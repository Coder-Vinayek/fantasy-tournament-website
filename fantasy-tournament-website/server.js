console.log("Server.js file is starting...");
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, initializeDatabase } = require('./database/init');

const app = express();
const PORT = 3001;

// Enhanced Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced session configuration
app.use(session({
    secret: 'fantasy-tournament-secret-key',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on each request
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true
    }
}));

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Enhanced requireAdmin middleware with proper JSON responses
function requireAdmin(req, res, next) {
    if (!req.session) {
        return res.status(403).json({ 
            error: 'No session found. Please login again.',
            code: 'NO_SESSION'
        });
    }
    
    if (!req.session.userId) {
        return res.status(403).json({ 
            error: 'Not logged in. Please login again.',
            code: 'NOT_LOGGED_IN'
        });
    }
    
    if (!req.session.isAdmin) {
        return res.status(403).json({ 
            error: 'Admin access required. Please login as admin.',
            code: 'NOT_ADMIN'
        });
    }
    
    next();
}

// Ban status check middleware
function checkBanStatus(req, res, next) {
    if (!req.session.userId) {
        return next();
    }
    
    db.get('SELECT ban_status, ban_expiry FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }
        
        // Check if temporarily banned and expired
        if (user.ban_status === 'temp_banned' && user.ban_expiry && new Date(user.ban_expiry) <= new Date()) {
            db.run(`UPDATE users 
                    SET ban_status = 'active', ban_expiry = NULL, ban_reason = NULL, 
                        banned_at = NULL, banned_by = NULL 
                    WHERE id = ?`, [req.session.userId], (err) => {
                if (err) console.error('Error updating expired ban:', err);
                next(); // Continue - ban has expired
            });
        } else if (user.ban_status === 'temp_banned' || user.ban_status === 'banned') {
            return res.status(403).json({ 
                error: 'Your account is banned. You can view the website but cannot perform this action.',
                banned: true,
                ban_status: user.ban_status
            });
        } else {
            next(); // Not banned, continue
        }
    });
}

// Routes - Serve HTML pages
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/tournaments');
    } else {
        res.sendFile(path.join(__dirname, 'views', 'index.html'));
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/tournaments', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'tournaments.html'));
});

app.get('/wallet', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'wallet.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/tournament/:id', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'tournament-lobby.html'));
});


// API Routes - Authentication
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username or email already exists' });
                }
                return res.status(500).json({ error: 'Registration failed' });
            }
            
            req.session.userId = this.lastID;
            req.session.username = username;
            req.session.isAdmin = false;
            res.json({ success: true, message: 'Registration successful' });
        }
    );
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Login failed' });
        }
        
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }
        
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = user.is_admin === 1;
        
        res.json({ 
            success: true, 
            message: 'Login successful',
            isAdmin: user.is_admin === 1
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// Admin session check route
app.get('/api/admin/session-check', (req, res) => {
    if (!req.session || !req.session.userId || !req.session.isAdmin) {
        return res.status(403).json({ 
            authenticated: false,
            isAdmin: false,
            error: 'Session expired or invalid',
            redirectTo: '/login'
        });
    }
    
    // Refresh admin info from database
    db.get('SELECT id, username, is_admin FROM users WHERE id = ? AND is_admin = 1', 
        [req.session.userId], (err, user) => {
            if (err || !user) {
                req.session.destroy();
                return res.status(403).json({ 
                    authenticated: false,
                    isAdmin: false,
                    error: 'Admin user not found',
                    redirectTo: '/login'
                });
            }
            
            // Refresh session data
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.isAdmin = user.is_admin === 1;
            
            res.json({ 
                authenticated: true,
                isAdmin: true,
                userId: user.id,
                username: user.username
            });
        });
});

// API Routes - User Info
app.get('/api/user', requireAuth, (req, res) => {
    db.get(`SELECT id, username, email, wallet_balance, winnings_balance,
                   ban_status, ban_expiry, ban_reason, banned_at
            FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to get user info' });
        }
        res.json(user);
    });
});

// API Routes - Tournaments
app.get('/api/tournaments', requireAuth, (req, res) => {
    db.all(`SELECT t.*, 
            CASE WHEN tr.user_id IS NOT NULL THEN 1 ELSE 0 END as is_registered
            FROM tournaments t 
            LEFT JOIN tournament_registrations tr ON t.id = tr.tournament_id AND tr.user_id = ?
            ORDER BY t.start_date ASC`, [req.session.userId], (err, tournaments) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to get tournaments' });
        }
        res.json(tournaments);
    });
});

app.post('/api/tournaments/register', requireAuth, checkBanStatus, (req, res) => {
    const { tournamentId } = req.body;
    
    // Get tournament and user info
    db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId], (err, tournament) => {
        if (err || !tournament) {
            return res.status(400).json({ error: 'Tournament not found' });
        }
        
        db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
            if (err || !user) {
                return res.status(400).json({ error: 'User not found' });
            }
            
            // Check if user has enough balance
            if (user.wallet_balance < tournament.entry_fee) {
                return res.status(400).json({ error: 'Insufficient wallet balance' });
            }
            
            // Check if tournament is full
            if (tournament.current_participants >= tournament.max_participants) {
                return res.status(400).json({ error: 'Tournament is full' });
            }
            
            // Register user and deduct fee
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                db.run('INSERT INTO tournament_registrations (user_id, tournament_id) VALUES (?, ?)',
                    [req.session.userId, tournamentId], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            if (err.message.includes('UNIQUE constraint failed')) {
                                return res.status(400).json({ error: 'Already registered for this tournament' });
                            }
                            return res.status(500).json({ error: 'Registration failed' });
                        }
                        
                        // Deduct entry fee from wallet
                        db.run('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?',
                            [tournament.entry_fee, req.session.userId], (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Payment failed' });
                                }
                                
                                // Update tournament participant count
                                db.run('UPDATE tournaments SET current_participants = current_participants + 1 WHERE id = ?',
                                    [tournamentId], (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return res.status(500).json({ error: 'Registration failed' });
                                        }
                                        
                                        // Record transaction
                                        db.run('INSERT INTO wallet_transactions (user_id, transaction_type, amount, balance_type, description) VALUES (?, ?, ?, ?, ?)',
                                            [req.session.userId, 'debit', tournament.entry_fee, 'wallet', `Tournament registration: ${tournament.name}`], (err) => {
                                                if (err) {
                                                    db.run('ROLLBACK');
                                                    return res.status(500).json({ error: 'Transaction recording failed' });
                                                }
                                                
                                                db.run('COMMIT');
                                                res.json({ success: true, message: 'Registration successful' });
                                            });
                                    });
                            });
                    });
            });
        });
    });
});

// API Routes - Wallet
app.post('/api/wallet/deposit', requireAuth, (req, res) => {
    const { amount } = req.body;
    const depositAmount = parseFloat(amount);
    
    if (!depositAmount || depositAmount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit amount' });
    }
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
            [depositAmount, req.session.userId], (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Deposit failed' });
                }
                
                db.run('INSERT INTO wallet_transactions (user_id, transaction_type, amount, balance_type, description) VALUES (?, ?, ?, ?, ?)',
                    [req.session.userId, 'credit', depositAmount, 'wallet', 'Wallet deposit'], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Transaction recording failed' });
                        }
                        
                        db.run('COMMIT');
                        res.json({ success: true, message: 'Deposit successful' });
                    });
            });
    });
});

app.post('/api/wallet/withdraw', requireAuth, checkBanStatus, (req, res) => {
    const { amount } = req.body;
    const withdrawAmount = parseFloat(amount);
    
    if (!withdrawAmount || withdrawAmount <= 0) {
        return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }
    
    db.get('SELECT winnings_balance FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'User not found' });
        }
        
        if (user.winnings_balance < withdrawAmount) {
            return res.status(400).json({ error: 'Insufficient winnings balance' });
        }
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            db.run('UPDATE users SET winnings_balance = winnings_balance - ? WHERE id = ?',
                [withdrawAmount, req.session.userId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Withdrawal failed' });
                    }
                    
                    db.run('INSERT INTO wallet_transactions (user_id, transaction_type, amount, balance_type, description) VALUES (?, ?, ?, ?, ?)',
                        [req.session.userId, 'debit', withdrawAmount, 'winnings', 'Winnings withdrawal'], (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Transaction recording failed' });
                            }
                            
                            db.run('COMMIT');
                            res.json({ success: true, message: 'Withdrawal successful' });
                        });
                });
        });
    });
});

app.get('/api/wallet/transactions', requireAuth, (req, res) => {
    db.all('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY transaction_date DESC',
        [req.session.userId], (err, transactions) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to get transactions' });
            }
            res.json(transactions);
        });
});

// Admin API Routes
app.get('/api/admin/users', requireAdmin, (req, res) => {
    db.all(`SELECT id, username, email, wallet_balance, winnings_balance, created_at,
                   ban_status, ban_expiry, ban_reason, banned_at, banned_by
            FROM users WHERE is_admin = 0`, (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to get users' });
        }
        res.json(users);
    });
});

app.post('/api/admin/tournaments', requireAdmin, (req, res) => {
    const { name, description, entry_fee, prize_pool, max_participants, start_date, end_date } = req.body;
    
    db.run('INSERT INTO tournaments (name, description, entry_fee, prize_pool, max_participants, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, description, entry_fee, prize_pool, max_participants, start_date, end_date],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create tournament' });
            }
            res.json({ success: true, message: 'Tournament created successfully' });
        });
});

app.get('/api/admin/tournaments', requireAdmin, (req, res) => {
    db.all('SELECT * FROM tournaments ORDER BY created_at DESC', (err, tournaments) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to get tournaments' });
        }
        res.json(tournaments);
    });
});

app.post('/api/admin/update-winnings', requireAdmin, (req, res) => {
    const { userId, amount } = req.body;
    const winningsAmount = parseFloat(amount);
    
    if (!winningsAmount || winningsAmount <= 0) {
        return res.status(400).json({ error: 'Invalid winnings amount' });
    }
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run('UPDATE users SET winnings_balance = winnings_balance + ? WHERE id = ?',
            [winningsAmount, userId], (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to update winnings' });
                }
                
                db.run('INSERT INTO wallet_transactions (user_id, transaction_type, amount, balance_type, description) VALUES (?, ?, ?, ?, ?)',
                    [userId, 'credit', winningsAmount, 'winnings', 'Prize winnings added by admin'], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Transaction recording failed' });
                        }
                        
                        db.run('COMMIT');
                        res.json({ success: true, message: 'Winnings updated successfully' });
                    });
            });
    });
});

// Delete Tournament API Route 
app.delete('/api/admin/tournaments/:id', requireAdmin, (req, res) => {
    const tournamentId = parseInt(req.params.id);
    
    if (!tournamentId || isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Invalid tournament ID' });
    }
    
    // Start transaction to handle all deletions
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // First, get tournament details for confirmation message
        db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId], (err, tournament) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('Error fetching tournament:', err);
                return res.status(500).json({ error: 'Database error while fetching tournament' });
            }
            
            if (!tournament) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: 'Tournament not found' });
            }
            
            // Delete tournament registrations first (foreign key constraint)
            db.run('DELETE FROM tournament_registrations WHERE tournament_id = ?', [tournamentId], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('Error deleting tournament registrations:', err);
                    return res.status(500).json({ error: 'Failed to delete tournament registrations' });
                }
                
                const registrationsDeleted = this.changes;
                
                // Delete the tournament itself
                db.run('DELETE FROM tournaments WHERE id = ?', [tournamentId], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('Error deleting tournament:', err);
                        return res.status(500).json({ error: 'Failed to delete tournament' });
                    }
                    
                    if (this.changes === 0) {
                        db.run('ROLLBACK');
                        return res.status(404).json({ error: 'Tournament not found or already deleted' });
                    }
                    
                    // Commit transaction
                    db.run('COMMIT', (err) => {
                        if (err) {
                            console.error('Error committing tournament deletion:', err);
                            return res.status(500).json({ error: 'Failed to commit deletion' });
                        }
                        
                        // Success response
                        res.json({ 
                            success: true, 
                            message: `Tournament "${tournament.name}" deleted successfully.`,
                            details: {
                                tournamentName: tournament.name,
                                registrationsDeleted: registrationsDeleted
                            }
                        });
                    });
                });
            });
        });
    });
});


// Ban User API Route
app.post('/api/admin/ban-user', requireAdmin, (req, res) => {
    const { userId, banType, banReason, banExpiry } = req.body;
    
    if (!userId || !banType || !banReason) {
        return res.status(400).json({ error: 'User ID, ban type, and reason are required' });
    }
    
    if (banType === 'temporary' && !banExpiry) {
        return res.status(400).json({ error: 'Expiry date is required for temporary bans' });
    }
    
    // Map frontend values to database values
    let dbBanStatus;
    if (banType === 'temporary') {
        dbBanStatus = 'temp_banned';
    } else if (banType === 'permanent') {
        dbBanStatus = 'banned';
    } else {
        return res.status(400).json({ error: 'Invalid ban type' });
    }
    
    const bannedAt = new Date().toISOString();
    const bannedBy = req.session.userId;
    
    const query = `UPDATE users 
                   SET ban_status = ?, ban_reason = ?, banned_at = ?, banned_by = ?, ban_expiry = ?
                   WHERE id = ? AND is_admin = 0`;
    
    const params = [dbBanStatus, banReason, bannedAt, bannedBy, banExpiry || null, userId];
    
    db.run(query, params, function(err) {
        if (err) {
            console.error('Ban user error:', err);
            return res.status(500).json({ 
                error: 'Failed to ban user',
                debug: {
                    message: err.message,
                    code: err.code
                }
            });
        }
        
        if (this.changes === 0) {
            return res.status(400).json({ error: 'User not found or is admin' });
        }
        
        res.json({ 
            success: true, 
            message: `User ${banType === 'permanent' ? 'permanently' : 'temporarily'} banned successfully` 
        });
    });
});

// Unban User API Route
app.post('/api/admin/unban-user', requireAdmin, (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    const query = `UPDATE users 
                   SET ban_status = 'active', ban_expiry = NULL, ban_reason = NULL, 
                       banned_at = NULL, banned_by = NULL
                   WHERE id = ? AND is_admin = 0`;
    
    db.run(query, [userId], function(err) {
        if (err) {
            console.error('Unban user error:', err);
            return res.status(500).json({ error: 'Failed to unban user' });
        }
        
        if (this.changes === 0) {
            return res.status(400).json({ error: 'User not found or is admin' });
        }
        
        res.json({ success: true, message: 'User unbanned successfully' });
    });
});

// Transactions API Routes 
app.get('/api/admin/transactions', requireAdmin, (req, res) => {
    db.all(`SELECT wt.*, u.username 
            FROM wallet_transactions wt 
            JOIN users u ON wt.user_id = u.id 
            WHERE wt.description LIKE '%admin%' 
            OR wt.description LIKE '%Prize winnings%'
            OR wt.description LIKE '%added by admin%'
            ORDER BY wt.transaction_date DESC`,
        (err, transactions) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to get admin transactions' });
            }
            res.json(transactions);
        });
});

// Analytics API Routes 
app.get('/api/admin/analytics', requireAdmin, (req, res) => {
    const analytics = {};
    
    // Get all analytics data in parallel
    Promise.all([
        // Total Users
        new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as total_users FROM users WHERE is_admin = 0', (err, row) => {
                if (err) reject(err);
                else resolve(row.total_users);
            });
        }),
        
        // Total Tournaments
        new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as total_tournaments FROM tournaments', (err, row) => {
                if (err) reject(err);
                else resolve(row.total_tournaments);
            });
        }),
        
        // Active Tournaments
        new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as active_tournaments FROM tournaments WHERE status = 'upcoming'", (err, row) => {
                if (err) reject(err);
                else resolve(row.active_tournaments);
            });
        }),
        
        // Total Revenue (all deposits)
        new Promise((resolve, reject) => {
            db.get("SELECT COALESCE(SUM(amount), 0) as total_revenue FROM wallet_transactions WHERE transaction_type = 'credit' AND balance_type = 'wallet'", (err, row) => {
                if (err) reject(err);
                else resolve(row.total_revenue);
            });
        }),
        
        // Total Withdrawals
        new Promise((resolve, reject) => {
            db.get("SELECT COALESCE(SUM(amount), 0) as total_withdrawals FROM wallet_transactions WHERE transaction_type = 'debit' AND balance_type = 'winnings'", (err, row) => {
                if (err) reject(err);
                else resolve(row.total_withdrawals);
            });
        }),
        
        // Tournament Entry Fees Collected
        new Promise((resolve, reject) => {
            db.get("SELECT COALESCE(SUM(amount), 0) as entry_fees FROM wallet_transactions WHERE description LIKE 'Tournament registration:%'", (err, row) => {
                if (err) reject(err);
                else resolve(row.entry_fees);
            });
        }),
        
        // Recent User Registrations (last 30 days)
        new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as recent_users FROM users WHERE created_at >= datetime('now', '-30 days') AND is_admin = 0", (err, row) => {
                if (err) reject(err);
                else resolve(row.recent_users);
            });
        }),
        
        // Most Popular Tournament
        new Promise((resolve, reject) => {
            db.get(`SELECT t.name, t.current_participants, t.max_participants 
                    FROM tournaments t 
                    ORDER BY t.current_participants DESC 
                    LIMIT 1`, (err, row) => {
                if (err) reject(err);
                else resolve(row || { name: 'No tournaments', current_participants: 0, max_participants: 0 });
            });
        }),
        
        // Transaction Trends (last 7 days) - Admin actions only
        new Promise((resolve, reject) => {
            db.all(`SELECT 
                        DATE(transaction_date) as date,
                        transaction_type,
                        COUNT(*) as count,
                        SUM(amount) as total_amount
                    FROM wallet_transactions 
                    WHERE transaction_date >= datetime('now', '-7 days')
                    AND (description LIKE '%admin%' OR description LIKE '%Prize winnings%')
                    GROUP BY DATE(transaction_date), transaction_type
                    ORDER BY date DESC`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        
        // Tournament Status Distribution
        new Promise((resolve, reject) => {
            db.all(`SELECT status, COUNT(*) as count FROM tournaments GROUP BY status`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        })
        
    ]).then(results => {
        analytics.totalUsers = results[0];
        analytics.totalTournaments = results[1];
        analytics.activeTournaments = results[2];
        analytics.totalRevenue = results[3];
        analytics.totalWithdrawals = results[4];
        analytics.entryFeesCollected = results[5];
        analytics.recentUsers = results[6];
        analytics.popularTournament = results[7];
        analytics.transactionTrends = results[8];
        analytics.tournamentStatus = results[9];
        
        analytics.totalProfit = analytics.totalRevenue - analytics.totalWithdrawals;
        
        res.json(analytics);
    }).catch(err => {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Failed to load analytics' });
    });
});

// Get tournament participants for specific tournament
app.get('/api/admin/tournament/:id/participants', requireAdmin, (req, res) => {
    const tournamentId = req.params.id;
    
    db.all(`SELECT 
                u.id, u.username, u.email, u.wallet_balance, u.winnings_balance,
                tr.registration_date,
                t.name as tournament_name
            FROM tournament_registrations tr
            JOIN users u ON tr.user_id = u.id
            JOIN tournaments t ON tr.tournament_id = t.id
            WHERE tr.tournament_id = ?
            ORDER BY tr.registration_date ASC`, [tournamentId], (err, participants) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to get tournament participants' });
        }
        res.json(participants);
    });
});


// Get Tournament Lobby Data
app.get('/api/tournament/:id/lobby', requireAuth, (req, res) => {
    const tournamentId = req.params.id;
    
    // First check if user is registered for this tournament
    db.get(`SELECT * FROM tournament_registrations 
            WHERE user_id = ? AND tournament_id = ?`, 
        [req.session.userId, tournamentId], (err, registration) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!registration) {
                return res.status(403).json({ error: 'You are not registered for this tournament' });
            }
            
            // Get tournament details
            db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId], (err, tournament) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to get tournament' });
                }
                
                if (!tournament) {
                    return res.status(404).json({ error: 'Tournament not found' });
                }
                
                // Get match details if exists
                db.get('SELECT * FROM tournament_match_details WHERE tournament_id = ?', 
                    [tournamentId], (err, matchDetails) => {
                        // Don't fail if no match details exist
                        if (err) {
                            console.error('Error getting match details:', err);
                        }
                        
                        res.json({
                            tournament: tournament,
                            matchDetails: matchDetails || null,
                            onlineCount: tournament.current_participants // Simplified for now
                        });
                    });
            });
        });
});

// Get Tournament Chat Messages
app.get('/api/tournament/:id/chat', requireAuth, (req, res) => {
    const tournamentId = req.params.id;
    
    // Check if user is admin OR registered for this tournament
    if (req.session.isAdmin) {
        // Admin can access any tournament's chat
        db.all(`SELECT cm.*, u.username, u.is_admin 
                FROM tournament_chat_messages cm
                JOIN users u ON cm.user_id = u.id
                WHERE cm.tournament_id = ?
                ORDER BY cm.created_at ASC
                LIMIT 100`, [tournamentId], (err, messages) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to get messages' });
            }
            res.json(messages);
        });
    } else {
        // Regular user - check if registered for this tournament
        db.get(`SELECT * FROM tournament_registrations 
                WHERE user_id = ? AND tournament_id = ?`, 
            [req.session.userId, tournamentId], (err, registration) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (!registration) {
                    return res.status(403).json({ error: 'Access denied' });
                }
                
                // User is registered - get chat messages
                db.all(`SELECT cm.*, u.username, u.is_admin 
                        FROM tournament_chat_messages cm
                        JOIN users u ON cm.user_id = u.id
                        WHERE cm.tournament_id = ?
                        ORDER BY cm.created_at ASC
                        LIMIT 100`, [tournamentId], (err, messages) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to get messages' });
                    }
                    res.json(messages);
                });
            });
    }
});

// Send Chat Message
app.post('/api/tournament/:id/chat', requireAuth, checkBanStatus, (req, res) => {
    const tournamentId = req.params.id;
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    if (message.length > 200) {
        return res.status(400).json({ error: 'Message too long (max 200 characters)' });
    }
    
    // Check if user is registered for this tournament
    db.get(`SELECT * FROM tournament_registrations 
            WHERE user_id = ? AND tournament_id = ?`, 
        [req.session.userId, tournamentId], (err, registration) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!registration) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Insert chat message
            db.run(`INSERT INTO tournament_chat_messages (tournament_id, user_id, message) 
                    VALUES (?, ?, ?)`, 
                [tournamentId, req.session.userId, message.trim()], function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to send message' });
                    }
                    
                    res.json({ success: true, message: 'Message sent successfully' });
                });
        });
});

// Get Tournament Players
app.get('/api/tournament/:id/players', requireAuth, (req, res) => {
    const tournamentId = req.params.id;
    
    // Check if user is registered for this tournament
    db.get(`SELECT * FROM tournament_registrations 
            WHERE user_id = ? AND tournament_id = ?`, 
        [req.session.userId, tournamentId], (err, registration) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!registration) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Get all players for this tournament
            db.all(`SELECT u.id, u.username, u.wallet_balance, u.winnings_balance, 
                           u.is_admin, tr.registration_date,
                           CASE WHEN u.id = ? THEN 1 ELSE 0 END as is_online
                    FROM tournament_registrations tr
                    JOIN users u ON tr.user_id = u.id
                    WHERE tr.tournament_id = ?
                    ORDER BY tr.registration_date ASC`, 
                [req.session.userId, tournamentId], (err, players) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to get players' });
                    }
                    
                    res.json(players);
                });
        });
});

// Get Tournament Announcements
app.get('/api/tournament/:id/announcements', requireAuth, (req, res) => {
    const tournamentId = req.params.id;
    
    // Check if user is admin OR registered for this tournament
    if (req.session.isAdmin) {
        // Admin can access any tournament's announcements
        db.all(`SELECT * FROM tournament_announcements 
                WHERE tournament_id = ?
                ORDER BY created_at DESC
                LIMIT 20`, [tournamentId], (err, announcements) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to get announcements' });
            }
            res.json(announcements);
        });
    } else {
        // Regular user - check if registered for this tournament
        db.get(`SELECT * FROM tournament_registrations 
                WHERE user_id = ? AND tournament_id = ?`, 
            [req.session.userId, tournamentId], (err, registration) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (!registration) {
                    return res.status(403).json({ error: 'Access denied' });
                }
                
                // User is registered - get announcements
                db.all(`SELECT * FROM tournament_announcements 
                        WHERE tournament_id = ?
                        ORDER BY created_at DESC
                        LIMIT 20`, [tournamentId], (err, announcements) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to get announcements' });
                    }
                    res.json(announcements);
                });
            });
    }
});

// Admin: Post Tournament Announcement
app.post('/api/admin/tournament/:id/announce', requireAdmin, (req, res) => {
    const tournamentId = req.params.id;
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Announcement cannot be empty' });
    }
    
    if (message.length > 500) {
        return res.status(400).json({ error: 'Announcement too long (max 500 characters)' });
    }
    
    db.run(`INSERT INTO tournament_announcements (tournament_id, admin_id, message) 
            VALUES (?, ?, ?)`, 
        [tournamentId, req.session.userId, message.trim()], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to post announcement' });
            }
            
            res.json({ success: true, message: 'Announcement posted successfully' });
        });
});

// Admin: Update Tournament Match Details
app.post('/api/admin/tournament/:id/match-details', requireAdmin, (req, res) => {
    const tournamentId = req.params.id;
    const { room_id, room_password, match_start_time, game_server } = req.body;
    
    // Insert or update match details
    db.run(`INSERT OR REPLACE INTO tournament_match_details 
            (tournament_id, room_id, room_password, match_start_time, game_server, updated_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`, 
        [tournamentId, room_id, room_password, match_start_time, game_server, req.session.userId], 
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update match details' });
            }
            
            res.json({ success: true, message: 'Match details updated successfully' });
        });
});

// Get Tournament Management Data
app.get('/api/admin/tournament/:id/manage', requireAdmin, (req, res) => {
    const tournamentId = req.params.id;
    
    // Get tournament details
    db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId], (err, tournament) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to get tournament' });
        }
        
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }
        
        // Get match details if exists
        db.get('SELECT * FROM tournament_match_details WHERE tournament_id = ?', 
            [tournamentId], (err, matchDetails) => {
                // Don't fail if no match details exist
                if (err) {
                    console.error('Error getting match details:', err);
                }
                
                res.json({
                    tournament: tournament,
                    matchDetails: matchDetails || null
                });
            });
    });
});

// Update Tournament Status
app.post('/api/admin/tournament/:id/status', requireAdmin, (req, res) => {
    const tournamentId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['upcoming', 'active', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    
    db.run('UPDATE tournaments SET status = ? WHERE id = ?', 
        [status, tournamentId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update tournament status' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Tournament not found' });
            }
            
            res.json({ success: true, message: 'Tournament status updated successfully' });
        });
});

// Send Bulk Message to Tournament Participants
app.post('/api/admin/tournament/:id/bulk-message', requireAdmin, (req, res) => {
    const tournamentId = req.params.id;
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    if (message.length > 200) {
        return res.status(400).json({ error: 'Message too long (max 200 characters)' });
    }
    
    // Insert message as admin in tournament chat
    db.run(`INSERT INTO tournament_chat_messages (tournament_id, user_id, message) 
            VALUES (?, ?, ?)`, 
        [tournamentId, req.session.userId, `[ADMIN BROADCAST] ${message.trim()}`], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to send bulk message' });
            }
            
            res.json({ success: true, message: 'Bulk message sent successfully' });
        });
});

// Export Tournament Participants
app.get('/api/admin/tournament/:id/export-participants', requireAdmin, (req, res) => {
    const tournamentId = req.params.id;
    
    db.all(`SELECT 
                u.id, u.username, u.email, u.wallet_balance, u.winnings_balance,
                tr.registration_date,
                t.name as tournament_name
            FROM tournament_registrations tr
            JOIN users u ON tr.user_id = u.id
            JOIN tournaments t ON tr.tournament_id = t.id
            WHERE tr.tournament_id = ?
            ORDER BY tr.registration_date ASC`, [tournamentId], (err, participants) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to export participants' });
        }
        
        // Format data for export
        const exportData = {
            tournament_name: participants.length > 0 ? participants[0].tournament_name : 'Unknown',
            export_date: new Date().toISOString(),
            total_participants: participants.length,
            participants: participants.map(p => ({
                id: p.id,
                username: p.username,
                email: p.email,
                wallet_balance: p.wallet_balance,
                winnings_balance: p.winnings_balance,
                registration_date: p.registration_date
            }))
        };
        
        res.json(exportData);
    });
});

// Start server
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Fantasy Tournament Server running on http://localhost:${PORT}`);
        console.log('Admin credentials: username=admin, password=admin123');
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
});

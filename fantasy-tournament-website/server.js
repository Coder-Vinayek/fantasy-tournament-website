console.log("Server.js file is starting...");

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config();

// Import Supabase client
const { supabase } = require('./database/supabase');

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fantasy-tournament-secret-key',
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
async function checkBanStatus(req, res, next) {
    if (!req.session.userId) {
        return next();
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('ban_status, ban_expiry')
            .eq('id', req.session.userId)
            .single();

        if (error) {
            console.error('Error checking user ban status:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Check if temporarily banned and expired
        if (user.ban_status === 'temp_banned' && user.ban_expiry && new Date(user.ban_expiry) <= new Date()) {
            // Update user to remove expired ban
            await supabase
                .from('users')
                .update({
                    ban_status: 'active',
                    ban_expiry: null,
                    ban_reason: null,
                    banned_at: null,
                    banned_by: null
                })
                .eq('id', req.session.userId);
            
            next(); // Continue - ban has expired
        } else if (user.ban_status === 'temp_banned' || user.ban_status === 'banned') {
            return res.status(403).json({
                error: 'Your account is banned. You can view the website but cannot perform this action.',
                banned: true,
                ban_status: user.ban_status
            });
        } else {
            next(); // Not banned, continue
        }
    } catch (error) {
        console.error('Error in ban status check:', error);
        return res.status(500).json({ error: 'Database error' });
    }
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
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        
        const { data, error } = await supabase
            .from('users')
            .insert([{
                username,
                email,
                password: hashedPassword,
                wallet_balance: 0,
                winnings_balance: 0,
                is_admin: false
            }])
            .select()
            .single();

        if (error) {
            console.error('Registration error:', error);
            if (error.code === '23505') { // Unique constraint violation
                return res.status(400).json({ error: 'Username or email already exists' });
            }
            return res.status(500).json({ error: 'Registration failed' });
        }

        req.session.userId = data.id;
        req.session.username = username;
        req.session.isAdmin = false;

        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user || !bcrypt.compareSync(password, user.password)) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = user.is_admin;

        res.json({
            success: true,
            message: 'Login successful',
            isAdmin: user.is_admin
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Login failed' });
    }
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
app.get('/api/admin/session-check', async (req, res) => {
    if (!req.session || !req.session.userId || !req.session.isAdmin) {
        return res.status(403).json({
            authenticated: false,
            isAdmin: false,
            error: 'Session expired or invalid',
            redirectTo: '/login'
        });
    }

    try {
        // Refresh admin info from database
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, is_admin')
            .eq('id', req.session.userId)
            .eq('is_admin', true)
            .single();

        if (error || !user) {
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
        req.session.isAdmin = user.is_admin;

        res.json({
            authenticated: true,
            isAdmin: true,
            userId: user.id,
            username: user.username
        });
    } catch (error) {
        console.error('Session check error:', error);
        return res.status(500).json({
            authenticated: false,
            isAdmin: false,
            error: 'Database error',
            redirectTo: '/login'
        });
    }
});

function getGameImageUrl(gameType) {
    const gameImages = {
        'Free Fire': '/images/games/freefire.jpg',
        'BGMI': '/images/games/bgmi.jpg',
        'Valorant': '/images/games/valorant.jpg',
        'CODM': '/images/games/codm.jpg'
    };
    return gameImages[gameType] || '/images/games/freefire.jpg';
}

// API Routes - User Info
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, email, wallet_balance, winnings_balance, ban_status, ban_expiry, ban_reason, banned_at')
            .eq('id', req.session.userId)
            .single();

        if (error) {
            console.error('Get user error:', error);
            return res.status(500).json({ error: 'Failed to get user info' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        return res.status(500).json({ error: 'Failed to get user info' });
    }
});

// API Routes - Tournaments
app.get('/api/tournaments', requireAuth, async (req, res) => {
    try {
        console.log('Loading tournaments for user:', req.session.userId);
        
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select(`
                *,
                tournament_registrations!left(user_id)
            `)
            .order('start_date', { ascending: true });

        if (error) {
            console.error('Get tournaments error:', error);
            return res.status(500).json({ error: 'Failed to get tournaments' });
        }

        // FIXED: Add game data to each tournament
        const tournamentsWithRegistration = tournaments.map(tournament => {
            const gameType = tournament.game_type || 'Free Fire';
            const teamMode = tournament.team_mode || 'solo';
            const gameImageUrl = tournament.game_image_url || getGameImageUrl(gameType);

            return {
                ...tournament,
                game_type: gameType,
                team_mode: teamMode,
                game_image_url: gameImageUrl,
                is_registered: tournament.tournament_registrations.some(reg => reg.user_id === req.session.userId) ? 1 : 0
            };
        });

        console.log('Processed tournaments:', tournamentsWithRegistration.length);
        res.json(tournamentsWithRegistration);

    } catch (error) {
        console.error('Get tournaments error:', error);
        res.status(500).json({ error: 'Failed to get tournaments' });
    }
});

app.post('/api/tournaments/register', requireAuth, checkBanStatus, async (req, res) => {
    const { tournamentId } = req.body;

    try {
        // Start a transaction-like operation
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return res.status(400).json({ error: 'Tournament not found' });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.session.userId)
            .single();

        if (userError || !user) {
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

        // Check if already registered
        const { data: existingReg, error: regCheckError } = await supabase
            .from('tournament_registrations')
            .select('id')
            .eq('user_id', req.session.userId)
            .eq('tournament_id', tournamentId)
            .single();

        if (existingReg) {
            return res.status(400).json({ error: 'Already registered for this tournament' });
        }

        // Register user for tournament
        const { error: registrationError } = await supabase
            .from('tournament_registrations')
            .insert([{
                user_id: req.session.userId,
                tournament_id: tournamentId
            }]);

        if (registrationError) {
            console.error('Registration error:', registrationError);
            return res.status(500).json({ error: 'Registration failed' });
        }

        // Deduct entry fee from wallet
        const { error: balanceError } = await supabase
            .from('users')
            .update({
                wallet_balance: user.wallet_balance - tournament.entry_fee
            })
            .eq('id', req.session.userId);

        if (balanceError) {
            console.error('Balance update error:', balanceError);
            return res.status(500).json({ error: 'Payment failed' });
        }

        // Update tournament participant count
        const { error: tournamentUpdateError } = await supabase
            .from('tournaments')
            .update({
                current_participants: tournament.current_participants + 1
            })
            .eq('id', tournamentId);

        if (tournamentUpdateError) {
            console.error('Tournament update error:', tournamentUpdateError);
            return res.status(500).json({ error: 'Registration failed' });
        }

        // Record transaction
        const { error: transactionError } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: req.session.userId,
                transaction_type: 'debit',
                amount: tournament.entry_fee,
                balance_type: 'wallet',
                description: `Tournament registration: ${tournament.name}`
            }]);

        if (transactionError) {
            console.error('Transaction error:', transactionError);
            return res.status(500).json({ error: 'Transaction recording failed' });
        }

        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Tournament registration error:', error);
        return res.status(500).json({ error: 'Registration failed' });
    }
});

// API Routes - Wallet
app.post('/api/wallet/deposit', requireAuth, async (req, res) => {
    const { amount } = req.body;
    const depositAmount = parseFloat(amount);

    if (!depositAmount || depositAmount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit amount' });
    }

    try {
        // Get current balance
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance')
            .eq('id', req.session.userId)
            .single();

        if (userError || !user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Update wallet balance
        const { error: updateError } = await supabase
            .from('users')
            .update({
                wallet_balance: user.wallet_balance + depositAmount
            })
            .eq('id', req.session.userId);

        if (updateError) {
            console.error('Deposit error:', updateError);
            return res.status(500).json({ error: 'Deposit failed' });
        }

        // Record transaction
        const { error: transactionError } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: req.session.userId,
                transaction_type: 'credit',
                amount: depositAmount,
                balance_type: 'wallet',
                description: 'Wallet deposit'
            }]);

        if (transactionError) {
            console.error('Transaction error:', transactionError);
            return res.status(500).json({ error: 'Transaction recording failed' });
        }

        res.json({ success: true, message: 'Deposit successful' });
    } catch (error) {
        console.error('Wallet deposit error:', error);
        return res.status(500).json({ error: 'Deposit failed' });
    }
});

app.post('/api/wallet/withdraw', requireAuth, checkBanStatus, async (req, res) => {
    const { amount } = req.body;
    const withdrawAmount = parseFloat(amount);

    if (!withdrawAmount || withdrawAmount <= 0) {
        return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('winnings_balance')
            .eq('id', req.session.userId)
            .single();

        if (userError || !user) {
            return res.status(400).json({ error: 'User not found' });
        }

        if (user.winnings_balance < withdrawAmount) {
            return res.status(400).json({ error: 'Insufficient winnings balance' });
        }

        // Update winnings balance
        const { error: updateError } = await supabase
            .from('users')
            .update({
                winnings_balance: user.winnings_balance - withdrawAmount
            })
            .eq('id', req.session.userId);

        if (updateError) {
            console.error('Withdrawal error:', updateError);
            return res.status(500).json({ error: 'Withdrawal failed' });
        }

        // Record transaction
        const { error: transactionError } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: req.session.userId,
                transaction_type: 'debit',
                amount: withdrawAmount,
                balance_type: 'winnings',
                description: 'Winnings withdrawal'
            }]);

        if (transactionError) {
            console.error('Transaction error:', transactionError);
            return res.status(500).json({ error: 'Transaction recording failed' });
        }

        res.json({ success: true, message: 'Withdrawal successful' });
    } catch (error) {
        console.error('Wallet withdrawal error:', error);
        return res.status(500).json({ error: 'Withdrawal failed' });
    }
});

app.get('/api/wallet/transactions', requireAuth, async (req, res) => {
    try {
        const { data: transactions, error } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('user_id', req.session.userId)
            .order('transaction_date', { ascending: false });

        if (error) {
            console.error('Get transactions error:', error);
            return res.status(500).json({ error: 'Failed to get transactions' });
        }

        res.json(transactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        return res.status(500).json({ error: 'Failed to get transactions' });
    }
});

// ====================================
// ADMIN API ROUTES - COMPLETE SET
// ====================================

// Analytics API Route
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
    try {
        const analytics = {};

        // Get total users
        const { count: totalUsers, error: usersError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('is_admin', false);

        if (usersError) throw usersError;
        analytics.totalUsers = totalUsers || 0;

        // Get total tournaments
        const { count: totalTournaments, error: tournamentsError } = await supabase
            .from('tournaments')
            .select('*', { count: 'exact', head: true });

        if (tournamentsError) throw tournamentsError;
        analytics.totalTournaments = totalTournaments || 0;

        // Get active tournaments
        const { count: activeTournaments, error: activeError } = await supabase
            .from('tournaments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'upcoming');

        if (activeError) throw activeError;
        analytics.activeTournaments = activeTournaments || 0;

        // Get total revenue (wallet deposits)
        const { data: revenueData, error: revenueError } = await supabase
            .from('wallet_transactions')
            .select('amount')
            .eq('transaction_type', 'credit')
            .eq('balance_type', 'wallet');

        if (revenueError) throw revenueError;
        analytics.totalRevenue = revenueData.reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // Get total withdrawals
        const { data: withdrawalData, error: withdrawalError } = await supabase
            .from('wallet_transactions')
            .select('amount')
            .eq('transaction_type', 'debit')
            .eq('balance_type', 'winnings');

        if (withdrawalError) throw withdrawalError;
        analytics.totalWithdrawals = withdrawalData.reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // Get entry fees collected
        const { data: entryFeeData, error: entryFeeError } = await supabase
            .from('wallet_transactions')
            .select('amount')
            .ilike('description', '%Tournament registration:%');

        if (entryFeeError) throw entryFeeError;
        analytics.entryFeesCollected = entryFeeData.reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // Calculate total profit
        analytics.totalProfit = analytics.totalRevenue - analytics.totalWithdrawals;

        // Recent users (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { count: recentUsers, error: recentError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('is_admin', false)
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (recentError) throw recentError;
        analytics.recentUsers = recentUsers || 0;

        // Most popular tournament
        const { data: popularTournament, error: popularError } = await supabase
            .from('tournaments')
            .select('name, current_participants, max_participants')
            .order('current_participants', { ascending: false })
            .limit(1)
            .single();

        if (popularError && popularError.code !== 'PGRST116') throw popularError;
        analytics.popularTournament = popularTournament || { 
            name: 'No tournaments', 
            current_participants: 0, 
            max_participants: 0 
        };

        // Tournament status distribution
        const { data: tournaments, error: allTournError } = await supabase
            .from('tournaments')
            .select('status');
        
        if (!allTournError) {
            const statusCounts = {};
            tournaments.forEach(t => {
                statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
            });
            analytics.tournamentStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
        } else {
            analytics.tournamentStatus = [];
        }

        // Transaction trends (simplified)
        analytics.transactionTrends = [];

        res.json(analytics);
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});

// Admin Users Route
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, email, wallet_balance, winnings_balance, created_at, ban_status, ban_expiry, ban_reason, banned_at, banned_by')
            .eq('is_admin', false);

        if (error) {
            console.error('Get admin users error:', error);
            return res.status(500).json({ error: 'Failed to get users' });
        }

        res.json(users);
    } catch (error) {
        console.error('Get admin users error:', error);
        return res.status(500).json({ error: 'Failed to get users' });
    }
});

// Admin Tournaments Routes
app.get('/api/admin/tournaments', requireAdmin, async (req, res) => {
    try {
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Get admin tournaments error:', error);
            return res.status(500).json({ error: 'Failed to get tournaments' });
        }

        res.json(tournaments);
    } catch (error) {
        console.error('Get admin tournaments error:', error);
        return res.status(500).json({ error: 'Failed to get tournaments' });
    }
});

// Delete Tournament Route
app.delete('/api/admin/tournaments/:id', requireAdmin, async (req, res) => {
    const tournamentId = parseInt(req.params.id);

    if (!tournamentId || isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    try {
        // Get tournament details first
        const { data: tournament, error: getError } = await supabase
            .from('tournaments')
            .select('name')
            .eq('id', tournamentId)
            .single();

        if (getError || !tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        // Delete tournament registrations first (due to foreign key constraints)
        const { error: regError } = await supabase
            .from('tournament_registrations')
            .delete()
            .eq('tournament_id', tournamentId);

        if (regError) {
            console.error('Error deleting registrations:', regError);
            return res.status(500).json({ error: 'Failed to delete tournament registrations' });
        }

        // Delete the tournament
        const { error: deleteError } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', tournamentId);

        if (deleteError) {
            console.error('Error deleting tournament:', deleteError);
            return res.status(500).json({ error: 'Failed to delete tournament' });
        }

        res.json({
            success: true,
            message: `Tournament "${tournament.name}" deleted successfully.`
        });
    } catch (error) {
        console.error('Delete tournament error:', error);
        return res.status(500).json({ error: 'Failed to delete tournament' });
    }
});

// Tournament Participants Route
app.get('/api/admin/tournament/:id/participants', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        const { data: participants, error } = await supabase
            .from('tournament_registrations')
            .select(`
                id,
                registration_date,
                users!inner(id, username, email, wallet_balance, winnings_balance),
                tournaments!inner(name)
            `)
            .eq('tournament_id', tournamentId)
            .order('registration_date', { ascending: true });

        if (error) {
            console.error('Get participants error:', error);
            return res.status(500).json({ error: 'Failed to get tournament participants' });
        }

        // Transform data to match expected format
        const transformedParticipants = participants.map(p => ({
            id: p.users.id,
            username: p.users.username,
            email: p.users.email,
            wallet_balance: p.users.wallet_balance,
            winnings_balance: p.users.winnings_balance,
            registration_date: p.registration_date,
            tournament_name: p.tournaments.name
        }));

        res.json(transformedParticipants);
    } catch (error) {
        console.error('Get participants error:', error);
        return res.status(500).json({ error: 'Failed to get tournament participants' });
    }
});

// Update Winnings Route
app.post('/api/admin/update-winnings', requireAdmin, async (req, res) => {
    const { userId, amount } = req.body;
    const winningsAmount = parseFloat(amount);

    if (!winningsAmount || winningsAmount <= 0) {
        return res.status(400).json({ error: 'Invalid winnings amount' });
    }

    try {
        // Get current winnings balance
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('winnings_balance')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Update winnings balance
        const { error: updateError } = await supabase
            .from('users')
            .update({
                winnings_balance: user.winnings_balance + winningsAmount
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Update winnings error:', updateError);
            return res.status(500).json({ error: 'Failed to update winnings' });
        }

        // Record transaction
        const { error: transactionError } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: userId,
                transaction_type: 'credit',
                amount: winningsAmount,
                balance_type: 'winnings',
                description: 'Prize winnings added by admin'
            }]);

        if (transactionError) {
            console.error('Transaction error:', transactionError);
            return res.status(500).json({ error: 'Transaction recording failed' });
        }

        res.json({ success: true, message: 'Winnings updated successfully' });
    } catch (error) {
        console.error('Update winnings error:', error);
        return res.status(500).json({ error: 'Failed to update winnings' });
    }
});

// Admin Transactions Route
app.get('/api/admin/transactions', requireAdmin, async (req, res) => {
    try {
        const { data: transactions, error } = await supabase
            .from('wallet_transactions')
            .select(`
                *,
                users!inner(username)
            `)
            .or('description.ilike.%admin%,description.ilike.%Prize winnings%,description.ilike.%added by admin%')
            .order('transaction_date', { ascending: false });

        if (error) {
            console.error('Get transactions error:', error);
            return res.status(500).json({ error: 'Failed to get admin transactions' });
        }

        // Transform data to match expected format
        const transformedTransactions = transactions.map(t => ({
            ...t,
            username: t.users.username
        }));

        res.json(transformedTransactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        return res.status(500).json({ error: 'Failed to get admin transactions' });
    }
});

// Ban User Route
app.post('/api/admin/ban-user', requireAdmin, async (req, res) => {
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

    try {
        const { data, error } = await supabase
            .from('users')
            .update({
                ban_status: dbBanStatus,
                ban_reason: banReason,
                banned_at: new Date().toISOString(),
                banned_by: req.session.userId,
                ban_expiry: banExpiry || null
            })
            .eq('id', userId)
            .eq('is_admin', false)
            .select();

        if (error) {
            console.error('Ban user error:', error);
            return res.status(500).json({ error: 'Failed to ban user' });
        }

        if (!data || data.length === 0) {
            return res.status(400).json({ error: 'User not found or is admin' });
        }

        res.json({
            success: true,
            message: `User ${banType === 'permanent' ? 'permanently' : 'temporarily'} banned successfully`
        });
    } catch (error) {
        console.error('Ban user error:', error);
        return res.status(500).json({ error: 'Failed to ban user' });
    }
});

// Unban User Route
app.post('/api/admin/unban-user', requireAdmin, async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .update({
                ban_status: 'active',
                ban_expiry: null,
                ban_reason: null,
                banned_at: null,
                banned_by: null
            })
            .eq('id', userId)
            .eq('is_admin', false)
            .select();

        if (error) {
            console.error('Unban user error:', error);
            return res.status(500).json({ error: 'Failed to unban user' });
        }

        if (!data || data.length === 0) {
            return res.status(400).json({ error: 'User not found or is admin' });
        }

        res.json({ success: true, message: 'User unbanned successfully' });
    } catch (error) {
        console.error('Unban user error:', error);
        return res.status(500).json({ error: 'Failed to unban user' });
    }
});

// Tournament Management Routes
app.get('/api/admin/tournament/:id/manage', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        // Get tournament details
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        // Get match details if exists
        const { data: matchDetails, error: matchError } = await supabase
            .from('tournament_match_details')
            .select('*')
            .eq('tournament_id', tournamentId)
            .single();

        // Don't fail if no match details exist
        res.json({
            tournament: tournament,
            matchDetails: matchDetails || null
        });
    } catch (error) {
        console.error('Get tournament management error:', error);
        return res.status(500).json({ error: 'Failed to get tournament' });
    }
});

// Update Match Details Route
app.post('/api/admin/tournament/:id/match-details', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;
    const { room_id, room_password, match_start_time, game_server } = req.body;

    try {
        const { data, error } = await supabase
            .from('tournament_match_details')
            .upsert({
                tournament_id: tournamentId,
                room_id: room_id,
                room_password: room_password,
                match_start_time: match_start_time,
                game_server: game_server,
                updated_by: req.session.userId,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'tournament_id'
            });

        if (error) {
            console.error('Update match details error:', error);
            return res.status(500).json({ error: 'Failed to update match details' });
        }

        res.json({ success: true, message: 'Match details updated successfully' });
    } catch (error) {
        console.error('Update match details error:', error);
        return res.status(500).json({ error: 'Failed to update match details' });
    }
});

// Post Tournament Announcement Route
app.post('/api/admin/tournament/:id/announce', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Announcement cannot be empty' });
    }

    if (message.length > 500) {
        return res.status(400).json({ error: 'Announcement too long (max 500 characters)' });
    }

    try {
        const { data, error } = await supabase
            .from('tournament_announcements')
            .insert([{
                tournament_id: tournamentId,
                admin_id: req.session.userId,
                message: message.trim()
            }]);

        if (error) {
            console.error('Post announcement error:', error);
            return res.status(500).json({ error: 'Failed to post announcement' });
        }

        res.json({ success: true, message: 'Announcement posted successfully' });
    } catch (error) {
        console.error('Post announcement error:', error);
        return res.status(500).json({ error: 'Failed to post announcement' });
    }
});

// Update Tournament Status Route
app.post('/api/admin/tournament/:id/status', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;
    const { status } = req.body;

    if (!status || !['upcoming', 'active', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const { data, error } = await supabase
            .from('tournaments')
            .update({ status: status })
            .eq('id', tournamentId)
            .select();

        if (error) {
            console.error('Update tournament status error:', error);
            return res.status(500).json({ error: 'Failed to update tournament status' });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        res.json({ success: true, message: 'Tournament status updated successfully' });
    } catch (error) {
        console.error('Update tournament status error:', error);
        return res.status(500).json({ error: 'Failed to update tournament status' });
    }
});

// Export Participants Route
app.get('/api/admin/tournament/:id/export-participants', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        const { data: participants, error } = await supabase
            .from('tournament_registrations')
            .select(`
                id,
                registration_date,
                users!inner(id, username, email, wallet_balance, winnings_balance),
                tournaments!inner(name)
            `)
            .eq('tournament_id', tournamentId)
            .order('registration_date', { ascending: true });

        if (error) {
            console.error('Export participants error:', error);
            return res.status(500).json({ error: 'Failed to export participants' });
        }

        // Format data for export
        const exportData = {
            tournament_name: participants.length > 0 ? participants[0].tournaments.name : 'Unknown',
            export_date: new Date().toISOString(),
            total_participants: participants.length,
            participants: participants.map(p => ({
                id: p.users.id,
                username: p.users.username,
                email: p.users.email,
                wallet_balance: p.users.wallet_balance,
                winnings_balance: p.users.winnings_balance,
                registration_date: p.registration_date
            }))
        };

        res.json(exportData);
    } catch (error) {
        console.error('Export participants error:', error);
        return res.status(500).json({ error: 'Failed to export participants' });
    }
});

// Send Bulk Message Route
app.post('/api/admin/tournament/:id/bulk-message', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 200) {
        return res.status(400).json({ error: 'Message too long (max 200 characters)' });
    }

    try {
        // Insert message as admin in tournament chat
        const { data, error } = await supabase
            .from('tournament_chat_messages')
            .insert([{
                tournament_id: tournamentId,
                user_id: req.session.userId,
                message: `[ADMIN BROADCAST] ${message.trim()}`
            }]);

        if (error) {
            console.error('Bulk message error:', error);
            return res.status(500).json({ error: 'Failed to send bulk message' });
        }

        res.json({ success: true, message: 'Bulk message sent successfully' });
    } catch (error) {
        console.error('Bulk message error:', error);
        return res.status(500).json({ error: 'Failed to send bulk message' });
    }
});

// Tournament Announcements Route (for users/admins)
app.get('/api/tournament/:id/announcements', requireAuth, async (req, res) => {
    const tournamentId = req.params.id;
    
    try {
        // FIXED: Check if user is admin OR registered for this tournament
        if (!req.session.isAdmin) {
            const { data: registration, error: regError } = await supabase
                .from('tournament_registrations')
                .select('id')
                .eq('tournament_id', tournamentId)
                .eq('user_id', req.session.userId)
                .single();

            if (regError || !registration) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const { data: announcements, error } = await supabase
            .from('tournament_announcements')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Get announcements error:', error);
            return res.status(500).json({ error: 'Failed to get announcements' });
        }

        res.json(announcements);

    } catch (error) {
        console.error('Get announcements error:', error);
        return res.status(500).json({ error: 'Failed to get announcements' });
    }
});

// Tournament Chat Route (for users/admins)
app.get('/api/tournament/:id/chat', requireAuth, async (req, res) => {
    const tournamentId = req.params.id;
    
    try {
        // FIXED: Check if user is admin OR registered for this tournament
        if (!req.session.isAdmin) {
            const { data: registration, error: regError } = await supabase
                .from('tournament_registrations')
                .select('id')
                .eq('tournament_id', tournamentId)
                .eq('user_id', req.session.userId)
                .single();

            if (regError || !registration) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const { data: messages, error } = await supabase
            .from('tournament_chat_messages')
            .select(`
                *,
                users!inner(username, is_admin)
            `)
            .eq('tournament_id', tournamentId)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) {
            console.error('Get chat messages error:', error);
            return res.status(500).json({ error: 'Failed to get messages' });
        }

        // Transform data to match expected format
        const transformedMessages = messages.map(m => ({
            ...m,
            username: m.users.username,
            is_admin: m.users.is_admin
        }));

        res.json(transformedMessages);

    } catch (error) {
        console.error('Get chat messages error:', error);
        return res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Send Chat Message Route
app.post('/api/tournament/:id/chat', requireAuth, checkBanStatus, async (req, res) => {
    const tournamentId = req.params.id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 200) {
        return res.status(400).json({ error: 'Message too long (max 200 characters)' });
    }

    try {
        // FIXED: Check if user is admin OR registered for this tournament
        if (!req.session.isAdmin) {
            const { data: registration, error: regError } = await supabase
                .from('tournament_registrations')
                .select('id')
                .eq('tournament_id', tournamentId)
                .eq('user_id', req.session.userId)
                .single();

            if (regError || !registration) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        // Insert chat message
        const { data, error } = await supabase
            .from('tournament_chat_messages')
            .insert([{
                tournament_id: tournamentId,
                user_id: req.session.userId,
                message: message.trim()
            }]);

        if (error) {
            console.error('Send message error:', error);
            return res.status(500).json({ error: 'Failed to send message' });
        }

        res.json({ success: true, message: 'Message sent successfully' });

    } catch (error) {
        console.error('Send message error:', error);
        return res.status(500).json({ error: 'Failed to send message' });
    }
});

// Tournament Lobby Data Route
app.get('/api/tournament/:id/lobby', requireAuth, async (req, res) => {
    const tournamentId = req.params.id;
    
    try {
        // FIXED: Check if user is admin first, if yes, skip registration check
        if (!req.session.isAdmin) {
            // Only check registration for non-admin users
            const { data: registration, error: regError } = await supabase
                .from('tournament_registrations')
                .select('*')
                .eq('user_id', req.session.userId)
                .eq('tournament_id', tournamentId)
                .single();

            if (regError || !registration) {
                return res.status(403).json({ error: 'You are not registered for this tournament' });
            }
        } else {
            console.log(`✅ Admin access granted to tournament ${tournamentId} for user ${req.session.userId}`);
        }

        // Get tournament details
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        // Get match details if exists
        const { data: matchDetails, error: matchError } = await supabase
            .from('tournament_match_details')
            .select('*')
            .eq('tournament_id', tournamentId)
            .single();

        // Don't fail if no match details exist
        res.json({
            tournament: tournament,
            matchDetails: matchDetails || null,
            onlineCount: tournament.current_participants // Simplified for now
        });

    } catch (error) {
        console.error('Get tournament lobby error:', error);
        return res.status(500).json({ error: 'Failed to get tournament data' });
    }
});

// Tournament Players Route
app.get('/api/tournament/:id/players', requireAuth, async (req, res) => {
    const tournamentId = req.params.id;
    
    try {
        // FIXED: Check if user is admin OR registered for this tournament
        if (!req.session.isAdmin) {
            const { data: registration, error: regError } = await supabase
                .from('tournament_registrations')
                .select('id')
                .eq('user_id', req.session.userId)
                .eq('tournament_id', tournamentId)
                .single();

            if (regError || !registration) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        // Get all players for this tournament
        const { data: players, error } = await supabase
            .from('tournament_registrations')
            .select(`
                registration_date,
                users!inner(id, username, wallet_balance, winnings_balance, is_admin)
            `)
            .eq('tournament_id', tournamentId)
            .order('registration_date', { ascending: true });

        if (error) {
            console.error('Get tournament players error:', error);
            return res.status(500).json({ error: 'Failed to get players' });
        }

        // Transform data to match expected format
        const transformedPlayers = players.map(p => ({
            id: p.users.id,
            username: p.users.username,
            wallet_balance: p.users.wallet_balance,
            winnings_balance: p.users.winnings_balance,
            is_admin: p.users.is_admin,
            registration_date: p.registration_date,
            is_online: p.users.id === req.session.userId ? 1 : 0 // Simplified online status
        }));

        res.json(transformedPlayers);

    } catch (error) {
        console.error('Get tournament players error:', error);
        return res.status(500).json({ error: 'Failed to get players' });
    }
});


// Enhanced Tournament Routes - Add these to your server.js file

// Enhanced tournaments API with game types and team modes
app.get('/api/tournaments/enhanced', requireAuth, async (req, res) => {
    try {
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select(`
                *,
                tournament_registrations!left(user_id),
                team_registrations!left(team_leader_id)
            `)
            .order('start_date', { ascending: true });

        if (error) {
            console.error('Get enhanced tournaments error:', error);
            return res.status(500).json({ error: 'Failed to get tournaments' });
        }

        // Transform data to include registration status
        const tournamentsWithRegistration = tournaments.map(tournament => {
            // Check solo registration
            const soloRegistered = tournament.tournament_registrations.some(reg => reg.user_id === req.session.userId);
            
            // Check team registration (as leader)
            const teamRegistered = tournament.team_registrations.some(team => team.team_leader_id === req.session.userId);
            
            return {
                ...tournament,
                is_registered: (soloRegistered || teamRegistered) ? 1 : 0
            };
        });

        res.json(tournamentsWithRegistration);
    } catch (error) {
        console.error('Get enhanced tournaments error:', error);
        return res.status(500).json({ error: 'Failed to get tournaments' });
    }
});

// Enhanced tournament registration with combined wallet balance
app.post('/api/tournaments/register', requireAuth, checkBanStatus, async (req, res) => {
    const { tournamentId } = req.body;

    try {
        // Get tournament details
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return res.status(400).json({ error: 'Tournament not found' });
        }

        // Get user details
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.session.userId)
            .single();

        if (userError || !user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Check combined balance (wallet + winnings for registration)
        const totalBalance = parseFloat(user.wallet_balance) + parseFloat(user.winnings_balance);
        if (totalBalance < tournament.entry_fee) {
            return res.status(400).json({ error: 'Insufficient combined balance' });
        }

        // Check if tournament is full
        if (tournament.current_participants >= tournament.max_participants) {
            return res.status(400).json({ error: 'Tournament is full' });
        }

        // Check if already registered (solo or team)
        const { data: existingSolo, error: soloCheckError } = await supabase
            .from('tournament_registrations')
            .select('id')
            .eq('user_id', req.session.userId)
            .eq('tournament_id', tournamentId)
            .single();

        if (existingSolo) {
            return res.status(400).json({ error: 'Already registered for this tournament' });
        }

        const { data: existingTeam, error: teamCheckError } = await supabase
            .from('team_registrations')
            .select('id')
            .eq('team_leader_id', req.session.userId)
            .eq('tournament_id', tournamentId)
            .single();

        if (existingTeam) {
            return res.status(400).json({ error: 'Already registered as team leader for this tournament' });
        }

        // Register user for tournament
        const { error: registrationError } = await supabase
            .from('tournament_registrations')
            .insert([{
                user_id: req.session.userId,
                tournament_id: tournamentId
            }]);

        if (registrationError) {
            console.error('Registration error:', registrationError);
            return res.status(500).json({ error: 'Registration failed' });
        }

        // Deduct from wallet first, then winnings if needed
        let newWalletBalance = user.wallet_balance;
        let newWinningsBalance = user.winnings_balance;
        let remainingFee = tournament.entry_fee;

        if (newWalletBalance >= remainingFee) {
            newWalletBalance -= remainingFee;
        } else {
            remainingFee -= newWalletBalance;
            newWalletBalance = 0;
            newWinningsBalance -= remainingFee;
        }

        // Update user balances
        const { error: balanceError } = await supabase
            .from('users')
            .update({
                wallet_balance: newWalletBalance,
                winnings_balance: newWinningsBalance
            })
            .eq('id', req.session.userId);

        if (balanceError) {
            console.error('Balance update error:', balanceError);
            return res.status(500).json({ error: 'Payment failed' });
        }

        // Update tournament participant count
        const { error: tournamentUpdateError } = await supabase
            .from('tournaments')
            .update({
                current_participants: tournament.current_participants + 1
            })
            .eq('id', tournamentId);

        if (tournamentUpdateError) {
            console.error('Tournament update error:', tournamentUpdateError);
            return res.status(500).json({ error: 'Registration failed' });
        }

        // Record transaction
        const { error: transactionError } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: req.session.userId,
                transaction_type: 'debit',
                amount: tournament.entry_fee,
                balance_type: 'combined',
                description: `Tournament registration: ${tournament.name}`
            }]);

        if (transactionError) {
            console.error('Transaction error:', transactionError);
            return res.status(500).json({ error: 'Transaction recording failed' });
        }

        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Tournament registration error:', error);
        return res.status(500).json({ error: 'Registration failed' });
    }
});

// Team registration endpoint
app.post('/api/tournaments/register-team', requireAuth, checkBanStatus, async (req, res) => {
    const { tournamentId, teamName, teamSize, members } = req.body;

    if (!teamName || !teamSize || !members || !Array.isArray(members)) {
        return res.status(400).json({ error: 'Invalid team data' });
    }

    if (teamSize < 2 || teamSize > 4) {
        return res.status(400).json({ error: 'Invalid team size' });
    }

    if (members.length !== teamSize - 1) {
        return res.status(400).json({ error: 'Member count does not match team size' });
    }

    try {
        // Get tournament details
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return res.status(400).json({ error: 'Tournament not found' });
        }

        // Validate tournament supports team mode
        const maxTeamSize = tournament.team_mode === 'duo' ? 2 : tournament.team_mode === 'squad' ? 4 : 1;
        if (teamSize > maxTeamSize) {
            return res.status(400).json({ error: `Tournament only supports up to ${maxTeamSize} players` });
        }

        // Get team leader details
        const { data: leader, error: leaderError } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.session.userId)
            .single();

        if (leaderError || !leader) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Check if leader has enough balance
        const totalBalance = parseFloat(leader.wallet_balance) + parseFloat(leader.winnings_balance);
        const totalEntryFee = tournament.entry_fee * teamSize;
        
        if (totalBalance < totalEntryFee) {
            return res.status(400).json({ error: `Insufficient balance. Need ₹${totalEntryFee} for team registration` });
        }

        // Validate team members exist
        const { data: memberUsers, error: memberError } = await supabase
            .from('users')
            .select('id, username')
            .in('username', members);

        if (memberError) {
            console.error('Member validation error:', memberError);
            return res.status(500).json({ error: 'Failed to validate team members' });
        }

        if (memberUsers.length !== members.length) {
            const foundUsernames = memberUsers.map(u => u.username);
            const notFound = members.filter(m => !foundUsernames.includes(m));
            return res.status(400).json({ error: `Users not found: ${notFound.join(', ')}` });
        }

        // Check if tournament has space for the team
        const spotsNeeded = teamSize;
        const availableSpots = tournament.max_participants - tournament.current_participants;
        
        if (availableSpots < spotsNeeded) {
            return res.status(400).json({ error: 'Not enough spots available for your team' });
        }

        // Check if any team member is already registered
        const allUserIds = [req.session.userId, ...memberUsers.map(u => u.id)];
        
        const { data: existingRegs, error: regCheckError } = await supabase
            .from('tournament_registrations')
            .select('user_id')
            .eq('tournament_id', tournamentId)
            .in('user_id', allUserIds);

        if (existingRegs && existingRegs.length > 0) {
            return res.status(400).json({ error: 'One or more team members are already registered' });
        }

        // Create team registration
        const { data: teamReg, error: teamRegError } = await supabase
            .from('team_registrations')
            .insert([{
                tournament_id: tournamentId,
                team_leader_id: req.session.userId,
                team_name: teamName,
                team_members: allUserIds,
                team_size: teamSize
            }])
            .select()
            .single();

        if (teamRegError) {
            console.error('Team registration error:', teamRegError);
            return res.status(500).json({ error: 'Team registration failed' });
        }

        // Register all team members individually
        const registrations = allUserIds.map(userId => ({
            user_id: userId,
            tournament_id: tournamentId
        }));

        const { error: memberRegError } = await supabase
            .from('tournament_registrations')
            .insert(registrations);

        if (memberRegError) {
            console.error('Member registration error:', memberRegError);
            return res.status(500).json({ error: 'Failed to register team members' });
        }

        // Deduct entry fee from team leader (pays for whole team)
        let newWalletBalance = leader.wallet_balance;
        let newWinningsBalance = leader.winnings_balance;
        let remainingFee = totalEntryFee;

        if (newWalletBalance >= remainingFee) {
            newWalletBalance -= remainingFee;
        } else {
            remainingFee -= newWalletBalance;
            newWalletBalance = 0;
            newWinningsBalance -= remainingFee;
        }

        const { error: balanceError } = await supabase
            .from('users')
            .update({
                wallet_balance: newWalletBalance,
                winnings_balance: newWinningsBalance
            })
            .eq('id', req.session.userId);

        if (balanceError) {
            console.error('Balance update error:', balanceError);
            return res.status(500).json({ error: 'Payment failed' });
        }

        // Update tournament participant count
        const { error: tournamentUpdateError } = await supabase
            .from('tournaments')
            .update({
                current_participants: tournament.current_participants + teamSize
            })
            .eq('id', tournamentId);

        if (tournamentUpdateError) {
            console.error('Tournament update error:', tournamentUpdateError);
            return res.status(500).json({ error: 'Registration failed' });
        }

        // Record transaction
        const { error: transactionError } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: req.session.userId,
                transaction_type: 'debit',
                amount: totalEntryFee,
                balance_type: 'combined',
                description: `Team registration: ${tournament.name} (${teamName})`
            }]);

        if (transactionError) {
            console.error('Transaction error:', transactionError);
            return res.status(500).json({ error: 'Transaction recording failed' });
        }

        res.json({ 
            success: true, 
            message: `Team "${teamName}" registered successfully for ₹${totalEntryFee}`,
            teamId: teamReg.id
        });

    } catch (error) {
        console.error('Team registration error:', error);
        return res.status(500).json({ error: 'Team registration failed' });
    }
});

// Enhanced admin tournament creation
app.post('/api/admin/tournaments/enhanced', requireAdmin, async (req, res) => {
    const { 
        name, 
        description, 
        game_type, 
        team_mode, 
        entry_fee, 
        prize_pool, 
        max_participants, 
        start_date, 
        end_date,
        kill_points,
        rank_points,
        match_type
    } = req.body;

    if (!name || !game_type || !team_mode || !entry_fee || !prize_pool || !max_participants || !start_date) {
        return res.status(400).json({ error: 'Required fields missing' });
    }

    // Validate game type
    const validGames = ['Free Fire', 'BGMI', 'Valorant', 'CODM'];
    if (!validGames.includes(game_type)) {
        return res.status(400).json({ error: 'Invalid game type' });
    }

    // Validate team mode
    const validModes = ['solo', 'duo', 'squad'];
    if (!validModes.includes(team_mode)) {
        return res.status(400).json({ error: 'Invalid team mode' });
    }

    try {
        const { data, error } = await supabase
            .from('tournaments')
            .insert([{
                name,
                description: description || `${game_type} ${team_mode} tournament`,
                game_type,
                team_mode,
                entry_fee: parseFloat(entry_fee),
                prize_pool: parseFloat(prize_pool),
                max_participants: parseInt(max_participants),
                start_date,
                end_date: end_date || start_date,
                kill_points: parseInt(kill_points) || 1,
                rank_points: rank_points || '{"1":10,"2":8,"3":6,"4":4,"5":2,"6":1}',
                match_type: match_type || 'Battle Royale',
                game_image_url: getGameImageUrl(game_type), // FIXED: Use helper function
                status: 'upcoming',
                current_participants: 0
            }])
            .select()
            .single();

        if (error) {
            console.error('Create enhanced tournament error:', error);
            return res.status(500).json({ error: 'Failed to create tournament' });
        }

        res.json({ 
            success: true, 
            message: 'Enhanced tournament created successfully',
            tournament: data
        });
    } catch (error) {
        console.error('Create enhanced tournament error:', error);
        return res.status(500).json({ error: 'Failed to create tournament' });
    }
});

// Get team details for a tournament
app.get('/api/tournament/:id/teams', requireAuth, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        const { data: teams, error } = await supabase
            .from('team_registrations')
            .select(`
                *,
                users!team_registrations_team_leader_id_fkey(username)
            `)
            .eq('tournament_id', tournamentId)
            .eq('is_active', true);

        if (error) {
            console.error('Get teams error:', error);
            return res.status(500).json({ error: 'Failed to get teams' });
        }

        // Get member details for each team
        const teamsWithMembers = await Promise.all(teams.map(async (team) => {
            const { data: members, error: memberError } = await supabase
                .from('users')
                .select('id, username')
                .in('id', team.team_members);

            return {
                ...team,
                leader_username: team.users.username,
                members: members || []
            };
        }));

        res.json(teamsWithMembers);
    } catch (error) {
        console.error('Get teams error:', error);
        return res.status(500).json({ error: 'Failed to get teams' });
    }
});

app.get('/api/debug/tournaments', requireAuth, async (req, res) => {
    try {
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(3);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({
            message: 'DEBUG: Raw tournament data from database',
            tournaments: tournaments,
            count: tournaments.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Initialize and start server
async function initializeServer() {
    try {
        // Test Supabase connection
        console.log('🔄 Testing Supabase connection...');
        const { data, error } = await supabase
            .from('users')
            .select('count', { count: 'exact' })
            .limit(1);

        if (error) {
            throw new Error(`Supabase connection failed: ${error.message}`);
        }

        console.log('✅ Supabase connection established');
        
        // Check if admin user exists
        const { data: adminUser, error: adminError } = await supabase
            .from('users')
            .select('id')
            .eq('is_admin', true)
            .single();

        if (adminError && adminError.code === 'PGRST116') {
            // No admin user found, create one
            console.log('🔧 Creating admin user...');
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            
            const { data: newAdmin, error: createError } = await supabase
                .from('users')
                .insert([{
                    username: 'admin',
                    email: 'admin@fantasy.com',
                    password: hashedPassword,
                    is_admin: true,
                    wallet_balance: 0,
                    winnings_balance: 0
                }])
                .select()
                .single();

            if (createError) {
                console.error("❌ Error creating admin:", createError);
            } else {
                console.log("✅ Admin user created successfully");
            }
        }

        app.listen(PORT, () => {
            console.log(`🚀 Fantasy Tournament Server running on http://localhost:${PORT}`);
            console.log('🗄️  Database: Supabase');
            console.log('👨‍💼 Admin credentials: username=admin, password=admin123');
            console.log('🔧 Change admin password after first login!');
        });
    } catch (error) {
        console.error('❌ Failed to initialize server:', error);
        process.exit(1);
    }
}

initializeServer();

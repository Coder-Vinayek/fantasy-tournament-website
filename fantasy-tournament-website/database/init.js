const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fantasy_tournament.db');
const db = new sqlite3.Database(dbPath);

// Initialize database with all required tables
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                wallet_balance REAL DEFAULT 0,
                winnings_balance REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_admin INTEGER DEFAULT 0,
                ban_status TEXT DEFAULT 'none',
                ban_expiry DATETIME DEFAULT NULL,
                ban_reason TEXT DEFAULT NULL,
                banned_at DATETIME DEFAULT NULL,
                banned_by INTEGER DEFAULT NULL
            )`);

            // Tournaments table
            db.run(`CREATE TABLE IF NOT EXISTS tournaments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                entry_fee REAL NOT NULL,
                prize_pool REAL NOT NULL,
                max_participants INTEGER NOT NULL,
                current_participants INTEGER DEFAULT 0,
                start_date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                status TEXT DEFAULT 'upcoming',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Tournament registrations table
            db.run(`CREATE TABLE IF NOT EXISTS tournament_registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                tournament_id INTEGER NOT NULL,
                registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (tournament_id) REFERENCES tournaments (id),
                UNIQUE(user_id, tournament_id)
            )`);

            // Wallet transactions table
            db.run(`CREATE TABLE IF NOT EXISTS wallet_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                transaction_type TEXT NOT NULL,
                amount REAL NOT NULL,
                balance_type TEXT NOT NULL,
                description TEXT,
                transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            // Tournament Chat Messages table
            db.run(`CREATE TABLE IF NOT EXISTS tournament_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
)`);

            // Tournament Announcements table
            db.run(`CREATE TABLE IF NOT EXISTS tournament_announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    admin_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments (id),
    FOREIGN KEY (admin_id) REFERENCES users (id)
)`);

            // Tournament Match Details table
            db.run(`CREATE TABLE IF NOT EXISTS tournament_match_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER UNIQUE NOT NULL,
    room_id TEXT,
    room_password TEXT,
    match_start_time DATETIME,
    game_server TEXT,
    updated_by INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments (id),
    FOREIGN KEY (updated_by) REFERENCES users (id)
)`);

            function checkExpiredBans() {
                db.run(`UPDATE users 
                        SET ban_status = 'none', 
                            ban_expiry = NULL, 
                            ban_reason = NULL, 
                            banned_at = NULL, 
                            banned_by = NULL 
                        WHERE ban_status = 'temporary' 
                        AND ban_expiry <= datetime('now')`,
                    (err) => {
                        if (err) {
                            console.error('Error checking expired bans:', err);
                        }
                    });
            }

            // Check expired bans every minute
            setInterval(checkExpiredBans, 60000);
            module.exports = { checkExpiredBans };

            // Create admin user if not exists
            db.get("SELECT COUNT(*) as count FROM users WHERE is_admin = 1", (err, row) => {
                if (err) {
                    console.error("Error checking admin:", err);
                    return;
                }

                if (row.count === 0) {
                    const bcrypt = require('bcryptjs');
                    const hashedPassword = bcrypt.hashSync('admin123', 10);

                    db.run(`INSERT INTO users (username, email, password, is_admin, wallet_balance, winnings_balance) 
                            VALUES (?, ?, ?, ?, ?, ?)`,
                        ['admin', 'admin@fantasy.com', hashedPassword, 1, 0, 0],
                        function (err) {
                            if (err) {
                                console.error("Error creating admin:", err);
                            } else {
                                console.log("Admin user created successfully");
                            }
                        });
                }
            });



            console.log("Database initialized successfully");
            resolve();
        });
    });
}

module.exports = { db, initializeDatabase };

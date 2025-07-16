// FIX MAIN PROJECT DATABASE - Run this file to add ban columns
const { db } = require('./database/init');

console.log('🔧 Adding ban columns to main project database...');

const commands = [
    "ALTER TABLE users ADD COLUMN ban_status TEXT DEFAULT 'active'",
    "ALTER TABLE users ADD COLUMN ban_expiry DATETIME DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN ban_reason TEXT DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN banned_at DATETIME DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN banned_by INTEGER DEFAULT NULL"
];

let completed = 0;

commands.forEach((cmd, i) => {
    db.run(cmd, (err) => {
        if (err && !err.message.includes('duplicate')) {
            console.log(`❌ Column ${i+1} error:`, err.message);
        } else {
            console.log(`✅ Column ${i+1} added successfully`);
        }
        completed++;
        
        if (completed === commands.length) {
            console.log('\n🎉 All ban columns added to main project!');
            console.log('💡 You can now restart your server: node server.js');
            console.log('🗑️ You can delete this file after running it.');
            
            db.close((err) => {
                if (err) console.error('Error closing database:', err);
                process.exit(0);
            });
        }
    });
});
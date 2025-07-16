// Script to add multiple sample tournaments for testing
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'fantasy_tournament.db');
const db = new sqlite3.Database(dbPath);

// Sample tournaments data
const sampleTournaments = [
    {
        name: "Fantasy Football Championship 🏆",
        description: "Join our exciting fantasy football tournament with amazing prizes! Pick your dream team and compete with other players.",
        entry_fee: 10.00,
        prize_pool: 500.00,
        max_participants: 50,
        start_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
        end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
        status: 'upcoming'
    },
    {
        name: "Basketball Legends Cup 🏀",
        description: "Show your basketball knowledge in this fast-paced fantasy tournament. Draft your favorite NBA stars!",
        entry_fee: 15.00,
        prize_pool: 750.00,
        max_participants: 30,
        start_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
        status: 'upcoming'
    },
    {
        name: "Soccer World Tournament ⚽",
        description: "Global soccer fantasy tournament featuring teams from around the world. Build your ultimate squad!",
        entry_fee: 20.00,
        prize_pool: 1000.00,
        max_participants: 100,
        start_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
        end_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 3 weeks from now
        status: 'upcoming'
    },
    {
        name: "Quick Strike Tournament ⚡",
        description: "Fast-paced tournament for quick decision makers. Entry fee is low, but competition is fierce!",
        entry_fee: 5.00,
        prize_pool: 200.00,
        max_participants: 40,
        start_date: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
        end_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        status: 'upcoming'
    },
    {
        name: "Premium Elite Tournament 💎",
        description: "High-stakes tournament for serious players only. Premium entry fee with massive prize pool!",
        entry_fee: 50.00,
        prize_pool: 2500.00,
        max_participants: 20,
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
        end_date: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(), // 4 weeks from now
        status: 'upcoming'
    }
];

console.log('Adding sample tournaments...');

// Clear existing tournaments first (optional)
db.run('DELETE FROM tournaments', (err) => {
    if (err) {
        console.error('Error clearing tournaments:', err);
    } else {
        console.log('Cleared existing tournaments');
    }
    
    // Add sample tournaments
    let completed = 0;
    
    sampleTournaments.forEach((tournament, index) => {
        db.run(`INSERT INTO tournaments (name, description, entry_fee, prize_pool, max_participants, start_date, end_date, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [tournament.name, tournament.description, tournament.entry_fee, 
                 tournament.prize_pool, tournament.max_participants, 
                 tournament.start_date, tournament.end_date, tournament.status],
                function(err) {
                    completed++;
                    if (err) {
                        console.error(`Error adding tournament ${index + 1}:`, err);
                    } else {
                        console.log(`✅ Added tournament: ${tournament.name} (ID: ${this.lastID})`);
                    }
                    
                    if (completed === sampleTournaments.length) {
                        console.log('\n🎉 All sample tournaments added successfully!');
                        console.log('🚀 Restart your server to see the tournaments');
                        db.close();
                    }
                });
    });
});
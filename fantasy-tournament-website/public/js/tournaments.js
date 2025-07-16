// Tournaments JavaScript - No inline JS for CPC compliance

document.addEventListener('DOMContentLoaded', function() {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logoutBtn');
    const walletBalanceSpan = document.getElementById('walletBalance');
    const winningsBalanceSpan = document.getElementById('winningsBalance');
    const tournamentsContainer = document.getElementById('tournamentsContainer');
    const messageDiv = document.getElementById('message');

    // Initialize page
    loadUserInfo();
    loadTournaments();

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST'
                });

                const result = await response.json();
                if (result.success) {
                    window.location.href = '/login';
                }
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    async function loadUserInfo() {
        try {
            const response = await fetch('/api/user');
            const user = await response.json();

            if (usernameDisplay) {
                usernameDisplay.textContent = `Welcome, ${user.username}`;
            }
            if (walletBalanceSpan) {
                walletBalanceSpan.textContent = user.wallet_balance.toFixed(2);
            }
            if (winningsBalanceSpan) {
                winningsBalanceSpan.textContent = user.winnings_balance.toFixed(2);
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    async function loadTournaments() {
        try {
            const response = await fetch('/api/tournaments');
            const tournaments = await response.json();

            if (tournamentsContainer) {
                tournamentsContainer.innerHTML = '';

                if (tournaments.length === 0) {
                    tournamentsContainer.innerHTML = '<p>No tournaments available at the moment.</p>';
                    return;
                }

                tournaments.forEach(tournament => {
                    const tournamentCard = createTournamentCard(tournament);
                    tournamentsContainer.appendChild(tournamentCard);
                });
            }
        } catch (error) {
            console.error('Error loading tournaments:', error);
            showMessage('Failed to load tournaments', 'error');
        }
    }

    function createTournamentCard(tournament) {
        const card = document.createElement('div');
        card.className = 'tournament-card';

        const startDate = new Date(tournament.start_date).toLocaleString();
        const endDate = new Date(tournament.end_date).toLocaleString();
        
        const statusClass = `status-${tournament.status}`;
        const isRegistered = tournament.is_registered === 1;
        const isFull = tournament.current_participants >= tournament.max_participants;

        card.innerHTML = `
            <h3>${tournament.name}</h3>
            <div class="tournament-info">
                <p><strong>Entry Fee:</strong> $${tournament.entry_fee}</p>
                <p><strong>Prize Pool:</strong> $${tournament.prize_pool}</p>
                <p><strong>Participants:</strong> ${tournament.current_participants}/${tournament.max_participants}</p>
                <p><strong>Start:</strong> ${startDate}</p>
                <p><strong>End:</strong> ${endDate}</p>
                <p><strong>Status:</strong> <span class="tournament-status ${statusClass}">${tournament.status}</span></p>
                ${tournament.description ? `<p><strong>Description:</strong> ${tournament.description}</p>` : ''}
            </div>
            <div class="tournament-actions">
                ${getActionButton(tournament, isRegistered, isFull)}
            </div>
        `;

        return card;
    }

    function getActionButton(tournament, isRegistered, isFull) {
        if (isRegistered) {
            return '<button class="btn btn-success" disabled>Registered ✓</button>';
        }
        
        if (isFull) {
            return '<button class="btn btn-secondary" disabled>Tournament Full</button>';
        }
        
        if (tournament.status === 'upcoming') {
            return `<button class="btn btn-primary register-btn" data-tournament-id="${tournament.id}" data-entry-fee="${tournament.entry_fee}">Register ($${tournament.entry_fee})</button>`;
        }
        
        return '<button class="btn btn-secondary" disabled>Registration Closed</button>';
    }

    // Tournament registration handler
    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('register-btn')) {
            const tournamentId = e.target.getAttribute('data-tournament-id');
            const entryFee = parseFloat(e.target.getAttribute('data-entry-fee'));
            
            // Confirm registration
            if (!confirm(`Register for this tournament? Entry fee: $${entryFee}`)) {
                return;
            }

            try {
                const response = await fetch('/api/tournaments/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tournamentId: parseInt(tournamentId) })
                });

                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, 'success');
                    // Reload tournaments and user info
                    await loadTournaments();
                    await loadUserInfo();
                } else {
                    showMessage(result.error || 'Registration failed', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            }
        }
    });

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
});
/**
 * FIXED Tournament System - Resolves hardcoded Free Fire display issue
 * This replaces the existing tournaments.js file
 */

// Global state management
let state = {
    allTournaments: [],
    filteredTournaments: [],
    currentUser: null,
    isLoading: false,
    currentFilters: {
        game: 'all',
        mode: 'all'
    }
};

// DOM elements cache
let elements = {};

// Game configurations - FIXED: Using actual database field values
const gameImages = {
    'Free Fire': '/images/games/freefire.jpg',
    'BGMI': '/images/games/bgmi.jpg', 
    'Valorant': '/images/games/valorant.jpg',
    'CODM': '/images/games/codm.jpg'
};

const teamModeConfig = {
    'solo': { size: 1, label: 'Solo' },
    'duo': { size: 2, label: 'Duo' },
    'squad': { size: 4, label: 'Squad' }
};

// FIXED: Default values for tournaments without game_type
const defaultGameData = {
    game_type: 'Free Fire',
    team_mode: 'solo',
    game_image_url: '/images/games/freefire.jpg'
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('FIXED Tournament system initializing...');
    initializeSystem();
});

/**
 * Initialize the tournament system
 */
async function initializeSystem() {
    try {
        // Cache DOM elements
        cacheElements();

        // Setup event listeners
        setupEventListeners();

        // Load initial data
        await Promise.all([
            loadUserInfo(),
            loadTournaments()
        ]);

        // Setup filters AFTER tournaments are loaded
        setupFilters();

        console.log('FIXED Tournament system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize tournament system:', error);
        showError('Failed to initialize system. Please refresh the page.');
    }
}

/**
 * Cache frequently used DOM elements
 */
function cacheElements() {
    elements = {
        usernameDisplay: document.getElementById('username-display'),
        logoutBtn: document.getElementById('logoutBtn'),
        walletBalance: document.getElementById('walletBalance'),
        winningsBalance: document.getElementById('winningsBalance'),
        tournamentsGrid: document.getElementById('tournaments-grid'),
        tournamentsContainer: document.getElementById('tournaments-container'),
        gameFilter: document.getElementById('gameFilter'),
        modeFilter: document.getElementById('modeFilter'),
        clearFilters: document.getElementById('clearFilters'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        message: document.getElementById('message'),
        retryBtn: document.getElementById('retry-btn')
    };
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Logout handler
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }

    // Retry handler
    if (elements.retryBtn) {
        elements.retryBtn.addEventListener('click', () => {
            hideError();
            loadTournaments();
        });
    }
}

/**
 * Setup filter functionality
 */
function setupFilters() {
    if (elements.gameFilter) {
        elements.gameFilter.addEventListener('change', applyFilters);
    }

    if (elements.modeFilter) {
        elements.modeFilter.addEventListener('change', applyFilters);
    }

    if (elements.clearFilters) {
        elements.clearFilters.addEventListener('click', clearAllFilters);
    }
}

/**
 * FIXED: Load tournaments using enhanced API
 */
async function loadTournaments() {
    try {
        showLoading();
        state.isLoading = true;

        console.log('Loading tournaments from enhanced API...');
        
        // FIXED: Use enhanced tournaments API endpoint
        const response = await fetch('/api/tournaments/enhanced');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const tournaments = await response.json();
        console.log('Raw tournaments data:', tournaments);

        // FIXED: Process tournaments to ensure they have game data
        state.allTournaments = tournaments.map(tournament => {
            return {
                ...tournament,
                // Use database values or fallback to defaults
                game_type: tournament.game_type || defaultGameData.game_type,
                team_mode: tournament.team_mode || defaultGameData.team_mode,
                game_image_url: tournament.game_image_url || gameImages[tournament.game_type] || defaultGameData.game_image_url
            };
        });

        state.filteredTournaments = [...state.allTournaments];

        console.log('Processed tournaments:', state.allTournaments);

        renderTournaments();
        hideLoading();

    } catch (error) {
        console.error('Error loading tournaments:', error);
        showError('Failed to load tournaments. Please try again.');
        state.allTournaments = [];
        state.filteredTournaments = [];
    } finally {
        state.isLoading = false;
    }
}

/**
 * FIXED: Render tournaments with proper game data
 */
function renderTournaments() {
    if (!elements.tournamentsGrid) {
        console.error('Tournaments grid element not found');
        return;
    }

    elements.tournamentsGrid.innerHTML = '';

    if (state.filteredTournaments.length === 0) {
        elements.tournamentsGrid.innerHTML = `
            <div class="no-tournaments">
                <h3>No tournaments found</h3>
                <p>Try adjusting your filters or check back later for new tournaments.</p>
            </div>
        `;
        return;
    }

    state.filteredTournaments.forEach(tournament => {
        const card = createTournamentCard(tournament);
        elements.tournamentsGrid.appendChild(card);
    });
}

/**
 * FIXED: Create tournament card with dynamic data
 */
function createTournamentCard(tournament) {
    const card = document.createElement('div');
    card.className = 'tournament-card';
    card.dataset.tournamentId = tournament.id;

    // FIXED: Use actual tournament data instead of hardcoded values
    const gameType = tournament.game_type || 'Unknown Game';
    const teamMode = tournament.team_mode || 'solo';
    const gameImage = tournament.game_image_url || gameImages[gameType] || '/images/games/default.jpg';
    
    const teamModeLabel = teamModeConfig[teamMode]?.label || teamMode.charAt(0).toUpperCase() + teamMode.slice(1);
    
    // Format dates
    const startDate = formatDate(tournament.start_date);
    const startTime = formatTime(tournament.start_date);

    // Registration status
    const isRegistered = tournament.is_registered === 1;
    const isFull = tournament.current_participants >= tournament.max_participants;

    card.innerHTML = `
        <div class="tournament-card-header">
            <div class="tournament-image-container">
                <img src="${gameImage}" alt="${gameType}" class="tournament-image" 
                     onerror="this.src='/images/games/default.jpg'">
                <div class="tournament-status ${tournament.status}">${tournament.status.toUpperCase()}</div>
            </div>
        </div>
        
        <div class="tournament-card-body">
            <div class="tournament-badges">
                <span class="game-badge">${escapeHtml(gameType)}</span>
                <span class="mode-badge">${escapeHtml(teamModeLabel)}</span>
            </div>
            
            <h3 class="tournament-name">${escapeHtml(tournament.name)}</h3>
            <p class="tournament-description">${escapeHtml(tournament.description || 'No description available')}</p>
            
            <div class="tournament-details">
                <div class="detail-row">
                    <span class="detail-label">Prize Pool:</span>
                    <span class="detail-value prize">₹${tournament.prize_pool}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Entry Fee:</span>
                    <span class="detail-value fee">₹${tournament.entry_fee}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Participants:</span>
                    <span class="detail-value">${tournament.current_participants}/${tournament.max_participants}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${startDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span class="detail-value">${startTime}</span>
                </div>
            </div>
        </div>
        
        <div class="tournament-card-footer">
            ${createActionButton(tournament, isRegistered, isFull)}
        </div>
    `;

    // Add event listeners
    setupCardEventListeners(card, tournament);

    return card;
}

/**
 * Create action button based on tournament state
 */
function createActionButton(tournament, isRegistered, isFull) {
    if (isRegistered) {
        return `
            <button class="btn btn-success btn-block" disabled>
                ✓ Registered
            </button>
            <button class="btn btn-primary btn-sm view-lobby-btn" data-tournament-id="${tournament.id}">
                View Lobby
            </button>
        `;
    }

    if (isFull) {
        return `<button class="btn btn-secondary btn-block" disabled>Tournament Full</button>`;
    }

    if (tournament.status !== 'upcoming') {
        return `<button class="btn btn-secondary btn-block" disabled>Registration Closed</button>`;
    }

    return `<button class="btn btn-primary btn-block register-btn" data-tournament-id="${tournament.id}">
        Register Now
    </button>`;
}

/**
 * Setup event listeners for tournament card
 */
function setupCardEventListeners(card, tournament) {
    // Register button
    const registerBtn = card.querySelector('.register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', () => registerForTournament(tournament.id));
    }

    // View lobby button
    const lobbyBtn = card.querySelector('.view-lobby-btn');
    if (lobbyBtn) {
        lobbyBtn.addEventListener('click', () => {
            window.location.href = `/tournament/${tournament.id}`;
        });
    }

    // Card click for details
    card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            showTournamentDetails(tournament);
        }
    });
}

/**
 * Apply filters to tournaments
 */
function applyFilters() {
    const gameFilter = elements.gameFilter?.value || 'all';
    const modeFilter = elements.modeFilter?.value || 'all';

    state.currentFilters = { game: gameFilter, mode: modeFilter };

    state.filteredTournaments = state.allTournaments.filter(tournament => {
        const gameMatch = gameFilter === 'all' || tournament.game_type === gameFilter;
        const modeMatch = modeFilter === 'all' || tournament.team_mode === modeFilter;
        
        return gameMatch && modeMatch;
    });

    console.log('Filtered tournaments:', state.filteredTournaments);
    renderTournaments();
}

/**
 * Clear all filters
 */
function clearAllFilters() {
    if (elements.gameFilter) elements.gameFilter.value = 'all';
    if (elements.modeFilter) elements.modeFilter.value = 'all';
    
    state.currentFilters = { game: 'all', mode: 'all' };
    state.filteredTournaments = [...state.allTournaments];
    
    renderTournaments();
}

/**
 * Register for tournament
 */
async function registerForTournament(tournamentId) {
    try {
        showMessage('Processing registration...', 'info');

        const response = await fetch('/api/tournaments/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tournamentId })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showMessage(result.message, 'success');
            await loadTournaments(); // Refresh tournaments
            await loadUserInfo(); // Refresh balance
        } else {
            throw new Error(result.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage(error.message, 'error');
    }
}

/**
 * Load user information
 */
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) throw new Error('Failed to load user info');

        const user = await response.json();
        state.currentUser = user;

        if (elements.usernameDisplay) {
            elements.usernameDisplay.textContent = user.username;
        }
        if (elements.walletBalance) {
            elements.walletBalance.textContent = user.wallet_balance.toFixed(2);
        }
        if (elements.winningsBalance) {
            elements.winningsBalance.textContent = user.winnings_balance.toFixed(2);
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        const result = await response.json();

        if (result.success) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

/**
 * Show tournament details modal (optional feature)
 */
function showTournamentDetails(tournament) {
    // Implementation for detailed view modal
    console.log('Tournament details:', tournament);
}

/**
 * Utility functions
 */
function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString();
    } catch {
        return 'TBD';
    }
}

function formatTime(dateString) {
    try {
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return 'TBD';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * UI state management
 */
function showLoading() {
    if (elements.loadingState) elements.loadingState.style.display = 'block';
    if (elements.tournamentsGrid) elements.tournamentsGrid.style.display = 'none';
}

function hideLoading() {
    if (elements.loadingState) elements.loadingState.style.display = 'none';
    if (elements.tournamentsGrid) elements.tournamentsGrid.style.display = 'grid';
}

function showError(message) {
    if (elements.errorState) {
        elements.errorState.style.display = 'block';
        elements.errorState.querySelector('p').textContent = message;
    }
    if (elements.tournamentsGrid) elements.tournamentsGrid.style.display = 'none';
}

function hideError() {
    if (elements.errorState) elements.errorState.style.display = 'none';
}

function showMessage(message, type = 'info') {
    if (!elements.message) return;
    
    elements.message.textContent = message;
    elements.message.className = `message ${type}`;
    elements.message.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        if (elements.message) {
            elements.message.style.display = 'none';
        }
    }, 5000);
}

// Make some functions globally available for debugging
window.tournamentSystem = {
    state,
    loadTournaments,
    applyFilters,
    clearAllFilters
};

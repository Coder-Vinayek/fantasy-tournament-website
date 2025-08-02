// Enhanced Admin JavaScript with Ban System, Session Management, and Payout System

// Ban System Variables
let banModal = null;
let currentBanUserId = null;
let currentBanUsername = null;

// Tournament Management Variables
let currentManagedTournamentId = null;
let chatRefreshInterval = null;
let isCreatingTournament = false;

// NEW: Payout System Variables
let currentPayoutId = null;

window.showMessage = function (message, type) {
    const messageDiv = document.getElementById('message');
    if (!messageDiv) {
        // Fallback to alert if message div doesn't exist
        alert(message);
        return;
    }

    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
};

document.addEventListener('DOMContentLoaded', function () {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logoutBtn');
    const messageDiv = document.getElementById('message');

    // Tab elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Container elements
    const usersContainer = document.getElementById('usersContainer');
    const adminTournamentsContainer = document.getElementById('adminTournamentsContainer');
    const adminTransactionsContainer = document.getElementById('adminTransactionsContainer');
    const payoutsContainer = document.getElementById('payoutsContainer'); // NEW

    // Form elements
    const createTournamentForm = document.getElementById('createTournamentForm');
    const updateWinningsForm = document.getElementById('updateWinningsForm');

    // Modal elements
    const winningsModal = document.getElementById('winningsModal');
    const closeModal = document.querySelector('.close');

    // Initialize page
    loadUserInfo();
    loadAnalytics();
    initializeBanModal();
    checkAdminSession();

    // Auto-refresh session every 5 minutes
    setInterval(checkAdminSession, 5 * 60 * 1000);

    // Auto-refresh payouts every 30 seconds if on payouts tab
    setInterval(function () {
        const payoutsTab = document.getElementById('payoutsTab');
        if (payoutsTab && payoutsTab.classList.contains('active')) {
            loadPayouts();
            loadAnalytics(); // Update badge count
        }
    }, 30000);

    // ADMIN SESSION MANAGEMENT
    async function checkAdminSession() {
        try {
            const response = await fetch('/api/admin/session-check');
            const result = await response.json();

            if (!result.authenticated || !result.isAdmin) {
                alert('Your admin session has expired. Please login again.');
                window.location.href = '/login';
                return false;
            }

            return true;
        } catch (error) {
            console.error('Session check failed:', error);
            return false;
        }
    }

    // Enhanced fetch wrapper for admin requests
    async function adminFetch(url, options = {}) {
        try {
            const response = await fetch(url, options);

            if (response.status === 403) {
                const sessionValid = await checkAdminSession();
                if (!sessionValid) {
                    return null;
                }
                showMessage('Access denied. Please try again.', 'error');
                return null;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        } catch (error) {
            console.error('Admin fetch error:', error);
            throw error;
        }
    }

    // TAB MANAGEMENT
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    function switchTab(tabName) {
        // Hide all tabs
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
        });

        // Remove active class from all buttons
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        let selectedTab;
        switch (tabName) {
            case 'analytics':
                selectedTab = document.getElementById('analyticsTab');
                break;
            case 'users':
                selectedTab = document.getElementById('usersTab');
                break;
            case 'tournaments':
                selectedTab = document.getElementById('tournamentsTab');
                break;
            case 'transactions':
                selectedTab = document.getElementById('transactionsTab');
                break;
            case 'payouts': // NEW
                selectedTab = document.getElementById('payoutsTab');
                break;
            case 'create-tournament':
                selectedTab = document.getElementById('createTournamentTab');
                break;
            case 'manage-tournaments':
                selectedTab = document.getElementById('manageTournamentsTab');
                break;
        }

        const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);

        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        // Load data for the selected tab
        switch (tabName) {
            case 'analytics':
                loadAnalytics();
                break;
            case 'users':
                loadUsers();
                break;
            case 'tournaments':
                loadTournaments();
                break;
            case 'transactions':
                loadTransactions();
                break;
            case 'payouts': // NEW
                loadPayouts();
                break;
            case 'manage-tournaments':
                loadManageTournaments();
                break;
        }
    }

    // ANALYTICS FUNCTIONS - UPDATED with Payout Count
    async function loadAnalytics() {
        try {
            const response = await adminFetch('/api/admin/analytics');
            if (!response) return;

            const analytics = await response.json();

            // Update metrics
            document.getElementById('totalUsers').textContent = analytics.totalUsers || 0;
            document.getElementById('totalTournaments').textContent = analytics.totalTournaments || 0;
            document.getElementById('activeTournaments').textContent = analytics.activeTournaments || 0;
            document.getElementById('totalRevenue').textContent = (analytics.totalRevenue || 0).toFixed(2);
            document.getElementById('totalProfit').textContent = (analytics.totalProfit || 0).toFixed(2);
            document.getElementById('totalWithdrawals').textContent = (analytics.totalWithdrawals || 0).toFixed(2);
            document.getElementById('entryFees').textContent = (analytics.entryFeesCollected || 0).toFixed(2);
            document.getElementById('recentUsers').textContent = analytics.recentUsers || 0;

            // NEW: Update pending payouts
            const pendingPayouts = analytics.pendingPayouts || 0;
            document.getElementById('pendingPayouts').textContent = pendingPayouts;

            // Update payout badge
            const payoutBadge = document.getElementById('payoutBadge');
            if (payoutBadge) {
                if (pendingPayouts > 0) {
                    payoutBadge.textContent = pendingPayouts;
                    payoutBadge.style.display = 'flex';
                } else {
                    payoutBadge.style.display = 'none';
                }
            }

            // Popular tournament
            const popularTournament = analytics.popularTournament || { name: 'No tournaments', current_participants: 0, max_participants: 0 };
            document.getElementById('popularTournamentStats').textContent =
                `${popularTournament.current_participants || 0}/${popularTournament.max_participants || 0} participants`;

            // Recent activity trends
            displayRecentActivity(analytics.transactionTrends || []);
            displayTournamentStatus(analytics.tournamentStatus || []);

        } catch (error) {
            console.error('Error loading analytics:', error);
            showMessage('Failed to load analytics data', 'error');
        }
    }

    function displayRecentActivity(trends) {
        const container = document.getElementById('recentActivity');
        container.innerHTML = '';

        if (trends.length === 0) {
            container.innerHTML = '<p class="no-activity-message">No admin actions in the last 7 days</p>';
            return;
        }

        const groupedByDate = {};
        trends.forEach(trend => {
            if (!groupedByDate[trend.date]) {
                groupedByDate[trend.date] = { credit: 0, debit: 0 };
            }
            groupedByDate[trend.date][trend.transaction_type] = trend.total_amount;
        });

        Object.keys(groupedByDate).forEach(date => {
            const item = document.createElement('div');
            item.className = 'trend-item';
            item.innerHTML = `
            <div>
                <strong>${new Date(date).toLocaleDateString()}</strong>
            </div>
            <div>
                <span class="credit-amount">+$${(groupedByDate[date].credit || 0).toFixed(2)} winnings awarded</span>
                ${groupedByDate[date].debit > 0 ? `| <span class="debit-amount">-$${(groupedByDate[date].debit || 0).toFixed(2)} deductions</span>` : ''}
            </div>
        `;
            container.appendChild(item);
        });
    }

    function displayTournamentStatus(statusData) {
        const container = document.getElementById('tournamentStatusChart');
        container.innerHTML = '';

        statusData.forEach(status => {
            const item = document.createElement('div');
            item.className = 'trend-item';
            const statusClass = status.status || 'default';

            item.innerHTML = `
            <div class="status-container">
                <div class="status-indicator ${statusClass}"></div>
                <strong>${status.status.charAt(0).toUpperCase() + status.status.slice(1)}</strong>
            </div>
            <div class="tournament-count ${statusClass}">
                ${status.count} tournaments
            </div>
        `;
            container.appendChild(item);
        });
    }

    // ====================================
    //  Load Payouts Function
    // ====================================
    async function loadPayouts() {
        try {
            console.log('Loading payout requests...');
            const response = await adminFetch('/api/admin/payout-requests');
            if (!response) return;

            const payouts = await response.json();
            console.log('Loaded payouts:', payouts);

            const payoutsContainer = document.getElementById('payoutsContainer');
            if (payoutsContainer) {
                payoutsContainer.innerHTML = '';

                if (payouts.length === 0) {
                    payoutsContainer.innerHTML = `
                    <div class="empty-state">
                        <h3>💸 No Payout Requests</h3>
                        <p>No withdrawal requests have been submitted yet.</p>
                        <small>Users can request withdrawals from their winnings balance.</small>
                    </div>
                `;
                    return;
                }

                const table = document.createElement('table');
                table.className = 'admin-table';

                const header = document.createElement('thead');
                header.innerHTML = `
                <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Requested</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            `;
                table.appendChild(header);

                const tbody = document.createElement('tbody');
                payouts.forEach(payout => {
                    const row = createPayoutRow(payout);
                    tbody.appendChild(row);
                });
                table.appendChild(tbody);

                payoutsContainer.appendChild(table);
            }
        } catch (error) {
            console.error('Error loading payouts:', error);
            showMessage('Failed to load payout requests', 'error');

            // Show error state in container
            const payoutsContainer = document.getElementById('payoutsContainer');
            if (payoutsContainer) {
                payoutsContainer.innerHTML = `
                <div class="error-state">
                    <h3>❌ Error Loading Payouts</h3>
                    <p>Failed to load payout requests. Please check:</p>
                    <ul>
                        <li>Database connection</li>
                        <li>payout_requests table exists</li>
                        <li>Server is running</li>
                    </ul>
                    <button onclick="loadPayouts()" class="btn btn-primary">Retry</button>
                </div>
            `;
            }
        }
    }

    // ====================================
    //  Create Payout Row Function
    // ====================================
    function createPayoutRow(payout) {
        const row = document.createElement('tr');
        const requestedDate = new Date(payout.requested_at).toLocaleDateString();

        const statusClass = payout.status === 'pending' ? 'status-pending' :
            payout.status === 'approved' ? 'status-approved' : 'status-rejected';

        const actionButtons = payout.status === 'pending' ?
            `<button class="btn btn-small btn-primary process-payout-btn"
                data-payout-id="${payout.id}"
                data-username="${payout.username}"
                data-amount="${payout.amount}"
                data-email="${payout.email}">
            Process
        </button>` :
            '<span style="color: #666; font-style: italic;">Processed</span>';

        row.innerHTML = `
        <td>${payout.id}</td>
        <td>${payout.username}<br><small>${payout.email}</small></td>
        <td>₹${parseFloat(payout.amount).toFixed(2)}</td>
        <td>${requestedDate}</td>
        <td><span class="payout-status ${statusClass}">${payout.status}</span></td>
        <td>${actionButtons}</td>
    `;

        // Add event listener for process button
        const processBtn = row.querySelector('.process-payout-btn');
        if (processBtn) {
            processBtn.addEventListener('click', function () {
                const payoutId = this.getAttribute('data-payout-id');
                const username = this.getAttribute('data-username');
                const amount = this.getAttribute('data-amount');
                const email = this.getAttribute('data-email');
                openPayoutModal(payoutId, username, amount, email);
            });
        }

        return row;
    }

    // ====================================
    //  Payout Modal Functions
    // ====================================
    function openPayoutModal(payoutId, username, amount, email) {
        const modal = document.getElementById('payoutModal');
        const payoutDetails = document.getElementById('payoutDetails');
        const payoutIdInput = document.getElementById('payoutId');

        if (payoutDetails) {
            payoutDetails.innerHTML = `
            <div class="payout-info">
                <p><strong>User:</strong> ${username}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Amount:</strong> ₹${parseFloat(amount).toFixed(2)}</p>
            </div>
        `;
        }

        if (payoutIdInput) {
            payoutIdInput.value = payoutId;
        }

        if (modal) {
            modal.style.display = 'block';
        }

        // Store current payout ID globally
        window.currentPayoutId = payoutId;
    }

    function closePayoutModal() {
        const modal = document.getElementById('payoutModal');
        if (modal) {
            modal.style.display = 'none';
        }
        window.currentPayoutId = null;
        const adminNotesField = document.getElementById('adminNotes');
        if (adminNotesField) {
            adminNotesField.value = '';
        }
    }

    // ====================================
    //  Process Payout Function
    // ====================================
    async function processPayout(action) {
        if (!window.currentPayoutId || !['approve', 'reject'].includes(action)) {
            alert('Invalid payout action');
            return;
        }

        const adminNotes = document.getElementById('adminNotes')?.value || '';

        // Confirm action
        const confirmMessage = action === 'approve'
            ? 'Are you sure you want to APPROVE this withdrawal request?'
            : 'Are you sure you want to REJECT this withdrawal request? The amount will be refunded to the user.';

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await fetch('/api/admin/process-payout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    payoutId: window.currentPayoutId,
                    action: action,
                    adminNotes: adminNotes
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();

            if (result.success) {
                showMessage(`Payout request ${action}d successfully`, 'success');
                closePayoutModal();
                // Reload payouts list
                loadPayouts();
                // Update analytics
                loadAnalytics();
            } else {
                showMessage(result.error || 'Failed to process payout', 'error');
            }

        } catch (error) {
            console.error('Error processing payout:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    // TOURNAMENT FUNCTIONS
    async function loadTournaments() {
        try {
            const response = await adminFetch('/api/admin/tournaments');
            if (!response) return;

            const tournaments = await response.json();

            if (adminTournamentsContainer) {
                adminTournamentsContainer.innerHTML = '';

                if (tournaments.length === 0) {
                    adminTournamentsContainer.innerHTML = '<p>No tournaments found.</p>';
                    return;
                }

                const table = document.createElement('table');
                table.className = 'admin-table';

                const header = document.createElement('thead');
                header.innerHTML = `
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Entry Fee</th>
                        <th>Prize Pool</th>
                        <th>Participants</th>
                        <th>Status</th>
                        <th>Start Date</th>
                        <th>Actions</th>
                    </tr>
                `;
                table.appendChild(header);

                const tbody = document.createElement('tbody');
                tournaments.forEach(tournament => {
                    const row = createTournamentRow(tournament);
                    tbody.appendChild(row);
                });
                table.appendChild(tbody);

                adminTournamentsContainer.appendChild(table);
            }
        } catch (error) {
            console.error('Error loading tournaments:', error);
            showMessage('Failed to load tournaments', 'error');
        }
    }

    function createTournamentRow(tournament) {
        const row = document.createElement('tr');
        const startDate = new Date(tournament.start_date).toLocaleDateString();

        row.innerHTML = `
            <td>${tournament.id}</td>
            <td>${tournament.name}</td>
            <td>$${tournament.entry_fee}</td>
            <td>$${tournament.prize_pool}</td>
            <td>${tournament.current_participants}/${tournament.max_participants}</td>
            <td><span class="tournament-status status-${tournament.status}">${tournament.status}</span></td>
            <td>${startDate}</td>
            <td class="tournament-actions-cell">
                <div class="tournament-actions-group">
                    <button class="btn btn-small btn-primary view-participants-btn"
                            data-tournament-id="${tournament.id}"
                            data-tournament-name="${tournament.name}">
                        👥 View Participants (${tournament.current_participants})
                    </button>
                    <button class="btn btn-small btn-danger delete-tournament-btn"
                            data-tournament-id="${tournament.id}"
                            data-tournament-name="${tournament.name}">
                        🗑️ Delete Tournament
                    </button>
                </div>
            </td>
        `;

        // Existing view participants button event listener
        const viewBtn = row.querySelector('.view-participants-btn');
        viewBtn.addEventListener('click', function () {
            const tournamentId = this.getAttribute('data-tournament-id');
            const tournamentName = this.getAttribute('data-tournament-name');
            viewTournamentParticipants(tournamentId, tournamentName);
        });

        // Simple delete tournament button event listener
        const deleteBtn = row.querySelector('.delete-tournament-btn');
        deleteBtn.addEventListener('click', function () {
            const tournamentId = this.getAttribute('data-tournament-id');
            const tournamentName = this.getAttribute('data-tournament-name');

            confirmDeleteTournament(tournamentId, tournamentName);
        });

        return row;
    }

    function confirmDeleteTournament(tournamentId, tournamentName) {
        const confirmMessage = `Are you sure you want to delete the tournament "${tournamentName}"?\n\nThis will permanently remove:\n• Tournament data\n• All registration records\n\nThis action cannot be undone.`;

        if (confirm(confirmMessage)) {
            deleteTournament(tournamentId, tournamentName);
        }
    }

    async function deleteTournament(tournamentId, tournamentName) {
        try {
            // Show loading state
            showMessage(`Deleting tournament "${tournamentName}"...`, 'info');

            const response = await adminFetch(`/api/admin/tournaments/${tournamentId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response) {
                showMessage('Failed to delete tournament. Please try again.', 'error');
                return;
            }

            const result = await response.json();

            if (result.success) {
                showMessage(result.message, 'success');

                // Refresh tournaments and analytics
                loadTournaments();
                loadAnalytics();

            } else {
                showMessage(result.error || 'Failed to delete tournament', 'error');
            }

        } catch (error) {
            console.error('Delete tournament error:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    async function viewTournamentParticipants(tournamentId, tournamentName) {
        try {
            const response = await adminFetch(`/api/admin/tournament/${tournamentId}/participants`);
            if (!response) return;

            const participants = await response.json();

            document.getElementById('participantsModalTitle').textContent = `Participants: ${tournamentName}`;

            const container = document.getElementById('participantsContainer');
            container.innerHTML = '';

            if (participants.length === 0) {
                container.innerHTML = '<p>No participants in this tournament yet.</p>';
            } else {
                const table = document.createElement('table');
                table.className = 'admin-table';

                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Wallet Balance</th>
                            <th>Winnings Balance</th>
                            <th>Registration Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${participants.map(p => `
                            <tr>
                                <td>${p.id}</td>
                                <td>${p.username}</td>
                                <td>${p.email}</td>
                                <td>$${p.wallet_balance.toFixed(2)}</td>
                                <td>$${p.winnings_balance.toFixed(2)}</td>
                                <td>${new Date(p.registration_date).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                `;

                container.appendChild(table);
            }

            document.getElementById('participantsModal').style.display = 'block';

        } catch (error) {
            console.error('Error loading participants:', error);
            showMessage('Failed to load tournament participants', 'error');
        }
    }

    // USER MANAGEMENT FUNCTIONS
    async function loadUsers() {
        try {
            const response = await adminFetch('/api/admin/users');
            if (!response) return;

            const users = await response.json();

            if (usersContainer) {
                usersContainer.innerHTML = '';

                // Create search container
                const searchContainer = createUserSearchContainer(users.length);
                usersContainer.appendChild(searchContainer);

                if (users.length === 0) {
                    const noUsersDiv = document.createElement('div');
                    noUsersDiv.className = 'users-no-results';
                    noUsersDiv.innerHTML = `
                        <span class="users-no-results-icon icon-fix">👥</span>
                        <h4>No users found</h4>
                        <p>No users have registered yet.</p>
                    `;
                    usersContainer.appendChild(noUsersDiv);
                    return;
                }

                // Create users table
                const tableContainer = createUsersTable(users);
                usersContainer.appendChild(tableContainer);

                // Setup search functionality
                setupUserSearch(users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showMessage('Failed to load users', 'error');
        }
    }

    function createUserSearchContainer(userCount) {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'users-search-container';

        const searchHeader = document.createElement('div');
        searchHeader.className = 'users-search-header';

        const searchTitle = document.createElement('h3');
        searchTitle.className = 'users-search-title';
        searchTitle.innerHTML = '<span class="icon-fix">👥</span> Manage Users';

        const countBadge = document.createElement('span');
        countBadge.className = 'users-count-badge';
        countBadge.id = 'totalUsersCount';
        countBadge.textContent = `${userCount} users`;

        searchHeader.appendChild(searchTitle);
        searchHeader.appendChild(countBadge);

        const searchWrapper = document.createElement('div');
        searchWrapper.className = 'users-search-wrapper';

        const searchIcon = document.createElement('span');
        searchIcon.className = 'users-search-icon icon-fix';
        searchIcon.textContent = '🔍';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'users-search-input';
        searchInput.id = 'userSearchInput';
        searchInput.placeholder = 'Search users by username, email, or ID...';

        searchWrapper.appendChild(searchIcon);
        searchWrapper.appendChild(searchInput);

        const searchResults = document.createElement('div');
        searchResults.className = 'users-search-results';
        searchResults.id = 'searchResults';

        searchContainer.appendChild(searchHeader);
        searchContainer.appendChild(searchWrapper);
        searchContainer.appendChild(searchResults);

        return searchContainer;
    }

    function createUsersTable(users) {
        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        tableContainer.id = 'usersTableContainer';

        const table = document.createElement('table');
        table.className = 'admin-table';
        table.id = 'usersTable';

        const header = document.createElement('thead');
        header.innerHTML = `
            <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Wallet Balance</th>
                <th>Winnings Balance</th>
                <th>Created</th>
                <th>Ban Status</th>
                <th>Actions</th>
            </tr>
        `;
        table.appendChild(header);

        const tbody = document.createElement('tbody');
        tbody.id = 'usersTableBody';
        users.forEach(user => {
            const row = createUserRow(user);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        tableContainer.appendChild(table);
        return tableContainer;
    }

    function createUserRow(user, searchTerm = '') {
        const row = document.createElement('tr');
        const createdDate = new Date(user.created_at).toLocaleDateString();

        const highlightText = (text, term) => {
            if (!term) return text;
            const regex = new RegExp(`(${term})`, 'gi');
            return text.replace(regex, '<span class="search-highlight">$1</span>');
        };

        // Add ban status styling to row
        if (user.ban_status === 'banned') {
            row.classList.add('user-row-banned-permanent');
        } else if (user.ban_status === 'temp_banned') {
            row.classList.add('user-row-banned-temporary');
        }

        const banStatusHTML = getBanStatusHTML(user);
        const banButtonHTML = getBanActionButton(user);

        row.innerHTML = `
            <td>${highlightText(user.id.toString(), searchTerm)}</td>
            <td>${highlightText(user.username, searchTerm)}</td>
            <td>${highlightText(user.email, searchTerm)}</td>
            <td>$${user.wallet_balance.toFixed(2)}</td>
            <td>$${user.winnings_balance.toFixed(2)}</td>
            <td>${createdDate}</td>
            <td class="ban-status-cell">${banStatusHTML}</td>
            <td class="user-actions-cell">
                <div class="user-actions-group">
                    <button class="btn btn-small btn-primary update-winnings-btn"
                            data-user-id="${user.id}" data-username="${user.username}">
                        💰 Update Winnings
                    </button>
                    ${banButtonHTML}
                </div>
            </td>
        `;

        // Add event listeners
        const updateBtn = row.querySelector('.update-winnings-btn');
        updateBtn.addEventListener('click', function () {
            const userId = this.getAttribute('data-user-id');
            const username = this.getAttribute('data-username');
            openWinningsModal(userId, username);
        });

        const banBtn = row.querySelector('.ban-action-btn');
        if (banBtn) {
            banBtn.addEventListener('click', function () {
                const action = this.getAttribute('data-action');
                const userId = this.getAttribute('data-user-id');
                const username = this.getAttribute('data-username');

                if (action === 'ban') {
                    openBanModal(userId, username);
                } else if (action === 'unban') {
                    handleUnbanUser(userId, username);
                }
            });
        }

        return row;
    }

    function setupUserSearch(allUsers) {
        const searchInput = document.getElementById('userSearchInput');
        const searchResults = document.getElementById('searchResults');
        const totalUsersCount = document.getElementById('totalUsersCount');

        let filteredUsers = allUsers;

        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase().trim();

            if (searchTerm === '') {
                filteredUsers = allUsers;
                searchResults.classList.remove('active');
            } else {
                filteredUsers = allUsers.filter(user =>
                    user.username.toLowerCase().includes(searchTerm) ||
                    user.email.toLowerCase().includes(searchTerm) ||
                    user.id.toString().includes(searchTerm)
                );

                searchResults.classList.add('active');
                if (filteredUsers.length > 0) {
                    searchResults.innerHTML = `
                        <span class="search-results-text">
                            Found ${filteredUsers.length} user(s) matching "${searchTerm}"
                        </span>
                        <button class="search-clear-btn" onclick="clearUserSearch()">
                            <span class="icon-fix">✕</span> Clear
                        </button>
                    `;
                } else {
                    searchResults.innerHTML = `
                        <span class="search-results-text no-results">
                            No users found matching "${searchTerm}"
                        </span>
                        <button class="search-clear-btn" onclick="clearUserSearch()">
                            <span class="icon-fix">✕</span> Clear
                        </button>
                    `;
                }
            }

            updateUsersTable(filteredUsers, searchTerm);
            totalUsersCount.textContent = `${filteredUsers.length} of ${allUsers.length} users`;
        });
    }

    function updateUsersTable(users, searchTerm = '') {
        const tableBody = document.getElementById('usersTableBody');
        const tableContainer = document.getElementById('usersTableContainer');

        tableBody.innerHTML = '';

        if (users.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'users-no-results';
            noResults.innerHTML = `
                <span class="users-no-results-icon icon-fix">🔍</span>
                <h4>No users found</h4>
                <p>Try adjusting your search terms or clear the search to see all users.</p>
            `;
            tableContainer.style.display = 'none';
            tableContainer.parentNode.appendChild(noResults);
        } else {
            const existingNoResults = tableContainer.parentNode.querySelector('.users-no-results');
            if (existingNoResults) {
                existingNoResults.remove();
            }
            tableContainer.style.display = 'block';

            users.forEach(user => {
                const row = createUserRow(user, searchTerm);
                tableBody.appendChild(row);
            });
        }
    }

    window.clearUserSearch = function () {
        const searchInput = document.getElementById('userSearchInput');
        const searchResults = document.getElementById('searchResults');

        searchInput.value = '';
        searchResults.classList.remove('active');
        loadUsers();
    }

    // TRANSACTION FUNCTIONS
    async function loadTransactions() {
        try {
            const response = await adminFetch('/api/admin/transactions');
            if (!response) return;

            const transactions = await response.json();

            if (adminTransactionsContainer) {
                adminTransactionsContainer.innerHTML = '';

                const headerDiv = document.createElement('div');
                headerDiv.className = 'admin-transactions-header';

                const headerContent = document.createElement('div');
                headerContent.className = 'admin-transactions-header-content';
                headerContent.innerHTML = `
                    <h3>🔧 Admin Transaction History</h3>
                    <p>📋 Shows only transactions performed by admin (awarding winnings, etc.)</p>
                `;

                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'transactions-controls';

                const countSpan = document.createElement('span');
                countSpan.className = 'transactions-count';
                countSpan.textContent = `${transactions.length} admin actions`;

                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'admin-toggle-btn collapsed';
                toggleBtn.id = 'adminTransactionsToggle';
                toggleBtn.innerHTML = `
                    <span>View Actions</span>
                    <span class="toggle-icon">▼</span>
                `;

                controlsDiv.appendChild(countSpan);
                controlsDiv.appendChild(toggleBtn);
                headerDiv.appendChild(headerContent);
                headerDiv.appendChild(controlsDiv);

                const collapsibleDiv = document.createElement('div');
                collapsibleDiv.className = 'transactions-collapsible';
                collapsibleDiv.id = 'adminTransactionsCollapsible';

                if (transactions.length === 0) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'transactions-empty';
                    emptyDiv.innerHTML = `
                        <h4>No admin actions yet</h4>
                        <p>Your admin transaction history will appear here when you award winnings to users.</p>
                    `;
                    collapsibleDiv.appendChild(emptyDiv);
                } else {
                    const table = document.createElement('table');
                    table.className = 'admin-table';

                    const header = document.createElement('thead');
                    header.innerHTML = `
                        <tr>
                            <th>ID</th>
                            <th>User</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Balance Type</th>
                            <th>Description</th>
                            <th>Date</th>
                        </tr>
                    `;
                    table.appendChild(header);

                    const tbody = document.createElement('tbody');
                    transactions.forEach(transaction => {
                        const row = createTransactionRow(transaction);
                        tbody.appendChild(row);
                    });
                    table.appendChild(tbody);

                    collapsibleDiv.appendChild(table);
                }

                adminTransactionsContainer.appendChild(headerDiv);
                adminTransactionsContainer.appendChild(collapsibleDiv);

                // Add toggle functionality
                const collapsible = document.getElementById('adminTransactionsCollapsible');
                const toggleIcon = toggleBtn.querySelector('.toggle-icon');

                toggleBtn.addEventListener('click', function () {
                    const isExpanded = collapsible.classList.contains('expanded');

                    if (isExpanded) {
                        collapsible.classList.remove('expanded');
                        toggleBtn.classList.add('collapsed');
                        toggleBtn.querySelector('span').textContent = 'View Actions';
                        toggleIcon.classList.remove('rotated');
                    } else {
                        collapsible.classList.add('expanded');
                        toggleBtn.classList.remove('collapsed');
                        toggleBtn.querySelector('span').textContent = 'Hide Actions';
                        toggleIcon.classList.add('rotated');
                    }
                });
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            showMessage('Failed to load transactions', 'error');
        }
    }

    function createTransactionRow(transaction) {
        const row = document.createElement('tr');
        const date = new Date(transaction.transaction_date).toLocaleString();
        const typeClass = `transaction-type-${transaction.transaction_type}`;
        const amountPrefix = transaction.transaction_type === 'credit' ? '+' : '-';

        row.innerHTML = `
            <td>${transaction.id}</td>
            <td>${transaction.username}</td>
            <td class="${typeClass}">${transaction.transaction_type.toUpperCase()}</td>
            <td class="${typeClass}">${amountPrefix}$${transaction.amount.toFixed(2)}</td>
            <td>${transaction.balance_type.toUpperCase()}</td>
            <td>${transaction.description}</td>
            <td>${date}</td>
        `;

        return row;
    }

    // Tournament Management Functions
    function loadManageTournaments() {
        console.log('Loading tournament management...');
        loadTournamentsForManagement();
        initializeTournamentManagementEvents();
    }

    async function loadTournamentsForManagement() {
        try {
            const response = await adminFetch('/api/admin/tournaments');
            if (!response) return;

            const tournaments = await response.json();
            const select = document.getElementById('manageTournamentSelect');

            if (select) {
                select.innerHTML = '<option value="">Select a tournament...</option>';

                tournaments.forEach(tournament => {
                    const option = document.createElement('option');
                    option.value = tournament.id;
                    option.textContent = `${tournament.name} (${tournament.status}) - ${tournament.current_participants}/${tournament.max_participants} players`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading tournaments for management:', error);
            showMessage('Failed to load tournaments', 'error');
        }
    }

    function initializeTournamentManagementEvents() {
        // Load Tournament Button
        const loadTournamentBtn = document.getElementById('loadTournamentBtn');
        if (loadTournamentBtn) {
            loadTournamentBtn.addEventListener('click', loadSelectedTournament);
        }

        // Match Details Form
        const matchDetailsForm = document.getElementById('matchDetailsForm');
        if (matchDetailsForm) {
            matchDetailsForm.addEventListener('submit', updateMatchDetails);
        }

        // Announcement Form
        const announcementForm = document.getElementById('announcementForm');
        if (announcementForm) {
            announcementForm.addEventListener('submit', postAnnouncement);
        }

        // Character counter for announcements
        const announcementText = document.getElementById('announcementText');
        const announcementCharCount = document.getElementById('announcementCharCount');
        if (announcementText && announcementCharCount) {
            announcementText.addEventListener('input', function () {
                announcementCharCount.textContent = this.value.length;
            });
        }

        // Refresh buttons
        const refreshTournamentBtn = document.getElementById('refreshTournamentBtn');
        if (refreshTournamentBtn) {
            refreshTournamentBtn.addEventListener('click', refreshTournamentData);
        }

        const refreshChatBtn = document.getElementById('refreshChatBtn');
        if (refreshChatBtn) {
            refreshChatBtn.addEventListener('click', loadLiveChatMessages);
        }

        // Action buttons
        const viewTournamentLobbyBtn = document.getElementById('viewTournamentLobbyBtn');
        if (viewTournamentLobbyBtn) {
            viewTournamentLobbyBtn.addEventListener('click', viewTournamentLobby);
        }

        // ===== NEW BUTTON EVENT LISTENERS =====

        // Update Tournament Status Button
        const updateTournamentStatusBtn = document.getElementById('updateTournamentStatusBtn');
        if (updateTournamentStatusBtn) {
            updateTournamentStatusBtn.addEventListener('click', updateTournamentStatus);
        }

        // Export Participants Button
        const exportParticipantsBtn = document.getElementById('exportParticipantsBtn');
        if (exportParticipantsBtn) {
            exportParticipantsBtn.addEventListener('click', exportParticipants);
        }

        // Send Bulk Message Button
        const sendBulkMessageBtn = document.getElementById('sendBulkMessageBtn');
        if (sendBulkMessageBtn) {
            sendBulkMessageBtn.addEventListener('click', sendBulkMessage);
        }
    }

    async function loadSelectedTournament() {
        const select = document.getElementById('manageTournamentSelect');
        const tournamentId = select.value;

        if (!tournamentId) {
            showMessage('Please select a tournament', 'error');
            return;
        }

        currentManagedTournamentId = tournamentId;

        // Show management panels
        const panels = document.getElementById('tournamentManagementPanels');
        if (panels) {
            panels.style.display = 'block';
        }

        // Load tournament data
        await loadTournamentManagementData();
    }

    async function loadTournamentManagementData() {
        if (!currentManagedTournamentId) return;

        try {
            // Load tournament overview
            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/manage`);
            if (!response) return;

            const data = await response.json();

            // Update overview
            document.getElementById('manageTournamentName').textContent = data.tournament.name;
            document.getElementById('manageTournamentStatus').textContent = data.tournament.status;
            document.getElementById('manageTournamentParticipants').textContent =
                `${data.tournament.current_participants}/${data.tournament.max_participants}`;
            document.getElementById('manageTournamentPrize').textContent = `$${data.tournament.prize_pool}`;

            // Load match details if they exist
            if (data.matchDetails) {
                const match = data.matchDetails;
                document.getElementById('roomIdInput').value = match.room_id || '';
                document.getElementById('roomPasswordInput').value = match.room_password || '';
                document.getElementById('gameServerInput').value = match.game_server || '';

                if (match.match_start_time) {
                    const date = new Date(match.match_start_time);
                    document.getElementById('matchStartTimeInput').value = date.toISOString().slice(0, 16);
                }
            }

            // Load recent announcements
            await loadRecentAnnouncements();

            // Load live chat
            await loadLiveChatMessages();

            // Start auto-refresh for chat
            if (chatRefreshInterval) {
                clearInterval(chatRefreshInterval);
            }
            chatRefreshInterval = setInterval(loadLiveChatMessages, 5000);

        } catch (error) {
            console.error('Error loading tournament management data:', error);
            showMessage('Failed to load tournament data', 'error');
        }
    }

    async function updateMatchDetails(e) {
        e.preventDefault();

        if (!currentManagedTournamentId) {
            showMessage('No tournament selected', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const matchDetails = {
            room_id: formData.get('room_id'),
            room_password: formData.get('room_password'),
            match_start_time: formData.get('match_start_time'),
            game_server: formData.get('game_server')
        };

        try {
            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/match-details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(matchDetails)
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage('Match details updated successfully', 'success');
            } else {
                showMessage(result.error || 'Failed to update match details', 'error');
            }
        } catch (error) {
            console.error('Error updating match details:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    async function postAnnouncement(e) {
        e.preventDefault();

        if (!currentManagedTournamentId) {
            showMessage('No tournament selected', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const message = formData.get('message').trim();

        if (!message) {
            showMessage('Announcement cannot be empty', 'error');
            return;
        }

        try {
            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/announce`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage('Announcement posted successfully', 'success');
                document.getElementById('announcementText').value = '';
                document.getElementById('announcementCharCount').textContent = '0';
                await loadRecentAnnouncements();
            } else {
                showMessage(result.error || 'Failed to post announcement', 'error');
            }
        } catch (error) {
            console.error('Error posting announcement:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    async function loadRecentAnnouncements() {
        if (!currentManagedTournamentId) return;

        try {
            const response = await adminFetch(`/api/tournament/${currentManagedTournamentId}/announcements`);
            if (!response) return;

            const announcements = await response.json();
            const container = document.getElementById('recentAnnouncementsList');

            if (container) {
                container.innerHTML = '';

                if (announcements.length === 0) {
                    container.innerHTML = '<p class="no-announcements">No announcements yet</p>';
                    return;
                }

                announcements.slice(0, 5).forEach(announcement => {
                    const announcementElement = createAnnouncementManagementElement(announcement);
                    container.appendChild(announcementElement);
                });
            }
        } catch (error) {
            console.error('Error loading recent announcements:', error);
        }
    }

    function createAnnouncementManagementElement(announcement) {
        const announcementDiv = document.createElement('div');
        announcementDiv.className = 'announcement-management-item';

        const timestamp = new Date(announcement.created_at).toLocaleString();

        announcementDiv.innerHTML = `
            <div class="announcement-management-header">
                <span class="announcement-management-time">${timestamp}</span>
            </div>
            <div class="announcement-management-content">${escapeHtml(announcement.message)}</div>
        `;

        return announcementDiv;
    }

    async function loadLiveChatMessages() {
        if (!currentManagedTournamentId) return;

        try {
            const response = await adminFetch(`/api/tournament/${currentManagedTournamentId}/chat`);
            if (!response) return;

            const messages = await response.json();
            const container = document.getElementById('liveChatMessages');

            if (container) {
                container.innerHTML = '';

                if (messages.length === 0) {
                    container.innerHTML = '<p class="no-chat-messages">No chat messages yet</p>';
                    return;
                }

                messages.slice(-10).forEach(message => {
                    const messageElement = createChatManagementElement(message);
                    container.appendChild(messageElement);
                });

                // Scroll to bottom
                container.scrollTop = container.scrollHeight;
            }
        } catch (error) {
            console.error('Error loading live chat messages:', error);
        }
    }

    function createChatManagementElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-management-message ${message.is_admin ? 'admin-message' : 'user-message'}`;

        const timestamp = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="chat-management-header">
                <span class="chat-management-username ${message.is_admin ? 'admin-username' : ''}">${message.username}${message.is_admin ? ' 👑' : ''}</span>
                <span class="chat-management-time">${timestamp}</span>
            </div>
            <div class="chat-management-content">${escapeHtml(message.message)}</div>
        `;

        return messageDiv;
    }

    async function refreshTournamentData() {
        if (currentManagedTournamentId) {
            await loadTournamentManagementData();
            showMessage('Tournament data refreshed', 'success');
        }
    }

    function viewTournamentLobby() {
        if (currentManagedTournamentId) {
            window.open(`/tournament/${currentManagedTournamentId}`, '_blank');
        }
    }

    // UPDATE TOURNAMENT STATUS FUNCTION
    async function updateTournamentStatus() {
        if (!currentManagedTournamentId) {
            showMessage('No tournament selected', 'error');
            return;
        }

        // Get current status
        const currentStatus = document.getElementById('manageTournamentStatus').textContent;

        // Show status selection
        const newStatus = prompt(`Current status: ${currentStatus}\n\nSelect new status:\n- upcoming\n- active\n- completed\n\nEnter new status:`);

        if (!newStatus) {
            return; // User cancelled
        }

        const validStatuses = ['upcoming', 'active', 'completed'];
        if (!validStatuses.includes(newStatus.toLowerCase())) {
            showMessage('Invalid status. Use: upcoming, active, or completed', 'error');
            return;
        }

        if (newStatus.toLowerCase() === currentStatus.toLowerCase()) {
            showMessage('Status is already set to ' + newStatus, 'info');
            return;
        }

        try {
            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus.toLowerCase() })
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage(`Tournament status updated to: ${newStatus}`, 'success');
                // Refresh tournament data
                await loadTournamentManagementData();
                // Refresh main tournaments list
                if (document.getElementById('tournamentsTab').classList.contains('active')) {
                    loadTournaments();
                }
            } else {
                showMessage(result.error || 'Failed to update status', 'error');
            }
        } catch (error) {
            console.error('Error updating tournament status:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    // EXPORT PARTICIPANTS FUNCTION
    async function exportParticipants() {
        if (!currentManagedTournamentId) {
            showMessage('No tournament selected', 'error');
            return;
        }

        try {
            showMessage('Exporting participants...', 'info');

            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/export-participants`);

            if (!response) return;

            const exportData = await response.json();

            // Create downloadable file
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            // Create download link
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tournament-${currentManagedTournamentId}-participants-${new Date().toISOString().split('T')[0]}.json`;

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showMessage(`Exported ${exportData.total_participants} participants successfully!`, 'success');

        } catch (error) {
            console.error('Error exporting participants:', error);
            showMessage('Failed to export participants', 'error');
        }
    }

    // SEND BULK MESSAGE FUNCTION
    async function sendBulkMessage() {
        if (!currentManagedTournamentId) {
            showMessage('No tournament selected', 'error');
            return;
        }

        // Get message from user
        const message = prompt('📢 Send message to all tournament participants:\n\n(This will appear in tournament chat with [ADMIN BROADCAST] prefix)');

        if (!message) {
            return; // User cancelled
        }

        if (message.trim().length === 0) {
            showMessage('Message cannot be empty', 'error');
            return;
        }

        if (message.length > 200) {
            showMessage('Message too long (max 200 characters)', 'error');
            return;
        }

        // Confirm action
        const confirmSend = window.confirm(`Send this message to all tournament participants?\n\n"${message}"\n\nThis cannot be undone.`);

        if (!confirmSend) {
            return;
        }

        try {
            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/bulk-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message.trim() })
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage('Bulk message sent to all participants!', 'success');
                // Refresh live chat to show the message
                await loadLiveChatMessages();
            } else {
                showMessage(result.error || 'Failed to send bulk message', 'error');
            }
        } catch (error) {
            console.error('Error sending bulk message:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // FORM HANDLERS
    if (createTournamentForm) {
        createTournamentForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // PREVENT DOUBLE SUBMISSION
            if (isCreatingTournament) {
                console.log('Tournament creation already in progress...');
                return;
            }

            isCreatingTournament = true;

            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            try {
                // Disable button and show loading
                submitBtn.disabled = true;
                submitBtn.innerHTML = '🔄 Creating Tournament...';

                const formData = new FormData(createTournamentForm);
                const tournamentData = {
                    name: formData.get('name'),
                    description: formData.get('description'),
                    game_type: formData.get('game_type'),
                    team_mode: formData.get('team_mode'),
                    entry_fee: parseFloat(formData.get('entry_fee')),
                    prize_pool: parseFloat(formData.get('prize_pool')),
                    max_participants: parseInt(formData.get('max_participants')),
                    start_date: formData.get('start_date'),
                    end_date: formData.get('end_date'),
                    kill_points: parseInt(formData.get('kill_points')) || 1,
                    rank_points: formData.get('rank_points') || '{"1":10,"2":8,"3":6,"4":4,"5":2,"6":1}',
                    match_type: formData.get('match_type') || 'Battle Royale'
                };

                console.log('Creating tournament with data:', tournamentData);

                // Use ONLY the enhanced endpoint
                const response = await fetch('/api/admin/tournaments/enhanced', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(tournamentData)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    showMessage(result.message || 'Tournament created successfully!', 'success');
                    createTournamentForm.reset();
                    loadAnalytics();
                    if (document.getElementById('tournamentsTab').classList.contains('active')) {
                        loadTournaments();
                    }
                } else {
                    throw new Error(result.error || 'Failed to create tournament');
                }

            } catch (error) {
                console.error('Tournament creation error:', error);
                showMessage(error.message || 'Failed to create tournament', 'error');
            } finally {
                // Re-enable button and reset state
                isCreatingTournament = false;
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    if (updateWinningsForm) {
        updateWinningsForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(updateWinningsForm);
            const userId = document.getElementById('selectedUserId').value;
            const amount = parseFloat(formData.get('amount'));

            try {
                const response = await adminFetch('/api/admin/update-winnings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId: parseInt(userId), amount: amount })
                });

                if (!response) return;

                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, 'success');
                    winningsModal.style.display = 'none';
                    updateWinningsForm.reset();
                    loadUsers();
                    loadAnalytics();
                } else {
                    showMessage(result.error || 'Failed to update winnings', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            }
        });
    }

    // MODAL HANDLERS
    if (closeModal) {
        closeModal.addEventListener('click', function () {
            winningsModal.style.display = 'none';
        });
    }

    window.addEventListener('click', function (e) {
        if (e.target === winningsModal) {
            winningsModal.style.display = 'none';
        }
        if (e.target === document.getElementById('participantsModal')) {
            closeParticipantsModal();
        }
        if (e.target === banModal) {
            closeBanModal();
        }
        if (e.target === document.getElementById('payoutModal')) {
            closePayoutModal();
        }
    });

    // LOGOUT HANDLER
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
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

    // UTILITY FUNCTIONS
    async function loadUserInfo() {
        try {
            const response = await adminFetch('/api/user');
            if (!response) return;

            const user = await response.json();

            if (usernameDisplay) {
                usernameDisplay.textContent = `Admin: ${user.username}`;
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    function openWinningsModal(userId, username) {
        document.getElementById('selectedUserId').value = userId;
        document.querySelector('#winningsModal h3').textContent = `Update Winnings for ${username}`;
        winningsModal.style.display = 'block';
    }

    window.closeParticipantsModal = function () {
        document.getElementById('participantsModal').style.display = 'none';
    }

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    // BAN SYSTEM FUNCTIONS
    function initializeBanModal() {
        const banModalHTML = `
        <div id="banModal" class="modal ban-modal">
            <div class="modal-content ban-modal-content">
                <div class="modal-header ban-modal-header">
                    <h3 id="banModalTitle">Ban User</h3>
                    <span class="close ban-modal-close">&times;</span>
                </div>
                <div class="modal-body ban-modal-body">
                    <form id="banUserForm" class="ban-form">
                        <div class="ban-user-info">
                            <div class="ban-user-avatar">👤</div>
                            <div class="ban-user-details">
                                <h4 id="banUserName">Username</h4>
                                <p id="banUserId">ID: #123</p>
                            </div>
                        </div>
                        
                        <div class="ban-form-group">
                            <label for="banType" class="ban-label">Ban Type:</label>
                            <select id="banType" name="banType" class="ban-select" required>
                                <option value="">Select ban type</option>
                                <option value="temporary">⏰ Temporary Ban</option>
                                <option value="permanent">🚫 Permanent Ban</option>
                            </select>
                        </div>
                        
                        <div class="ban-form-group" id="banExpiryGroup" style="display: none;">
                            <label for="banExpiry" class="ban-label">Ban Expires On:</label>
                            <input type="datetime-local" id="banExpiry" name="banExpiry" class="ban-input">
                            <small class="ban-help-text">User will be automatically unbanned after this date</small>
                        </div>
                        
                        <div class="ban-form-group">
                            <label for="banReason" class="ban-label">Reason for Ban:</label>
                            <textarea id="banReason" name="banReason" class="ban-textarea" 
                                    placeholder="Enter detailed reason for banning this user..." 
                                    rows="4" required></textarea>
                            <small class="ban-help-text">This reason will be visible to other admins</small>
                        </div>
                        
                        <div class="ban-form-actions">
                            <button type="button" class="btn btn-secondary ban-cancel-btn">Cancel</button>
                            <button type="submit" class="btn btn-danger ban-submit-btn">
                                <span class="ban-submit-icon">🔨</span>
                                <span class="ban-submit-text">Ban User</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', banModalHTML);

        banModal = document.getElementById('banModal');
        const banForm = document.getElementById('banUserForm');
        const banTypeSelect = document.getElementById('banType');
        const banExpiryGroup = document.getElementById('banExpiryGroup');
        const closeBtn = banModal.querySelector('.ban-modal-close');
        const cancelBtn = banModal.querySelector('.ban-cancel-btn');

        banTypeSelect.addEventListener('change', function () {
            if (this.value === 'temporary') {
                banExpiryGroup.style.display = 'block';
                document.getElementById('banExpiry').required = true;

                const minDate = new Date();
                minDate.setHours(minDate.getHours() + 1);
                document.getElementById('banExpiry').min = minDate.toISOString().slice(0, 16);
            } else {
                banExpiryGroup.style.display = 'none';
                document.getElementById('banExpiry').required = false;
            }

            const submitText = banModal.querySelector('.ban-submit-text');
            if (this.value === 'permanent') {
                submitText.textContent = 'Permanently Ban User';
                banModal.querySelector('.ban-submit-icon').textContent = '🚫';
            } else if (this.value === 'temporary') {
                submitText.textContent = 'Temporarily Ban User';
                banModal.querySelector('.ban-submit-icon').textContent = '⏰';
            } else {
                submitText.textContent = 'Ban User';
                banModal.querySelector('.ban-submit-icon').textContent = '🔨';
            }
        });

        banForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            await handleBanUser();
        });

        closeBtn.addEventListener('click', closeBanModal);
        cancelBtn.addEventListener('click', closeBanModal);
    }

    function openBanModal(userId, username) {
        currentBanUserId = userId;
        currentBanUsername = username;

        document.getElementById('banUserName').textContent = username;
        document.getElementById('banUserId').textContent = `ID: #${userId}`;
        document.getElementById('banModalTitle').textContent = `Ban ${username}`;

        document.getElementById('banUserForm').reset();
        document.getElementById('banExpiryGroup').style.display = 'none';
        document.getElementById('banExpiry').required = false;

        banModal.style.display = 'block';
        banModal.classList.add('show');
    }

    function closeBanModal() {
        banModal.style.display = 'none';
        banModal.classList.remove('show');
        currentBanUserId = null;
        currentBanUsername = null;
    }

    async function handleBanUser() {
        const formData = new FormData(document.getElementById('banUserForm'));
        const banData = {
            userId: parseInt(currentBanUserId),
            banType: formData.get('banType'),
            banReason: formData.get('banReason'),
            banExpiry: formData.get('banExpiry') || null
        };

        if (banData.banType === 'temporary') {
            const expiryDate = new Date(banData.banExpiry);
            const now = new Date();

            if (expiryDate <= now) {
                showMessage('Ban expiry date must be in the future', 'error');
                return;
            }
        }

        const submitBtn = banModal.querySelector('.ban-submit-btn');
        if (!submitBtn) {
            console.error('Submit button not found');
            return;
        }

        const originalText = submitBtn.innerHTML;

        try {
            submitBtn.innerHTML = '<span class="loading-spinner">⏳</span> Banning...';
            submitBtn.disabled = true;

            const response = await adminFetch('/api/admin/ban-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(banData)
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage(result.message, 'success');
                closeBanModal();
                loadUsers();
                loadAnalytics();
            } else {
                showMessage(result.error || 'Failed to ban user', 'error');
            }
        } catch (error) {
            console.error('Ban request error:', error);
            showMessage('Network error. Please try again.', 'error');
        } finally {
            if (submitBtn && originalText) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    async function handleUnbanUser(userId, username) {
        if (!confirm(`Are you sure you want to unban "${username}"? They will regain full access to the platform.`)) {
            return;
        }

        try {
            const response = await adminFetch('/api/admin/unban-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: parseInt(userId) })
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage(result.message, 'success');
                loadUsers();
                loadAnalytics();
            } else {
                showMessage(result.error || 'Failed to unban user', 'error');
            }
        } catch (error) {
            showMessage('Network error. Please try again.', 'error');
        }
    }

});

// BAN SYSTEM HELPER FUNCTIONS (outside DOMContentLoaded)
function getBanStatusHTML(user) {
    if (user.ban_status === 'active' || !user.ban_status) {
        return '<span class="ban-status ban-status-active">✅ Active</span>';
    } else if (user.ban_status === 'temp_banned') {
        const expiryDate = new Date(user.ban_expiry);
        const isExpired = expiryDate <= new Date();

        if (isExpired) {
            return '<span class="ban-status ban-status-expired">⏰ Expired</span>';
        } else {
            return `<span class="ban-status ban-status-temporary">⏰ Temp Ban<br><small>Until ${expiryDate.toLocaleDateString()}</small></span>`;
        }
    } else if (user.ban_status === 'banned') {
        return '<span class="ban-status ban-status-permanent">🚫 Permanent</span>';
    }

    return '<span class="ban-status ban-status-active">✅ Active</span>';
}

function getBanActionButton(user) {
    if (user.ban_status === 'active' || !user.ban_status) {
        return `<button class="btn btn-small btn-warning ban-action-btn" 
                       data-action="ban" data-user-id="${user.id}" data-username="${user.username}">
                    🔨 Ban User
                </button>`;
    } else {
        return `<button class="btn btn-small btn-success ban-action-btn" 
                       data-action="unban" data-user-id="${user.id}" data-username="${user.username}">
                    ✅ Unban User
                </button>`;
    }
}


// Enhanced Admin Tournament Creation JavaScript
// Game images mapping
const gameImages = {
    'Free Fire': '/images/games/freefire.jpg',
    'BGMI': '/images/games/bgmi.jpg',
    'Valorant': '/images/games/valorant.jpg',
    'CODM': '/images/games/codm.jpg'
};

// Initialize enhanced tournament creation
function initializeEnhancedTournamentCreation() {
    const gameTypeSelect = document.getElementById('gameType');
    const teamModeSelect = document.getElementById('teamMode');
    const autoFillBtn = document.getElementById('autoFillBtn');
    const tournamentForm = document.getElementById('createTournamentForm');

    // Auto-fill tournament name
    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', autoFillTournamentName);
    }

    // Live preview updates
    if (gameTypeSelect) gameTypeSelect.addEventListener('change', updateTournamentPreview);
    if (teamModeSelect) teamModeSelect.addEventListener('change', updateTournamentPreview);

    // Form inputs for preview
    const previewInputs = [
        'tournamentName', 'entryFee', 'prizePool', 'maxParticipants'
    ];

    previewInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', updateTournamentPreview);
        }
    });

    // Enhanced form submission
    if (tournamentForm) {
        tournamentForm.removeEventListener('submit', handleEnhancedTournamentCreation);
        tournamentForm.addEventListener('submit', handleEnhancedTournamentCreation);
    }

    // Set default values
    setDefaultValues();
}

// Set default values for new fields
function setDefaultValues() {
    const killPointsInput = document.getElementById('killPoints');
    const rankPointsInput = document.getElementById('rankPoints');
    const matchTypeSelect = document.getElementById('matchType');

    if (killPointsInput && !killPointsInput.value) {
        killPointsInput.value = '1';
    }

    if (rankPointsInput && !rankPointsInput.value) {
        rankPointsInput.value = '{"1":10,"2":8,"3":6,"4":4,"5":2,"6":1}';
    }

    if (matchTypeSelect && !matchTypeSelect.value) {
        matchTypeSelect.value = 'Battle Royale';
    }
}

// Auto-fill tournament name based on selection
function autoFillTournamentName() {
    const gameType = document.getElementById('gameType').value;
    const teamMode = document.getElementById('teamMode').value;
    const tournamentNameInput = document.getElementById('tournamentName');

    if (!gameType || !teamMode) {
        showMessage('Please select both game type and team mode first', 'warning');
        return;
    }

    const modeNames = {
        'solo': 'Solo',
        'duo': 'Duo',
        'squad': 'Squad'
    };

    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });

    const autoName = `${gameType} ${modeNames[teamMode]} Championship - ${dateString}`;

    if (tournamentNameInput) {
        tournamentNameInput.value = autoName;
        updateTournamentPreview();
    }
}

// Update tournament preview
function updateTournamentPreview() {
    const gameType = document.getElementById('gameType').value;
    const teamMode = document.getElementById('teamMode').value;
    const tournamentName = document.getElementById('tournamentName').value;
    const entryFee = document.getElementById('entryFee').value;
    const prizePool = document.getElementById('prizePool').value;
    const maxParticipants = document.getElementById('maxParticipants').value;

    const preview = document.getElementById('tournamentPreview');
    const previewGameImage = document.getElementById('previewGameImage');
    const previewGameBadge = document.getElementById('previewGameBadge');
    const previewModeBadge = document.getElementById('previewModeBadge');
    const previewName = document.getElementById('previewName');
    const previewFee = document.getElementById('previewFee');
    const previewPrize = document.getElementById('previewPrize');
    const previewMax = document.getElementById('previewMax');

    // Show preview if we have basic info
    if (gameType || teamMode || tournamentName) {
        if (preview) preview.style.display = 'block';

        // Update preview content
        if (previewGameImage && gameType) {
            previewGameImage.src = gameImages[gameType] || '/images/games/default.jpg';
        }

        if (previewGameBadge) {
            previewGameBadge.textContent = gameType || 'Select Game';
        }

        if (previewModeBadge) {
            const modeLabels = { 'solo': 'Solo', 'duo': 'Duo', 'squad': 'Squad' };
            previewModeBadge.textContent = modeLabels[teamMode] || 'Select Mode';
        }

        if (previewName) {
            previewName.textContent = tournamentName || 'Tournament Name';
        }

        if (previewFee) {
            previewFee.textContent = entryFee || '0';
        }

        if (previewPrize) {
            previewPrize.textContent = prizePool || '0';
        }

        if (previewMax) {
            previewMax.textContent = maxParticipants || '0';
        }
    } else {
        if (preview) preview.style.display = 'none';
    }
}

// Enhanced tournament creation handler
async function handleEnhancedTournamentCreation(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const tournamentData = {
        name: formData.get('name'),
        description: formData.get('description'),
        game_type: formData.get('game_type'),
        team_mode: formData.get('team_mode'),
        entry_fee: parseFloat(formData.get('entry_fee')),
        prize_pool: parseFloat(formData.get('prize_pool')),
        max_participants: parseInt(formData.get('max_participants')),
        start_date: formData.get('start_date'),
        end_date: formData.get('end_date'),
        kill_points: parseInt(formData.get('kill_points')) || 1,
        rank_points: formData.get('rank_points') || '{"1":10,"2":8,"3":6,"4":4,"5":2,"6":1}',
        match_type: formData.get('match_type') || 'Battle Royale'
    };

    // Validation
    if (!tournamentData.name || !tournamentData.game_type || !tournamentData.team_mode) {
        showMessage('Please fill in all required fields including game type and team mode', 'error');
        return;
    }

    // Validate JSON format for rank points
    try {
        JSON.parse(tournamentData.rank_points);
    } catch (error) {
        showMessage('Invalid rank points format. Please use valid JSON format.', 'error');
        return;
    }

    // Validate dates
    const startDate = new Date(tournamentData.start_date);
    const endDate = new Date(tournamentData.end_date);
    const now = new Date();

    if (startDate < now) {
        showMessage('Start date cannot be in the past', 'error');
        return;
    }

    if (endDate <= startDate) {
        showMessage('End date must be after start date', 'error');
        return;
    }

    try {
        const submitBtn = e.target.querySelector('.create-tournament-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '🔄 Creating Tournament...';
        }

        // Use enhanced API endpoint
        const response = await fetch('/api/admin/tournaments/enhanced', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tournamentData)
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(result.message || 'Enhanced tournament created successfully!', 'success');

            // Reset form
            e.target.reset();
            setDefaultValues();
            updateTournamentPreview();

            // Refresh tournaments list if visible
            if (typeof loadTournaments === 'function') {
                await loadTournaments();
            }

        } else {
            throw new Error(result.error || 'Failed to create tournament');
        }

    } catch (error) {
        console.error('Enhanced tournament creation error:', error);
        showMessage(error.message || 'Failed to create tournament', 'error');
    } finally {
        const submitBtn = e.target.querySelector('.create-tournament-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🚀 Create Enhanced Tournament';
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Small delay to ensure all elements are loaded
    setTimeout(() => {
        initializeEnhancedTournamentCreation();
    }, 500);
});

// ====================================
// Make functions globally available
// ====================================
window.initializeEnhancedTournamentCreation = initializeEnhancedTournamentCreation;
window.autoFillTournamentName = autoFillTournamentName;
window.updateTournamentPreview = updateTournamentPreview;
window.loadPayouts = loadPayouts;
window.openPayoutModal = openPayoutModal;
window.closePayoutModal = closePayoutModal;
window.processPayout = processPayout;

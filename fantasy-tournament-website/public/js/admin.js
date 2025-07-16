// Enhanced Admin JavaScript with Ban System and Session Management

// Ban System Variables
let banModal = null;
let currentBanUserId = null;
let currentBanUsername = null;

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
        tabContents.forEach(content => {
            content.classList.remove('active');
        });

        // Remove active class from all buttons
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
            case 'create-tournament':
                selectedTab = document.getElementById('createTournamentTab');
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
        }
    }

    // ANALYTICS FUNCTIONS

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

            // Popular tournament
            const popularTournament = analytics.popularTournament;
            document.getElementById('popularTournamentName').textContent = popularTournament.name || 'No tournaments';
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
            <td>
                <button class="btn btn-small btn-primary view-participants-btn" data-tournament-id="${tournament.id}" data-tournament-name="${tournament.name}">
                    👥 View Participants (${tournament.current_participants})
                </button>
            </td>
        `;

        const viewBtn = row.querySelector('.view-participants-btn');
        viewBtn.addEventListener('click', function () {
            const tournamentId = this.getAttribute('data-tournament-id');
            const tournamentName = this.getAttribute('data-tournament-name');
            viewTournamentParticipants(tournamentId, tournamentName);
        });

        return row;
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

    // FORM HANDLERS

    if (createTournamentForm) {
        createTournamentForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(createTournamentForm);
            const tournamentData = {
                name: formData.get('name'),
                description: formData.get('description'),
                entry_fee: parseFloat(formData.get('entry_fee')),
                prize_pool: parseFloat(formData.get('prize_pool')),
                max_participants: parseInt(formData.get('max_participants')),
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date')
            };

            try {
                const response = await adminFetch('/api/admin/tournaments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(tournamentData)
                });

                if (!response) return;

                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, 'success');
                    createTournamentForm.reset();
                    loadAnalytics();
                    if (document.getElementById('tournamentsTab').classList.contains('active')) {
                        loadTournaments();
                    }
                } else {
                    showMessage(result.error || 'Failed to create tournament', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
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
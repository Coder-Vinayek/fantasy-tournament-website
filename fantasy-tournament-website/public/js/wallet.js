// Enhanced Wallet JavaScript - No inline JS for CPC compliance

document.addEventListener('DOMContentLoaded', function () {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logoutBtn');
    const walletBalanceSpan = document.getElementById('walletBalance');
    const winningsBalanceSpan = document.getElementById('winningsBalance');
    const depositForm = document.getElementById('depositForm');
    const withdrawForm = document.getElementById('withdrawForm');
    const transactionsContainer = document.getElementById('transactionsContainer');
    const messageDiv = document.getElementById('message');

    // Initialize page
    loadUserInfo();
    loadTransactions();

    // Logout handler
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

    // Deposit form handler
    if (depositForm) {
        depositForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(depositForm);
            const amount = parseFloat(formData.get('amount'));

            if (!amount || amount <= 0) {
                showMessage('Please enter a valid amount', 'error');
                return;
            }

            if (amount > 5000) {
                showMessage('Maximum deposit amount is $5,000 per transaction', 'error');
                return;
            }

            try {
                // Show loading state
                const submitBtn = depositForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Processing...';
                submitBtn.disabled = true;

                const response = await fetch('/api/wallet/deposit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ amount: amount })
                });

                const result = await response.json();

                // Reset button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;

                if (result.success) {
                    showMessage(`✅ ${result.message} $${amount.toFixed(2)} has been added to your wallet balance.`, 'success');
                    depositForm.reset();
                    await loadUserInfo();
                    await loadTransactions();
                } else {
                    showMessage(`❌ ${result.error || 'Deposit failed'}`, 'error');
                }
            } catch (error) {
                showMessage('❌ Network error. Please try again.', 'error');

                // Reset button state on error
                const submitBtn = depositForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.textContent = 'Deposit';
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // ENHANCED Withdraw form handler
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(withdrawForm);
            const amount = parseFloat(formData.get('amount'));

            // Enhanced validation
            if (!amount || amount <= 0) {
                showMessage('Please enter a valid amount greater than $0', 'error');
                return;
            }

            if (amount > 10000) {
                showMessage('Maximum withdrawal amount is $10,000 per transaction', 'error');
                return;
            }

            // Get current user info to check winnings balance
            try {
                const userResponse = await fetch('/api/user');
                if (!userResponse.ok) {
                    throw new Error('Failed to get user information');
                }

                const user = await userResponse.json();

                // Check if user has enough winnings balance
                if (amount > user.winnings_balance) {
                    showMessage(`❌ Insufficient winnings balance! You have $${user.winnings_balance.toFixed(2)} available for withdrawal.\n\n💡 Note: You can only withdraw from winnings balance (not wallet balance).`, 'error');
                    return;
                }

                if (user.winnings_balance === 0) {
                    showMessage('❌ No winnings available for withdrawal.\n\n💡 You need to win tournaments first, or ask admin to add winnings to your account.', 'error');
                    return;
                }


                // Show loading state
                const submitBtn = withdrawForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Processing...';
                submitBtn.disabled = true;

                const response = await fetch('/api/wallet/withdraw', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ amount: amount })
                });

                const result = await response.json();

                // Reset button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;

                if (result.success) {
                    showMessage(`✅ ${result.message}\n\n💰 $${amount.toFixed(2)} has been withdrawn from your winnings balance.`, 'success');
                    withdrawForm.reset();
                    await loadUserInfo();
                    await loadTransactions();
                } else {
                    showMessage(`❌ ${result.error || 'Withdrawal failed'}`, 'error');
                }
            } catch (error) {
                console.error('Withdrawal error:', error);
                showMessage('❌ Network error. Please check your connection and try again.', 'error');

                // Reset button state on error
                const submitBtn = withdrawForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.textContent = 'Withdraw';
                    submitBtn.disabled = false;
                }
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

    async function loadTransactions() {
        try {
            const response = await fetch('/api/wallet/transactions');
            const transactions = await response.json();
    
            if (transactionsContainer) {
                transactionsContainer.innerHTML = '';
    
                // Create header with toggle button
                const headerDiv = document.createElement('div');
                headerDiv.className = 'transactions-header';
                
                // Header content
                const headerContent = document.createElement('div');
                headerContent.className = 'transactions-header-content';
                headerContent.innerHTML = `
                    <h3>💳 Transaction History</h3>
                    <p>View your complete transaction history</p>
                `;
    
                // Controls (count + button)
                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'transactions-controls';
                
                const countSpan = document.createElement('span');
                countSpan.className = 'transactions-count';
                countSpan.textContent = `${transactions.length} transactions`;
                
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'transactions-toggle-btn collapsed';
                toggleBtn.id = 'transactionsToggle';
                toggleBtn.innerHTML = `
                    <span>View History</span>
                    <span class="toggle-icon">▼</span>
                `;
    
                controlsDiv.appendChild(countSpan);
                controlsDiv.appendChild(toggleBtn);
                
                headerDiv.appendChild(headerContent);
                headerDiv.appendChild(controlsDiv);
    
                // Create collapsible container
                const collapsibleDiv = document.createElement('div');
                collapsibleDiv.className = 'transactions-collapsible';
                collapsibleDiv.id = 'transactionsCollapsible';
    
                if (transactions.length === 0) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'transactions-empty';
                    emptyDiv.innerHTML = `
                        <h4>No transactions yet</h4>
                        <p>Your transaction history will appear here once you make deposits or withdrawals.</p>
                    `;
                    collapsibleDiv.appendChild(emptyDiv);
                } else {
                    // Create transactions list
                    const transactionsList = document.createElement('div');
                    transactionsList.className = 'transactions-list';
    
                    // Create header
                    const header = document.createElement('div');
                    header.className = 'transaction-item transaction-header';
                    header.innerHTML = `
                        <div>Type</div>
                        <div>Amount</div>
                        <div>Balance Type</div>
                        <div>Date</div>
                        <div>Description</div>
                    `;
                    transactionsList.appendChild(header);
    
                    // Create transaction items
                    transactions.forEach(transaction => {
                        const item = createTransactionItem(transaction);
                        transactionsList.appendChild(item);
                    });
    
                    collapsibleDiv.appendChild(transactionsList);
                }
    
                // Add to container
                transactionsContainer.appendChild(headerDiv);
                transactionsContainer.appendChild(collapsibleDiv);
    
                // Add toggle functionality
                const collapsible = document.getElementById('transactionsCollapsible');
                const toggleIcon = toggleBtn.querySelector('.toggle-icon');
                
                toggleBtn.addEventListener('click', function() {
                    const isExpanded = collapsible.classList.contains('expanded');
                    
                    if (isExpanded) {
                        // Collapse
                        collapsible.classList.remove('expanded');
                        toggleBtn.classList.add('collapsed');
                        toggleBtn.querySelector('span').textContent = 'View History';
                        toggleIcon.classList.remove('rotated');
                    } else {
                        // Expand
                        collapsible.classList.add('expanded');
                        toggleBtn.classList.remove('collapsed');
                        toggleBtn.querySelector('span').textContent = 'Hide History';
                        toggleIcon.classList.add('rotated');
                    }
                });
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            showMessage('Failed to load transactions', 'error');
        }
    }

    function createTransactionItem(transaction) {
        const item = document.createElement('div');
        item.className = 'transaction-item';

        const date = new Date(transaction.transaction_date).toLocaleString();
        const typeClass = `transaction-type-${transaction.transaction_type}`;
        const amountPrefix = transaction.transaction_type === 'credit' ? '+' : '-';

        item.innerHTML = `
            <div class="${typeClass}">${transaction.transaction_type.toUpperCase()}</div>
            <div class="${typeClass}">${amountPrefix}$${transaction.amount.toFixed(2)}</div>
            <div>${transaction.balance_type.toUpperCase()}</div>
            <div>${date}</div>
            <div>${transaction.description}</div>
        `;

        return item;
    }

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 7000); // Show for 7 seconds for longer messages
    }
});
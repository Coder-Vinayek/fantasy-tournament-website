// Authentication JavaScript - No inline JS for CPC compliance

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const messageDiv = document.getElementById('message');

    // Login form handler
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(loginForm);
            const loginData = {
                username: formData.get('username'),
                password: formData.get('password')
            };

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(loginData)
                });

                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, 'success');
                    setTimeout(() => {
                        if (result.isAdmin) {
                            window.location.href = '/admin';
                        } else {
                            window.location.href = '/tournaments';
                        }
                    }, 1000);
                } else {
                    showMessage(result.error || 'Login failed', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            }
        });
    }

    // Register form handler
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(registerForm);
            const registerData = {
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password')
            };

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(registerData)
                });

                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, 'success');
                    setTimeout(() => {
                        window.location.href = '/tournaments';
                    }, 1000);
                } else {
                    showMessage(result.error || 'Registration failed', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            }
        });
    }

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }


    // Enhanced user info display with ban status (add to your existing auth.js)
function displayBanStatus(user) {
    // Check if user has ban status information
    if (user.ban_status && user.ban_status !== 'none') {
        let banMessage = '';
        let banClass = '';
        
        if (user.ban_status === 'permanent') {
            banMessage = '🚫 Your account is permanently banned. You can view the website but cannot register for tournaments or withdraw money.';
            banClass = 'ban-message-permanent';
        } else if (user.ban_status === 'temporary') {
            const expiryDate = new Date(user.ban_expiry);
            const now = new Date();
            
            if (expiryDate > now) {
                banMessage = `⏰ Your account is temporarily banned until ${expiryDate.toLocaleDateString()} ${expiryDate.toLocaleTimeString()}. You can view the website but cannot register for tournaments or withdraw money.`;
                banClass = 'ban-message-temporary';
            }
        }
        
        if (banMessage) {
            // Create ban notification banner
            const banBanner = document.createElement('div');
            banBanner.className = `ban-notification-banner ${banClass}`;
            banBanner.innerHTML = `
                <div class="ban-notification-content">
                    <div class="ban-notification-icon">⚠️</div>
                    <div class="ban-notification-text">
                        <strong>Account Restricted</strong>
                        <p>${banMessage}</p>
                        ${user.ban_reason ? `<small><strong>Reason:</strong> ${user.ban_reason}</small>` : ''}
                    </div>
                </div>
            `;
            
            // Insert banner at the top of the page
            document.body.insertBefore(banBanner, document.body.firstChild);
            
            // Animate banner in
            setTimeout(() => banBanner.classList.add('show'), 100);
        }
    }
}

// Enhanced fetch wrapper that handles ban responses
async function safeFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const result = await response.json();
        
        // Check if user is banned
        if (result.banned) {
            // Show ban message
            showMessage(result.error, 'error');
            
            // Optionally reload user info to show updated ban status
            if (typeof loadUserInfo === 'function') {
                setTimeout(loadUserInfo, 1000);
            }
            
            return { banned: true, error: result.error };
        }
        
        return result;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// Add ban notification styles to your CSS (already included in the main CSS file)
// These styles should be added to your existing style.css

const BAN_NOTIFICATION_STYLES = `
/* Ban Notification Banner Styles */
.ban-notification-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    padding: 16px 20px;
    transform: translateY(-100%);
    transition: transform 0.4s ease-in-out;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.ban-notification-banner.show {
    transform: translateY(0);
}

.ban-message-permanent {
    background: linear-gradient(135deg, #dc3545, #6f42c1);
    color: white;
}

.ban-message-temporary {
    background: linear-gradient(135deg, #ffc107, #fd7e14);
    color: #000;
}

.ban-notification-content {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    max-width: 1200px;
    margin: 0 auto;
}

.ban-notification-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
}

.ban-notification-text {
    flex: 1;
}

.ban-notification-text strong {
    display: block;
    font-size: 1.1rem;
    margin-bottom: 4px;
}

.ban-notification-text p {
    margin: 0 0 8px 0;
    line-height: 1.4;
}

.ban-notification-text small {
    opacity: 0.9;
    font-size: 0.85rem;
}

/* Responsive Design */
@media (max-width: 768px) {
    .ban-notification-banner {
        padding: 12px 16px;
    }
    
    .ban-notification-content {
        flex-direction: column;
        gap: 12px;
        text-align: center;
    }
    
    .ban-notification-icon {
        font-size: 2rem;
    }
}

/* Adjust main content to account for banner */
body.has-ban-banner {
    padding-top: 80px;
}

@media (max-width: 768px) {
    body.has-ban-banner {
        padding-top: 100px;
    }
}
`;

// Function to add CSS styles dynamically
function addBanNotificationStyles() {
    if (!document.getElementById('ban-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'ban-notification-styles';
        style.textContent = BAN_NOTIFICATION_STYLES;
        document.head.appendChild(style);
    }
}

// Initialize ban notification system
function initializeBanNotificationSystem() {
    addBanNotificationStyles();
}

// Enhanced tournament registration with ban check
async function registerForTournamentWithBanCheck(tournamentId) {
    try {
        const result = await safeFetch('/api/tournaments/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tournamentId })
        });
        
        if (result.banned) {
            return; // Ban message already shown
        }
        
        if (result.success) {
            showMessage(result.message, 'success');
            // Refresh tournaments list if function exists
            if (typeof loadTournaments === 'function') {
                loadTournaments();
            }
        } else {
            showMessage(result.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

// Enhanced withdrawal with ban check
async function withdrawWithBanCheck(amount) {
    try {
        const result = await safeFetch('/api/wallet/withdraw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount })
        });
        
        if (result.banned) {
            return; // Ban message already shown
        }
        
        if (result.success) {
            showMessage(result.message, 'success');
            // Refresh wallet info if function exists
            if (typeof loadWalletInfo === 'function') {
                loadWalletInfo();
            }
        } else {
            showMessage(result.error || 'Withdrawal failed', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        displayBanStatus,
        safeFetch,
        registerForTournamentWithBanCheck,
        withdrawWithBanCheck,
        initializeBanNotificationSystem
    };
}


});
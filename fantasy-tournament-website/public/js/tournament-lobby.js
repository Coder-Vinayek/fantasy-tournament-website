// Tournament Lobby JavaScript - FIXED VERSION
// Replace your tournament-lobby.js with this

document.addEventListener('DOMContentLoaded', function() {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logoutBtn');
    const messageDiv = document.getElementById('message');
    
    // Tournament elements
    const tournamentName = document.getElementById('tournamentName');
    const tournamentStatus = document.getElementById('tournamentStatus');
    const prizePool = document.getElementById('prizePool');
    const participantCount = document.getElementById('participantCount');
    const startTime = document.getElementById('startTime');
    const timeRemaining = document.getElementById('timeRemaining');
    const tournamentDescription = document.getElementById('tournamentDescription');
    
    // Chat elements
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const onlineCount = document.getElementById('onlineCount');
    
    // Match elements
    const announcementsList = document.getElementById('announcementsList');
    const roomId = document.getElementById('roomId');
    const roomPassword = document.getElementById('roomPassword');
    const matchStartTime = document.getElementById('matchStartTime');
    const gameServer = document.getElementById('gameServer');
    
    // Players elements
    const playersList = document.getElementById('playersList');
    const refreshPlayers = document.getElementById('refreshPlayers');
    
    // Rules toggle
    const rulesToggle = document.getElementById('rulesToggle');
    const rulesContent = document.getElementById('rulesContent');
    
    // ===== FIXED: Get tournament ID from URL path instead of search params =====
    const pathParts = window.location.pathname.split('/');
    const tournamentId = pathParts[pathParts.length - 1]; // Gets "4" from "/tournament/4"
    
    console.log('🔍 Tournament lobby page loaded');
    console.log('🌐 URL:', window.location.href);
    console.log('📍 URL pathname:', window.location.pathname);
    console.log('🆔 Tournament ID extracted:', tournamentId);
    
    if (!tournamentId || tournamentId === 'tournament') {
        console.error('❌ Invalid tournament ID found:', tournamentId);
        showMessage('Invalid tournament ID', 'error');
        setTimeout(() => {
            window.location.href = '/tournaments';
        }, 2000);
        return;
    }
    
    console.log('✅ Valid tournament ID found:', tournamentId);
    
    // Initialize page
    loadUserInfo();
    loadTournamentData();
    loadChatMessages();
    loadPlayers();
    loadAnnouncements();
    
    // Set up auto-refresh intervals
    setInterval(loadTournamentData, 30000); // Refresh tournament data every 30 seconds
    setInterval(loadChatMessages, 5000);    // Refresh chat every 5 seconds
    setInterval(loadPlayers, 30000);        // Refresh players every 30 seconds
    setInterval(loadAnnouncements, 15000);  // Refresh announcements every 15 seconds
    setInterval(updateTimeRemaining, 1000); // Update countdown every second
    
    // Event Listeners
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    if (refreshPlayers) {
        refreshPlayers.addEventListener('click', function() {
            this.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                this.style.transform = 'rotate(0deg)';
            }, 500);
            loadPlayers();
        });
    }
    
    if (rulesToggle) {
        rulesToggle.addEventListener('click', function() {
            const isExpanded = rulesContent.classList.contains('expanded');
            const toggleIcon = this.querySelector('.toggle-icon');
            
            if (isExpanded) {
                rulesContent.classList.remove('expanded');
                toggleIcon.textContent = '▼';
            } else {
                rulesContent.classList.add('expanded');
                toggleIcon.textContent = '▲';
            }
        });
    }
    
    // Functions
    async function loadUserInfo() {
        console.log('📊 Loading user info...');
        try {
            const response = await fetch('/api/user');
            const user = await response.json();
            
            console.log('✅ User info loaded:', user.username);
            
            if (usernameDisplay) {
                usernameDisplay.textContent = `Welcome, ${user.username}`;
            }
        } catch (error) {
            console.error('❌ Error loading user info:', error);
        }
    }
    
    async function loadTournamentData() {
        console.log('🏆 Loading tournament data for ID:', tournamentId);
        try {
            const response = await fetch(`/api/tournament/${tournamentId}/lobby`);
            console.log('📡 Tournament API response status:', response.status);
            
            const data = await response.json();
            console.log('📄 Tournament API response data:', data);
            
            if (!response.ok) {
                console.error('❌ Tournament API error:', data);
                if (response.status === 403) {
                    showMessage('You are not registered for this tournament', 'error');
                    setTimeout(() => {
                        window.location.href = '/tournaments';
                    }, 2000);
                    return;
                }
                throw new Error(data.error || 'Failed to load tournament');
            }
            
            const tournament = data.tournament;
            console.log('✅ Tournament data loaded:', tournament.name);
            
            // Update tournament info
            tournamentName.textContent = tournament.name;
            tournamentStatus.textContent = tournament.status;
            tournamentStatus.className = `status-badge status-${tournament.status}`;
            prizePool.textContent = `$${tournament.prize_pool}`;
            participantCount.textContent = `${tournament.current_participants}/${tournament.max_participants}`;
            startTime.textContent = new Date(tournament.start_date).toLocaleString();
            tournamentDescription.textContent = tournament.description || 'No description available';
            
            // Update match details if available
            if (data.matchDetails) {
                const match = data.matchDetails;
                roomId.textContent = match.room_id || 'Not assigned';
                roomPassword.textContent = match.room_password || 'Not assigned';
                matchStartTime.textContent = match.match_start_time ? new Date(match.match_start_time).toLocaleString() : 'TBD';
                gameServer.textContent = match.game_server || 'TBD';
            }
            
            // Update online count
            onlineCount.textContent = data.onlineCount || tournament.current_participants;
            
        } catch (error) {
            console.error('❌ Error loading tournament data:', error);
            showMessage(error.message, 'error');
        }
    }
    
    async function loadChatMessages() {
        console.log('💬 Loading chat messages...');
        try {
            const response = await fetch(`/api/tournament/${tournamentId}/chat`);
            const messages = await response.json();
            
            console.log('✅ Chat messages loaded:', messages.length, 'messages');
            
            chatMessages.innerHTML = '';
            
            if (messages.length === 0) {
                chatMessages.innerHTML = '<div class="no-messages">No messages yet. Be the first to say hello! 👋</div>';
                return;
            }
            
            messages.forEach(message => {
                const messageElement = createChatMessage(message);
                chatMessages.appendChild(messageElement);
            });
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
        } catch (error) {
            console.error('❌ Error loading chat messages:', error);
        }
    }
    
    function createChatMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${message.is_admin ? 'admin-message' : 'user-message'}`;
        
        const timestamp = new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-username ${message.is_admin ? 'admin-username' : ''}">${message.username}${message.is_admin ? ' 👑' : ''}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content">${escapeHtml(message.message)}</div>
        `;
        
        return messageDiv;
    }
    
    async function sendMessage() {
        const message = chatInput.value.trim();
        
        if (!message) {
            return;
        }
        
        if (message.length > 200) {
            showMessage('Message too long (max 200 characters)', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/tournament/${tournamentId}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });
            
            const result = await response.json();
            
            if (result.success) {
                chatInput.value = '';
                loadChatMessages(); // Refresh messages
            } else {
                showMessage(result.error || 'Failed to send message', 'error');
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            showMessage('Failed to send message', 'error');
        }
    }
    
    async function loadPlayers() {
        console.log('👥 Loading players...');
        try {
            const response = await fetch(`/api/tournament/${tournamentId}/players`);
            const players = await response.json();
            
            console.log('✅ Players loaded:', players.length, 'players');
            
            playersList.innerHTML = '';
            
            if (players.length === 0) {
                playersList.innerHTML = '<div class="no-players">No players found</div>';
                return;
            }
            
            players.forEach(player => {
                const playerElement = createPlayerElement(player);
                playersList.appendChild(playerElement);
            });
            
        } catch (error) {
            console.error('❌ Error loading players:', error);
        }
    }
    
    function createPlayerElement(player) {
        const playerDiv = document.createElement('div');
        playerDiv.className = `player-item ${player.is_online ? 'online' : 'offline'}`;
        
        const joinDate = new Date(player.registration_date).toLocaleDateString();
        
        playerDiv.innerHTML = `
            <div class="player-avatar">
                <span class="player-initial">${player.username.charAt(0).toUpperCase()}</span>
                <span class="player-status ${player.is_online ? 'online' : 'offline'}"></span>
            </div>
            <div class="player-info">
                <div class="player-name">${player.username}${player.is_admin ? ' 👑' : ''}</div>
                <div class="player-meta">
                    <span class="join-date">Joined: ${joinDate}</span>
                    <span class="player-balance">$${player.wallet_balance.toFixed(2)}</span>
                </div>
            </div>
        `;
        
        return playerDiv;
    }
    
    async function loadAnnouncements() {
        console.log('📢 Loading announcements...');
        try {
            const response = await fetch(`/api/tournament/${tournamentId}/announcements`);
            const announcements = await response.json();
            
            console.log('✅ Announcements loaded:', announcements.length, 'announcements');
            
            announcementsList.innerHTML = '';
            
            if (announcements.length === 0) {
                announcementsList.innerHTML = '<p class="no-announcements">No announcements yet</p>';
                return;
            }
            
            announcements.forEach(announcement => {
                const announcementElement = createAnnouncementElement(announcement);
                announcementsList.appendChild(announcementElement);
            });
            
        } catch (error) {
            console.error('❌ Error loading announcements:', error);
        }
    }
    
    function createAnnouncementElement(announcement) {
        const announcementDiv = document.createElement('div');
        announcementDiv.className = 'announcement-item';
        
        const timestamp = new Date(announcement.created_at).toLocaleString();
        
        announcementDiv.innerHTML = `
            <div class="announcement-header">
                <span class="announcement-type">📢 Admin</span>
                <span class="announcement-time">${timestamp}</span>
            </div>
            <div class="announcement-content">${escapeHtml(announcement.message)}</div>
        `;
        
        return announcementDiv;
    }
    
    function updateTimeRemaining() {
        const startTimeText = startTime.textContent;
        if (startTimeText === '-' || !startTimeText) {
            timeRemaining.textContent = '-';
            return;
        }
        
        const startDate = new Date(startTimeText);
        const now = new Date();
        const diff = startDate - now;
        
        if (diff <= 0) {
            timeRemaining.textContent = 'Tournament Started';
            timeRemaining.className = 'detail-value tournament-started';
        } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            if (days > 0) {
                timeRemaining.textContent = `${days}d ${hours}h ${minutes}m`;
            } else if (hours > 0) {
                timeRemaining.textContent = `${hours}h ${minutes}m ${seconds}s`;
            } else {
                timeRemaining.textContent = `${minutes}m ${seconds}s`;
            }
            
            timeRemaining.className = 'detail-value';
        }
    }
    
    async function handleLogout() {
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
    }
    
    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});

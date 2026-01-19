// Main Application Class
class SmartRoomSystem {
    constructor() {
        this.currentUser = null;
        this.currentDashboard = 'guest';
        this.sidebarCollapsed = false;
        this.initialize();
    }

    initialize() {
        this.setupEventListeners();
        this.loadUserData();
        this.setupAnimations();
        this.checkPageType();
    }

    async checkPageType() {
        const path = window.location.pathname;
        const file = (path.split('/').pop() || '').toLowerCase();

        const createAccountForm = document.getElementById('createAccountForm');
        if (file === 'create_account.html' || createAccountForm) {
            this.setupCreateAccountPage();
            return;
        }

        const isDashboard = (file === 'guest.html' || file === 'staff.html' || file === 'admin.html');
        if (!isDashboard) {
            this.setupLoginPage();
            return;
        }

        const expectedRole = file === 'admin.html' ? 'admin' : file === 'staff.html' ? 'staff' : 'guest';

        try {
            const res = await fetch(this.getApiPath('me.php'), {
                method: 'GET',
                credentials: 'include'
            });

            const data = await res.json().catch(() => null);
            const user = (res.ok && data && data.ok === true && data.user) ? data.user : null;

            if (!user || !user.role) {
                localStorage.removeItem('smartRoomUser');
                this.currentUser = null;
                this.showToast('Unauthorized. Please login again.', 'error');
                setTimeout(() => {
                    window.location.href = this.getPagePath('index');
                }, 500);
                return;
            }

            if (String(user.role).toLowerCase() !== expectedRole) {
                this.showToast('Unauthorized for this dashboard. Please login with the correct user type.', 'error');
                localStorage.removeItem('smartRoomUser');
                this.currentUser = null;
                setTimeout(() => {
                    window.location.href = this.getPagePath('index');
                }, 500);
                return;
            }

            this.currentUser = this.normalizeUser(user);
            try {
                localStorage.setItem('smartRoomUser', JSON.stringify(this.currentUser));
            } catch (_) {
                // ignore
            }

            this.currentDashboard = expectedRole;
            if (expectedRole === 'admin') {
                this.setupAdminDashboard();
            } else if (expectedRole === 'staff') {
                this.setupStaffDashboard();
            } else {
                this.setupGuestDashboard();
            }
        } catch (_) {
            this.currentUser = null;
            localStorage.removeItem('smartRoomUser');
            this.showToast('Unauthorized. Please login again.', 'error');
            setTimeout(() => {
                window.location.href = this.getPagePath('index');
            }, 500);
            return;
        }
    }

    getPagePath(target) {
        const path = window.location.pathname;
        const segments = path.split('/').filter(Boolean);
        const inHtmlFolder = segments[segments.length - 2]?.toLowerCase() === 'html';

        const v = '7';

        if (target === 'index') {
            return inHtmlFolder ? '../index.html' : 'index.html';
        }

        // guest/staff/admin
        return inHtmlFolder ? `${target}.html?v=${v}` : `html/${target}.html?v=${v}`;
    }

    getApiPath(endpoint) {
        const path = window.location.pathname;
        const segments = path.split('/').filter(Boolean);
        const inHtmlFolder = segments[segments.length - 2]?.toLowerCase() === 'html';
        return inHtmlFolder ? `../php/api/${endpoint}` : `php/api/${endpoint}`;
    }

    setupEventListeners() {
        // Sidebar toggle
        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => this.toggleSidebar());
        }

        const logoutLink = document.getElementById('logout-link');
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        // User menu
        const userMenu = document.getElementById('userMenu');
        if (userMenu) {
            userMenu.addEventListener('click', (e) => this.showUserMenu(e));
        }

        // Language selector
        const languageBtn = document.getElementById('languageBtn');
        if (languageBtn) {
            languageBtn.addEventListener('click', () => this.showLanguageSelector());
        }

        // Notifications
        const notificationsBtn = document.getElementById('notificationsBtn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => this.showNotifications());
        }

        // Mobile menu
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => this.toggleMobileMenu());
        }

        // Close modals on overlay click
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.closeModal();
                }
            });
        }

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        this.sidebarCollapsed = !this.sidebarCollapsed;
        
        if (this.sidebarCollapsed) {
            sidebar.classList.add('sidebar-collapsed');
            mainContent.classList.add('main-content-expanded');
        } else {
            sidebar.classList.remove('sidebar-collapsed');
            mainContent.classList.remove('main-content-expanded');
        }
    }

    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('show');
    }

    showUserMenu(e) {
        e.stopPropagation();
        
        const menuHtml = `
            <div class="user-dropdown">
                <div class="dropdown-header">
                    <div class="user-avatar-small">${this.getUserInitials(this.currentUser) || 'GU'}</div>
                    <div>
                        <h4>${this.getUserFullName(this.currentUser) || 'Guest User'}</h4>
                        <p>${this.getUserRoleLabel(this.currentUser) || 'Guest'}</p>
                    </div>
                </div>
                <div class="dropdown-divider"></div>
                <a href="#" class="dropdown-item">
                    <i class="fas fa-user"></i>
                    <span>My Profile</span>
                </a>
                <a href="#" class="dropdown-item">
                    <i class="fas fa-cog"></i>
                    <span>Settings</span>
                </a>
                <a href="#" class="dropdown-item">
                    <i class="fas fa-question-circle"></i>
                    <span>Help & Support</span>
                </a>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item logout-btn">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                </button>
            </div>
        `;
        
        this.showDropdown(e.currentTarget, menuHtml, 'user-dropdown-container');
        
        // Add logout event listener
        setTimeout(() => {
            const logoutBtn = document.querySelector('.logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.logout());
            }
        }, 100);
    }

    showLanguageSelector() {
        const languages = [
            { code: 'en', name: 'English', flag: '🇬🇧' },
            { code: 'fr', name: 'French', flag: '🇫🇷' },
            { code: 'es', name: 'Spanish', flag: '🇪🇸' },
            { code: 'de', name: 'German', flag: '🇩🇪' },
            { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
            { code: 'ny', name: 'Chichewa', flag: '🇲🇼' }
        ];
        
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Select Language</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="languages-grid">
                        ${languages.map(lang => `
                            <button class="language-option" data-lang="${lang.code}">
                                <span class="language-flag">${lang.flag}</span>
                                <span class="language-name">${lang.name}</span>
                                <i class="fas fa-check"></i>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(modalHtml);
        
        // Add language selection handlers
        setTimeout(() => {
            document.querySelectorAll('.language-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    const lang = e.currentTarget.dataset.lang;
                    this.changeLanguage(lang);
                });
            });
            
            document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        }, 100);
    }

    showNotifications() {
        const notifications = [
            { id: 1, type: 'info', title: 'Room Service', message: 'Your breakfast order is on its way', time: '5 min ago' },
            { id: 2, type: 'success', title: 'Housekeeping', message: 'Room cleaning completed', time: '1 hour ago' },
            { id: 3, type: 'warning', title: 'Energy Alert', message: 'High energy consumption detected in room', time: '2 hours ago' },
            { id: 4, type: 'danger', title: 'Maintenance', message: 'Scheduled maintenance tomorrow at 10 AM', time: '1 day ago' }
        ];
        
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Notifications</h3>
                    <div class="modal-actions">
                        <button class="btn btn-sm btn-secondary" id="markAllRead">Mark all as read</button>
                        <button class="modal-close">&times;</button>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="notifications-list">
                        ${notifications.map(notif => `
                            <div class="notification-item ${notif.type}">
                                <div class="notification-icon">
                                    <i class="fas fa-${notif.type === 'info' ? 'info-circle' : 
                                                      notif.type === 'success' ? 'check-circle' : 
                                                      notif.type === 'warning' ? 'exclamation-triangle' : 
                                                      'exclamation-circle'}"></i>
                                </div>
                                <div class="notification-content">
                                    <h4>${notif.title}</h4>
                                    <p>${notif.message}</p>
                                    <small>${notif.time}</small>
                                </div>
                                <button class="notification-close" data-id="${notif.id}">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(modalHtml);
        
        setTimeout(() => {
            document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
            document.getElementById('markAllRead').addEventListener('click', () => this.markAllNotificationsRead());
            
            document.querySelectorAll('.notification-close').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    this.dismissNotification(id);
                });
            });
        }, 100);
    }

    showDropdown(anchorElement, contentHtml, className = 'dropdown-container') {
        // Remove existing dropdown
        const existingDropdown = document.querySelector(`.${className}`);
        if (existingDropdown) {
            existingDropdown.remove();
        }
        
        // Create new dropdown
        const dropdown = document.createElement('div');
        dropdown.className = className;
        dropdown.innerHTML = contentHtml;
        
        // Position dropdown
        const rect = anchorElement.getBoundingClientRect();
        dropdown.style.position = 'absolute';
        dropdown.style.top = `${rect.bottom + 5}px`;
        dropdown.style.right = `${window.innerWidth - rect.right}px`;
        
        document.body.appendChild(dropdown);
        
        // Close dropdown when clicking outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!dropdown.contains(e.target) && !anchorElement.contains(e.target)) {
                    dropdown.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    showModal(contentHtml) {
        const modalOverlay = document.getElementById('modalOverlay');
        modalOverlay.innerHTML = contentHtml;
        modalOverlay.style.display = 'flex';
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modalOverlay = document.getElementById('modalOverlay');
        modalOverlay.style.display = 'none';
        modalOverlay.innerHTML = '';
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    changeLanguage(lang) {
        this.showToast(`Language changed to ${this.getLanguageName(lang)}`, 'success');
        this.closeModal();
        
        // In a real application, this would update the entire UI
        localStorage.setItem('preferredLanguage', lang);
    }

    getLanguageName(lang) {
        const languages = {
            'en': 'English',
            'fr': 'French',
            'es': 'Spanish',
            'de': 'German',
            'zh': 'Chinese',
            'ny': 'Chichewa'
        };
        return languages[lang] || lang;
    }

    markAllNotificationsRead() {
        this.showToast('All notifications marked as read', 'success');
        this.closeModal();
    }

    dismissNotification(id) {
        this.showToast(`Notification ${id} dismissed`, 'info');
        // In a real app, this would update the backend
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            this.showToast('Logging out...', 'info');
            
            // Clear user data
            localStorage.removeItem('smartRoomUser');
            this.currentUser = null;

            // Clear server session (best-effort)
            fetch(this.getApiPath('logout.php'), {
                method: 'POST',
                credentials: 'include'
            }).catch(() => {
                // ignore
            }).finally(() => {
                setTimeout(() => {
                    window.location.href = this.getPagePath('index');
                }, 500);
            });
        }
    }

    // Setup Methods for Different Pages
    setupLoginPage() {
        const loginForm = document.getElementById('loginForm');
        const showPasswordBtn = document.getElementById('showPassword');
        const userTypeBtns = document.querySelectorAll('.user-type-btn');
        const loginBtn = document.getElementById('loginBtn');

        if (showPasswordBtn) {
            showPasswordBtn.addEventListener('click', () => {
                const passwordInput = document.getElementById('password');
                const type = passwordInput.type === 'password' ? 'text' : 'password';
                passwordInput.type = type;
                showPasswordBtn.innerHTML = type === 'password' ? 
                    '<i class="fas fa-eye"></i>' : 
                    '<i class="fas fa-eye-slash"></i>';
            });
        }

        if (userTypeBtns.length) {
            userTypeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    userTypeBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.handleLogin());
        }
    }

    setupCreateAccountPage() {
        const form = document.getElementById('createAccountForm');
        const createBtn = document.getElementById('createAccountBtn');

        const showNewPasswordBtn = document.getElementById('showNewPassword');
        const showConfirmPasswordBtn = document.getElementById('showConfirmPassword');

        const togglePassword = (inputId, btn) => {
            const input = document.getElementById(inputId);
            if (!input || !btn) return;

            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            btn.innerHTML = type === 'password' ?
                '<i class="fas fa-eye"></i>' :
                '<i class="fas fa-eye-slash"></i>';
        };

        if (showNewPasswordBtn) {
            showNewPasswordBtn.addEventListener('click', () => togglePassword('newPassword', showNewPasswordBtn));
        }
        if (showConfirmPasswordBtn) {
            showConfirmPasswordBtn.addEventListener('click', () => togglePassword('confirmPassword', showConfirmPasswordBtn));
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateAccount();
            });
        }
    }

    setupGuestDashboard() {
        this.renderCurrentUser();
        this.setupGuestNavigation();
        this.showGuestSection('dashboard');
    }

    setupGuestNavigation() {
        const navLinks = {
            'dashboard-link': 'dashboard',
            'room-control-link': 'room-controls',
            'services-link': 'services',
            'energy-link': 'energy',
            'communication-link': 'communication',
            'security-link': 'security',
            'settings-link': 'settings'
        };

        Object.entries(navLinks).forEach(([linkId, section]) => {
            const link = document.getElementById(linkId);
            if (link) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showGuestSection(section);
                    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                    link.classList.add('active');
                });
            }
        });
    }

    showGuestSection(section) {
        const dashboardContent = document.querySelector('.dashboard-content');
        if (!dashboardContent) return;

        const sections = {
            'dashboard': this.getGuestDashboardContent(),
            'room-controls': this.getGuestRoomControlsContent(),
            'services': this.getGuestServicesContent(),
            'energy': this.getGuestEnergyContent(),
            'communication': this.getGuestCommunicationContent(),
            'security': this.getGuestSecurityContent(),
            'settings': this.getGuestSettingsContent()
        };

        dashboardContent.innerHTML = sections[section] || sections['dashboard'];
        this.initializeGuestSectionEvents(section);
    }

    getGuestDashboardContent() {
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon primary"><i class="fas fa-temperature-low"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">22°C</div>
                        <div class="stat-label">Room Temperature</div>
                        <div class="stat-change positive"><i class="fas fa-arrow-up"></i><span>Perfect</span></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-bolt"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">14.2 kWh</div>
                        <div class="stat-label">Energy Usage Today</div>
                        <div class="stat-change positive"><i class="fas fa-arrow-down"></i><span>45% less than avg</span></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning"><i class="fas fa-clock"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">2</div>
                        <div class="stat-label">Pending Requests</div>
                        <div class="stat-change"><i class="fas fa-clock"></i><span>Needs attention</span></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon danger"><i class="fas fa-door-closed"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">4 Days</div>
                        <div class="stat-label">Stay Duration</div>
                        <div class="stat-change"><i class="fas fa-calendar"></i><span>Check-out: 28 Oct</span></div>
                    </div>
                </div>
            </div>
            <div class="dashboard-grid grid-2" style="margin-top: 1.5rem;">
                <div class="card room-status-card">
                    <div class="room-status-header">
                        <div class="room-title">
                            <h3>Room ${this.currentUser?.room_number || '205'}</h3>
                            <p class="room-subtitle">Premium Suite • Floor 2</p>
                        </div>
                        <div class="room-icon"><i class="fas fa-door-closed"></i></div>
                    </div>
                    <div class="room-details">
                        <div class="detail-item"><span class="detail-label">Check-in</span><span class="detail-value">24 Oct 2025, 14:00</span></div>
                        <div class="detail-item"><span class="detail-label">Check-out</span><span class="detail-value">28 Oct 2025, 12:00</span></div>
                        <div class="detail-item"><span class="detail-label">Key Card Status</span><span class="detail-value">Active</span></div>
                    </div>
                    <div class="room-status-footer"><span class="status-indicator"></span><span>Room Occupied • All Systems Normal</span></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Quick Actions</h3></div>
                    <div class="card-body">
                        <div class="quick-actions-grid">
                            <button class="quick-action" data-action="turndown"><i class="fas fa-bed"></i><span>Turn Down Service</span></button>
                            <button class="quick-action" data-action="taxi"><i class="fas fa-car"></i><span>Request Taxi</span></button>
                            <button class="quick-action" data-action="roomservice"><i class="fas fa-utensils"></i><span>Room Service</span></button>
                            <button class="quick-action" data-action="spa"><i class="fas fa-spa"></i><span>Spa Booking</span></button>
                            <button class="quick-action" data-action="gym"><i class="fas fa-dumbbell"></i><span>Gym Access</span></button>
                            <button class="quick-action" data-action="pool"><i class="fas fa-swimming-pool"></i><span>Pool Booking</span></button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    getGuestRoomControlsContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Room Controls</h2>
                <p style="color: var(--text-secondary);">Manage your room's climate, lighting, and more</p>
            </div>
            <div class="dashboard-grid grid-2">
                <div class="card control-card">
                    <div class="card-header">
                        <h3 class="card-title">Climate Control</h3>
                        <div class="control-toggle"><input type="checkbox" id="climateToggle" checked><label for="climateToggle"></label></div>
                    </div>
                    <div class="card-body">
                        <div class="control-section">
                            <div class="control-label"><span>Temperature</span><span class="control-value" id="tempValue">22°C</span></div>
                            <input type="range" min="16" max="30" value="22" class="control-slider" id="tempSlider">
                        </div>
                        <div class="control-section mt-6">
                            <div class="control-label"><span>Air Conditioning Mode</span></div>
                            <div class="control-buttons">
                                <button class="control-btn active" data-mode="cool"><i class="fas fa-snowflake"></i><span>Cool</span></button>
                                <button class="control-btn" data-mode="dry"><i class="fas fa-wind"></i><span>Dry</span></button>
                                <button class="control-btn" data-mode="fan"><i class="fas fa-fan"></i><span>Fan</span></button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card control-card">
                    <div class="card-header">
                        <h3 class="card-title">Lighting Control</h3>
                        <div class="control-toggle"><input type="checkbox" id="lightingToggle" checked><label for="lightingToggle"></label></div>
                    </div>
                    <div class="card-body">
                        <div class="light-controls">
                            <div class="light-control-item"><span>Main Lights</span><div class="control-toggle small"><input type="checkbox" id="mainLights" checked><label for="mainLights"></label></div></div>
                            <div class="light-control-item"><span>Bedside Lamps</span><div class="control-toggle small"><input type="checkbox" id="bedsideLamps"><label for="bedsideLamps"></label></div></div>
                            <div class="light-control-item"><span>Bathroom</span><div class="control-toggle small"><input type="checkbox" id="bathroomLights" checked><label for="bathroomLights"></label></div></div>
                        </div>
                        <div class="control-section mt-6">
                            <div class="control-label"><span>Brightness</span><span class="control-value" id="brightnessValue">75%</span></div>
                            <input type="range" min="0" max="100" value="75" class="control-slider" id="brightnessSlider">
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Curtain & Window Control</h3></div>
                    <div class="card-body">
                        <div class="control-section">
                            <div class="control-label"><span>Main Curtains</span><span class="control-value">75% Open</span></div>
                            <div class="control-buttons">
                                <button class="control-btn active"><i class="fas fa-chevron-up"></i><span>Open</span></button>
                                <button class="control-btn"><i class="fas fa-chevron-down"></i><span>Close</span></button>
                                <button class="control-btn"><i class="fas fa-sliders-h"></i><span>Auto</span></button>
                            </div>
                        </div>
                        <div class="control-section mt-6">
                            <div class="control-label"><span>Window Security</span><span class="control-value success">Secured</span></div>
                            <button class="btn btn-success w-full mt-3" id="lockWindowsBtn"><i class="fas fa-lock"></i><span>Lock All Windows</span></button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    getGuestServicesContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 600;">Service Requests</h2>
                    <p style="color: var(--text-secondary);">Request hotel services and track their status</p>
                </div>
                <button class="btn btn-primary" id="newRequestBtn"><i class="fas fa-plus"></i><span>New Request</span></button>
            </div>
            <div class="card">
                <div class="card-body">
                    <div class="request-item pending">
                        <div class="request-header"><span class="request-title">Housekeeping</span><span class="request-status pending">Pending</span></div>
                        <p class="request-description">Room cleaning requested</p>
                        <div class="request-footer"><span><i class="far fa-clock"></i> 10:30 AM</span><span>Request ID: #HK2051</span></div>
                    </div>
                    <div class="request-item completed">
                        <div class="request-header"><span class="request-title">Room Service</span><span class="request-status completed">Completed</span></div>
                        <p class="request-description">Breakfast order - Continental</p>
                        <div class="request-footer"><span><i class="far fa-clock"></i> 8:15 AM</span><span>Request ID: #RS2049</span></div>
                    </div>
                    <div class="request-item in-progress">
                        <div class="request-header"><span class="request-title">Maintenance</span><span class="request-status in-progress">In Progress</span></div>
                        <p class="request-description">AC noise inspection</p>
                        <div class="request-footer"><span><i class="far fa-clock"></i> Yesterday</span><span>Request ID: #MN2047</span></div>
                    </div>
                </div>
            </div>`;
    }

    getGuestEnergyContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Energy Usage</h2>
                <p style="color: var(--text-secondary);">Monitor your room's energy consumption</p>
            </div>
            <div class="dashboard-grid grid-2">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Energy Consumption</h3>
                        <span class="text-success"><i class="fas fa-leaf"></i><span>Eco Mode Active</span></span>
                    </div>
                    <div class="card-body">
                        <div class="energy-summary">
                            <div class="energy-item">
                                <div class="energy-label">Today's Usage</div>
                                <div class="energy-value">14.2 kWh</div>
                                <div class="energy-change positive"><i class="fas fa-arrow-down"></i> 45% less than average</div>
                            </div>
                        </div>
                        <div class="energy-chart">
                            <div class="chart-bar">
                                <div class="bar" style="height: 80%"><div class="bar-label">AC</div></div>
                                <div class="bar" style="height: 40%"><div class="bar-label">Lighting</div></div>
                                <div class="bar" style="height: 60%"><div class="bar-label">TV</div></div>
                                <div class="bar" style="height: 30%"><div class="bar-label">Other</div></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Eco Tips</h3></div>
                    <div class="card-body">
                        <ul style="list-style: none; padding: 0;">
                            <li style="padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);"><i class="fas fa-lightbulb text-warning" style="margin-right: 0.5rem;"></i> Turn off lights when leaving the room</li>
                            <li style="padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);"><i class="fas fa-thermometer-half text-info" style="margin-right: 0.5rem;"></i> Set AC to 24°C for optimal efficiency</li>
                            <li style="padding: 0.75rem 0;"><i class="fas fa-door-open text-success" style="margin-right: 0.5rem;"></i> Close curtains during hot afternoons</li>
                        </ul>
                    </div>
                </div>
            </div>`;
    }

    getGuestCommunicationContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Communication</h2>
                <p style="color: var(--text-secondary);">Chat with hotel staff</p>
            </div>
            <div class="card chat-card">
                <div class="card-header">
                    <h3 class="card-title">Staff Communication</h3>
                    <div class="card-actions">
                        <button class="action-btn"><i class="fas fa-phone"></i></button>
                        <button class="action-btn"><i class="fas fa-video"></i></button>
                    </div>
                </div>
                <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                    <div class="message received">
                        <div class="message-content">Your dinner reservation at 7 PM is confirmed. Would you like a wake-up call tomorrow?</div>
                        <div class="message-time">Concierge • 10:22 AM</div>
                    </div>
                    <div class="message sent">
                        <div class="message-content">Yes, please set a wake-up call for 7 AM. Thank you!</div>
                        <div class="message-time">You • 10:25 AM</div>
                    </div>
                    <div class="message received">
                        <div class="message-content">We've completed your room cleaning. Is there anything else you need?</div>
                        <div class="message-time">Housekeeping • 9:15 AM</div>
                    </div>
                </div>
                <div class="message-input">
                    <input type="text" placeholder="Type your message..." id="messageInput">
                    <button id="sendMessageBtn"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>`;
    }

    getGuestSecurityContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Security</h2>
                <p style="color: var(--text-secondary);">Manage your room's security settings</p>
            </div>
            <div class="dashboard-grid grid-2">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Door Lock Status</h3></div>
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-lock" style="font-size: 4rem; color: var(--success-color); margin-bottom: 1rem;"></i>
                        <h4 style="color: var(--success-color);">Door Locked</h4>
                        <p style="color: var(--text-secondary); margin-top: 0.5rem;">Your room is secure</p>
                        <button class="btn btn-primary mt-4" id="unlockDoorBtn"><i class="fas fa-unlock"></i> Unlock Door</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Do Not Disturb</h3></div>
                    <div class="card-body">
                        <div class="light-control-item" style="padding: 1rem 0;">
                            <span style="font-weight: 500;">Enable Do Not Disturb</span>
                            <div class="control-toggle"><input type="checkbox" id="dndToggle"><label for="dndToggle"></label></div>
                        </div>
                        <p style="color: var(--text-secondary); font-size: 0.875rem;">When enabled, staff will not enter your room unless requested.</p>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Safe Status</h3></div>
                    <div class="card-body">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <i class="fas fa-safe" style="font-size: 2rem; color: var(--success-color);"></i>
                            <div>
                                <h4>In-Room Safe</h4>
                                <p style="color: var(--text-secondary);">Locked • Last opened: 2 hours ago</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    getGuestSettingsContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Settings</h2>
                <p style="color: var(--text-secondary);">Customize your room preferences</p>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Preferences</h3></div>
                <div class="card-body">
                    <div class="light-control-item" style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);">
                        <span>Auto-adjust temperature based on occupancy</span>
                        <div class="control-toggle"><input type="checkbox" id="autoTemp" checked><label for="autoTemp"></label></div>
                    </div>
                    <div class="light-control-item" style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);">
                        <span>Night mode (dim lights after 10 PM)</span>
                        <div class="control-toggle"><input type="checkbox" id="nightMode"><label for="nightMode"></label></div>
                    </div>
                    <div class="light-control-item" style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);">
                        <span>Energy saving mode</span>
                        <div class="control-toggle"><input type="checkbox" id="energySaving" checked><label for="energySaving"></label></div>
                    </div>
                    <div class="light-control-item" style="padding: 1rem 0;">
                        <span>Receive notifications</span>
                        <div class="control-toggle"><input type="checkbox" id="notifications" checked><label for="notifications"></label></div>
                    </div>
                </div>
            </div>`;
    }

    initializeGuestSectionEvents(section) {
        if (section === 'room-controls') {
            const tempSlider = document.getElementById('tempSlider');
            const tempValue = document.getElementById('tempValue');
            if (tempSlider && tempValue) {
                tempSlider.addEventListener('input', (e) => {
                    tempValue.textContent = `${e.target.value}°C`;
                    this.showToast(`Temperature set to ${e.target.value}°C`, 'info');
                });
            }

            const brightnessSlider = document.getElementById('brightnessSlider');
            const brightnessValue = document.getElementById('brightnessValue');
            if (brightnessSlider && brightnessValue) {
                brightnessSlider.addEventListener('input', (e) => {
                    brightnessValue.textContent = `${e.target.value}%`;
                });
            }

            document.querySelectorAll('.control-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const parent = e.currentTarget.closest('.control-buttons');
                    parent.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    const mode = e.currentTarget.dataset.mode || e.currentTarget.querySelector('span')?.textContent;
                    this.showToast(`Mode changed to ${mode}`, 'info');
                });
            });

            const lockWindowsBtn = document.getElementById('lockWindowsBtn');
            if (lockWindowsBtn) {
                lockWindowsBtn.addEventListener('click', () => this.showToast('All windows secured', 'success'));
            }
        }

        if (section === 'services') {
            const newRequestBtn = document.getElementById('newRequestBtn');
            if (newRequestBtn) {
                newRequestBtn.addEventListener('click', () => this.createServiceRequest());
            }
        }

        if (section === 'communication') {
            const sendMessageBtn = document.getElementById('sendMessageBtn');
            const messageInput = document.getElementById('messageInput');
            if (sendMessageBtn && messageInput) {
                sendMessageBtn.addEventListener('click', () => this.sendMessage());
                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.sendMessage();
                });
            }
        }

        if (section === 'dashboard') {
            document.querySelectorAll('.quick-action').forEach(action => {
                action.addEventListener('click', (e) => {
                    const service = e.currentTarget.querySelector('span').textContent;
                    this.showToast(`${service} requested`, 'success');
                });
            });
        }

        if (section === 'security') {
            const unlockDoorBtn = document.getElementById('unlockDoorBtn');
            if (unlockDoorBtn) {
                unlockDoorBtn.addEventListener('click', () => this.showToast('Door unlocked for 30 seconds', 'info'));
            }
        }

        document.querySelectorAll('.control-toggle input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const label = e.target.closest('.light-control-item')?.querySelector('span')?.textContent || 
                              e.target.closest('.card')?.querySelector('.card-title')?.textContent || 'Setting';
                const state = e.target.checked ? 'enabled' : 'disabled';
                this.showToast(`${label} ${state}`, e.target.checked ? 'success' : 'warning');
            });
        });
    }

    setupStaffDashboard() {
        this.renderCurrentUser();
        this.setupStaffNavigation();
        this.showStaffSection('dashboard');
    }

    setupStaffNavigation() {
        const navLinks = {
            'dashboard-link': 'dashboard',
            'rooms-link': 'rooms',
            'requests-link': 'requests',
            'guests-link': 'guests',
            'addGuestBtn': 'add-guest',
            'reports-link': 'reports',
            'schedule-link': 'schedule',
            'staff-tools-link': 'tools'
        };

        Object.entries(navLinks).forEach(([linkId, section]) => {
            const link = document.getElementById(linkId);
            if (link) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showStaffSection(section);
                    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                    link.classList.add('active');
                });
            }
        });
    }

    showStaffSection(section) {
        const dashboardContent = document.querySelector('.dashboard-content');
        if (!dashboardContent) return;

        const sections = {
            'dashboard': this.getStaffDashboardContent(),
            'rooms': this.getStaffRoomsContent(),
            'requests': this.getStaffRequestsContent(),
            'guests': this.getStaffGuestsContent(),
            'add-guest': this.getStaffAddGuestContent(),
            'reports': this.getStaffReportsContent(),
            'schedule': this.getStaffScheduleContent(),
            'tools': this.getStaffToolsContent()
        };

        dashboardContent.innerHTML = sections[section] || sections['dashboard'];
        this.initializeStaffSectionEvents(section);
    }

    getStaffDashboardContent() {
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon danger"><i class="fas fa-clock"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">12</div>
                        <div class="stat-label">Pending Requests</div>
                        <div class="stat-change negative"><i class="fas fa-arrow-up"></i><span>2 new in last hour</span></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon primary"><i class="fas fa-bed"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">142/160</div>
                        <div class="stat-label">Rooms Occupied</div>
                        <div class="stat-change"><i class="fas fa-chart-line"></i><span>87% occupancy</span></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-users"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">24</div>
                        <div class="stat-label">Active Staff</div>
                        <div class="stat-change"><i class="fas fa-user-check"></i><span>4 on break</span></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning"><i class="fas fa-leaf"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">18%</div>
                        <div class="stat-label">Energy Saved</div>
                        <div class="stat-change positive"><i class="fas fa-arrow-up"></i><span>vs yesterday</span></div>
                    </div>
                </div>
            </div>
            <div class="card mt-6">
                <div class="card-header">
                    <h3 class="card-title">Guest Alerts & Notifications</h3>
                    <button class="btn btn-warning btn-sm" id="acknowledgeAllBtn"><i class="fas fa-check-double"></i><span>Acknowledge All</span></button>
                </div>
                <div class="card-body">
                    <div class="alerts-grid">
                        <div class="alert-item urgent">
                            <div class="alert-icon"><i class="fas fa-exclamation-triangle"></i></div>
                            <div class="alert-content">
                                <h4>Room 312 - Emergency</h4>
                                <p>Guest reporting water leak in bathroom</p>
                                <small>Priority: High • 5 minutes ago</small>
                            </div>
                            <div class="alert-actions"><button class="btn btn-danger btn-sm">Take Action</button></div>
                        </div>
                        <div class="alert-item warning">
                            <div class="alert-icon"><i class="fas fa-clock"></i></div>
                            <div class="alert-content">
                                <h4>Room 205 - Late Check-out</h4>
                                <p>Guest requesting extended stay until 2 PM</p>
                                <small>Priority: Medium • 30 minutes ago</small>
                            </div>
                            <div class="alert-actions"><button class="btn btn-warning btn-sm">Review</button></div>
                        </div>
                        <div class="alert-item info">
                            <div class="alert-icon"><i class="fas fa-info-circle"></i></div>
                            <div class="alert-content">
                                <h4>Room 118 - Special Request</h4>
                                <p>Guest requesting extra pillows and blankets</p>
                                <small>Priority: Low • 1 hour ago</small>
                            </div>
                            <div class="alert-actions"><button class="btn btn-primary btn-sm">Fulfill</button></div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    getStaffRoomsContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 600;">Room Management</h2>
                    <p style="color: var(--text-secondary);">Monitor and manage all hotel rooms</p>
                </div>
                <select class="form-control" style="width: auto;" id="floorFilter">
                    <option>All Floors</option>
                    <option>Floor 1</option>
                    <option>Floor 2</option>
                    <option>Floor 3</option>
                </select>
            </div>
            <div class="card">
                <div class="card-body">
                    <div class="room-status-grid">
                        <div class="room-status-item occupied">
                            <div class="room-status-header"><span class="room-number">205</span><span class="room-status-badge">Occupied</span></div>
                            <div class="room-status-info"><p>Prince Kamanga</p><small>Check-out: 28 Oct</small></div>
                            <button class="room-action-btn"><i class="fas fa-eye"></i></button>
                        </div>
                        <div class="room-status-item vacant">
                            <div class="room-status-header"><span class="room-number">208</span><span class="room-status-badge">Vacant</span></div>
                            <div class="room-status-info"><p>Ready for check-in</p><small>Last cleaned: Today 10:30</small></div>
                            <button class="room-action-btn"><i class="fas fa-bell"></i></button>
                        </div>
                        <div class="room-status-item cleaning">
                            <div class="room-status-header"><span class="room-number">212</span><span class="room-status-badge">Cleaning</span></div>
                            <div class="room-status-info"><p>Housekeeping in progress</p><small>Started: 11:45 AM</small></div>
                            <button class="room-action-btn"><i class="fas fa-clock"></i></button>
                        </div>
                        <div class="room-status-item maintenance">
                            <div class="room-status-header"><span class="room-number">215</span><span class="room-status-badge">Maintenance</span></div>
                            <div class="room-status-info"><p>AC repair in progress</p><small>Estimated: 2 hours</small></div>
                            <button class="room-action-btn"><i class="fas fa-tools"></i></button>
                        </div>
                        <div class="room-status-item occupied">
                            <div class="room-status-header"><span class="room-number">301</span><span class="room-status-badge">Occupied</span></div>
                            <div class="room-status-info"><p>John Smith</p><small>Check-out: 30 Oct</small></div>
                            <button class="room-action-btn"><i class="fas fa-eye"></i></button>
                        </div>
                        <div class="room-status-item vacant">
                            <div class="room-status-header"><span class="room-number">302</span><span class="room-status-badge">Vacant</span></div>
                            <div class="room-status-info"><p>Ready for check-in</p><small>Last cleaned: Today 09:00</small></div>
                            <button class="room-action-btn"><i class="fas fa-bell"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    getStaffRequestsContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 600;">Service Requests</h2>
                    <p style="color: var(--text-secondary);">Manage guest service requests</p>
                </div>
                <button class="btn btn-primary btn-sm" id="assignAllBtn"><i class="fas fa-tasks"></i><span>Assign All</span></button>
            </div>
            <div class="card">
                <div class="card-body">
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr><th>Request ID</th><th>Room</th><th>Service</th><th>Time</th><th>Status</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>#HK2105</td><td>312</td><td>Housekeeping</td><td>11:30 AM</td><td><span class="status-badge warning">Pending</span></td><td><button class="btn btn-primary btn-sm assign-btn">Assign</button></td></tr>
                                <tr><td>#MN2104</td><td>205</td><td>Maintenance</td><td>11:15 AM</td><td><span class="status-badge info">In Progress</span></td><td><button class="btn btn-secondary btn-sm">View</button></td></tr>
                                <tr><td>#RS2103</td><td>118</td><td>Room Service</td><td>10:45 AM</td><td><span class="status-badge success">Completed</span></td><td><button class="btn btn-secondary btn-sm">Details</button></td></tr>
                                <tr><td>#HK2102</td><td>409</td><td>Housekeeping</td><td>10:20 AM</td><td><span class="status-badge warning">Pending</span></td><td><button class="btn btn-primary btn-sm assign-btn">Assign</button></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    }

    getStaffGuestsContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 600;">Guest List</h2>
                    <p style="color: var(--text-secondary);">View and manage hotel guests</p>
                </div>
                <button class="btn btn-primary" id="addNewGuestBtn"><i class="fas fa-user-plus"></i><span>Add Guest</span></button>
            </div>
            <div class="card">
                <div class="card-body">
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr><th>Name</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>Prince Kamanga</td><td>205</td><td>24 Oct</td><td>28 Oct</td><td><span class="status-badge success">Active</span></td><td><button class="btn btn-secondary btn-sm">View</button></td></tr>
                                <tr><td>John Smith</td><td>301</td><td>25 Oct</td><td>30 Oct</td><td><span class="status-badge success">Active</span></td><td><button class="btn btn-secondary btn-sm">View</button></td></tr>
                                <tr><td>Jane Doe</td><td>118</td><td>23 Oct</td><td>27 Oct</td><td><span class="status-badge warning">Check-out Today</span></td><td><button class="btn btn-secondary btn-sm">View</button></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    }

    getStaffAddGuestContent() {
        return `
            <div class="page-header" style="margin-bottom: 2rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Manage Guests</h2>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">Add new guests to the system</p>
            </div>
            <div class="card" style="max-width: 600px;">
                <div class="card-header"><h3 style="font-size: 1.125rem; font-weight: 600;">Add New Guest</h3></div>
                <div class="card-body" style="padding: 1.5rem;">
                    <form id="addGuestForm">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Full Name</label>
                            <input type="text" class="form-control" id="guestFullName" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px;">
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Email Address</label>
                            <input type="email" class="form-control" id="guestEmail" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px;">
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Phone Number</label>
                            <input type="text" class="form-control" id="guestPhoneNumber" placeholder="Optional" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px;">
                        </div>
                    </form>
                    <small class="form-text" style="color: var(--text-secondary); display: block; margin-top: 1rem;">A vacant room will be assigned automatically and a 7-character access code will be emailed to the guest.</small>
                </div>
                <div class="card-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; gap: 1rem; justify-content: flex-end;">
                    <button class="btn btn-secondary" id="cancelAddGuest" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">Back to Dashboard</button>
                    <button class="btn btn-primary" id="createGuest" style="padding: 0.75rem 1.5rem; border-radius: 8px; background: var(--primary-gradient); color: white; border: none; cursor: pointer;">Create Guest</button>
                </div>
            </div>`;
    }

    getStaffReportsContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Reports</h2>
                <p style="color: var(--text-secondary);">View hotel performance reports</p>
            </div>
            <div class="dashboard-grid grid-2">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Occupancy Report</h3></div>
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <div style="font-size: 3rem; font-weight: 700; color: var(--primary-color);">87%</div>
                        <p style="color: var(--text-secondary);">Current Occupancy Rate</p>
                        <button class="btn btn-primary mt-4"><i class="fas fa-download"></i> Download Report</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Service Performance</h3></div>
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <div style="font-size: 3rem; font-weight: 700; color: var(--success-color);">94%</div>
                        <p style="color: var(--text-secondary);">Request Completion Rate</p>
                        <button class="btn btn-primary mt-4"><i class="fas fa-download"></i> Download Report</button>
                    </div>
                </div>
            </div>`;
    }

    getStaffScheduleContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Schedule</h2>
                <p style="color: var(--text-secondary);">View your work schedule</p>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Today's Schedule</h3></div>
                <div class="card-body">
                    <div class="staff-activity-list">
                        <div class="activity-item" style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div><strong>Morning Shift</strong><p style="color: var(--text-secondary); margin: 0;">6:00 AM - 2:00 PM</p></div>
                                <span class="status-badge success">Current</span>
                            </div>
                        </div>
                        <div class="activity-item" style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div><strong>Room Inspections</strong><p style="color: var(--text-secondary); margin: 0;">10:00 AM - 11:00 AM</p></div>
                                <span class="status-badge info">Upcoming</span>
                            </div>
                        </div>
                        <div class="activity-item" style="padding: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div><strong>Team Meeting</strong><p style="color: var(--text-secondary); margin: 0;">1:00 PM - 1:30 PM</p></div>
                                <span class="status-badge info">Upcoming</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    getStaffToolsContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Staff Tools</h2>
                <p style="color: var(--text-secondary);">Quick access to staff utilities</p>
            </div>
            <div class="dashboard-grid grid-3">
                <div class="card" style="cursor: pointer;" onclick="this.closest('.dashboard-content').querySelector('#clockInBtn')?.click()">
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-clock" style="font-size: 2.5rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
                        <h4>Clock In/Out</h4>
                        <p style="color: var(--text-secondary);">Record your attendance</p>
                    </div>
                </div>
                <div class="card" style="cursor: pointer;">
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-clipboard-list" style="font-size: 2.5rem; color: var(--success-color); margin-bottom: 1rem;"></i>
                        <h4>Task List</h4>
                        <p style="color: var(--text-secondary);">View assigned tasks</p>
                    </div>
                </div>
                <div class="card" style="cursor: pointer;">
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-comments" style="font-size: 2.5rem; color: var(--warning-color); margin-bottom: 1rem;"></i>
                        <h4>Team Chat</h4>
                        <p style="color: var(--text-secondary);">Communicate with team</p>
                    </div>
                </div>
            </div>`;
    }

    initializeStaffSectionEvents(section) {
        if (section === 'dashboard') {
            const acknowledgeAllBtn = document.getElementById('acknowledgeAllBtn');
            if (acknowledgeAllBtn) {
                acknowledgeAllBtn.addEventListener('click', () => this.showToast('All alerts acknowledged', 'success'));
            }
        }

        if (section === 'rooms') {
            document.querySelectorAll('.room-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const roomItem = e.currentTarget.closest('.room-status-item');
                    const roomNumber = roomItem.querySelector('.room-number').textContent;
                    this.showRoomDetails(roomNumber);
                });
            });

            const floorFilter = document.getElementById('floorFilter');
            if (floorFilter) {
                floorFilter.addEventListener('change', (e) => this.showToast(`Showing rooms for ${e.target.value}`, 'info'));
            }
        }

        if (section === 'requests') {
            document.querySelectorAll('.assign-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.assignServiceRequest(e.currentTarget.closest('tr'));
                });
            });

            const assignAllBtn = document.getElementById('assignAllBtn');
            if (assignAllBtn) {
                assignAllBtn.addEventListener('click', () => this.showToast('All pending requests assigned', 'success'));
            }
        }

        if (section === 'guests' || section === 'add-guest') {
            const addNewGuestBtn = document.getElementById('addNewGuestBtn');
            if (addNewGuestBtn) {
                addNewGuestBtn.addEventListener('click', () => this.showStaffSection('add-guest'));
            }

            const cancelAddGuest = document.getElementById('cancelAddGuest');
            if (cancelAddGuest) {
                cancelAddGuest.addEventListener('click', () => this.showStaffSection('dashboard'));
            }

            const createGuest = document.getElementById('createGuest');
            if (createGuest) {
                createGuest.addEventListener('click', () => this.handleCreateGuest());
            }
        }
    }

    async handleCreateGuest() {
        const fullName = document.getElementById('guestFullName')?.value;
        const email = document.getElementById('guestEmail')?.value;
        const phoneNumber = document.getElementById('guestPhoneNumber')?.value;

        if (!fullName || !email) {
            this.showToast('Please fill in full name and email', 'error');
            return;
        }

        const payload = {
            role: 'guest',
            full_name: String(fullName).trim(),
            email: String(email).trim(),
            phone_number: String(phoneNumber || '').trim(),
        };

        try {
            const res = await fetch(this.getApiPath('register.php'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data || data.ok !== true || !data.user) {
                throw new Error((data && data.error) ? data.error : 'Failed to create guest');
            }

            const room = data.user.room_number ? String(data.user.room_number) : '';
            if (data.warning) {
                const detail = data.warning_detail ? ` (${data.warning_detail})` : '';
                const code = data.guest_code ? ` Code: ${data.guest_code}` : '';
                this.showToast(`${data.warning}${detail}${room ? ` Room ${room}.` : ''}${code}`, 'warning');
            } else {
                this.showToast(`Guest created${room ? ` (Room ${room})` : ''}. Access code sent via email.`, 'success');
            }

            document.getElementById('guestFullName').value = '';
            document.getElementById('guestEmail').value = '';
            document.getElementById('guestPhoneNumber').value = '';
        } catch (err) {
            this.showToast(err?.message || 'Failed to create guest', 'error');
        }
    }

    setupAdminDashboard() {
        this.renderCurrentUser();

        // Add user button
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.showAddUserModal());
        }

        // Save config button
        const saveConfigBtn = document.getElementById('saveConfigBtn');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => {
                this.showToast('Configuration saved successfully', 'success');
            });
        }

        // System health button
        const systemHealthBtn = document.getElementById('systemHealthBtn');
        if (systemHealthBtn) {
            systemHealthBtn.addEventListener('click', () => this.showSystemHealth());
        }

        // Export buttons
        const exportLogsBtn = document.getElementById('exportLogsBtn');
        if (exportLogsBtn) {
            exportLogsBtn.addEventListener('click', () => {
                this.showToast('Logs exported successfully', 'success');
            });
        }

        // Initialize admin tools
        this.setupAdminTools();
    }

    setupRoomControls() {
        // Toggle switches
        document.querySelectorAll('.control-toggle input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const control = e.target.closest('.control-card').querySelector('.card-title').textContent;
                const state = e.target.checked ? 'enabled' : 'disabled';
                this.showToast(`${control} ${state}`, e.target.checked ? 'success' : 'warning');
            });
        });

        // Curtain controls
        document.querySelectorAll('.curtain-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.textContent.trim();
                this.showToast(`Curtains ${action.toLowerCase()}`, 'info');
            });
        });

        // Window security
        const windowLockBtn = document.querySelector('.btn-success');
        if (windowLockBtn && windowLockBtn.textContent.includes('Window')) {
            windowLockBtn.addEventListener('click', () => {
                this.showToast('All windows secured', 'success');
            });
        }
    }

    setupStaffTools() {
        // Filter rooms
        const roomFilter = document.querySelector('.form-control');
        if (roomFilter) {
            roomFilter.addEventListener('change', (e) => {
                const floor = e.target.value;
                this.showToast(`Showing rooms for ${floor}`, 'info');
            });
        }

        // Assign all requests
        const assignAllBtn = document.getElementById('assignAllBtn');
        if (assignAllBtn) {
            assignAllBtn.addEventListener('click', () => {
                this.showToast('All pending requests assigned', 'success');
            });
        }
    }

    setupAdminTools() {
        // Config toggles
        document.querySelectorAll('.config-section input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const setting = e.target.closest('.config-item').querySelector('span').textContent;
                const state = e.target.checked ? 'enabled' : 'disabled';
                this.showToast(`${setting} ${state}`, 'info');
            });
        });

        // Clear logs
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all logs?')) {
                    this.showToast('System logs cleared', 'warning');
                }
            });
        }
    }

    async handleLogin() {
        const username = document.getElementById('username')?.value;
        const password = document.getElementById('password')?.value;
        const rememberMe = document.getElementById('rememberMe')?.checked;
        const userType = document.querySelector('.user-type-btn.active')?.dataset.type || 'guest';

        if (!username || !password) {
            this.showToast('Please enter username and password', 'error');
            return;
        }

        // Show loading
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }

        try {
            const res = await fetch(this.getApiPath('login.php'), {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: String(username).trim(),
                    password: String(password),
                    role: String(userType).trim().toLowerCase()
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data || data.ok !== true) {
                const msg = (data && data.error) ? data.error : 'Login failed';
                throw new Error(msg);
            }

            const user = data.user;
            if (!user || !user.role) {
                throw new Error('Login failed');
            }

            try {
                localStorage.setItem('smartRoomUser', JSON.stringify(user));
            } catch (_) {
                // ignore
            }
            this.currentUser = user;

            this.showToast('Login successful!', 'success');

            setTimeout(() => {
                switch (user.role) {
                    case 'admin':
                        window.location.href = this.getPagePath('admin');
                        break;
                    case 'staff':
                        window.location.href = this.getPagePath('staff');
                        break;
                    case 'guest':
                        window.location.href = this.getPagePath('guest');
                        break;
                    default:
                        window.location.href = this.getPagePath('index');
                }
            }, 700);
        } catch (err) {
            this.showToast(err?.message || 'Login failed', 'error');
        } finally {
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }
    }

    async handleCreateAccount() {
        const fullName = document.getElementById('fullName')?.value;
        const username = document.getElementById('newUsername')?.value;
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('newPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;
        const role = document.getElementById('userType')?.value;

        if (!fullName || !username || !email || !password || !confirmPassword || !role) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (String(password) !== String(confirmPassword)) {
            this.showToast('Passwords do not match', 'error');
            return;
        }

        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }

        try {
            const res = await fetch(this.getApiPath('self_register.php'), {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    full_name: String(fullName).trim(),
                    username: String(username).trim(),
                    email: String(email).trim(),
                    password: String(password),
                    role: String(role).trim().toLowerCase(),
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data || data.ok !== true || !data.user) {
                const msg = (data && data.error) ? data.error : 'Failed to create account';
                throw new Error(msg);
            }

            const user = data.user;
            this.showToast('Account created successfully', 'success');

            try {
                localStorage.removeItem('smartRoomUser');
            } catch (_) {
                // ignore
            }

            fetch(this.getApiPath('logout.php'), {
                method: 'POST',
                credentials: 'include'
            }).catch(() => {
                // ignore
            });

            window.location.replace(this.getPagePath('index'));
        } catch (err) {
            this.showToast(err?.message || 'Failed to create account', 'error');
        } finally {
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }
    }

    createServiceRequest() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Create Service Request</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="serviceRequestForm">
                        <div class="form-group">
                            <label class="form-label">Service Type</label>
                            <select class="form-control" required>
                                <option value="">Select service type</option>
                                <option value="housekeeping">Housekeeping</option>
                                <option value="room-service">Room Service</option>
                                <option value="maintenance">Maintenance</option>
                                <option value="laundry">Laundry</option>
                                <option value="extra-amenities">Extra Amenities</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Priority</label>
                            <div class="priority-buttons">
                                <button type="button" class="priority-btn low active">Low</button>
                                <button type="button" class="priority-btn medium">Medium</button>
                                <button type="button" class="priority-btn high">High</button>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea class="form-control" rows="4" placeholder="Describe your request..." required></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Preferred Time</label>
                            <input type="time" class="form-control">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="cancelRequest">Cancel</button>
                    <button class="btn btn-primary" id="submitRequest">Submit Request</button>
                </div>
            </div>
        `;

        this.showModal(modalHtml);

        setTimeout(() => {
            // Priority buttons
            document.querySelectorAll('.priority-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                });
            });

            // Cancel button
            document.getElementById('cancelRequest').addEventListener('click', () => this.closeModal());

            // Submit button
            document.getElementById('submitRequest').addEventListener('click', () => {
                this.showToast('Service request submitted successfully', 'success');
                this.closeModal();
            });

            // Close button
            document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        }, 100);
    }

    assignServiceRequest(row) {
        const requestId = row.cells[0].textContent;
        const roomNumber = row.cells[1].textContent;
        
        this.showToast(`Request ${requestId} for room ${roomNumber} assigned`, 'success');
        
        // Update UI
        const statusCell = row.cells[4];
        statusCell.innerHTML = '<span class="status-badge info">In Progress</span>';
        
        const actionCell = row.cells[5];
        actionCell.innerHTML = '<button class="btn btn-secondary btn-sm">View</button>';
    }

    showRoomDetails(roomNumber) {
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Room ${roomNumber} Details</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="room-details-container">
                        <div class="room-info">
                            <div class="info-item">
                                <span class="info-label">Status:</span>
                                <span class="info-value">Occupied</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Guest:</span>
                                <span class="info-value">Prince Kamanga</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Check-in:</span>
                                <span class="info-value">24 Oct 2025, 14:00</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Check-out:</span>
                                <span class="info-value">28 Oct 2025, 12:00</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Temperature:</span>
                                <span class="info-value">22°C</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Energy Usage:</span>
                                <span class="info-value">14.2 kWh (45% below avg)</span>
                            </div>
                        </div>
                        
                        <div class="room-actions">
                            <h4>Quick Actions</h4>
                            <div class="action-buttons">
                                <button class="btn btn-primary btn-sm">Send Message</button>
                                <button class="btn btn-secondary btn-sm">View History</button>
                                <button class="btn btn-warning btn-sm">Schedule Service</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.showModal(modalHtml);

        setTimeout(() => {
            document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        }, 100);
    }

    showAddUserModal() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Add New User</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="addUserForm">
                        <div class="form-group">
                            <label class="form-label">Full Name</label>
                            <input type="text" class="form-control" id="newUserFullName" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Email Address</label>
                            <input type="email" class="form-control" id="newUserEmail" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Role</label>
                            <select class="form-control" id="newUserRole" required>
                                <option value="">Select role</option>
                                <option value="admin">Administrator</option>
                                <option value="staff">Staff</option>
                                <option value="guest">Guest</option>
                            </select>
                        </div>

                        <div class="form-group" id="guestRoomGroup" style="display:none;">
                            <label class="form-label">Room Number</label>
                            <input type="text" class="form-control" id="newUserRoomNumber" placeholder="e.g. 205">
                            <small class="form-text">Guest will receive a generated login code via email.</small>
                        </div>
                        
                        <div class="form-group" id="staffAdminPasswordGroup" style="display:none;">
                            <label class="form-label">Password</label>
                            <input type="password" class="form-control" id="newUserPassword" placeholder="Enter password">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="cancelAddUser">Cancel</button>
                    <button class="btn btn-primary" id="createUser">Create User</button>
                </div>
            </div>
        `;

        this.showModal(modalHtml);

        setTimeout(() => {
            const cancelBtn = document.getElementById('cancelAddUser');
            const createBtn = document.getElementById('createUser');
            const roleSelect = document.getElementById('newUserRole');
            const guestRoomGroup = document.getElementById('guestRoomGroup');
            const staffAdminPasswordGroup = document.getElementById('staffAdminPasswordGroup');

            const syncRoleFields = () => {
                const role = String(roleSelect?.value || '').toLowerCase();
                if (role === 'guest') {
                    guestRoomGroup.style.display = '';
                    staffAdminPasswordGroup.style.display = 'none';
                } else if (role === 'admin' || role === 'staff') {
                    guestRoomGroup.style.display = 'none';
                    staffAdminPasswordGroup.style.display = '';
                } else {
                    guestRoomGroup.style.display = 'none';
                    staffAdminPasswordGroup.style.display = 'none';
                }
            };

            if (roleSelect) {
                roleSelect.addEventListener('change', syncRoleFields);
                syncRoleFields();
            }

            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
            const closeBtn = document.querySelector('.modal-close');
            if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

            if (createBtn) {
                createBtn.addEventListener('click', async () => {
                    const fullName = document.getElementById('newUserFullName')?.value;
                    const email = document.getElementById('newUserEmail')?.value;
                    const role = document.getElementById('newUserRole')?.value;
                    const roomNumber = document.getElementById('newUserRoomNumber')?.value;
                    const password = document.getElementById('newUserPassword')?.value;

                    if (!fullName || !email || !role) {
                        this.showToast('Please fill in full name, email, and role', 'error');
                        return;
                    }

                    const payload = {
                        full_name: String(fullName).trim(),
                        email: String(email).trim(),
                        role: String(role).trim().toLowerCase()
                    };

                    if (payload.role === 'guest') {
                        if (!roomNumber) {
                            this.showToast('Room number is required for guest', 'error');
                            return;
                        }
                        payload.room_number = String(roomNumber).trim();
                    } else {
                        if (!password) {
                            this.showToast('Password is required for staff/admin', 'error');
                            return;
                        }
                        payload.password = String(password);
                    }

                    try {
                        const res = await fetch(this.getApiPath('register.php'), {
                            method: 'POST',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload)
                        });

                        const data = await res.json().catch(() => null);
                        if (!res.ok || !data || data.ok !== true) {
                            const msg = (data && data.error) ? data.error : 'Failed to create user';
                            throw new Error(msg);
                        }

                        if (data.warning) {
                            const detail = data.warning_detail ? ` (${data.warning_detail})` : '';
                            this.showToast(`${data.warning}${detail}`, 'warning');
                        } else {
                            this.showToast('User created successfully', 'success');
                        }
                        this.closeModal();
                    } catch (err) {
                        this.showToast(err?.message || 'Failed to create user', 'error');
                    }
                });
            }
        }, 100);
    }

    showAddGuestModal() {
        const dashboardContent = document.querySelector('.dashboard-content');
        if (!dashboardContent) return;

        // Store original content to restore later
        if (!this._originalDashboardContent) {
            this._originalDashboardContent = dashboardContent.innerHTML;
        }

        const formHtml = `
            <div class="manage-guests-page">
                <div class="page-header" style="margin-bottom: 2rem;">
                    <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--text-primary);">Manage Guests</h2>
                    <p style="color: var(--text-secondary); margin-top: 0.5rem;">Add new guests to the system</p>
                </div>

                <div class="card" style="max-width: 600px;">
                    <div class="card-header">
                        <h3 style="font-size: 1.125rem; font-weight: 600;">Add New Guest</h3>
                    </div>
                    <div class="card-body" style="padding: 1.5rem;">
                        <form id="addGuestForm">
                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Full Name</label>
                                <input type="text" class="form-control" id="guestFullName" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px;">
                            </div>

                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Email Address</label>
                                <input type="email" class="form-control" id="guestEmail" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px;">
                            </div>

                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Phone Number</label>
                                <input type="text" class="form-control" id="guestPhoneNumber" placeholder="Optional" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px;">
                            </div>
                        </form>
                        <small class="form-text" style="color: var(--text-secondary); display: block; margin-top: 1rem;">A vacant room will be assigned automatically and a 7-character access code will be emailed to the guest.</small>
                    </div>
                    <div class="card-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; gap: 1rem; justify-content: flex-end;">
                        <button class="btn btn-secondary" id="cancelAddGuest" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">Back to Dashboard</button>
                        <button class="btn btn-primary" id="createGuest" style="padding: 0.75rem 1.5rem; border-radius: 8px; background: var(--primary-gradient); color: white; border: none; cursor: pointer;">Create Guest</button>
                    </div>
                </div>
            </div>
        `;

        dashboardContent.innerHTML = formHtml;

        const cancelBtn = document.getElementById('cancelAddGuest');
        const createBtn = document.getElementById('createGuest');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (this._originalDashboardContent) {
                    dashboardContent.innerHTML = this._originalDashboardContent;
                }
            });
        }

        if (createBtn) {
            createBtn.addEventListener('click', async () => {
                const fullName = document.getElementById('guestFullName')?.value;
                const email = document.getElementById('guestEmail')?.value;
                const phoneNumber = document.getElementById('guestPhoneNumber')?.value;

                if (!fullName || !email) {
                    this.showToast('Please fill in full name and email', 'error');
                    return;
                }

                const payload = {
                    role: 'guest',
                    full_name: String(fullName).trim(),
                    email: String(email).trim(),
                    phone_number: String(phoneNumber || '').trim(),
                };

                try {
                    const res = await fetch(this.getApiPath('register.php'), {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data || data.ok !== true || !data.user) {
                        const msg = (data && data.error) ? data.error : 'Failed to create guest';
                        throw new Error(msg);
                    }

                    const room = data.user.room_number ? String(data.user.room_number) : '';
                    if (data.warning) {
                        const detail = data.warning_detail ? ` (${data.warning_detail})` : '';
                        const code = data.guest_code ? ` Code: ${data.guest_code}` : '';
                        this.showToast(`${data.warning}${detail}${room ? ` Room ${room}.` : ''}${code}`, 'warning');
                    } else {
                        this.showToast(`Guest created${room ? ` (Room ${room})` : ''}. Access code sent via email.`, 'success');
                    }

                    // Clear form after successful creation
                    document.getElementById('guestFullName').value = '';
                    document.getElementById('guestEmail').value = '';
                    document.getElementById('guestPhoneNumber').value = '';
                } catch (err) {
                    this.showToast(err?.message || 'Failed to create guest', 'error');
                }
            });
        }
    }

    showSystemHealth() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3>System Health Monitor</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="system-health">
                        <div class="health-metric">
                            <div class="metric-header">
                                <span>Server Response Time</span>
                                <span class="metric-value success">142ms</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill success" style="width: 95%"></div>
                            </div>
                        </div>
                        
                        <div class="health-metric">
                            <div class="metric-header">
                                <span>Database Performance</span>
                                <span class="metric-value success">98%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill success" style="width: 98%"></div>
                            </div>
                        </div>
                        
                        <div class="health-metric">
                            <div class="metric-header">
                                <span>IoT Connectivity</span>
                                <span class="metric-value success">100%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill success" style="width: 100%"></div>
                            </div>
                        </div>
                        
                        <div class="health-metric">
                            <div class="metric-header">
                                <span>Storage Usage</span>
                                <span class="metric-value warning">65%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill warning" style="width: 65%"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="system-status mt-6">
                        <h4>System Status: <span class="status-success">All Systems Operational</span></h4>
                        <p class="text-muted">Last updated: Just now</p>
                    </div>
                </div>
            </div>
        `;

        this.showModal(modalHtml);

        setTimeout(() => {
            document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        }, 100);
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput || !messageInput.value.trim()) return;

        const message = messageInput.value.trim();
        messageInput.value = '';

        // Add message to chat
        const chatBody = document.querySelector('.chat-card .card-body');
        if (chatBody) {
            const messageHtml = `
                <div class="message sent">
                    <div class="message-content">
                        ${message}
                    </div>
                    <div class="message-time">
                        You • ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                </div>
            `;
            chatBody.insertAdjacentHTML('beforeend', messageHtml);
            chatBody.scrollTop = chatBody.scrollHeight;
        }

        // Simulate response
        setTimeout(() => {
            if (chatBody) {
                const responses = [
                    "Thank you for your message. Is there anything else we can assist you with?",
                    "Message received. Our team will get back to you shortly.",
                    "We've noted your request and will take appropriate action."
                ];
                const response = responses[Math.floor(Math.random() * responses.length)];
                
                const responseHtml = `
                    <div class="message received">
                        <div class="message-content">
                            ${response}
                        </div>
                        <div class="message-time">
                            Concierge • ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                `;
                chatBody.insertAdjacentHTML('beforeend', responseHtml);
                chatBody.scrollTop = chatBody.scrollHeight;
            }
        }, 1000);
    }

    loadUserData() {
        // In a real app, this would load from localStorage or API
        try {
            const savedUser = localStorage.getItem('smartRoomUser');
            if (savedUser) {
                this.currentUser = this.normalizeUser(JSON.parse(savedUser));
            }
        } catch (err) {
            console.error('Failed to load user data:', err);
            try {
                localStorage.removeItem('smartRoomUser');
            } catch (_) {
                // ignore
            }
            this.currentUser = null;
        }
    }

    normalizeUser(user) {
        if (!user || typeof user !== 'object') return null;

        const fullName = this.getUserFullName(user);
        const initials = this.getUserInitials(user);
        const roleLabel = this.getUserRoleLabel(user);

        return {
            ...user,
            name: fullName,
            initials,
            role_label: roleLabel,
        };
    }

    getUserFullName(user) {
        const fullName = (user && typeof user === 'object') ? (user.full_name ?? user.name) : null;
        const s = String(fullName ?? '').trim();
        return s !== '' ? s : null;
    }

    getUserInitials(user) {
        const fullName = this.getUserFullName(user);
        if (!fullName) return null;

        const parts = fullName.split(/\s+/).filter(Boolean);
        const first = parts[0]?.[0] ?? '';
        const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
        const initials = (first + second).toUpperCase();
        return initials !== '' ? initials : null;
    }

    getUserRoleLabel(user) {
        if (!user || typeof user !== 'object') return null;
        const role = String(user.role ?? '').toLowerCase();
        if (!role) return null;

        if (role === 'guest') {
            const room = String(user.room_number ?? '').trim();
            return room ? `Guest • Room ${room}` : 'Guest';
        }

        if (role === 'admin') return 'Admin';
        if (role === 'staff') return 'Staff';
        return role;
    }

    renderCurrentUser() {
        if (this.currentUser) {
            this.currentUser = this.normalizeUser(this.currentUser);
        }

        const name = this.getUserFullName(this.currentUser) || '';
        const initials = this.getUserInitials(this.currentUser) || '';
        const roleLabel = this.getUserRoleLabel(this.currentUser) || '';

        const sidebarName = document.querySelector('.user-profile .user-name');
        if (sidebarName) sidebarName.textContent = name;

        const sidebarRole = document.querySelector('.user-profile .user-role');
        if (sidebarRole && roleLabel) sidebarRole.textContent = roleLabel;

        const sidebarAvatar = document.querySelector('.user-profile .user-avatar');
        if (sidebarAvatar && initials) {
            let updated = false;
            for (const node of Array.from(sidebarAvatar.childNodes)) {
                if (node.nodeType === Node.TEXT_NODE) {
                    node.nodeValue = `\n                ${initials}\n                `;
                    updated = true;
                    break;
                }
            }
            if (!updated) {
                sidebarAvatar.insertBefore(document.createTextNode(`\n                ${initials}\n                `), sidebarAvatar.firstChild);
            }
        }

        const topAvatar = document.querySelector('#userMenu .user-avatar-small');
        if (topAvatar && initials) topAvatar.textContent = initials;
    }

    setupAnimations() {
        // Add animation classes to cards on load
        setTimeout(() => {
            document.querySelectorAll('.card').forEach((card, index) => {
                card.style.animationDelay = `${index * 0.1}s`;
                card.classList.add('animate-fade-in');
            });
        }, 100);
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toastId = 'toast-' + Date.now();
        const toastHtml = `
            <div class="toast ${type}" id="${toastId}">
                <div class="toast-icon">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : 
                                       type === 'error' ? 'exclamation-circle' : 
                                       type === 'warning' ? 'exclamation-triangle' : 
                                       'info-circle'}"></i>
                </div>
                <div class="toast-content">
                    <div class="toast-title">${this.getToastTitle(type)}</div>
                    <div class="toast-message">${message}</div>
                </div>
                <button class="toast-close" onclick="document.getElementById('${toastId}').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);

        // Auto remove after 5 seconds
        setTimeout(() => {
            const toast = document.getElementById(toastId);
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(20px)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    getToastTitle(type) {
        const titles = {
            'success': 'Success',
            'error': 'Error',
            'warning': 'Warning',
            'info': 'Information'
        };
        return titles[type] || 'Notification';
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.smartRoomSystem = new SmartRoomSystem();
});

// Helper function for animations
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
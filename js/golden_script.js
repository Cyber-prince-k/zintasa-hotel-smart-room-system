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
                <div class="card-body" id="serviceRequestsContainer">
                    <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                        <i class="fas fa-spinner fa-spin"></i> <span style="margin-left: 0.5rem;">Loading requests...</span>
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
                        <button class="action-btn" id="refreshMessagesBtn"><i class="fas fa-sync-alt"></i></button>
                    </div>
                </div>
                <div class="card-body" id="messagesContainer" style="max-height: 400px; overflow-y: auto; min-height: 200px;">
                    <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                        <i class="fas fa-spinner fa-spin"></i> <span style="margin-left: 0.5rem;">Loading messages...</span>
                    </div>
                </div>
                <div class="message-input" style="display: flex; gap: 0.5rem; padding: 1rem; border-top: 1px solid var(--border-color);">
                    <input type="text" placeholder="Type your message..." id="messageInput" class="form-control" style="flex: 1;">
                    <button id="sendMessageBtn" class="btn btn-primary"><i class="fas fa-paper-plane"></i></button>
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
            this.loadServiceRequests();
            const newRequestBtn = document.getElementById('newRequestBtn');
            if (newRequestBtn) {
                newRequestBtn.addEventListener('click', () => this.showNewServiceRequestForm());
            }
        }

        if (section === 'communication') {
            this.loadMessages();
            this.startMessagePolling();
            const sendMessageBtn = document.getElementById('sendMessageBtn');
            const messageInput = document.getElementById('messageInput');
            if (sendMessageBtn && messageInput) {
                sendMessageBtn.addEventListener('click', () => this.sendMessage());
                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.sendMessage();
                });
            }
            const refreshMessagesBtn = document.getElementById('refreshMessagesBtn');
            if (refreshMessagesBtn) {
                refreshMessagesBtn.addEventListener('click', () => this.loadMessages());
            }
        } else {
            this.stopMessagePolling();
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
        this.updatePendingRequestsBadge();
    }

    async updatePendingRequestsBadge() {
        try {
            const res = await fetch(this.getApiPath('service_requests.php') + '?status=pending', {
                method: 'GET',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.ok) {
                const count = (data.requests || []).length;
                const badge = document.getElementById('requestsBadge');
                if (badge) {
                    badge.textContent = count;
                    badge.style.display = count > 0 ? 'inline-flex' : 'none';
                }
            }
        } catch (err) {
            console.error('Failed to update requests badge:', err);
        }
    }

    async loadStaffDashboardStats() {
        try {
            // Fetch service requests
            const reqRes = await fetch(this.getApiPath('service_requests.php'), {
                method: 'GET',
                credentials: 'include'
            });
            const reqData = await reqRes.json();
            const requests = reqData.ok ? (reqData.requests || []) : [];
            
            const pendingCount = requests.filter(r => r.status === 'pending').length;
            const inProgressCount = requests.filter(r => r.status === 'in_progress').length;
            const completedCount = requests.filter(r => r.status === 'completed').length;
            
            // Update pending requests stat
            const pendingStat = document.getElementById('statPendingRequests');
            if (pendingStat) pendingStat.textContent = pendingCount;
            
            const pendingChange = document.getElementById('statPendingChange');
            if (pendingChange) {
                pendingChange.innerHTML = inProgressCount > 0 
                    ? `<i class="fas fa-spinner"></i><span>${inProgressCount} in progress</span>`
                    : '<span>No requests in progress</span>';
            }
            
            // Update total requests stat
            const totalStat = document.getElementById('statTotalRequests');
            if (totalStat) totalStat.textContent = requests.length;
            
            const completedStat = document.getElementById('statCompletedRequests');
            if (completedStat) {
                completedStat.innerHTML = `<i class="fas fa-check"></i><span>${completedCount} completed</span>`;
            }

            // Fetch guests
            const guestRes = await fetch(this.getApiPath('guests.php'), {
                method: 'GET',
                credentials: 'include'
            });
            const guestData = await guestRes.json();
            const guests = guestData.ok ? (guestData.guests || []) : [];
            
            const activeGuests = guests.filter(g => g.status === 'active').length;
            const checkoutToday = guests.filter(g => g.status === 'checkout_today').length;
            
            // Update guests stat
            const guestsStat = document.getElementById('statActiveGuests');
            if (guestsStat) guestsStat.textContent = activeGuests;
            
            const checkoutStat = document.getElementById('statCheckoutToday');
            if (checkoutStat) {
                checkoutStat.innerHTML = checkoutToday > 0 
                    ? `<i class="fas fa-sign-out-alt"></i><span>${checkoutToday} checkout today</span>`
                    : '<span>No checkouts today</span>';
            }
            
            // Update rooms stat (based on guests with rooms)
            const occupiedRooms = guests.filter(g => g.status === 'active' && g.room_number).length;
            const totalRooms = 50; // Default total rooms
            const occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);
            
            const roomsStat = document.getElementById('statRoomsOccupied');
            if (roomsStat) roomsStat.textContent = `${occupiedRooms}/${totalRooms}`;
            
            const occupancyStat = document.getElementById('statOccupancyRate');
            if (occupancyStat) {
                occupancyStat.innerHTML = `<i class="fas fa-chart-line"></i><span>${occupancyRate}% occupancy</span>`;
            }
            
            // Load recent requests
            this.loadRecentRequests(requests.slice(0, 5));
            
        } catch (err) {
            console.error('Failed to load dashboard stats:', err);
        }
    }

    loadRecentRequests(requests) {
        const container = document.getElementById('recentRequestsContainer');
        if (!container) return;
        
        if (requests.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: var(--text-secondary);">
                    <p>No recent service requests</p>
                </div>`;
            return;
        }
        
        container.innerHTML = `
            <div class="alerts-grid">
                ${requests.map(req => {
                    const priorityClass = req.priority === 'high' ? 'urgent' : (req.priority === 'medium' ? 'warning' : 'info');
                    const priorityIcon = req.priority === 'high' ? 'exclamation-triangle' : (req.priority === 'medium' ? 'clock' : 'info-circle');
                    const typeLabel = (req.request_type || 'other').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const time = this.formatRequestTime(req.created_at);
                    
                    return `
                        <div class="alert-item ${priorityClass}">
                            <div class="alert-icon"><i class="fas fa-${priorityIcon}"></i></div>
                            <div class="alert-content">
                                <h4>Room ${req.room_number || 'N/A'} - ${typeLabel}</h4>
                                <p>${this.escapeHtml(req.description || 'No description')}</p>
                                <small>Priority: ${req.priority || 'medium'} • ${time}</small>
                            </div>
                            <div class="alert-actions">
                                ${req.status === 'pending' 
                                    ? `<button class="btn btn-primary btn-sm" onclick="window.smartRoomSystem.updateRequestStatus(${req.id}, 'in_progress')">Start</button>`
                                    : req.status === 'in_progress'
                                        ? `<button class="btn btn-success btn-sm" onclick="window.smartRoomSystem.updateRequestStatus(${req.id}, 'completed')">Complete</button>`
                                        : `<span class="status-badge success">Completed</span>`
                                }
                            </div>
                        </div>`;
                }).join('')}
            </div>`;
    }

    setupStaffNavigation() {
        const navLinks = {
            'dashboard-link': 'dashboard',
            'rooms-link': 'rooms',
            'requests-link': 'requests',
            'guests-link': 'guests',
            'addGuestBtn': 'add-guest',
            'messages-link': 'messages',
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
            'messages': this.getStaffMessagesContent(),
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
                        <div class="stat-value" id="statPendingRequests"><i class="fas fa-spinner fa-spin"></i></div>
                        <div class="stat-label">Pending Requests</div>
                        <div class="stat-change" id="statPendingChange"></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon primary"><i class="fas fa-bed"></i></div>
                    <div class="stat-content">
                        <div class="stat-value" id="statRoomsOccupied"><i class="fas fa-spinner fa-spin"></i></div>
                        <div class="stat-label">Rooms Occupied</div>
                        <div class="stat-change" id="statOccupancyRate"></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-users"></i></div>
                    <div class="stat-content">
                        <div class="stat-value" id="statActiveGuests"><i class="fas fa-spinner fa-spin"></i></div>
                        <div class="stat-label">Active Guests</div>
                        <div class="stat-change" id="statCheckoutToday"></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning"><i class="fas fa-concierge-bell"></i></div>
                    <div class="stat-content">
                        <div class="stat-value" id="statTotalRequests"><i class="fas fa-spinner fa-spin"></i></div>
                        <div class="stat-label">Total Requests Today</div>
                        <div class="stat-change" id="statCompletedRequests"></div>
                    </div>
                </div>
            </div>
            <div class="card mt-6">
                <div class="card-header">
                    <h3 class="card-title">Recent Service Requests</h3>
                    <button class="btn btn-primary btn-sm" onclick="window.smartRoomSystem.showStaffSection('requests')"><i class="fas fa-list"></i><span>View All</span></button>
                </div>
                <div class="card-body">
                    <div id="recentRequestsContainer">
                        <div style="text-align: center; padding: 1rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
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
                <div style="display: flex; gap: 0.5rem;">
                    <select class="form-control" id="requestStatusFilter" style="width: auto;">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="assigned">Assigned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <button class="btn btn-secondary btn-sm" id="refreshRequestsBtn"><i class="fas fa-sync-alt"></i></button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <div class="table-container" id="staffRequestsContainer">
                        <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                            <i class="fas fa-spinner fa-spin"></i> <span style="margin-left: 0.5rem;">Loading requests...</span>
                        </div>
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
                <div style="display: flex; gap: 0.5rem;">
                    <input type="text" class="form-control" id="guestSearchInput" placeholder="Search guests..." style="width: 200px;">
                    <button class="btn btn-secondary btn-sm" id="refreshGuestsBtn"><i class="fas fa-sync-alt"></i></button>
                    <button class="btn btn-primary" id="addNewGuestBtn"><i class="fas fa-user-plus"></i><span>Add Guest</span></button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <div class="table-container" id="staffGuestsContainer">
                        <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                            <i class="fas fa-spinner fa-spin"></i> <span style="margin-left: 0.5rem;">Loading guests...</span>
                        </div>
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

    getStaffMessagesContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Guest Messages</h2>
                <p style="color: var(--text-secondary);">Communicate with guests</p>
            </div>
            <div class="dashboard-grid grid-2">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Active Conversations</h3>
                        <button class="action-btn" id="refreshRoomsBtn"><i class="fas fa-sync-alt"></i></button>
                    </div>
                    <div class="card-body" id="roomsListContainer" style="max-height: 400px; overflow-y: auto;">
                        <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                            <i class="fas fa-spinner fa-spin"></i> <span style="margin-left: 0.5rem;">Loading rooms...</span>
                        </div>
                    </div>
                </div>
                <div class="card chat-card">
                    <div class="card-header">
                        <h3 class="card-title">Chat</h3>
                        <span id="currentChatRoom" style="color: var(--text-secondary);">Select a room</span>
                    </div>
                    <div class="card-body" id="messagesContainer" style="max-height: 350px; overflow-y: auto; min-height: 200px;">
                        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                            <i class="fas fa-comments" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <p>Select a room to view messages</p>
                        </div>
                    </div>
                    <div class="message-input" style="display: flex; gap: 0.5rem; padding: 1rem; border-top: 1px solid var(--border-color);">
                        <input type="text" placeholder="Type your reply..." id="messageInput" class="form-control" style="flex: 1;" disabled>
                        <button id="sendMessageBtn" class="btn btn-primary" disabled><i class="fas fa-paper-plane"></i></button>
                    </div>
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
            this.loadStaffDashboardStats();
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
            this.loadStaffServiceRequests();
            
            const statusFilter = document.getElementById('requestStatusFilter');
            if (statusFilter) {
                statusFilter.addEventListener('change', () => this.loadStaffServiceRequests());
            }
            
            const refreshBtn = document.getElementById('refreshRequestsBtn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => this.loadStaffServiceRequests());
            }
        }

        if (section === 'guests') {
            this.loadStaffGuests();
            
            const addNewGuestBtn = document.getElementById('addNewGuestBtn');
            if (addNewGuestBtn) {
                addNewGuestBtn.addEventListener('click', () => this.showStaffSection('add-guest'));
            }
            
            const refreshGuestsBtn = document.getElementById('refreshGuestsBtn');
            if (refreshGuestsBtn) {
                refreshGuestsBtn.addEventListener('click', () => this.loadStaffGuests());
            }
            
            const searchInput = document.getElementById('guestSearchInput');
            if (searchInput) {
                let searchTimeout;
                searchInput.addEventListener('input', () => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => this.loadStaffGuests(searchInput.value), 300);
                });
            }
        }
        
        if (section === 'add-guest') {
            const cancelAddGuest = document.getElementById('cancelAddGuest');
            if (cancelAddGuest) {
                cancelAddGuest.addEventListener('click', () => this.showStaffSection('guests'));
            }

            const createGuest = document.getElementById('createGuest');
            if (createGuest) {
                createGuest.addEventListener('click', () => this.handleCreateGuest());
            }
        }

        if (section === 'messages') {
            this.loadRoomsWithMessages();
            this.startMessagePolling();
            
            const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
            if (refreshRoomsBtn) {
                refreshRoomsBtn.addEventListener('click', () => this.loadRoomsWithMessages());
            }

            const sendMessageBtn = document.getElementById('sendMessageBtn');
            const messageInput = document.getElementById('messageInput');
            if (sendMessageBtn && messageInput) {
                sendMessageBtn.addEventListener('click', () => this.sendMessage(this.currentRoomNumber));
                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.sendMessage(this.currentRoomNumber);
                });
            }
        } else {
            this.stopMessagePolling();
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
        this.setupAdminNavigation();
        this.showAdminSection('dashboard');
    }

    setupAdminNavigation() {
        const navLinks = {
            'dashboard-link': 'dashboard',
            'analytics-link': 'analytics',
            'users-link': 'users',
            'system-link': 'system',
            'reports-link': 'reports',
            'security-link': 'security',
            'backup-link': 'backup'
        };

        Object.entries(navLinks).forEach(([linkId, section]) => {
            const link = document.getElementById(linkId);
            if (link) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showAdminSection(section);
                    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                    link.classList.add('active');
                });
            }
        });
    }

    showAdminSection(section) {
        const dashboardContent = document.querySelector('.dashboard-content');
        if (!dashboardContent) return;

        const sections = {
            'dashboard': this.getAdminDashboardContent(),
            'analytics': this.getAdminAnalyticsContent(),
            'users': this.getAdminUsersContent(),
            'system': this.getAdminSystemContent(),
            'reports': this.getAdminReportsContent(),
            'security': this.getAdminSecurityContent(),
            'backup': this.getAdminBackupContent()
        };

        dashboardContent.innerHTML = sections[section] || sections['dashboard'];
        this.initializeAdminSectionEvents(section);
    }

    getAdminDashboardContent() {
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon primary"><i class="fas fa-microchip"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">98%</div>
                        <div class="stat-label">System Uptime</div>
                        <div class="stat-change positive"><i class="fas fa-arrow-up"></i><span>30 days stable</span></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-plug"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">160/160</div>
                        <div class="stat-label">IoT Devices Online</div>
                        <div class="stat-change"><i class="fas fa-check-circle"></i><span>All connected</span></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning"><i class="fas fa-database"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">2.4TB</div>
                        <div class="stat-label">Data Storage Used</div>
                        <div class="stat-change negative"><i class="fas fa-arrow-up"></i><span>65% of capacity</span></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon danger"><i class="fas fa-shield-alt"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">0</div>
                        <div class="stat-label">Security Alerts</div>
                        <div class="stat-change positive"><i class="fas fa-check"></i><span>No threats detected</span></div>
                    </div>
                </div>
            </div>
            <div class="dashboard-grid grid-2" style="margin-top: 1.5rem;">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">System Health Monitor</h3><span class="text-success"><i class="fas fa-check-circle"></i> All Systems Normal</span></div>
                    <div class="card-body">
                        <div class="health-monitor">
                            <div class="health-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);">
                                <div><i class="fas fa-server" style="margin-right: 0.5rem;"></i><span>Web Server</span></div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;"><div style="width: 100px; height: 8px; background: var(--border-color); border-radius: 4px;"><div style="width: 95%; height: 100%; background: var(--success-color); border-radius: 4px;"></div></div><span>95%</span></div>
                            </div>
                            <div class="health-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);">
                                <div><i class="fas fa-database" style="margin-right: 0.5rem;"></i><span>Database</span></div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;"><div style="width: 100px; height: 8px; background: var(--border-color); border-radius: 4px;"><div style="width: 88%; height: 100%; background: var(--success-color); border-radius: 4px;"></div></div><span>88%</span></div>
                            </div>
                            <div class="health-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);">
                                <div><i class="fas fa-plug" style="margin-right: 0.5rem;"></i><span>IoT Gateway</span></div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;"><div style="width: 100px; height: 8px; background: var(--border-color); border-radius: 4px;"><div style="width: 100%; height: 100%; background: var(--success-color); border-radius: 4px;"></div></div><span>100%</span></div>
                            </div>
                            <div class="health-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0;">
                                <div><i class="fas fa-shield-alt" style="margin-right: 0.5rem;"></i><span>Security System</span></div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;"><div style="width: 100px; height: 8px; background: var(--border-color); border-radius: 4px;"><div style="width: 100%; height: 100%; background: var(--success-color); border-radius: 4px;"></div></div><span>100%</span></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Recent System Logs</h3><button class="btn btn-primary btn-sm" id="exportLogsBtn"><i class="fas fa-download"></i> Export</button></div>
                    <div class="card-body">
                        <div class="logs-container">
                            <div style="display: flex; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);"><span style="color: var(--text-secondary); min-width: 70px;">14:30:22</span><span class="status-badge info" style="font-size: 0.7rem;">INFO</span><span>User 'Admin' logged in successfully</span></div>
                            <div style="display: flex; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);"><span style="color: var(--text-secondary); min-width: 70px;">14:25:18</span><span class="status-badge success" style="font-size: 0.7rem;">SUCCESS</span><span>Room 205 temperature adjusted</span></div>
                            <div style="display: flex; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);"><span style="color: var(--text-secondary); min-width: 70px;">14:15:42</span><span class="status-badge warning" style="font-size: 0.7rem;">WARNING</span><span>Energy threshold exceeded in 312</span></div>
                            <div style="display: flex; gap: 1rem; padding: 0.5rem 0;"><span style="color: var(--text-secondary); min-width: 70px;">14:10:05</span><span class="status-badge info" style="font-size: 0.7rem;">INFO</span><span>Backup completed successfully</span></div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    getAdminAnalyticsContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Analytics</h2>
                <p style="color: var(--text-secondary);">System usage and performance analytics</p>
            </div>
            <div class="dashboard-grid grid-2">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">System Usage</h3>
                        <select class="form-control" style="width: auto;"><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option></select>
                    </div>
                    <div class="card-body">
                        <div style="display: flex; gap: 2rem; margin-bottom: 1.5rem;">
                            <div><span style="color: var(--text-secondary); display: block;">Avg Response Time</span><span style="font-size: 1.5rem; font-weight: 600;">142ms</span></div>
                            <div><span style="color: var(--text-secondary); display: block;">Peak Users</span><span style="font-size: 1.5rem; font-weight: 600;">2,847</span></div>
                        </div>
                        <div style="height: 150px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: flex-end; justify-content: space-around; padding: 1rem;">
                            <div style="width: 12%; height: 40%; background: var(--primary-color); border-radius: 4px;"></div>
                            <div style="width: 12%; height: 60%; background: var(--primary-color); border-radius: 4px;"></div>
                            <div style="width: 12%; height: 80%; background: var(--primary-color); border-radius: 4px;"></div>
                            <div style="width: 12%; height: 95%; background: var(--primary-color); border-radius: 4px;"></div>
                            <div style="width: 12%; height: 75%; background: var(--primary-color); border-radius: 4px;"></div>
                            <div style="width: 12%; height: 65%; background: var(--primary-color); border-radius: 4px;"></div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Resource Usage</h3></div>
                    <div class="card-body">
                        <div style="margin-bottom: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;"><span>CPU Usage</span><span>45%</span></div>
                            <div style="height: 8px; background: var(--border-color); border-radius: 4px;"><div style="width: 45%; height: 100%; background: var(--success-color); border-radius: 4px;"></div></div>
                        </div>
                        <div style="margin-bottom: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;"><span>Memory Usage</span><span>72%</span></div>
                            <div style="height: 8px; background: var(--border-color); border-radius: 4px;"><div style="width: 72%; height: 100%; background: var(--warning-color); border-radius: 4px;"></div></div>
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;"><span>Storage Usage</span><span>65%</span></div>
                            <div style="height: 8px; background: var(--border-color); border-radius: 4px;"><div style="width: 65%; height: 100%; background: var(--warning-color); border-radius: 4px;"></div></div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    getAdminUsersContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 600;">User Management</h2>
                    <p style="color: var(--text-secondary);">Manage system users and permissions</p>
                </div>
                <button class="btn btn-primary" id="addUserBtn"><i class="fas fa-user-plus"></i><span>Add User</span></button>
            </div>
            <div class="card">
                <div class="card-body">
                    <div class="table-container">
                        <table class="data-table">
                            <thead><tr><th>User</th><th>Role</th><th>Last Active</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                <tr>
                                    <td><div style="display: flex; align-items: center; gap: 0.75rem;"><div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">AD</div><div><strong>Admin User</strong><br><small style="color: var(--text-secondary);">admin@goldenpeacock.com</small></div></div></td>
                                    <td><span class="status-badge" style="background: var(--danger-color); color: white;">Admin</span></td>
                                    <td>Just now</td>
                                    <td><span class="status-badge success">Active</span></td>
                                    <td><button class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i></button> <button class="btn btn-secondary btn-sm"><i class="fas fa-trash"></i></button></td>
                                </tr>
                                <tr>
                                    <td><div style="display: flex; align-items: center; gap: 0.75rem;"><div style="width: 32px; height: 32px; border-radius: 50%; background: var(--success-color); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">SM</div><div><strong>Staff Manager</strong><br><small style="color: var(--text-secondary);">manager@goldenpeacock.com</small></div></div></td>
                                    <td><span class="status-badge" style="background: var(--primary-color); color: white;">Staff</span></td>
                                    <td>2 hours ago</td>
                                    <td><span class="status-badge success">Active</span></td>
                                    <td><button class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i></button> <button class="btn btn-secondary btn-sm"><i class="fas fa-trash"></i></button></td>
                                </tr>
                                <tr>
                                    <td><div style="display: flex; align-items: center; gap: 0.75rem;"><div style="width: 32px; height: 32px; border-radius: 50%; background: var(--warning-color); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">CK</div><div><strong>Concierge</strong><br><small style="color: var(--text-secondary);">concierge@goldenpeacock.com</small></div></div></td>
                                    <td><span class="status-badge" style="background: var(--primary-color); color: white;">Staff</span></td>
                                    <td>1 day ago</td>
                                    <td><span class="status-badge success">Active</span></td>
                                    <td><button class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i></button> <button class="btn btn-secondary btn-sm"><i class="fas fa-trash"></i></button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    }

    getAdminSystemContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 600;">System Configuration</h2>
                    <p style="color: var(--text-secondary);">Configure system settings and preferences</p>
                </div>
                <button class="btn btn-success" id="saveConfigBtn"><i class="fas fa-save"></i><span>Save Changes</span></button>
            </div>
            <div class="dashboard-grid grid-2">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">IoT Device Settings</h3></div>
                    <div class="card-body">
                        <div class="light-control-item" style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);"><span>Auto Device Detection</span><div class="control-toggle"><input type="checkbox" id="autoDetect" checked><label for="autoDetect"></label></div></div>
                        <div class="light-control-item" style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);"><span>Device Health Monitoring</span><div class="control-toggle"><input type="checkbox" id="healthMonitor" checked><label for="healthMonitor"></label></div></div>
                        <div class="light-control-item" style="padding: 1rem 0;"><span>Auto Firmware Updates</span><div class="control-toggle"><input type="checkbox" id="autoUpdates"><label for="autoUpdates"></label></div></div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Energy Management</h3></div>
                    <div class="card-body">
                        <div class="light-control-item" style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);"><span>Auto Power Saving</span><div class="control-toggle"><input type="checkbox" id="autoPowerSaving" checked><label for="autoPowerSaving"></label></div></div>
                        <div class="light-control-item" style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);"><span>Peak Hours Reduction</span><div class="control-toggle"><input type="checkbox" id="peakReduction" checked><label for="peakReduction"></label></div></div>
                        <div class="light-control-item" style="padding: 1rem 0;"><span>Energy Reports</span><div class="control-toggle"><input type="checkbox" id="energyReports" checked><label for="energyReports"></label></div></div>
                    </div>
                </div>
            </div>`;
    }

    getAdminReportsContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Reports</h2>
                <p style="color: var(--text-secondary);">Generate and download system reports</p>
            </div>
            <div class="dashboard-grid grid-3">
                <div class="card" style="cursor: pointer;">
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-chart-pie" style="font-size: 2.5rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
                        <h4>Occupancy Report</h4>
                        <p style="color: var(--text-secondary);">Room occupancy statistics</p>
                        <button class="btn btn-primary mt-4"><i class="fas fa-download"></i> Download</button>
                    </div>
                </div>
                <div class="card" style="cursor: pointer;">
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-bolt" style="font-size: 2.5rem; color: var(--warning-color); margin-bottom: 1rem;"></i>
                        <h4>Energy Report</h4>
                        <p style="color: var(--text-secondary);">Energy consumption data</p>
                        <button class="btn btn-primary mt-4"><i class="fas fa-download"></i> Download</button>
                    </div>
                </div>
                <div class="card" style="cursor: pointer;">
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-users" style="font-size: 2.5rem; color: var(--success-color); margin-bottom: 1rem;"></i>
                        <h4>User Activity</h4>
                        <p style="color: var(--text-secondary);">User login and activity logs</p>
                        <button class="btn btn-primary mt-4"><i class="fas fa-download"></i> Download</button>
                    </div>
                </div>
            </div>`;
    }

    getAdminSecurityContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Security</h2>
                <p style="color: var(--text-secondary);">Monitor and manage system security</p>
            </div>
            <div class="dashboard-grid grid-2">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Security Status</h3></div>
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-shield-alt" style="font-size: 4rem; color: var(--success-color); margin-bottom: 1rem;"></i>
                        <h4 style="color: var(--success-color);">All Systems Secure</h4>
                        <p style="color: var(--text-secondary);">No threats detected</p>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Security Settings</h3></div>
                    <div class="card-body">
                        <div class="light-control-item" style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);"><span>Two-Factor Authentication</span><div class="control-toggle"><input type="checkbox" id="twoFactor" checked><label for="twoFactor"></label></div></div>
                        <div class="light-control-item" style="padding: 1rem 0; border-bottom: 1px solid var(--border-color);"><span>Login Notifications</span><div class="control-toggle"><input type="checkbox" id="loginNotif" checked><label for="loginNotif"></label></div></div>
                        <div class="light-control-item" style="padding: 1rem 0;"><span>Auto Session Timeout</span><div class="control-toggle"><input type="checkbox" id="sessionTimeout" checked><label for="sessionTimeout"></label></div></div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Recent Login Activity</h3></div>
                    <div class="card-body">
                        <div style="padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);"><strong>Admin User</strong> - Just now<br><small style="color: var(--text-secondary);">IP: 192.168.1.100</small></div>
                        <div style="padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);"><strong>Staff Manager</strong> - 2 hours ago<br><small style="color: var(--text-secondary);">IP: 192.168.1.105</small></div>
                        <div style="padding: 0.75rem 0;"><strong>Concierge</strong> - 1 day ago<br><small style="color: var(--text-secondary);">IP: 192.168.1.110</small></div>
                    </div>
                </div>
            </div>`;
    }

    getAdminBackupContent() {
        return `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; font-weight: 600;">Backup & Restore</h2>
                <p style="color: var(--text-secondary);">Manage system backups and data recovery</p>
            </div>
            <div class="dashboard-grid grid-2">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Create Backup</h3></div>
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
                        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Create a full system backup</p>
                        <button class="btn btn-primary" id="createBackupBtn"><i class="fas fa-plus"></i> Create Backup</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Restore Data</h3></div>
                    <div class="card-body" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-cloud-download-alt" style="font-size: 3rem; color: var(--warning-color); margin-bottom: 1rem;"></i>
                        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Restore from a previous backup</p>
                        <button class="btn btn-warning" id="restoreBackupBtn"><i class="fas fa-undo"></i> Restore</button>
                    </div>
                </div>
                <div class="card" style="grid-column: span 2;">
                    <div class="card-header"><h3 class="card-title">Backup History</h3></div>
                    <div class="card-body">
                        <div class="table-container">
                            <table class="data-table">
                                <thead><tr><th>Date</th><th>Size</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
                                <tbody>
                                    <tr><td>Jan 19, 2026 - 14:10</td><td>2.4 GB</td><td>Full Backup</td><td><span class="status-badge success">Completed</span></td><td><button class="btn btn-secondary btn-sm"><i class="fas fa-download"></i></button></td></tr>
                                    <tr><td>Jan 18, 2026 - 02:00</td><td>2.3 GB</td><td>Auto Backup</td><td><span class="status-badge success">Completed</span></td><td><button class="btn btn-secondary btn-sm"><i class="fas fa-download"></i></button></td></tr>
                                    <tr><td>Jan 17, 2026 - 02:00</td><td>2.3 GB</td><td>Auto Backup</td><td><span class="status-badge success">Completed</span></td><td><button class="btn btn-secondary btn-sm"><i class="fas fa-download"></i></button></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    initializeAdminSectionEvents(section) {
        if (section === 'dashboard') {
            const exportLogsBtn = document.getElementById('exportLogsBtn');
            if (exportLogsBtn) {
                exportLogsBtn.addEventListener('click', () => this.showToast('Logs exported successfully', 'success'));
            }
        }

        if (section === 'users') {
            const addUserBtn = document.getElementById('addUserBtn');
            if (addUserBtn) {
                addUserBtn.addEventListener('click', () => this.showAddUserModal());
            }
        }

        if (section === 'system') {
            const saveConfigBtn = document.getElementById('saveConfigBtn');
            if (saveConfigBtn) {
                saveConfigBtn.addEventListener('click', () => this.showToast('Configuration saved successfully', 'success'));
            }
        }

        if (section === 'backup') {
            const createBackupBtn = document.getElementById('createBackupBtn');
            if (createBackupBtn) {
                createBackupBtn.addEventListener('click', () => this.showToast('Backup started...', 'info'));
            }
            const restoreBackupBtn = document.getElementById('restoreBackupBtn');
            if (restoreBackupBtn) {
                restoreBackupBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to restore from backup? This will overwrite current data.')) {
                        this.showToast('Restore started...', 'warning');
                    }
                });
            }
        }

        document.querySelectorAll('.control-toggle input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const label = e.target.closest('.light-control-item')?.querySelector('span')?.textContent || 'Setting';
                const state = e.target.checked ? 'enabled' : 'disabled';
                this.showToast(`${label} ${state}`, e.target.checked ? 'success' : 'warning');
            });
        });
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

    async loadMessages(roomNumber = null) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;

        try {
            let url = this.getApiPath('messages.php');
            if (roomNumber) {
                url += `?room=${encodeURIComponent(roomNumber)}`;
            }

            const res = await fetch(url, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await res.json();
            if (!data.ok) {
                throw new Error(data.error || 'Failed to load messages');
            }

            const messages = data.messages || [];
            this.currentRoomNumber = data.room_number || roomNumber;

            if (messages.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fas fa-comments" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>No messages yet. Start a conversation!</p>
                    </div>`;
                return;
            }

            const currentUserId = this.user?.id;
            container.innerHTML = messages.map(msg => {
                const isSent = msg.sender_id == currentUserId;
                const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const senderLabel = isSent ? 'You' : (msg.sender_name || 'Staff');
                
                return `
                    <div class="message ${isSent ? 'sent' : 'received'}" style="
                        display: flex;
                        flex-direction: column;
                        align-items: ${isSent ? 'flex-end' : 'flex-start'};
                        margin-bottom: 1rem;
                    ">
                        <div class="message-content" style="
                            background: ${isSent ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                            color: ${isSent ? 'white' : 'var(--text-primary)'};
                            padding: 0.75rem 1rem;
                            border-radius: 1rem;
                            max-width: 70%;
                        ">${this.escapeHtml(msg.message)}</div>
                        <div class="message-time" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                            ${senderLabel} • ${time}
                        </div>
                    </div>`;
            }).join('');

            container.scrollTop = container.scrollHeight;
        } catch (err) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>${err.message || 'Failed to load messages'}</p>
                    <button class="btn btn-primary btn-sm mt-4" onclick="window.smartRoomSystem.loadMessages()">Retry</button>
                </div>`;
        }
    }

    async sendMessage(roomNumber = null) {
        const input = document.getElementById('messageInput');
        if (!input) return;

        const message = input.value.trim();
        if (!message) {
            this.showToast('Please enter a message', 'warning');
            return;
        }

        const sendBtn = document.getElementById('sendMessageBtn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            const payload = { message };
            if (roomNumber || this.currentRoomNumber) {
                payload.room_number = roomNumber || this.currentRoomNumber;
            }

            const res = await fetch(this.getApiPath('messages.php'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!data.ok) {
                throw new Error(data.error || 'Failed to send message');
            }

            input.value = '';
            await this.loadMessages(roomNumber);
        } catch (err) {
            this.showToast(err.message || 'Failed to send message', 'error');
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadServiceRequests() {
        const container = document.getElementById('serviceRequestsContainer');
        if (!container) return;

        try {
            const res = await fetch(this.getApiPath('service_requests.php'), {
                method: 'GET',
                credentials: 'include'
            });

            const data = await res.json();
            if (!data.ok) {
                throw new Error(data.error || 'Failed to load requests');
            }

            const requests = data.requests || [];

            if (requests.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fas fa-clipboard-list" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>No service requests yet</p>
                        <p style="font-size: 0.875rem;">Click "New Request" to request a service</p>
                    </div>`;
                return;
            }

            container.innerHTML = requests.map(req => {
                const statusClass = req.status.replace('_', '-');
                const statusLabel = req.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                const typeLabel = req.request_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                const time = this.formatRequestTime(req.created_at);
                const typePrefix = req.request_type.substring(0, 2).toUpperCase();
                
                return `
                    <div class="request-item ${statusClass}" style="
                        padding: 1rem;
                        margin-bottom: 1rem;
                        border-left: 4px solid var(--${statusClass === 'completed' ? 'success' : statusClass === 'pending' ? 'warning' : statusClass === 'in-progress' ? 'info' : 'danger'}-color, var(--primary-color));
                        background: var(--bg-secondary);
                        border-radius: 0 8px 8px 0;
                    ">
                        <div class="request-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span class="request-title" style="font-weight: 600;">${typeLabel}</span>
                            <span class="request-status ${statusClass}" style="
                                padding: 0.25rem 0.75rem;
                                border-radius: 20px;
                                font-size: 0.75rem;
                                background: var(--${statusClass === 'completed' ? 'success' : statusClass === 'pending' ? 'warning' : statusClass === 'in-progress' ? 'info' : 'danger'}-color, var(--primary-color));
                                color: white;
                            ">${statusLabel}</span>
                        </div>
                        <p class="request-description" style="color: var(--text-secondary); margin: 0.5rem 0;">${this.escapeHtml(req.description || 'No description')}</p>
                        <div class="request-footer" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
                            <span><i class="far fa-clock"></i> ${time}</span>
                            <span>Request ID: #${typePrefix}${req.id}</span>
                        </div>
                        ${req.status === 'pending' ? `<button class="btn btn-sm btn-danger mt-2" onclick="window.smartRoomSystem.cancelServiceRequest(${req.id})"><i class="fas fa-times"></i> Cancel</button>` : ''}
                    </div>`;
            }).join('');

        } catch (err) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>${err.message || 'Failed to load requests'}</p>
                    <button class="btn btn-primary btn-sm mt-4" onclick="window.smartRoomSystem.loadServiceRequests()">Retry</button>
                </div>`;
        }
    }

    formatRequestTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffDays === 1) return 'Yesterday';
        return date.toLocaleDateString();
    }

    showNewServiceRequestForm() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3>New Service Request</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="newServiceRequestForm">
                        <div class="form-group">
                            <label class="form-label">Service Type</label>
                            <select class="form-control" id="requestType" required>
                                <option value="">Select a service...</option>
                                <option value="housekeeping">Housekeeping</option>
                                <option value="room_service">Room Service</option>
                                <option value="maintenance">Maintenance</option>
                                <option value="laundry">Laundry</option>
                                <option value="amenities">Amenities</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Priority</label>
                            <select class="form-control" id="requestPriority">
                                <option value="low">Low</option>
                                <option value="medium" selected>Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea class="form-control" id="requestDescription" rows="3" placeholder="Describe your request..."></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Preferred Time (Optional)</label>
                            <input type="time" class="form-control" id="requestTime">
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
            const cancelBtn = document.getElementById('cancelRequest');
            const submitBtn = document.getElementById('submitRequest');
            const closeBtn = document.querySelector('.modal-close');

            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
            if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

            if (submitBtn) {
                submitBtn.addEventListener('click', async () => {
                    const requestType = document.getElementById('requestType')?.value;
                    const priority = document.getElementById('requestPriority')?.value;
                    const description = document.getElementById('requestDescription')?.value;
                    const preferredTime = document.getElementById('requestTime')?.value;

                    if (!requestType) {
                        this.showToast('Please select a service type', 'error');
                        return;
                    }

                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

                    try {
                        const res = await fetch(this.getApiPath('service_requests.php'), {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                request_type: requestType,
                                priority: priority,
                                description: description,
                                preferred_time: preferredTime || null
                            })
                        });

                        const data = await res.json();
                        if (!data.ok) {
                            throw new Error(data.error || 'Failed to submit request');
                        }

                        this.showToast('Service request submitted successfully!', 'success');
                        this.closeModal();
                        this.loadServiceRequests();
                    } catch (err) {
                        this.showToast(err.message || 'Failed to submit request', 'error');
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = 'Submit Request';
                    }
                });
            }
        }, 100);
    }

    async cancelServiceRequest(requestId) {
        if (!confirm('Are you sure you want to cancel this request?')) return;

        try {
            const res = await fetch(this.getApiPath('service_requests.php') + `?id=${requestId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await res.json();
            if (!data.ok) {
                throw new Error(data.error || 'Failed to cancel request');
            }

            this.showToast('Request cancelled', 'success');
            this.loadServiceRequests();
        } catch (err) {
            this.showToast(err.message || 'Failed to cancel request', 'error');
        }
    }

    async loadStaffServiceRequests() {
        const container = document.getElementById('staffRequestsContainer');
        if (!container) return;

        const statusFilter = document.getElementById('requestStatusFilter')?.value || '';

        try {
            let url = this.getApiPath('service_requests.php');
            if (statusFilter) {
                url += `?status=${statusFilter}`;
            }

            const res = await fetch(url, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await res.json();
            if (!data.ok) {
                throw new Error(data.error || 'Failed to load requests');
            }

            const requests = data.requests || [];

            if (requests.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fas fa-clipboard-check" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>No service requests found</p>
                    </div>`;
                return;
            }

            container.innerHTML = `
                <table class="data-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--bg-tertiary, #1a1a2e);">
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Request ID</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Room</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Guest</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Service</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Priority</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Time</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Status</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(req => {
                            const typePrefix = (req.request_type || 'OT').substring(0, 2).toUpperCase();
                            const typeLabel = (req.request_type || 'Other').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                            const statusClass = this.getStatusBadgeClass(req.status);
                            const statusLabel = (req.status || 'pending').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                            const priorityClass = this.getPriorityClass(req.priority);
                            const time = this.formatRequestTime(req.created_at);
                            
                            let actionBtn = '';
                            if (req.status === 'pending') {
                                actionBtn = `<button class="btn btn-primary btn-sm" onclick="window.smartRoomSystem.updateRequestStatus(${req.id}, 'in_progress')">Start</button>`;
                            } else if (req.status === 'assigned' || req.status === 'in_progress') {
                                actionBtn = `<button class="btn btn-success btn-sm" onclick="window.smartRoomSystem.updateRequestStatus(${req.id}, 'completed')">Complete</button>`;
                            } else {
                                actionBtn = `<button class="btn btn-secondary btn-sm" onclick="window.smartRoomSystem.viewRequestDetails(${req.id})">View</button>`;
                            }
                            
                            const description = req.description ? this.escapeHtml(req.description.substring(0, 50)) + (req.description.length > 50 ? '...' : '') : 'No details';
                            
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color, #333);" title="${this.escapeHtml(req.description || '')}">
                                    <td style="padding: 0.75rem; color: #333;">#${typePrefix}${req.id || ''}</td>
                                    <td style="padding: 0.75rem; color: #333; font-weight: 600;">${req.room_number || 'N/A'}</td>
                                    <td style="padding: 0.75rem; color: #333;">${this.escapeHtml(req.guest_name || 'N/A')}</td>
                                    <td style="padding: 0.75rem; color: #333;"><strong>${typeLabel}</strong><br><small style="color: #666;">${description}</small></td>
                                    <td style="padding: 0.75rem;"><span class="status-badge ${priorityClass}">${req.priority || 'medium'}</span></td>
                                    <td style="padding: 0.75rem; color: #333;">${time}</td>
                                    <td style="padding: 0.75rem;"><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                                    <td style="padding: 0.75rem;">${actionBtn}</td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>`;

        } catch (err) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>${err.message || 'Failed to load requests'}</p>
                    <button class="btn btn-primary btn-sm mt-4" onclick="window.smartRoomSystem.loadStaffServiceRequests()">Retry</button>
                </div>`;
        }
    }

    getStatusBadgeClass(status) {
        const classes = {
            'pending': 'warning',
            'assigned': 'info',
            'in_progress': 'info',
            'completed': 'success',
            'cancelled': 'danger'
        };
        return classes[status] || 'secondary';
    }

    getPriorityClass(priority) {
        const classes = {
            'low': 'secondary',
            'medium': 'info',
            'high': 'warning',
            'urgent': 'danger'
        };
        return classes[priority] || 'secondary';
    }

    async updateRequestStatus(requestId, newStatus) {
        try {
            const res = await fetch(this.getApiPath('service_requests.php'), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: requestId, status: newStatus })
            });

            const data = await res.json();
            if (!data.ok) {
                throw new Error(data.error || 'Failed to update request');
            }

            this.showToast(`Request ${newStatus.replace('_', ' ')}`, 'success');
            this.loadStaffServiceRequests();
            this.updatePendingRequestsBadge();
        } catch (err) {
            this.showToast(err.message || 'Failed to update request', 'error');
        }
    }

    viewRequestDetails(requestId) {
        this.showToast('Request details view coming soon', 'info');
    }

    async loadStaffGuests(search = '') {
        const container = document.getElementById('staffGuestsContainer');
        if (!container) return;

        try {
            let url = this.getApiPath('guests.php');
            if (search) {
                url += `?search=${encodeURIComponent(search)}`;
            }

            const res = await fetch(url, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await res.json();
            if (!data.ok) {
                throw new Error(data.error || 'Failed to load guests');
            }

            const guests = data.guests || [];

            if (guests.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>No guests found</p>
                    </div>`;
                return;
            }

            container.innerHTML = `
                <table class="data-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--bg-tertiary, #1a1a2e);">
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Name</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Room</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Email</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Check-in</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Check-out</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Status</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-primary, #fff);">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${guests.map(guest => {
                            const statusClass = this.getGuestStatusClass(guest.status);
                            const statusLabel = this.getGuestStatusLabel(guest.status);
                            const checkIn = guest.check_in_date ? new Date(guest.check_in_date).toLocaleDateString() : 'N/A';
                            const checkOut = guest.check_out_date ? new Date(guest.check_out_date).toLocaleDateString() : 'N/A';
                            
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color, #333);">
                                    <td style="padding: 0.75rem; color: #333; font-weight: 600;">${this.escapeHtml(guest.full_name || 'N/A')}</td>
                                    <td style="padding: 0.75rem; color: #333;">${guest.room_number || 'N/A'}</td>
                                    <td style="padding: 0.75rem; color: #333;">${this.escapeHtml(guest.email || 'N/A')}</td>
                                    <td style="padding: 0.75rem; color: #333;">${checkIn}</td>
                                    <td style="padding: 0.75rem; color: #333;">${checkOut}</td>
                                    <td style="padding: 0.75rem;"><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                                    <td style="padding: 0.75rem;">
                                        <button class="btn btn-secondary btn-sm" onclick="window.smartRoomSystem.viewGuestDetails(${guest.id})">View</button>
                                    </td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>`;

        } catch (err) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>${err.message || 'Failed to load guests'}</p>
                    <button class="btn btn-primary btn-sm mt-4" onclick="window.smartRoomSystem.loadStaffGuests()">Retry</button>
                </div>`;
        }
    }

    getGuestStatusClass(status) {
        const classes = {
            'active': 'success',
            'checkout_today': 'warning',
            'checked_out': 'secondary',
            'upcoming': 'info'
        };
        return classes[status] || 'secondary';
    }

    getGuestStatusLabel(status) {
        const labels = {
            'active': 'Active',
            'checkout_today': 'Checkout Today',
            'checked_out': 'Checked Out',
            'upcoming': 'Upcoming'
        };
        return labels[status] || status;
    }

    viewGuestDetails(guestId) {
        this.showToast('Guest details view coming soon', 'info');
    }

    startMessagePolling() {
        this.stopMessagePolling(); // Clear any existing interval
        this.messagePollingInterval = setInterval(() => {
            if (this.currentRoomNumber) {
                this.loadMessages(this.currentRoomNumber);
            } else {
                this.loadMessages();
            }
            // Also refresh rooms list for staff
            const roomsContainer = document.getElementById('roomsListContainer');
            if (roomsContainer) {
                this.loadRoomsWithMessages();
            }
        }, 5000); // Poll every 5 seconds
    }

    stopMessagePolling() {
        if (this.messagePollingInterval) {
            clearInterval(this.messagePollingInterval);
            this.messagePollingInterval = null;
        }
    }

    async loadRoomsWithMessages() {
        const container = document.getElementById('roomsListContainer');
        if (!container) return;

        try {
            const res = await fetch(this.getApiPath('messages.php'), {
                method: 'GET',
                credentials: 'include'
            });

            const data = await res.json();
            if (!data.ok) {
                throw new Error(data.error || 'Failed to load messages');
            }

            const messages = data.messages || [];
            
            // Group messages by room
            const roomsMap = new Map();
            messages.forEach(msg => {
                if (!msg.room_number) return;
                if (!roomsMap.has(msg.room_number)) {
                    roomsMap.set(msg.room_number, {
                        room_number: msg.room_number,
                        lastMessage: msg,
                        unreadCount: 0
                    });
                }
                const room = roomsMap.get(msg.room_number);
                // Update last message if this one is newer
                if (new Date(msg.created_at) > new Date(room.lastMessage.created_at)) {
                    room.lastMessage = msg;
                }
                // Count unread messages from guests
                if (msg.is_from_guest && !msg.is_read) {
                    room.unreadCount++;
                }
            });

            const rooms = Array.from(roomsMap.values()).sort((a, b) => 
                new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at)
            );

            if (rooms.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>No conversations yet</p>
                    </div>`;
                return;
            }

            container.innerHTML = rooms.map(room => {
                const preview = room.lastMessage.message.substring(0, 50) + (room.lastMessage.message.length > 50 ? '...' : '');
                const time = new Date(room.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return `
                    <div class="room-message-item" data-room="${room.room_number}" style="
                        padding: 1rem;
                        border-bottom: 1px solid var(--border-color);
                        cursor: pointer;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div>
                                <strong style="display: flex; align-items: center; gap: 0.5rem;">
                                    <i class="fas fa-door-open"></i> Room ${room.room_number}
                                    ${room.unreadCount > 0 ? `<span class="status-badge danger" style="font-size: 0.7rem;">${room.unreadCount}</span>` : ''}
                                </strong>
                                <p style="color: var(--text-secondary); margin: 0.25rem 0 0 0; font-size: 0.875rem;">${this.escapeHtml(preview)}</p>
                            </div>
                            <span style="color: var(--text-secondary); font-size: 0.75rem;">${time}</span>
                        </div>
                    </div>`;
            }).join('');

            // Add click handlers
            container.querySelectorAll('.room-message-item').forEach(item => {
                item.addEventListener('click', () => {
                    const roomNum = item.dataset.room;
                    this.selectRoomChat(roomNum);
                });
            });

        } catch (err) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>${err.message || 'Failed to load rooms'}</p>
                </div>`;
        }
    }

    selectRoomChat(roomNumber) {
        this.currentRoomNumber = roomNumber;
        
        // Update header
        const header = document.getElementById('currentChatRoom');
        if (header) header.textContent = `Room ${roomNumber}`;
        
        // Enable input
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        if (messageInput) messageInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        
        // Load messages for this room
        this.loadMessages(roomNumber);
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
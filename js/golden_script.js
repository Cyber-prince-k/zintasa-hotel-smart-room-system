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

        // Temperature control
        const tempSlider = document.getElementById('tempSlider');
        const tempValue = document.getElementById('tempValue');
        if (tempSlider && tempValue) {
            tempSlider.addEventListener('input', (e) => {
                tempValue.textContent = `${e.target.value}°C`;
                this.showToast(`Temperature set to ${e.target.value}°C`, 'info');
            });
        }

        // Brightness control
        const brightnessSlider = document.getElementById('brightnessSlider');
        const brightnessValue = document.getElementById('brightnessValue');
        if (brightnessSlider && brightnessValue) {
            brightnessSlider.addEventListener('input', (e) => {
                brightnessValue.textContent = `${e.target.value}%`;
            });
        }

        // Control buttons
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const mode = e.currentTarget.dataset.mode;
                this.showToast(`AC mode changed to ${mode}`, 'info');
            });
        });

        // New service request
        const newRequestBtn = document.getElementById('newRequestBtn');
        if (newRequestBtn) {
            newRequestBtn.addEventListener('click', () => this.createServiceRequest());
        }

        // Send message
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        const messageInput = document.getElementById('messageInput');
        if (sendMessageBtn && messageInput) {
            sendMessageBtn.addEventListener('click', () => this.sendMessage());
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }

        // Quick actions
        document.querySelectorAll('.quick-action').forEach(action => {
            action.addEventListener('click', (e) => {
                const service = e.currentTarget.querySelector('span').textContent;
                this.showToast(`${service} requested`, 'success');
            });
        });

        // Initialize room controls
        this.setupRoomControls();
    }

    setupStaffDashboard() {
        this.renderCurrentUser();

        const addGuestBtn = document.getElementById('addGuestBtn');
        if (addGuestBtn) {
            addGuestBtn.addEventListener('click', () => this.showAddGuestModal());
        }

        // Assign buttons
        document.querySelectorAll('.assign-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.assignServiceRequest(e.currentTarget.closest('tr'));
            });
        });

        // Room action buttons
        document.querySelectorAll('.room-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomItem = e.currentTarget.closest('.room-status-item');
                const roomNumber = roomItem.querySelector('.room-number').textContent;
                this.showRoomDetails(roomNumber);
            });
        });

        // Acknowledge all alerts
        const acknowledgeAllBtn = document.getElementById('acknowledgeAllBtn');
        if (acknowledgeAllBtn) {
            acknowledgeAllBtn.addEventListener('click', () => {
                this.showToast('All alerts acknowledged', 'success');
            });
        }

        // Initialize staff tools
        this.setupStaffTools();
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
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Add Guest</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="addGuestForm">
                        <div class="form-group">
                            <label class="form-label">Full Name</label>
                            <input type="text" class="form-control" id="guestFullName" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Email Address</label>
                            <input type="email" class="form-control" id="guestEmail" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Phone Number</label>
                            <input type="text" class="form-control" id="guestPhoneNumber" placeholder="Optional">
                        </div>
                    </form>
                    <small class="form-text">A vacant room will be assigned automatically and a 7-character access code will be emailed to the guest.</small>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="cancelAddGuest">Cancel</button>
                    <button class="btn btn-primary" id="createGuest">Create Guest</button>
                </div>
            </div>
        `;

        this.showModal(modalHtml);

        setTimeout(() => {
            const cancelBtn = document.getElementById('cancelAddGuest');
            const createBtn = document.getElementById('createGuest');

            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
            const closeBtn = document.querySelector('.modal-close');
            if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

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

                        this.closeModal();
                    } catch (err) {
                        this.showToast(err?.message || 'Failed to create guest', 'error');
                    }
                });
            }
        }, 100);
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
# Golden Peacock Hotel - Smart Room System

A comprehensive smart room management system for the Golden Peacock Hotel, providing IoT-based room controls, service requests, and multi-role dashboards for guests, staff, and administrators.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [API Reference](#api-reference)
- [User Roles](#user-roles)
- [Frontend Components](#frontend-components)
- [Security](#security)

---

## Overview

The Smart Room System enables hotel guests to control in-room devices (temperature, lighting, curtains), request services, and communicate with staff—all from a modern web dashboard. Staff members can manage service requests and room statuses, while administrators have full control over user management and system configuration.

---

## Features

### Guest Dashboard
- **Room Controls**: Temperature, lighting/brightness, AC modes, curtains
- **Service Requests**: Housekeeping, room service, maintenance, laundry, extra amenities
- **Real-time Chat**: Direct communication with hotel concierge
- **Quick Actions**: Fast access to common services
- **Notifications**: Alerts for service updates and announcements

### Staff Dashboard
- **Guest Management**: Add and manage guest accounts with auto-assigned rooms
- **Service Request Queue**: View, assign, and track pending requests
- **Room Status Overview**: Monitor occupancy, cleaning status, and alerts
- **Alert Management**: Acknowledge and respond to system alerts

### Admin Dashboard
- **User Management**: Create admin, staff, and guest accounts
- **System Configuration**: Toggle system-wide settings
- **System Health Monitor**: View server, database, IoT, and storage metrics
- **Audit Logs**: Export and manage system logs

### Common Features
- **Multi-language Support**: English, French, Spanish, German, Chinese, Chichewa
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Session-based Authentication**: Secure PHP sessions with role enforcement
- **Toast Notifications**: User feedback for all actions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (HTML/JS)                       │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐  │
│  │ index    │   │  guest   │   │  staff   │   │    admin     │  │
│  │ (login)  │   │ dashboard│   │ dashboard│   │  dashboard   │  │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └──────┬───────┘  │
│       │              │              │                │          │
│       └──────────────┴──────────────┴────────────────┘          │
│                              │                                   │
│                    SmartRoomSystem (JS)                          │
│                    golden_script.js                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP (JSON)
┌──────────────────────────────┴──────────────────────────────────┐
│                        Backend (PHP API)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐│
│  │ login    │ │ logout   │ │   me     │ │ register / self_reg  ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘│
│                              │                                   │
│                    lib/ (db, auth, env, mailer, response)        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   MySQL Database    │
                    │   (golden)          │
                    └─────────────────────┘
```

---

## Project Structure

```
smart room/
├── index.html                 # Login page
├── create_account.html        # Self-registration page
├── .env                       # Environment variables (secrets - not committed)
├── .env.example               # Environment template
├── composer.json              # PHP dependencies
│
├── html/
│   ├── guest.html             # Guest dashboard
│   ├── staff.html             # Staff dashboard
│   └── admin.html             # Admin dashboard
│
├── js/
│   └── golden_script.js       # Main application class (SmartRoomSystem)
│
├── assest/
│   └── css/
│       └── golden.css         # Styles
│
└── php/
    ├── schema.sql             # Database schema
    │
    ├── api/
    │   ├── login.php          # POST - User authentication
    │   ├── logout.php         # POST - Session termination
    │   ├── me.php             # GET  - Current user info
    │   ├── register.php       # POST - Admin/staff creates users
    │   ├── self_register.php  # POST - Public self-registration
    │   ├── bootstrap_admin.php# POST - Initial admin setup
    │   └── health.php         # GET  - System health check
    │
    └── lib/
        ├── db.php             # PDO database connection
        ├── auth.php           # Session & role management
        ├── env.php            # .env file loader
        ├── mailer.php         # SMTP email (PHPMailer)
        └── response.php       # JSON response helpers
```

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | HTML5, Tailwind CSS, Font Awesome, Poppins font |
| JavaScript | Vanilla ES6+ (SmartRoomSystem class)            |
| Backend    | PHP 8.x                                         |
| Database   | MySQL 8.x / MariaDB                             |
| Email      | PHPMailer (SMTP via Gmail)                      |

---

## Installation

### Prerequisites
- PHP 8.0+
- MySQL 8.0+ or MariaDB 10.5+
- Web server (Apache/Nginx) or PHP built-in server
- Composer (for PHPMailer)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Cyber-prince-k/zintasa-hotel-smart-room-system.git
   cd "smart room"
   ```

2. **Install PHP dependencies**
   ```bash
   composer install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database and SMTP credentials.

4. **Import database schema**
   ```bash
   mysql -u root -p < php/schema.sql
   ```

5. **Bootstrap the first admin user**
   ```bash
   curl -X POST http://localhost/php/api/bootstrap_admin.php \
     -H "Content-Type: application/json" \
     -d '{"token":"YOUR_SETUP_TOKEN","email":"admin@hotel.com","password":"securepass","full_name":"Admin User"}'
   ```

6. **Start development server**
   ```bash
   php -S localhost:8000
   ```

7. **Open browser**
   Navigate to `http://localhost:8000`

---

## Configuration

### Environment Variables (`.env`)

| Variable          | Description                                      |
|-------------------|--------------------------------------------------|
| `DB_HOST`         | MySQL host (default: `localhost`)                |
| `DB_PORT`         | MySQL port (default: `3306`)                     |
| `DB_NAME`         | Database name (default: `golden`)                |
| `DB_USER`         | Database username                                |
| `DB_PASS`         | Database password                                |
| `SESSION_NAME`    | PHP session cookie name                          |
| `SETUP_TOKEN`     | One-time token for bootstrap_admin.php           |
| `SMTP_HOST`       | SMTP server hostname                             |
| `SMTP_PORT`       | SMTP port (587 for TLS)                          |
| `SMTP_SECURE`     | `tls` or `ssl`                                   |
| `SMTP_USER`       | SMTP username/email                              |
| `SMTP_PASS`       | SMTP password or app password                    |
| `SMTP_FROM`       | Sender email address                             |
| `SMTP_FROM_NAME`  | Sender display name                              |

---

## Database Setup

### Schema (`php/schema.sql`)

The system uses an **inheritance-based design** where role-specific tables extend the base `users` table:

```
┌─────────────────────────────────────────────────────────────────┐
│                         users (base)                             │
│  id, role, full_name, username, email, phone_number,            │
│  password_hash, created_by, created_at, updated_at, active      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────────┐
│   guests    │   │    staff    │   │     admins      │
│  user_id ──►│   │  user_id ──►│   │   user_id ──►   │
│  room_number│   │  employee_id│   │   access_level  │
│  key_card_id│   │  department │   │   permissions   │
│  check_in   │   │  shift      │   │   last_login_at │
│  check_out  │   │  supervisor │   └─────────────────┘
│  vip_status │   └─────────────┘
└─────────────┘
```

### Base Users Table
Common fields shared by all user types:

```sql
CREATE TABLE users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role            ENUM('admin','staff','guest') NOT NULL,
  full_name       VARCHAR(120) NOT NULL,
  username        VARCHAR(80) NULL UNIQUE,
  email           VARCHAR(190) NOT NULL UNIQUE,
  phone_number    VARCHAR(30) NULL,
  password_hash   VARCHAR(255) NOT NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active          TINYINT(1) DEFAULT 1,
  
  INDEX idx_users_role (role),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### Guests Table
Guest-specific fields (extends users):

| Column           | Type         | Description                          |
|------------------|--------------|--------------------------------------|
| `user_id`        | BIGINT       | FK to users.id                       |
| `room_number`    | VARCHAR(20)  | Assigned room                        |
| `key_card_id`    | VARCHAR(64)  | Physical key card identifier         |
| `check_in_date`  | DATE         | Check-in date                        |
| `check_out_date` | DATE         | Check-out date                       |
| `guest_code`     | VARCHAR(10)  | Auto-generated access code           |
| `vip_status`     | TINYINT(1)   | VIP flag                             |
| `special_requests` | TEXT       | Special accommodation requests       |

### Staff Table
Staff-specific fields (extends users):

| Column              | Type         | Description                          |
|---------------------|--------------|--------------------------------------|
| `user_id`           | BIGINT       | FK to users.id                       |
| `employee_id`       | VARCHAR(20)  | Employee ID number                   |
| `department`        | ENUM         | front_desk, housekeeping, maintenance, room_service, security, concierge, management |
| `shift`             | ENUM         | morning, afternoon, night            |
| `hire_date`         | DATE         | Employment start date                |
| `supervisor_id`     | BIGINT       | FK to staff.id (self-referencing)    |
| `can_manage_guests` | TINYINT(1)   | Permission flag                      |
| `can_manage_requests` | TINYINT(1) | Permission flag                      |

### Admins Table
Admin-specific fields (extends users):

| Column             | Type         | Description                          |
|--------------------|--------------|--------------------------------------|
| `user_id`          | BIGINT       | FK to users.id                       |
| `access_level`     | ENUM         | super_admin, admin, manager          |
| `can_manage_users` | TINYINT(1)   | Permission flag                      |
| `can_manage_staff` | TINYINT(1)   | Permission flag                      |
| `can_manage_rooms` | TINYINT(1)   | Permission flag                      |
| `can_manage_system`| TINYINT(1)   | Permission flag                      |
| `can_view_logs`    | TINYINT(1)   | Permission flag                      |
| `can_export_data`  | TINYINT(1)   | Permission flag                      |
| `last_login_at`    | TIMESTAMP    | Last login timestamp                 |

### Additional Tables

| Table              | Description                                      |
|--------------------|--------------------------------------------------|
| `rooms`            | Room inventory (number, floor, type, status, price, amenities) |
| `service_requests` | Guest service requests with priority, status, assignment |
| `system_logs`      | Audit trail for admin monitoring                 |

### User Roles
- **admin**: Full system access, user management, system configuration
- **staff**: Guest management, service request handling, room monitoring
- **guest**: Room controls, service requests, chat with concierge

---

## API Reference

### Authentication

| Endpoint                  | Method | Description                              |
|---------------------------|--------|------------------------------------------|
| `/php/api/login.php`      | POST   | Authenticate user                        |
| `/php/api/logout.php`     | POST   | End session                              |
| `/php/api/me.php`         | GET    | Get current authenticated user           |

#### POST `/php/api/login.php`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "guest"  // optional: admin, staff, guest
}
```

**Response (Success):**
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "role": "guest",
    "full_name": "John Doe",
    "username": "johndoe",
    "email": "user@example.com",
    "room_number": "205"
  }
}
```

**Login Identifiers**: Username > Room Number > Email (in priority order)

---

### User Registration

| Endpoint                       | Method | Description                              |
|--------------------------------|--------|------------------------------------------|
| `/php/api/register.php`        | POST   | Admin/staff creates new user             |
| `/php/api/self_register.php`   | POST   | Public self-registration                 |
| `/php/api/bootstrap_admin.php` | POST   | Initial admin setup (requires token)     |

#### POST `/php/api/register.php` (Admin Only)

**Request Body:**
```json
{
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "role": "guest",
  "room_number": "301"  // for guests
}
```

For guests, a 7-character access code is auto-generated and emailed.

---

### Health Check

| Endpoint                | Method | Description                              |
|-------------------------|--------|------------------------------------------|
| `/php/api/health.php`   | GET    | System health status                     |

---

## User Roles

### Guest
- Access: `html/guest.html`
- Permissions:
  - Control room devices (temperature, lights, curtains)
  - Submit service requests
  - Chat with concierge
  - View notifications

### Staff
- Access: `html/staff.html`
- Permissions:
  - Add guest accounts (auto-assigns vacant room)
  - View and assign service requests
  - Monitor room statuses
  - Acknowledge alerts

### Admin
- Access: `html/admin.html`
- Permissions:
  - All staff permissions
  - Create any user type (admin, staff, guest)
  - Configure system settings
  - View system health metrics
  - Export/clear logs

---

## Frontend Components

### SmartRoomSystem Class (`js/golden_script.js`)

The main application controller with 1500+ lines of functionality:

#### Core Methods
| Method                   | Description                                  |
|--------------------------|----------------------------------------------|
| `initialize()`           | Sets up event listeners, loads user data     |
| `checkPageType()`        | Determines page and validates authorization  |
| `getApiPath(endpoint)`   | Returns correct API path based on location   |
| `getPagePath(target)`    | Returns correct page path for navigation     |

#### Authentication
| Method                   | Description                                  |
|--------------------------|----------------------------------------------|
| `handleLogin()`          | Processes login form submission              |
| `handleCreateAccount()`  | Processes registration form                  |
| `logout()`               | Clears session and redirects                 |
| `loadUserData()`         | Loads user from localStorage                 |

#### Dashboard Setup
| Method                   | Description                                  |
|--------------------------|----------------------------------------------|
| `setupGuestDashboard()`  | Initializes guest controls and listeners     |
| `setupStaffDashboard()`  | Initializes staff tools and listeners        |
| `setupAdminDashboard()`  | Initializes admin tools and listeners        |

#### UI Components
| Method                   | Description                                  |
|--------------------------|----------------------------------------------|
| `showModal(html)`        | Displays modal dialog                        |
| `closeModal()`           | Closes active modal                          |
| `showToast(msg, type)`   | Shows notification toast                     |
| `showDropdown(el, html)` | Shows dropdown menu                          |

#### User Helpers
| Method                   | Description                                  |
|--------------------------|----------------------------------------------|
| `normalizeUser(user)`    | Standardizes user object format              |
| `getUserFullName(user)`  | Extracts full name                           |
| `getUserInitials(user)`  | Generates avatar initials                    |
| `getUserRoleLabel(user)` | Formats role display text                    |

---

## Security

### Authentication Flow
1. User submits credentials via login form
2. Backend validates against `users` table (bcrypt password hash)
3. On success, user data stored in PHP session
4. Frontend stores user in `localStorage` for UI purposes
5. Each dashboard page validates session via `/php/api/me.php`
6. Role mismatch or missing session redirects to login

### Security Features
- **Password Hashing**: bcrypt via `password_hash()` / `password_verify()`
- **Session Security**: HttpOnly cookies, SameSite=Lax
- **Role Enforcement**: Server-side role checks on all protected endpoints
- **Input Validation**: Server-side validation of all inputs
- **Prepared Statements**: PDO prepared statements prevent SQL injection

### Best Practices
- Never commit `.env` file (contains secrets)
- Use strong `SETUP_TOKEN` for initial admin bootstrap
- Use app-specific passwords for Gmail SMTP
- Regularly rotate admin passwords
- Enable HTTPS in production

---

## License

This project is proprietary software for Golden Peacock Hotel done as a school project.

---

## Support

For technical support, contact the development team or call +265 996850711.

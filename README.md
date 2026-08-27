# Secure Authentication System

A full-stack authentication system built with Node.js, Express, PostgreSQL, and vanilla JavaScript, designed to explore production-oriented authentication and application security.

## Overview

This project implements a complete authentication lifecycle, including:

- User registration and login
- JWT-based authentication
- Short-lived access tokens
- Rotating refresh tokens
- Server-side token revocation
- Password reset
- Account lockout
- Rate limiting
- Secure password hashing
- Protected API endpoints
- Security headers and Content Security Policy
- SQL injection protection
- User-enumeration protection

The goal of this project was to understand how authentication systems are designed, where common weaknesses occur, and how multiple security controls can work together to protect an application.

## Security Features

This project was designed with multiple layers of security to protect the authentication system against common attacks.

### Password Security
- Passwords are hashed using bcrypt and never stored in plaintext.
- Refresh tokens and password-reset tokens are stored as SHA-256 hashes.

### Authentication Security
- Short-lived JWT access tokens.
- Rotating refresh tokens.
- Server-side token revocation during logout.
- Protected authenticated endpoints.

### Brute-Force Protection
- Rate limiting on login, registration, and password-reset endpoints.
- Account lockout after repeated failed login attempts.

### Web Application Security
- Parameterized SQL queries to reduce SQL injection risk.
- Helmet security headers.
- Scoped Content Security Policy (CSP).
- Request body size limits.
- Centralized error handling that avoids exposing internal application details.

### Privacy & Enumeration Protection
- Consistent responses for registration and password-reset requests to reduce user enumeration.
- Timing-attack considerations when processing authentication requests.

## Authentication Flow

The application follows a token-based authentication flow using JWT access tokens and rotating refresh tokens.
```
1. Registration

User submits their email and password.

User
 ↓
Registration Request
 ↓
Validate Input
 ↓
Hash Password with bcrypt
 ↓
Store User in PostgreSQL

 2. Login

User
 ↓
Login Request
 ↓
Validate Credentials
 ↓
Check Account Status
 ↓
Generate Access Token + Refresh Token
 ↓
Return Authentication Response


 3. Accessing Protected Resources
Client
 ↓
Access Token
 ↓
Protected API Endpoint
 ↓
Verify JWT
 ↓
Authenticated User
 ↓
Return Protected Data


 4. Refreshing an Expired Session

When the short-lived access token expires:

Client
 ↓
Refresh Token
 ↓
Verify Refresh Token
 ↓
Revoke/Rotate Existing Token
 ↓
Generate New Access Token
 + New Refresh Token
 ↓
Continue Session

 5. Logout
User
 ↓
Logout Request
 ↓
Server Revokes Token
 ↓
Session Invalidated


 6. Password Reset
User
 ↓
Password Reset Request
 ↓
Generate Reset Token
 ↓
Store SHA-256 Token Hash
 ↓
Verify Reset Token
 ↓
Set New Password
 ↓
Hash New Password with bcrypt
 ↓
Update Account
```

## Testing & Security Validation

The application was tested locally to verify that authentication and security controls behaved as expected.

### Authentication Testing

- Tested successful user registration.
- Tested successful and failed login attempts.
- Tested protected API endpoints with valid and invalid authentication tokens.
- Tested logout and server-side token revocation.
- Tested refresh-token rotation.
- Tested password-reset request and confirmation flows.

### Expected Security Behavior

| Test | Expected Result |
|---|---|
| Correct credentials | User is authenticated |
| Incorrect credentials | Authentication fails |
| Repeated failed logins | Account is locked |
| Expired access token | Request is rejected |
| Revoked token | Request is rejected |
| Invalid refresh token | Refresh request is rejected |
| Malicious SQL input | Input is treated as data |
| Oversized request body | Request is rejected |
| Unauthorized protected endpoint | Access is denied |

## Installation & Setup

### Prerequisites

Make sure the following are installed:

- Node.js
- npm
- PostgreSQL
- Git

### 1. Clone the Repository


git clone https://github.com/hajiazeinab/secure-auth-app.git
cd secure-auth-app

Install Dependencies
npm install```

Configure Environment Variables

Create a .env file in the project root:

PORT=3000
DATABASE_URL=your_postgresql_connection_string
JWT_ACCESS_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret

Use strong, unique values for your secrets and never commit the .env file to GitHub.



The application should then be available locally at:

http://localhost:3000
Development

If the project includes a development script, it can be started with:

npm run dev

## Project Structure

secure-auth-app/
├── frontend/          # Frontend interface
├── src/               # Backend application and authentication logic
├── .gitignore         # Files excluded from version control
├── package.json       # Project configuration and dependencies
├── package-lock.json  # Locked dependency versions
└── README.md          # Project documentation

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in — returns an access token, sets a refresh cookie |
| POST | `/api/auth/refresh` | Exchange the refresh cookie for a new access token |
| POST | `/api/auth/logout` | Revoke the current refresh token |
| POST | `/api/auth/password-reset/request` | Request a reset link |
| POST | `/api/auth/password-reset/confirm` | Complete a reset with `{ token, password }` |
| GET | `/api/auth/me` | Current user — requires `Authorization: Bearer <accessToken>` |

## Limitations

The following areas are intentionally outside the current scope of the project:

- Email delivery for password resets is not connected to an external mail provider. Reset tokens are surfaced through the development interface.
- HTTPS termination is not handled by the application itself and is assumed to be provided by a reverse proxy in a production deployment.
- The current system focuses on authentication and does not include role-based authorization or an admin system.
- The application was developed and tested in a local development environment.

## Future Improvements

Potential improvements include:

- Integrate a production email service for password-reset workflows.
- Deploy the application behind HTTPS.
- Add role-based access control (RBAC).
- Add multi-factor authentication (MFA).
- Improve automated security and integration testing.
- Add security monitoring and authentication event logging.
- Deploy the application to a production environment.

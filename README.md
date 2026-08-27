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

1. Registration

User submits their email and password.

```text
User
 ↓
Registration Request
 ↓
Validate Input
 ↓
Hash Password with bcrypt
 ↓
Store User in PostgreSQL

### 2. Login

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


### 3. Accessing Protected Resources
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

## What's stubbed, not shipped

Two things are deliberately left as integration points rather than built in,
since they depend on infrastructure this project doesn't own:

- **Email delivery.** Verification and password-reset tokens are generated
  and stored, but the `// In production: email ...` comments in
  `authController.js` mark where you'd plug in a mail provider (Resend,
  SendGrid, SES, etc.) instead of the current no-op.
- **HTTPS termination.** `secure: true` on the refresh cookie assumes you're
  behind TLS in production (`NODE_ENV=production`) — typically handled by a
  reverse proxy or your hosting platform, not this codebase.

## Before using this in production

- Put the API behind HTTPS — the refresh cookie's `secure` flag depends on it.
- Consider adding 2FA (TOTP) for higher-value accounts.
- Add structured logging/alerting on repeated lockouts — that's a signal
  worth watching, not just blocking.
- Run `npm audit` periodically and keep `bcrypt`, `jsonwebtoken`, and
  `express` patched.
# secure-auth-app

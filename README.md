# Secure Authentication System

A JavaScript (Node.js + Express + PostgreSQL) authentication API built around
current best practice rather than a single trick. Nothing here is exotic —
each piece closes a specific, well-known attack path.

## What it defends against

| Threat | Defense |
|---|---|
| Stolen password database | bcrypt hashing, 12 salt rounds — hashes are slow to crack even in bulk |
| Brute-force password guessing | `express-rate-limit` on `/login`, `/register`, `/password-reset/*` |
| Credential stuffing / repeated failed logins | Per-account lockout after `MAX_LOGIN_ATTEMPTS`, timed release |
| Account enumeration | Register and password-reset endpoints return identical responses whether or not the email exists; login uses one generic error message |
| Timing attacks on login | A dummy bcrypt comparison runs even when the email isn't found, so response time doesn't leak account existence |
| XSS stealing session tokens | Refresh token lives in an `httpOnly` cookie, invisible to JavaScript |
| CSRF | Access token is sent via `Authorization: Bearer`, not a cookie, so it isn't auto-attached to cross-site requests; refresh cookie is `SameSite=Strict` |
| Stolen refresh token reused after real user re-authenticates | Refresh tokens rotate on every use and are revoked once consumed |
| Leaked DB dump handing out live sessions | Refresh and password-reset tokens are stored as SHA-256 hashes, never in plaintext |
| SQL injection | All queries are parameterized (`pg` placeholders, never string concatenation) |
| Weak passwords | Enforced minimum length + character-class rules on register and reset |
| Stale sessions after a password reset | All refresh tokens for that user are revoked the moment a reset completes |
| Common HTTP header attacks (clickjacking, MIME sniffing, etc.) | `helmet()` |
| Oversized request bodies | `express.json({ limit: '10kb' })` |
| Leaking internals in error responses | Central error handler returns generic messages for 5xx, logs details server-side only |

## Project layout

```
secure-auth-system/
├── src/
│   ├── server.js                 # Express app + middleware wiring
│   ├── config/db.js              # PostgreSQL connection pool
│   ├── db/schema.sql             # Table definitions
│   ├── controllers/authController.js
│   ├── routes/authRoutes.js
│   ├── middleware/
│   │   ├── authenticate.js       # Verifies the access token on protected routes
│   │   ├── rateLimiter.js
│   │   ├── validators.js
│   │   └── errorHandler.js
│   └── utils/tokens.js           # JWT signing/verification + token hashing
├── .env.example
└── package.json
```

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set DATABASE_URL and generate two separate JWT secrets, e.g.
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

psql "$DATABASE_URL" -f src/db/schema.sql
npm run dev
```

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

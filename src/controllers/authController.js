const bcrypt = require('bcrypt');
const pool = require('../config/db');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateRandomToken,
} = require('../utils/tokens');

const SALT_ROUNDS = 12;
const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const LOCKOUT_MINUTES = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10);

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// A hash of a password that will never match anything, used to burn
// the same amount of time as a real bcrypt.compare() when an email
// doesn't exist — otherwise response timing leaks which emails are
// registered.
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7cGyfrHkVGr9V2FJz1H7X7z2xZfZ2Cy';

async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      // Identical response whether or not the email is taken, so this
      // endpoint can't be used to enumerate registered accounts.
      return res.status(201).json({
        message: 'If that email is available, an account has been created. Please check your inbox to verify it.',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
      [email, passwordHash]
    );

    // In production: generate a verification token (see
    // requestPasswordReset for the pattern), store it hashed, and
    // email a verification link before setting is_verified = true.

    return res.status(201).json({
      message: 'Account created. Please check your inbox to verify your email.',
      user: { id: result.rows[0].id, email: result.rows[0].email },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const genericError = { error: 'Invalid email or password' };

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH); // equalize timing
      return res.status(401).json(genericError);
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({
        error: `Account temporarily locked. Try again after ${new Date(user.locked_until).toLocaleTimeString()}.`,
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      const attempts = user.failed_login_attempts + 1;
      const lockUntil =
        attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;

      await pool.query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = $2, updated_at = now() WHERE id = $3`,
        [attempts >= MAX_ATTEMPTS ? 0 : attempts, lockUntil, user.id]
      );

      return res.status(401).json(genericError);
    }

    // Successful login resets the failure counter.
    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = $1`,
      [user.id]
    );

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, hashToken(refreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    // Refresh token: httpOnly cookie, inaccessible to JS (mitigates XSS).
    // Access token: returned in the JSON body, held in memory client-side,
    // sent as a Bearer header (mitigates CSRF, since cookies aren't used
    // for authenticated requests).
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    return res.json({ accessToken, user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token provided' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const tokenHash = hashToken(token);
    const stored = await pool.query(
      `SELECT * FROM refresh_tokens
       WHERE user_id = $1 AND token_hash = $2 AND revoked = FALSE AND expires_at > now()`,
      [payload.sub, tokenHash]
    );

    if (stored.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token not recognized' });
    }

    // Rotate on every use: revoke the presented token and issue a new
    // pair. If a stolen refresh token is ever replayed after the real
    // owner has used theirs, this row will already be revoked.
    await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, [stored.rows[0].id]);

    const newAccessToken = signAccessToken(payload.sub);
    const newRefreshToken = signRefreshToken(payload.sub);

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [payload.sub, hashToken(newRefreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);
    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [
        hashToken(token),
      ]);
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    return res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    // Always respond identically, whether or not the email is registered.
    if (result.rows.length > 0) {
      const rawToken = generateRandomToken();
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [result.rows[0].id, hashToken(rawToken), new Date(Date.now() + 60 * 60 * 1000)]
      );
      // In production: email rawToken as a reset link — never log it,
      // and never return it in this response.
    }

    return res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token) return res.status(400).json({ error: 'Reset token is required' });

    const tokenHash = hashToken(token);
    const result = await pool.query(
      `SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND used = FALSE AND expires_at > now()`,
      [tokenHash]
    );
    const record = result.rows[0];
    if (!record) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [
      passwordHash,
      record.user_id,
    ]);
    await pool.query(`UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`, [record.id]);

    // Revoke every existing session so a password reset also kicks out
    // anyone who was using a previously stolen session.
    await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [record.user_id]);

    return res.json({ message: 'Password has been reset. Please log in again.' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, email, is_verified, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
  me,
};

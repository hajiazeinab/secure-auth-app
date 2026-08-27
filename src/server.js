require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(
  helmet({
    // Default CSP is locked to same-origin only, which would silently
    // block the Google Fonts request the frontend makes — allowlist
    // just those two domains rather than loosening the policy generally.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10kb' })); // caps request body size against payload-flood abuse
app.use(cookieParser());

// Serves index.html, style.css, and app.js directly — the frontend and
// API now share one origin and one port, so no separate static server
// and no cross-origin cookie concerns.
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// 404 for anything unmatched under /api — non-API 404s fall through to
// express.static's own handling above.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Auth server running on port ${PORT}`));

module.exports = app;

// Point this at wherever your backend is actually running.
const API_BASE = 'http://localhost:5001/api';

// The access token lives only in memory — never in localStorage — so it
// can't be stolen by an XSS payload reading browser storage. It's lost on
// page refresh by design; refreshSession() below restores it using the
// httpOnly refresh cookie instead.
let accessToken = null;

const els = {
  readoutDot: document.getElementById('readoutDot'),
  readoutValue: document.getElementById('readoutValue'),
  authCard: document.getElementById('authCard'),
  dashboard: document.getElementById('dashboard'),
  statusMsg: document.getElementById('statusMsg'),
  tabs: document.querySelectorAll('.tab'),
  forms: document.querySelectorAll('.form'),
  dashEmail: document.getElementById('dashEmail'),
  dashVerified: document.getElementById('dashVerified'),
  dashCreated: document.getElementById('dashCreated'),
};

function setReadout(state) {
  els.readoutDot.className = 'readout-dot ' + state;
  els.readoutValue.textContent = { none: 'NONE', pending: 'PENDING', granted: 'GRANTED' }[state];
}

function showStatus(message, isError) {
  els.statusMsg.textContent = message || '';
  els.statusMsg.className = 'status-msg ' + (isError ? 'error' : 'success');
}

function showForm(name) {
  showStatus('');
  els.forms.forEach((f) => f.classList.toggle('hidden', f.dataset.form !== name));
  els.tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    credentials: 'include', // sends/receives the httpOnly refresh cookie
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || (data.errors && data.errors[0]) || 'Something went wrong');
  }
  return data;
}

async function loadDashboard() {
  const { user } = await apiFetch('/auth/me');
  els.dashEmail.textContent = user.email;
  els.dashVerified.textContent = user.is_verified ? 'Yes' : 'No';
  els.dashCreated.textContent = new Date(user.created_at).toLocaleDateString();
  els.authCard.classList.add('hidden');
  els.dashboard.classList.remove('hidden');
  setReadout('granted');
}

function showAuthCard() {
  els.dashboard.classList.add('hidden');
  els.authCard.classList.remove('hidden');
  setReadout('none');
}

// On page load, try to silently restore a session using the refresh
// cookie — this is what lets a refresh survive a page reload even though
// the access token itself is only ever kept in memory.
async function tryRestoreSession() {
  try {
    const { accessToken: token } = await apiFetch('/auth/refresh', { method: 'POST' });
    accessToken = token;
    await loadDashboard();
  } catch {
    showAuthCard();
  }
}

document.querySelectorAll('[data-tab]').forEach((tab) => {
  tab.addEventListener('click', () => showForm(tab.dataset.tab));
});

document.querySelectorAll('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => showForm(btn.dataset.goto));
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  setReadout('pending');
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    accessToken = data.accessToken;
    await loadDashboard();
  } catch (err) {
    setReadout('none');
    showStatus(err.message, true);
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    showStatus(data.message, false);
    e.target.reset();
  } catch (err) {
    showStatus(err.message, true);
  }
});

document.getElementById('resetRequestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await apiFetch('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email') }),
    });
    // devResetToken only ever appears outside production — see the note
    // in authController.js. It saves you from needing a mail server
    // wired up just to test this flow locally.
    if (data.devResetToken) {
      showStatus('Dev mode — reset token: ' + data.devResetToken, false);
      const tokenField = document.querySelector('#resetConfirmForm [name="token"]');
      tokenField.value = data.devResetToken;
      showForm('resetConfirm');
    } else {
      showStatus(data.message, false);
    }
  } catch (err) {
    showStatus(err.message, true);
  }
});

document.getElementById('resetConfirmForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await apiFetch('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: form.get('token'), password: form.get('password') }),
    });
    showStatus(data.message, false);
    e.target.reset();
    showForm('login');
  } catch (err) {
    showStatus(err.message, true);
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // even if the request fails, clear local state so the UI doesn't lie
  }
  accessToken = null;
  showAuthCard();
});

tryRestoreSession();

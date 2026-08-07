const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '4000'
  ? 'http://localhost:4000/api'
  : '/api';

// Retrieve token from storage
function getToken() {
  return localStorage.getItem('rapidcash_token');
}

// Save token to storage
function setToken(token) {
  localStorage.setItem('rapidcash_token', token);
}

// Remove token and clear session
function logout() {
  localStorage.removeItem('rapidcash_token');
  localStorage.removeItem('rapidcash_user');
  window.location.href = 'login.html';
}

// Fetch user profile from token
async function checkUserProfile() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        // Expired or bad token
        localStorage.removeItem('rapidcash_token');
        localStorage.removeItem('rapidcash_user');
      }
      return null;
    }

    const data = await res.json();
    localStorage.setItem('rapidcash_user', JSON.stringify(data.user));
    return data.user;
  } catch (err) {
    console.error('Failed to verify user profile:', err);
    return null;
  }
}

// UI Switch between Log In and Register tabs
function switchTab(tab) {
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const loginPanel = document.getElementById('panel-login');
  const registerPanel = document.getElementById('panel-register');
  const statusBox = document.getElementById('auth-status');

  if (!loginTab || !registerTab) return;

  statusBox.style.display = 'none';
  statusBox.textContent = '';
  statusBox.className = 'form-status';

  if (tab === 'login') {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginPanel.classList.add('active');
    registerPanel.classList.remove('active');
  } else {
    loginTab.classList.remove('active');
    registerTab.classList.add('active');
    loginPanel.classList.remove('active');
    registerPanel.classList.add('active');
  }
}

// Handle Login form submission
async function handleLoginSubmit(event) {
  event.preventDefault();
  const statusBox = document.getElementById('auth-status');
  const submitBtn = document.getElementById('btn-login-submit');

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  statusBox.style.display = 'none';
  statusBox.textContent = '';
  statusBox.className = 'form-status';

  submitBtn.disabled = true;
  submitBtn.textContent = 'Authenticating...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Server returned an invalid response (Status: ${res.status}). The API server might be offline or misconfigured.`);
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed. Please check your credentials.');
    }

    setToken(data.token);
    localStorage.setItem('rapidcash_user', JSON.stringify(data.user));

    statusBox.textContent = 'Welcome! Redirecting...';
    statusBox.className = 'form-status success';
    statusBox.style.display = 'block';

    setTimeout(() => {
      routeBasedOnRole(data.user.role);
    }, 800);

  } catch (err) {
    statusBox.textContent = err.message;
    statusBox.className = 'form-status error';
    statusBox.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Access Account';
  }
}

// Handle Register form submission
async function handleRegisterSubmit(event) {
  event.preventDefault();
  const statusBox = document.getElementById('auth-status');
  const submitBtn = document.getElementById('btn-register-submit');

  const firstName = document.getElementById('reg-firstname').value;
  const lastName = document.getElementById('reg-lastname').value;
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;

  statusBox.style.display = 'none';
  statusBox.textContent = '';
  statusBox.className = 'form-status';

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating Account...';

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, phone, password })
    });

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Server returned an invalid response (Status: ${res.status}). The API server might be offline or misconfigured.`);
    }

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.errors ? data.errors.map(e => e.msg).join(', ') : (data.error || 'Registration failed.');
      throw new Error(errMsg);
    }

    setToken(data.token);
    localStorage.setItem('rapidcash_user', JSON.stringify(data.user));

    statusBox.textContent = 'Account created successfully! Redirecting...';
    statusBox.className = 'form-status success';
    statusBox.style.display = 'block';

    setTimeout(() => {
      routeBasedOnRole(data.user.role);
    }, 800);

  } catch (err) {
    statusBox.textContent = err.message;
    statusBox.className = 'form-status error';
    statusBox.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
  }
}

// Redirect logic depending on User role
function routeBasedOnRole(role) {
  if (role === 'admin' || role === 'underwriter' || role === 'loan_officer') {
    window.location.href = 'admin.html';
  } else {
    window.location.href = 'dashboard.html';
  }
}

// Check auth state on login.html load to auto-redirect logged in users
document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname.endsWith('login.html')) {
    const user = await checkUserProfile();
    if (user) {
      routeBasedOnRole(user.role);
    }
  }
});

// Admin Login Page Logic

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  const toggleBtn = document.getElementById('toggle-password');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', togglePasswordVisibility);
  }
});

function togglePasswordVisibility() {
  const input = document.getElementById('password');
  const eyeIcon = document.getElementById('eye-icon');
  const eyeOffIcon = document.getElementById('eye-off-icon');
  if (!input || !eyeIcon || !eyeOffIcon) return;

  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  eyeIcon.style.display = isHidden ? 'none' : 'block';
  eyeOffIcon.style.display = isHidden ? 'block' : 'none';
}

async function handleLoginSubmit(e) {
  e.preventDefault();

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('login-btn');
  const alertBox = document.getElementById('login-alert');

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    showAlert('Please enter both username and password.', 'error');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Signing in...';
    if (alertBox) {
      alertBox.hidden = true;
      alertBox.style.display = 'none';
    }

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      showAlert('Signed in successfully. Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = data.redirectUrl || '/admin';
      }, 800);
    } else {
      showAlert(data.message === 'ভুল ইউজারনেম অথবা পাসওয়ার্ড! আবার চেষ্টা করুন।'
        ? 'Incorrect username or password. Please try again.'
        : (data.message || 'Sign in failed. Please try again.'), 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Sign In';
    }

  } catch (err) {
    console.error('Login error:', err);
    showAlert('Connection error. Please try again later.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Sign In';
  }
}

function showAlert(msg, type) {
  const alertBox = document.getElementById('login-alert');
  if (!alertBox) return;

  alertBox.hidden = false;
  alertBox.style.display = 'block';
  alertBox.innerText = msg;
  alertBox.className = `login-alert login-alert--${type}`;
}

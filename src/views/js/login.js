// Admin Login Page Logic

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
});

async function handleLoginSubmit(e) {
  e.preventDefault();

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('login-btn');
  const alertBox = document.getElementById('login-alert');

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    showAlert('ইউজারনেম এবং পাসওয়ার্ড উভয়ই লিখুন।', 'error');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '🔄 যাঁচাই করা হচ্ছে...';
    alertBox.style.display = 'none';

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      showAlert('✅ ' + data.message, 'success');
      setTimeout(() => {
        window.location.href = data.redirectUrl || '/admin';
      }, 800);
    } else {
      showAlert('❌ ' + (data.message || 'লগইন ব্যর্থ হয়েছে!'), 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '🔑 অ্যাডমিন সিস্টেমে প্রবেশ করুন';
    }

  } catch (err) {
    console.error('Login error:', err);
    showAlert('❌ সংযোগে সমস্যা হয়েছে! পরে চেষ্টা করুন।', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '🔑 অ্যাডমিন সিস্টেমে প্রবেশ করুন';
  }
}

function showAlert(msg, type) {
  const alertBox = document.getElementById('login-alert');
  if (!alertBox) return;

  alertBox.style.display = 'block';
  alertBox.innerText = msg;

  if (type === 'success') {
    alertBox.style.background = 'rgba(168, 85, 247, 0.15)';
    alertBox.style.border = '1px solid #a855f7';
    alertBox.style.color = '#c084fc';
  } else {
    alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
    alertBox.style.border = '1px solid #ef4444';
    alertBox.style.color = '#fca5a5';
  }
}

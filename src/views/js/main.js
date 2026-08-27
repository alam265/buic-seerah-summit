// BUIC Quiz Portal - Main UI Logic

document.addEventListener('DOMContentLoaded', async () => {
  await loadPartials();
  initNavbar();
  initCountdown();
  checkBackendHealth();
});

async function loadPartials() {
  const headerElem = document.getElementById('header-placeholder');
  const footerElem = document.getElementById('footer-placeholder');

  if (headerElem && !headerElem.children.length) {
    try {
      const res = await fetch('/partials/header.html');
      if (res.ok) {
        headerElem.innerHTML = await res.text();
      }
    } catch (e) {
      console.warn('Could not load header partial dynamically:', e);
    }
  }

  if (footerElem && !footerElem.children.length) {
    try {
      const res = await fetch('/partials/footer.html');
      if (res.ok) {
        footerElem.innerHTML = await res.text();
      }
    } catch (e) {
      console.warn('Could not load footer partial dynamically:', e);
    }
  }
}

function initNavbar() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.getElementById('nav-links');

  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      menuBtn.innerHTML = navLinks.classList.contains('active') ? '✕' : '☰';
    });
  }

  const currentPath = window.location.pathname;
  const links = document.querySelectorAll('.nav-link');

  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '/' && href === '/') || (href !== '/' && currentPath.startsWith(href) && href !== '#')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Adjust CTA / Logout button based on route
  const isAdminPage = currentPath.startsWith('/admin');
  const logoutBtn = document.getElementById('logout-btn');
  const ctaBtn = document.getElementById('nav-cta-btn');

  if (isAdminPage) {
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (ctaBtn) ctaBtn.style.display = 'none';
  } else {
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (ctaBtn) ctaBtn.style.display = 'inline-flex';
  }
}

function initCountdown() {
  const timerContainer = document.getElementById('countdown');
  if (!timerContainer) return;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 14);

  function updateTimer() {
    const now = new Date().getTime();
    const distance = targetDate.getTime() - now;

    if (distance < 0) {
      timerContainer.innerHTML = '<div class="time-box" style="grid-column: 1/-1;">রেজিস্ট্রেশান এবং সীরাত প্রতিযোগিতা চলছে!</div>';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById('cd-days').innerText = String(days).padStart(2, '0');
    document.getElementById('cd-hours').innerText = String(hours).padStart(2, '0');
    document.getElementById('cd-minutes').innerText = String(minutes).padStart(2, '0');
    document.getElementById('cd-seconds').innerText = String(seconds).padStart(2, '0');
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

async function checkBackendHealth() {
  const statusBadge = document.getElementById('db-status-banner');
  if (!statusBadge) return;

  try {
    const res = await fetch('/api/health');
    const data = await res.json();

    if (data.isNeonConnected) {
      statusBadge.className = 'db-status-banner connected';
      statusBadge.innerHTML = `
        <span><span class="db-status-dot"></span> 🟢 Neon PostgreSQL ডাটাবেজ: <strong>সক্রিয় (Connected)</strong></span>
        <span style="font-size:0.8rem; opacity:0.8;">মোট নিবন্ধিত: ${data.totalRegistrations} জন</span>
      `;
    } else {
      statusBadge.className = 'db-status-banner fallback';
      statusBadge.innerHTML = `
        <span><span class="db-status-dot"></span> 🟡 Neon DB মোড: <strong>লোকাল ডেভ স্টোরেজ সক্রিয়</strong> (Neon connect করতে .env তে DATABASE_URL সেট করুন)</span>
        <span style="font-size:0.8rem; opacity:0.8;">নিবন্ধিত: ${data.totalRegistrations} জন</span>
      `;
    }
  } catch (err) {
    console.warn('Backend Health Check failed:', err);
  }
}

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? '✅' : '⚠️';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

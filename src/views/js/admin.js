// BUIC Quiz Portal - Admin Participant Directory Logic

const COLSPAN = 15;

const COMPETITION_LABELS = {
  quiz: 'Quiz',
  seerah: 'Open Book'
};
const BOOK_COLSPAN = 11;
const MAX_FETCH_RETRIES = 5;
const FETCH_RETRY_BASE_MS = 2000;
let participantsData = [];
let bookOrdersData = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateDbStatusBanner(storageType) {
  const banner = document.getElementById('db-status-banner');
  if (!banner || !storageType) return;

  const isNeon = storageType.includes('Neon');
  banner.className = isNeon ? 'db-status-banner connected' : 'db-status-banner fallback';
  banner.innerHTML = isNeon
    ? '<span><span class="db-status-dot"></span> 🟢 Neon PostgreSQL: <strong>Connected</strong></span>'
    : `<span><span class="db-status-dot"></span> 🟡 Storage: <strong>${escapeHtml(storageType)}</strong></span>`;
}

function shouldRetryFetch(response, result) {
  return response.status === 503 || result?.code === 'DB_NOT_READY' || result?.retryable === true;
}

document.addEventListener('DOMContentLoaded', () => {
  fetchParticipants();
  fetchBookOrders();
  checkEmailStatus();

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', filterParticipants);
  }

  const competitionFilter = document.getElementById('competition-filter');
  if (competitionFilter) {
    competitionFilter.addEventListener('change', filterParticipants);
  }

  const bookSearchInput = document.getElementById('book-search-input');
  if (bookSearchInput) {
    bookSearchInput.addEventListener('input', filterBookOrders);
  }

  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
  }

  const exportBookBtn = document.getElementById('export-book-btn');
  if (exportBookBtn) {
    exportBookBtn.addEventListener('click', exportBookOrdersToCSV);
  }

  const notifyEmailBtn = document.getElementById('notify-email-btn');
  if (notifyEmailBtn) {
    notifyEmailBtn.addEventListener('click', openNotifyModal);
  }

  const notifyForm = document.getElementById('notify-form');
  if (notifyForm) {
    notifyForm.addEventListener('submit', handleNotifySubmit);
  }

  const editForm = document.getElementById('edit-form');
  if (editForm) {
    editForm.addEventListener('submit', handleEditSubmit);
  }
});

async function handleLogout() {
  try {
    const res = await fetch('/api/admin/logout', { method: 'POST' });
    const data = await res.json();
    showToast('Logout successful!', 'success');
    setTimeout(() => {
      window.location.href = data.redirectUrl || '/login';
    }, 500);
  } catch (err) {
    console.error('Logout error:', err);
    window.location.href = '/login';
  }
}

async function fetchParticipants(retryCount = 0) {
  const tbody = document.getElementById('participants-tbody');
  const countBadge = document.getElementById('total-count');
  const storageBadge = document.getElementById('storage-type-badge');
  if (!tbody) return;

  try {
    const retryHint = retryCount > 0
      ? ` (পুনরায় চেষ্টা ${retryCount}/${MAX_FETCH_RETRIES})`
      : '';
    tbody.innerHTML = `<tr><td colspan="${COLSPAN}" style="text-align:center; padding:30px;">🔄 ডাটাবেজ থেকে তথ্য লোড হচ্ছে...${retryHint}</td></tr>`;

    const response = await fetch('/api/participants');

    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }

    const result = await response.json();

    if (shouldRetryFetch(response, result) && retryCount < MAX_FETCH_RETRIES) {
      await sleep(FETCH_RETRY_BASE_MS * (retryCount + 1));
      return fetchParticipants(retryCount + 1);
    }

    if (result.success) {
      participantsData = result.participants || [];
      if (countBadge) countBadge.innerText = `${result.count} জন`;
      if (storageBadge) storageBadge.innerText = result.storageType || '';
      updateDbStatusBanner(result.storageType);
      renderTable(participantsData);
    } else {
      tbody.innerHTML = `<tr><td colspan="${COLSPAN}" style="text-align:center; color:#ef4444; padding:30px;">❌ ${result.message}</td></tr>`;
    }
  } catch (err) {
    console.error('Error fetching participants:', err);
    if (retryCount < MAX_FETCH_RETRIES) {
      await sleep(FETCH_RETRY_BASE_MS * (retryCount + 1));
      return fetchParticipants(retryCount + 1);
    }
    tbody.innerHTML = `<tr><td colspan="${COLSPAN}" style="text-align:center; color:#ef4444; padding:30px;">❌ ডাটা সংগ্রহ করতে সমস্যা হয়েছে।</td></tr>`;
  }
}

function renderTable(data) {
  const tbody = document.getElementById('participants-tbody');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${COLSPAN}" style="text-align:center; padding:30px; color:var(--text-muted);">কোনো নিবন্ধনের তথ্য পাওয়া যায়নি।</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((item, index) => {
    const createdDate = new Date(item.createdAt).toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    return `
      <tr>
        <td style="font-weight:700;">${index + 1}</td>
        <td><span class="ticket-id" style="font-size:0.82rem; padding:4px 8px;">${item.ticketId}</span></td>
        <td><span style="font-size:0.82rem; font-weight:600; color:var(--accent-gold);">${COMPETITION_LABELS[item.competition] || escapeHtml(item.competition || '—')}</span></td>
        <td style="font-weight:600; color:var(--text-heading);">${escapeHtml(item.fullName)}</td>
        <td>${escapeHtml(item.studentId)}</td>
        <td>${escapeHtml(item.semester)}</td>
        <td>${escapeHtml(item.department)}</td>
        <td>${escapeHtml(item.whatsapp)}</td>
        <td>${escapeHtml(item.gender)}</td>
        <td style="word-break:break-all;">${escapeHtml(item.gsuitEmail)}</td>
        <td style="word-break:break-all;">${escapeHtml(item.personalEmail)}</td>
        <td style="font-size:0.82rem; max-width:120px; word-break:break-all;">
          ${item.facebookLink
            ? `<a href="${escapeHtml(item.facebookLink)}" target="_blank" rel="noopener" style="color:var(--accent-gold);">Profile</a>`
            : '—'}
        </td>
        <td>${escapeHtml(item.uswatunHasanahRead || '—')}</td>
        <td style="font-size:0.85rem; color:var(--text-muted);">${createdDate}</td>
        <td style="text-align:center;">
          <div style="display:flex; gap:6px; justify-content:center;">
            <button onclick="openEditModal(${item.id})" class="btn btn-secondary" style="padding:4px 10px; font-size:0.8rem;" title="তথ্য পরিবর্তন করুন">✏️ Edit</button>
            <button onclick="deleteParticipantItem(${item.id}, '${escapeHtml(item.fullName)}')" class="btn" style="padding:4px 10px; font-size:0.8rem; background:rgba(239, 68, 68, 0.2); border:1px solid #ef4444; color:#fca5a5;" title="মুছে ফেলুন">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openEditModal(id) {
  const participant = participantsData.find(p => p.id === id);
  if (!participant) return;

  document.getElementById('edit-id').value = participant.id;
  document.getElementById('edit-competition').value = participant.competition || 'quiz';
  document.getElementById('edit-name').value = participant.fullName || '';
  document.getElementById('edit-studentId').value = participant.studentId || '';
  document.getElementById('edit-semester').value = participant.semester || '';
  document.getElementById('edit-department').value = participant.department || '';
  document.getElementById('edit-whatsapp').value = participant.whatsapp || '';
  document.getElementById('edit-gender').value = participant.gender || '';
  document.getElementById('edit-facebookLink').value = participant.facebookLink || '';
  document.getElementById('edit-gsuitEmail').value = participant.gsuitEmail || '';
  document.getElementById('edit-personalEmail').value = participant.personalEmail || '';
  document.getElementById('edit-bkashTxnId').value = participant.bkashTxnId || '';
  document.getElementById('edit-uswatunHasanahRead').value = participant.uswatunHasanahRead || '';
  document.getElementById('edit-uswatunHasanahParticipation').value = participant.uswatunHasanahParticipation || '';

  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

async function handleEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const payload = {
    competition: document.getElementById('edit-competition').value,
    fullName: document.getElementById('edit-name').value.trim(),
    studentId: document.getElementById('edit-studentId').value.trim(),
    semester: document.getElementById('edit-semester').value.trim(),
    department: document.getElementById('edit-department').value.trim(),
    whatsapp: document.getElementById('edit-whatsapp').value.trim(),
    gender: document.getElementById('edit-gender').value,
    facebookLink: document.getElementById('edit-facebookLink').value.trim(),
    gsuitEmail: document.getElementById('edit-gsuitEmail').value.trim(),
    personalEmail: document.getElementById('edit-personalEmail').value.trim(),
    bkashTxnId: document.getElementById('edit-bkashTxnId').value.trim(),
    uswatunHasanahRead: document.getElementById('edit-uswatunHasanahRead').value,
    uswatunHasanahParticipation: document.getElementById('edit-uswatunHasanahParticipation').value
  };

  try {
    const res = await fetch(`/api/participants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showToast('তথ্য সফলভাবে আপডেট করা হয়েছে!', 'success');
      closeEditModal();
      fetchParticipants();
    } else {
      showToast(result.message || 'আপডেট করা সম্ভব হয়নি', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('সার্ভার কানেকশন ত্রুটি', 'error');
  }
}

async function deleteParticipantItem(id, name) {
  if (!confirm(`আপনি কি নিশ্চিত যে আপনি "${name}"-এর ডাটা মুছে ফেলতে চান?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/participants/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
      showToast('ডাটা সফলভাবে ডিলিট করা হয়েছে!', 'success');
      fetchParticipants();
    } else {
      showToast(result.message || 'ডিলিট করা সম্ভব হয়নি', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('সার্ভার কানেকশন ত্রুটি', 'error');
  }
}

function filterParticipants() {
  const searchInput = document.getElementById('search-input');
  const competitionFilter = document.getElementById('competition-filter');
  const query = (searchInput?.value || '').toLowerCase().trim();
  const competition = competitionFilter?.value || '';

  const filtered = participantsData.filter(item => {
    const matchesCompetition = !competition || item.competition === competition;
    if (!matchesCompetition) return false;

    if (!query) return true;

    return item.fullName.toLowerCase().includes(query) ||
           item.ticketId.toLowerCase().includes(query) ||
           item.studentId.toLowerCase().includes(query) ||
           item.whatsapp.toLowerCase().includes(query) ||
           item.department.toLowerCase().includes(query) ||
           item.gsuitEmail.toLowerCase().includes(query) ||
           item.personalEmail.toLowerCase().includes(query) ||
           item.bkashTxnId.toLowerCase().includes(query) ||
           (item.facebookLink || '').toLowerCase().includes(query);
  });
  renderTable(filtered);
}

function exportToCSV() {
  if (participantsData.length === 0) {
    showToast('ডাউনলোড করার মতো কোনো ডাটা নেই!', 'error');
    return;
  }

  const headers = [
    'ID', 'Ticket ID', 'Competition', 'Full Name', 'Student ID', 'Semester', 'Department', 'WhatsApp', 'Gender',
    'Gsuit Email', 'Personal Email', 'Facebook Link', 'Bkash Txn ID',
    'Uswatun Hasanah Read', 'Uswatun Hasanah Participation',
    'Created At'
  ];
  const rows = participantsData.map(p => [
    p.id,
    `"${p.ticketId}"`,
    `"${p.competition || 'quiz'}"`,
    `"${p.fullName}"`,
    `"${p.studentId}"`,
    `"${p.semester}"`,
    `"${p.department}"`,
    `"${p.whatsapp}"`,
    `"${p.gender}"`,
    `"${p.gsuitEmail}"`,
    `"${p.personalEmail}"`,
    `"${p.facebookLink || ''}"`,
    `"${p.bkashTxnId}"`,
    `"${p.uswatunHasanahRead || ''}"`,
    `"${p.uswatunHasanahParticipation || ''}"`,
    `"${p.createdAt}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
    + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `BUIC_Registrations_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('CSV ফাইল ডাউনলোড সম্পন্ন হয়েছে!', 'success');
}

let emailConfigured = false;

async function checkEmailStatus() {
  try {
    const response = await fetch('/api/notifications/email/status');
    if (response.status === 401) {
      emailConfigured = false;
      return;
    }

    const result = await response.json();
    emailConfigured = Boolean(result.success && result.configured);

    const notifyBtn = document.getElementById('notify-email-btn');
    if (notifyBtn && !emailConfigured) {
      notifyBtn.title = 'SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env (local) or Vercel Environment Variables (production).';
    }
  } catch (err) {
    console.error('Email status check failed:', err);
    emailConfigured = false;
  }
}

function openNotifyModal() {
  if (!emailConfigured) {
    showToast('SMTP সেটআপ নেই। লোকালে .env-এ বা Vercel Dashboard → Settings → Environment Variables-এ SMTP_HOST, SMTP_USER, SMTP_PASS যোগ করুন।', 'error');
    return;
  }

  if (participantsData.length === 0) {
    showToast('কোনো অংশগ্রহণকারী নেই — ইমেইল পাঠানো যাবে না!', 'error');
    return;
  }

  document.getElementById('notify-modal').style.display = 'flex';
}

function closeNotifyModal() {
  document.getElementById('notify-modal').style.display = 'none';
}

async function handleNotifySubmit(e) {
  e.preventDefault();

  const subject = document.getElementById('notify-subject').value.trim();
  const message = document.getElementById('notify-message').value.trim();
  const submitBtn = document.getElementById('notify-submit-btn');
  const originalText = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ ইমেইল পাঠানো হচ্ছে...';

    const response = await fetch('/api/notifications/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, message })
    });
    const result = await response.json();

    if (result.success) {
      showToast(result.message, 'success');
      closeNotifyModal();
      document.getElementById('notify-form').reset();
    } else {
      showToast(result.message || 'ইমেইল পাঠানো ব্যর্থ হয়েছে।', 'error');
    }
  } catch (err) {
    console.error('Email notification error:', err);
    showToast('ইমেইল পাঠাতে সমস্যা হয়েছে।', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

async function fetchBookOrders(retryCount = 0) {
  const tbody = document.getElementById('book-orders-tbody');
  const countBadge = document.getElementById('book-total-count');
  if (!tbody) return;

  try {
    const retryHint = retryCount > 0
      ? ` (পুনরায় চেষ্টা ${retryCount}/${MAX_FETCH_RETRIES})`
      : '';
    tbody.innerHTML = `<tr><td colspan="${BOOK_COLSPAN}" style="text-align:center; padding:30px;">🔄 বই রেজিস্ট্রেশন লোড হচ্ছে...${retryHint}</td></tr>`;

    const response = await fetch('/api/book-orders');
    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }

    const result = await response.json();

    if (shouldRetryFetch(response, result) && retryCount < MAX_FETCH_RETRIES) {
      await sleep(FETCH_RETRY_BASE_MS * (retryCount + 1));
      return fetchBookOrders(retryCount + 1);
    }

    if (result.success) {
      bookOrdersData = result.orders || [];
      if (countBadge) countBadge.innerText = String(result.count);
      renderBookOrdersTable(bookOrdersData);
    } else {
      tbody.innerHTML = `<tr><td colspan="${BOOK_COLSPAN}" style="text-align:center; color:#ef4444; padding:30px;">❌ ${result.message}</td></tr>`;
    }
  } catch (err) {
    console.error('Error fetching book orders:', err);
    if (retryCount < MAX_FETCH_RETRIES) {
      await sleep(FETCH_RETRY_BASE_MS * (retryCount + 1));
      return fetchBookOrders(retryCount + 1);
    }
    tbody.innerHTML = `<tr><td colspan="${BOOK_COLSPAN}" style="text-align:center; color:#ef4444; padding:30px;">❌ বই রেজিস্ট্রেশন লোড করতে সমস্যা হয়েছে।</td></tr>`;
  }
}

function renderBookOrdersTable(data) {
  const tbody = document.getElementById('book-orders-tbody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="${BOOK_COLSPAN}" style="text-align:center; padding:30px; color:var(--text-muted);">কোনো বই রেজিস্ট্রেশন নেই।</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((item, index) => {
    const createdDate = new Date(item.createdAt).toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const paymentLabel = item.paymentMethod === 'bkash' ? 'bKash' : 'Cash';

    return `
      <tr>
        <td style="font-weight:700;">${index + 1}</td>
        <td style="font-weight:600; color:var(--text-heading);">${escapeHtml(item.fullName)}</td>
        <td>${escapeHtml(item.studentId)}</td>
        <td style="word-break:break-all;">${escapeHtml(item.gsuitEmail)}</td>
        <td>${escapeHtml(item.whatsapp)}</td>
        <td>${item.isParticipant ? 'Yes' : 'No'}</td>
        <td><strong>${item.amountTk} Tk</strong></td>
        <td>${paymentLabel}</td>
        <td>${escapeHtml(item.senderBkashNumber || '—')}</td>
        <td style="font-size:0.85rem; color:var(--text-muted);">${createdDate}</td>
        <td style="text-align:center;">
          <button onclick="deleteBookOrderItem(${item.id}, '${escapeHtml(item.fullName)}')" class="btn"
            style="padding:4px 10px; font-size:0.8rem; background:rgba(239, 68, 68, 0.2); border:1px solid #ef4444; color:#fca5a5;"
            title="মুছে ফেলুন">🗑️ Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterBookOrders(e) {
  const query = e.target.value.toLowerCase().trim();
  const filtered = bookOrdersData.filter((item) => {
    return (item.fullName || '').toLowerCase().includes(query) ||
      (item.studentId || '').toLowerCase().includes(query) ||
      (item.gsuitEmail || '').toLowerCase().includes(query) ||
      (item.whatsapp || '').toLowerCase().includes(query) ||
      (item.senderBkashNumber || '').toLowerCase().includes(query) ||
      (item.paymentMethod || '').toLowerCase().includes(query);
  });
  renderBookOrdersTable(filtered);
}

async function deleteBookOrderItem(id, name) {
  if (!confirm(`আপনি কি নিশ্চিত যে আপনি "${name}"-এর বই রেজিস্ট্রেশন মুছে ফেলতে চান?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/book-orders/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      showToast('বই রেজিস্ট্রেশন ডিলিট করা হয়েছে!', 'success');
      fetchBookOrders();
    } else {
      showToast(result.message || 'ডিলিট করা সম্ভব হয়নি', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('সার্ভার কানেকশন ত্রুটি', 'error');
  }
}

function exportBookOrdersToCSV() {
  if (bookOrdersData.length === 0) {
    showToast('ডাউনলোড করার মতো কোনো বই রেজিস্ট্রেশন নেই!', 'error');
    return;
  }

  const headers = [
    'ID', 'Full Name', 'Student ID', 'Gsuit Email', 'WhatsApp',
    'Is Participant', 'Amount Tk', 'Payment Method', 'bKash Number', 'Created At'
  ];
  const rows = bookOrdersData.map((p) => [
    p.id,
    `"${p.fullName}"`,
    `"${p.studentId}"`,
    `"${p.gsuitEmail}"`,
    `"${p.whatsapp}"`,
    p.isParticipant ? 'Yes' : 'No',
    p.amountTk,
    `"${p.paymentMethod}"`,
    `"${p.senderBkashNumber || ''}"`,
    `"${p.createdAt}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `BUIC_Book_Registrations_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Book CSV ফাইল ডাউনলোড সম্পন্ন হয়েছে!', 'success');
}


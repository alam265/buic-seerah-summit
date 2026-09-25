// BUIC Quiz Portal - Book Registration (multi-step)

let formState = {
  studentId: '',
  fullName: '',
  gsuitEmail: '',
  personalEmail: '',
  whatsapp: '',
  isParticipant: false,
  amountTk: 220,
  regularPrice: 220,
  participantPrice: 150
};

let bkashNumber = '';

document.addEventListener('DOMContentLoaded', () => {
  loadBookConfig();
  prefillFromQuery();

  const step1 = document.getElementById('book-step1-form');
  const step2 = document.getElementById('book-step2-form');
  const backBtn = document.getElementById('back-btn');

  if (step1) step1.addEventListener('submit', handleLookupSubmit);
  if (step2) step2.addEventListener('submit', handleBookSubmit);
  if (backBtn) backBtn.addEventListener('click', goBackToStep1);

  document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener('change', onPaymentMethodChange);
  });
});

function prefillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const fields = ['studentId', 'fullName', 'gsuitEmail', 'personalEmail', 'whatsapp'];

  fields.forEach((id) => {
    const value = params.get(id);
    const input = document.getElementById(id);
    if (value && input) input.value = value;
  });
}

async function loadBookConfig() {
  try {
    const res = await fetch('/api/book-register/config');
    const data = await res.json();
    if (data.success) {
      bkashNumber = data.bkashNumber || '';
      formState.regularPrice = data.regularPrice || 220;
      formState.participantPrice = data.participantPrice || 150;
    }
  } catch (err) {
    console.error('Book config load failed:', err);
  }
}

async function handleLookupSubmit(e) {
  e.preventDefault();

  const payload = {
    studentId: document.getElementById('studentId').value.trim(),
    fullName: document.getElementById('fullName').value.trim(),
    gsuitEmail: document.getElementById('gsuitEmail').value.trim(),
    personalEmail: document.getElementById('personalEmail').value.trim(),
    whatsapp: document.getElementById('whatsapp').value.trim()
  };

  if (!payload.studentId || !payload.fullName || !payload.gsuitEmail || !payload.personalEmail || !payload.whatsapp) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  const btn = document.getElementById('lookup-btn');
  const original = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = '⏳ Checking...';

    const res = await fetch('/api/book-register/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (!result.success) {
      showToast(result.message || 'Lookup failed', 'error');
      return;
    }

    formState = {
      ...formState,
      ...payload,
      isParticipant: result.isParticipant,
      amountTk: result.amountTk,
      regularPrice: result.regularPrice,
      participantPrice: result.participantPrice
    };

    showStep2(result);
  } catch (err) {
    console.error(err);
    showToast('There was a problem connecting to the server.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function showStep2(result) {
  const banner = document.getElementById('price-banner');

  if (result.isParticipant) {
    banner.className = 'db-status-banner connected';
    banner.innerHTML = `
      <span>
        <strong>${escapeHtml(result.message)}</strong><br>
        Total: <s style="opacity:0.7;">${result.regularPrice} Tk</s>
        <strong style="color:var(--accent-emerald); font-size:1.15rem; margin-left:8px;">${result.amountTk} Tk</strong>
      </span>
    `;
  } else {
    banner.className = 'db-status-banner';
    banner.innerHTML = `
      <span>
        Total: <strong style="font-size:1.15rem;">${result.amountTk} Tk</strong>
      </span>
    `;
  }

  document.getElementById('book-step1-form').style.display = 'none';
  document.getElementById('book-step2-form').style.display = 'block';
  document.getElementById('book-success').style.display = 'none';

  updateBkashInstructions();
  onPaymentMethodChange();
}

function updateBkashInstructions() {
  const el = document.getElementById('bkash-instructions');
  const number = bkashNumber || '—';
  const canCopy = Boolean(bkashNumber);

  el.innerHTML = `
    bKash Send Money <strong>${formState.amountTk} Tk</strong> to this account
    ${canCopy
      ? `<button type="button" class="bkash-copy-btn" data-copy="${escapeHtml(number)}" title="Copy number" aria-label="Copy bKash number ${escapeHtml(number)}">
          <span class="bkash-copy-number">${escapeHtml(number)}</span>
          <svg class="bkash-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>`
      : `<strong style="color:var(--accent-gold);">${escapeHtml(number)}</strong>`}
    and enter the bKash number you sent from below.
  `;

  const btn = el.querySelector('.bkash-copy-btn');
  if (btn) {
    btn.addEventListener('click', copyBkashNumber);
  }
}

async function copyBkashNumber(e) {
  const btn = e.currentTarget;
  const number = btn.dataset.copy;
  if (!number) return;

  try {
    await navigator.clipboard.writeText(number);
    showToast('bKash number copied', 'success');
  } catch (err) {
    // Fallback for older browsers / insecure contexts
    const range = document.createRange();
    const span = document.createElement('span');
    span.textContent = number;
    span.style.position = 'fixed';
    span.style.left = '-9999px';
    document.body.appendChild(span);
    range.selectNodeContents(span);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    try {
      document.execCommand('copy');
      showToast('bKash number copied', 'success');
    } catch (copyErr) {
      showToast('Could not copy — please select and copy the number manually.', 'error');
    }
    selection.removeAllRanges();
    span.remove();
  }
}

function onPaymentMethodChange() {
  const method = document.querySelector('input[name="paymentMethod"]:checked')?.value;
  const panel = document.getElementById('bkash-panel');
  const senderInput = document.getElementById('senderBkashNumber');

  if (method === 'bkash') {
    panel.style.display = 'block';
    senderInput.required = true;
  } else {
    panel.style.display = 'none';
    senderInput.required = false;
    senderInput.value = '';
  }
}

function goBackToStep1() {
  document.getElementById('book-step2-form').style.display = 'none';
  document.getElementById('book-step1-form').style.display = 'block';
  document.getElementById('book-success').style.display = 'none';
}

async function handleBookSubmit(e) {
  e.preventDefault();

  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
  const senderBkashNumber = document.getElementById('senderBkashNumber').value.trim();

  if (!paymentMethod) {
    showToast('Please select a payment method.', 'error');
    return;
  }

  if (paymentMethod === 'bkash' && !senderBkashNumber) {
    showToast('Please provide the bKash number you sent from.', 'error');
    return;
  }

  const btn = document.getElementById('submit-book-btn');
  const original = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = '⏳ Submitting...';

    const res = await fetch('/api/book-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: formState.studentId,
        fullName: formState.fullName,
        gsuitEmail: formState.gsuitEmail,
        personalEmail: formState.personalEmail,
        whatsapp: formState.whatsapp,
        paymentMethod,
        senderBkashNumber: paymentMethod === 'bkash' ? senderBkashNumber : ''
      })
    });
    const result = await res.json();

    if (!result.success) {
      showToast(result.message || 'Registration failed', 'error');
      return;
    }

    showToast(result.message, 'success');
    showSuccess(result.registration);
    showCompetitionPromo(result.missingCompetitions);
  } catch (err) {
    console.error(err);
    showToast('There was a problem connecting to the server.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function showSuccess(reg) {
  document.getElementById('book-step1-form').style.display = 'none';
  document.getElementById('book-step2-form').style.display = 'none';
  document.getElementById('book-success').style.display = 'block';

  const methodLabel = reg.paymentMethod === 'bkash' ? 'bKash' : 'Cash';
  const senderLine = reg.senderBkashNumber
    ? `<br>bKash From: <strong>${escapeHtml(reg.senderBkashNumber)}</strong>`
    : '';

  document.getElementById('success-summary').innerHTML = `
    <strong>${escapeHtml(reg.fullName)}</strong> (${escapeHtml(reg.studentId)})<br>
    Amount: <strong>${reg.amountTk} Tk</strong> · Payment: <strong>${methodLabel}</strong>${senderLine}
  `;
}


const COMPETITION_LABELS = {
  quiz: 'Seerah Quiz Competition',
  seerah: 'Seerah Open Book Competition'
};

const COMPETITION_EMOJI = {
  quiz: '🏆',
  seerah: '📖'
};

function competitionRegisterUrl(competition) {
  const params = new URLSearchParams({
    studentId: formState.studentId,
    fullName: formState.fullName,
    gsuitEmail: formState.gsuitEmail,
    personalEmail: formState.personalEmail,
    whatsapp: formState.whatsapp
  });
  return `/register?competition=${encodeURIComponent(competition)}&${params.toString()}`;
}

function showCompetitionPromo(missingCompetitions) {
  if (!Array.isArray(missingCompetitions) || missingCompetitions.length === 0) return;

  let modal = document.getElementById('competition-promo-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'competition-promo-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const buttonsHtml = missingCompetitions.map((competition) => `
    <a href="${competitionRegisterUrl(competition)}" class="btn btn-primary" style="padding:10px 20px; font-size:0.9rem;">
      ${COMPETITION_EMOJI[competition] || '🎉'} ${COMPETITION_LABELS[competition] || competition}
    </a>
  `).join('');

  const message = missingCompetitions.length === 2
    ? 'আপনি কি Quiz অথবা Open Book প্রতিযোগিতায় রেজিস্ট্রেশন করতে চান?'
    : `আপনি কি ${COMPETITION_LABELS[missingCompetitions[0]] || missingCompetitions[0]}-এও রেজিস্ট্রেশন করতে চান?`;

  modal.innerHTML = `
    <div class="ticket-card" style="max-width:420px;">
      <div class="ticket-header">
        <div style="font-size:2rem;">🎉</div>
        <div class="ticket-badge-title">বই রেজিস্ট্রেশন সম্পন্ন!</div>
      </div>

      <p style="margin-bottom:24px; color:var(--text-muted);">${message}</p>

      <div class="ticket-actions" style="flex-wrap:wrap;">
        ${buttonsHtml}
        <button onclick="closeCompetitionPromoModal()" class="btn btn-secondary" style="padding:10px 20px; font-size:0.9rem;">
          না, ধন্যবাদ
        </button>
      </div>
    </div>
  `;

  setTimeout(() => modal.classList.add('active'), 50);
}

function closeCompetitionPromoModal() {
  const modal = document.getElementById('competition-promo-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}

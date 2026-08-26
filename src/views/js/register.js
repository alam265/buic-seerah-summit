// BUIC Quiz Portal - Registration Logic & Ticket Badge Modal

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registration-form');
  if (form) {
    form.addEventListener('submit', handleRegistrationSubmit);
  }
});

async function handleRegistrationSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('submit-btn');
  const originalBtnText = submitBtn.innerHTML;

  const invitationSource = document.querySelector('input[name="invitationSource"]:checked')?.value || '';
  const uswatunHasanahRead = document.querySelector('input[name="uswatunHasanahRead"]:checked')?.value || '';
  const uswatunHasanahParticipation = document.querySelector('input[name="uswatunHasanahParticipation"]:checked')?.value || '';

  const payload = {
    fullName: document.getElementById('fullName').value.trim(),
    studentId: document.getElementById('studentId').value.trim(),
    semester: document.getElementById('semester').value.trim(),
    department: document.getElementById('department').value.trim(),
    whatsapp: document.getElementById('whatsapp').value.trim(),
    facebookLink: document.getElementById('facebookLink').value.trim(),
    gsuitEmail: document.getElementById('gsuitEmail').value.trim(),
    personalEmail: document.getElementById('personalEmail').value.trim(),
    gender: document.getElementById('gender').value,
    bkashTxnId: document.getElementById('bkashTxnId').value.trim(),
    seerahReadBefore: document.getElementById('seerahReadBefore').value.trim(),
    engagementSuggestions: document.getElementById('engagementSuggestions').value.trim(),
    programmeExpectation: document.getElementById('programmeExpectation').value.trim(),
    invitationSource,
    uswatunHasanahRead,
    uswatunHasanahParticipation
  };

  if (!payload.fullName || !payload.studentId || !payload.department || !payload.whatsapp || !payload.gsuitEmail || !payload.personalEmail || !payload.gender || !payload.bkashTxnId) {
    showToast('অনুগ্রহ করে সকল প্রয়োজনীয় ঘর সঠিকভাবে পূরণ করুন।', 'error');
    return;
  }

  if (!payload.invitationSource || !payload.uswatunHasanahRead || !payload.uswatunHasanahParticipation) {
    showToast('অনুগ্রহ করে Survey Section-এর সকল প্রয়োজনীয় প্রশ্নের উত্তর দিন।', 'error');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ ডাটা সাবমিট করা হচ্ছে...';

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      showToast(result.message, 'success');
      document.getElementById('registration-form').reset();
      showTicketModal(result.registration, result.storageType);
      checkBackendHealth();
    } else {
      showToast(result.message || 'সমস্যা হয়েছে, পুনরায় চেষ্টা করুন।', 'error');
    }

  } catch (err) {
    console.error('Registration Error:', err);
    showToast('সার্ভারের সাথে ডাটা আদানপ্রদানে সমস্যা হয়েছে।', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}

function showTicketModal(reg, storageType) {
  let modal = document.getElementById('ticket-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ticket-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const createdDate = new Date(reg.createdAt).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  modal.innerHTML = `
    <div class="ticket-card">
      <div class="ticket-header">
        <div style="font-size:2rem;">🏆</div>
        <div class="ticket-badge-title">সীরাত প্রতিযোগিতা ২০২৬</div>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">BUIC Registration Badge</p>
        <div class="ticket-id">${reg.ticketId}</div>
      </div>

       <div class="ticket-details">
        <div class="ticket-field">
          <label>অংশগ্রহণকারীর নাম</label>
          <p>${reg.fullName}</p>
        </div>

        <div class="ticket-field">
          <label>স্টুডেন্ট আইডি</label>
          <p>${reg.studentId}</p>
        </div>

        <div class="ticket-field">
          <label>সেমিস্টার / ইনটেক</label>
          <p>${reg.semester}</p>
        </div>

        <div class="ticket-field">
          <label>বিভাগ (Department)</label>
          <p>${reg.department}</p>
        </div>

        <div class="ticket-field">
          <label>হোয়াটসঅ্যাপ</label>
          <p>${reg.whatsapp}</p>
        </div>

        <div class="ticket-field">
          <label>লিঙ্গ</label>
          <p>${reg.gender}</p>
        </div>

        <div class="ticket-field">
          <label>জিসুইট ইমেইল</label>
          <p style="word-break:break-all;">${reg.gsuitEmail}</p>
        </div>

        <div class="ticket-field">
          <label>পার্সোনাল ইমেইল</label>
          <p style="word-break:break-all;">${reg.personalEmail}</p>
        </div>

        <div class="ticket-field">
          <label>বিকাশ ট্রানজ্যাকশন আইডি</label>
          <p>${reg.bkashTxnId}</p>
        </div>
      </div>

      <p style="font-size:0.78rem; color:var(--accent-emerald); margin-bottom: 20px;">
        তারিখ: ${createdDate}
      </p>

      <div class="ticket-actions">
        <button onclick="window.print()" class="btn btn-primary" style="padding:10px 20px; font-size:0.9rem;">
          🖨️ রসিদ প্রিন্ট করুন
        </button>
        <button onclick="closeTicketModal()" class="btn btn-secondary" style="padding:10px 20px; font-size:0.9rem;">
          বন্ধ করুন
        </button>
      </div>
    </div>
  `;

  setTimeout(() => modal.classList.add('active'), 50);
}

function closeTicketModal() {
  const modal = document.getElementById('ticket-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// BUIC Quiz Portal - Registration Logic & Ticket Badge Modal

const COMPETITION_LABELS = {
  quiz: 'Seerah Quiz Competition',
  seerah: 'Seerah Open Book Competition'
};

const COMPETITION_COPY = {
  quiz: {
    badge: '🎟️ Quiz Portal',
    title: 'Seerah Quiz Competition Registration',
    subtitle: 'Fill in the form below to register for the Seerah Quiz Series.'
  },
  seerah: {
    badge: '📖 Open Book Portal',
    title: 'Seerah Open Book Competition Registration',
    subtitle: 'Fill in the form below to register for the Seerah Open Book Examination.'
  }
};

let pendingCrossPromo = null;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registration-form');
  if (!form) return;

  form.addEventListener('submit', handleRegistrationSubmit);

  document.querySelectorAll('.registration-tab').forEach((tab) => {
    tab.addEventListener('click', () => setCompetitionTab(tab.dataset.competition));
  });

  const initialCompetition = getInitialCompetition();
  setCompetitionTab(initialCompetition, { updateUrl: false });
  prefillFromQuery();

  initScrollableSelect(document.getElementById('department'));
});

function prefillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const fields = ['fullName', 'studentId', 'semester', 'department', 'whatsapp', 'facebookLink', 'gsuitEmail', 'personalEmail', 'gender'];

  fields.forEach((id) => {
    const value = params.get(id);
    const input = document.getElementById(id);
    if (value && input) input.value = value;
  });
}

function initScrollableSelect(select, maxVisible = 8) {
  if (!select) return;

  let expanded = false;

  const expand = () => {
    if (expanded) return;
    expanded = true;
    select.size = Math.min(select.options.length, maxVisible);
    select.classList.add('is-expanded');
  };

  const collapse = () => {
    if (!expanded) return;
    expanded = false;
    select.size = 1;
    select.classList.remove('is-expanded');
  };

  select.addEventListener('focus', expand);
  select.addEventListener('change', collapse);
  select.addEventListener('blur', collapse);
}

function getInitialCompetition() {
  const params = new URLSearchParams(window.location.search);
  const competition = params.get('competition');
  return competition === 'seerah' ? 'seerah' : 'quiz';
}

function setCompetitionTab(competition, options = {}) {
  const { updateUrl = true } = options;
  const normalized = competition === 'seerah' ? 'seerah' : 'quiz';
  const form = document.getElementById('registration-form');
  const quizOnlyFields = document.getElementById('quiz-only-fields');
  const copy = COMPETITION_COPY[normalized];

  form.dataset.competition = normalized;

  document.querySelectorAll('.registration-tab').forEach((tab) => {
    const isActive = tab.dataset.competition === normalized;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  if (quizOnlyFields) {
    quizOnlyFields.classList.toggle('is-hidden', normalized !== 'quiz');
  }

  document.querySelectorAll('[data-quiz-required]').forEach((input) => {
    input.required = normalized === 'quiz';
  });

  document.querySelectorAll('[data-quiz-text][data-seerah-text]').forEach((el) => {
    el.textContent = normalized === 'seerah' ? el.dataset.seerahText : el.dataset.quizText;
  });

  const badge = document.getElementById('registration-badge');
  const title = document.getElementById('registration-title');
  const subtitle = document.getElementById('registration-subtitle');
  if (badge) badge.textContent = copy.badge;
  if (title) title.textContent = copy.title;
  if (subtitle) subtitle.textContent = copy.subtitle;
  document.title = `${copy.title} - BUIC Seerah Summit`;

  if (updateUrl) {
    const url = new URL(window.location.href);
    if (normalized === 'seerah') {
      url.searchParams.set('competition', 'seerah');
    } else {
      url.searchParams.delete('competition');
    }
    window.history.replaceState({}, '', url);
  }
}

async function handleRegistrationSubmit(e) {
  e.preventDefault();

  const form = e.currentTarget;
  const competition = form.dataset.competition || 'quiz';
  const isQuiz = competition === 'quiz';
  const submitBtn = document.getElementById('submit-btn');
  const originalBtnText = submitBtn.innerHTML;

  const uswatunHasanahRead = document.querySelector('input[name="uswatunHasanahRead"]:checked')?.value || '';
  const uswatunHasanahParticipation = document.querySelector('input[name="uswatunHasanahParticipation"]:checked')?.value || '';

  const payload = {
    competition,
    fullName: document.getElementById('fullName').value.trim(),
    studentId: document.getElementById('studentId').value.trim(),
    semester: document.getElementById('semester').value.trim(),
    department: document.getElementById('department').value.trim(),
    whatsapp: document.getElementById('whatsapp').value.trim(),
    facebookLink: document.getElementById('facebookLink').value.trim(),
    gsuitEmail: document.getElementById('gsuitEmail').value.trim(),
    personalEmail: document.getElementById('personalEmail').value.trim(),
    gender: document.getElementById('gender').value,
    uswatunHasanahRead,
    uswatunHasanahParticipation
  };

  if (!payload.fullName || !payload.studentId || !payload.department || !payload.whatsapp || !payload.facebookLink || !payload.gsuitEmail || !payload.personalEmail || !payload.gender) {
    showToast('অনুগ্রহ করে সকল প্রয়োজনীয় ঘর সঠিকভাবে পূরণ করুন।', 'error');
    return;
  }

  if (!payload.uswatunHasanahRead || !payload.uswatunHasanahParticipation) {
    showToast('অনুগ্রহ করে Uswatun Hasanah সম্পর্কিত সকল প্রয়োজনীয় প্রশ্নের উত্তর দিন।', 'error');
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
      const wantsToPurchase =
        isQuiz &&
        uswatunHasanahParticipation ===
          'Yes, I want to purchase Uswatun Hasanah, and participate';

      if (wantsToPurchase) {
        const params = new URLSearchParams({
          studentId: payload.studentId,
          fullName: payload.fullName,
          gsuitEmail: payload.gsuitEmail,
          personalEmail: payload.personalEmail,
          whatsapp: payload.whatsapp
        });
        window.location.href = `/book-register?${params.toString()}`;
        return;
      }

      pendingCrossPromo = result.alreadyRegisteredOther
        ? null
        : {
            competition: result.otherCompetition,
            prefill: {
              fullName: payload.fullName,
              studentId: payload.studentId,
              semester: payload.semester,
              department: payload.department,
              whatsapp: payload.whatsapp,
              facebookLink: payload.facebookLink,
              gsuitEmail: payload.gsuitEmail,
              personalEmail: payload.personalEmail,
              gender: payload.gender
            }
          };

      form.reset();
      setCompetitionTab(competition, { updateUrl: false });
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
  const competitionLabel = COMPETITION_LABELS[reg.competition] || reg.competition;

  modal.innerHTML = `
    <div class="ticket-card">
      <div class="ticket-header">
        <div style="font-size:2rem;">🏆</div>
        <div class="ticket-badge-title">${competitionLabel}</div>
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

  if (pendingCrossPromo) {
    const promo = pendingCrossPromo;
    pendingCrossPromo = null;
    setTimeout(() => showCrossPromoModal(promo), 300);
  }
}

const CROSS_PROMO_COPY = {
  quiz: {
    emoji: '🏆',
    message: 'আপনি কি Seerah Quiz Competition-এও রেজিস্ট্রেশন করতে চান?'
  },
  seerah: {
    emoji: '📖',
    message: 'আপনি কি Seerah Open Book Competition-এও রেজিস্ট্রেশন করতে চান?'
  }
};

function showCrossPromoModal({ competition, prefill }) {
  let modal = document.getElementById('cross-promo-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cross-promo-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const label = COMPETITION_LABELS[competition] || competition;
  const copy = CROSS_PROMO_COPY[competition] || { emoji: '🎉', message: `আপনি কি ${label}-এও রেজিস্ট্রেশন করতে চান?` };
  const registerUrl = `/register?competition=${encodeURIComponent(competition)}&${new URLSearchParams(prefill).toString()}`;

  modal.innerHTML = `
    <div class="ticket-card" style="max-width:420px;">
      <div class="ticket-header">
        <div style="font-size:2rem;">${copy.emoji}</div>
        <div class="ticket-badge-title">${label}</div>
      </div>

      <p style="margin-bottom:24px; color:var(--text-muted);">${copy.message}</p>

      <div class="ticket-actions">
        <a href="${registerUrl}" class="btn btn-primary" style="padding:10px 20px; font-size:0.9rem;">
          হ্যাঁ, রেজিস্টার করি
        </a>
        <button onclick="closeCrossPromoModal()" class="btn btn-secondary" style="padding:10px 20px; font-size:0.9rem;">
          না, ধন্যবাদ
        </button>
      </div>
    </div>
  `;

  setTimeout(() => modal.classList.add('active'), 50);
}

function closeCrossPromoModal() {
  const modal = document.getElementById('cross-promo-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// BUIC Quiz Portal - Contact & FAQ Logic

document.addEventListener('DOMContentLoaded', () => {
  initFAQ();
  initContactForm();
});

function initFAQ() {
  const faqQuestions = document.querySelectorAll('.faq-question');

  faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const isActive = item.classList.contains('active');

      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));

      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Your message has been received. Our representative will contact you shortly.', 'success');
    form.reset();
  });
}

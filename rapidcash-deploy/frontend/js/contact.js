// Point this at your deployed API origin in production.
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '4000'
  ? 'http://localhost:4000/api'
  : '/api';

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const statusBox = document.getElementById('contact-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusBox.className = 'form-status';
    statusBox.textContent = '';

    const payload = {
      firstName: form.firstName.value,
      lastName: form.lastName.value,
      email: form.email.value,
      phone: form.phone.value,
      topic: form.topic.value,
      message: form.message.value,
      website: form.website.value, // honeypot, should stay empty
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server returned an invalid response (Status: ${res.status}). The API server might be offline or misconfigured.`);
      }

      const data = await res.json();

      if (!res.ok) {
        const message = data.errors?.[0]?.msg || data.error || 'Something went wrong. Please try again.';
        throw new Error(message);
      }

      statusBox.textContent = data.message;
      statusBox.className = 'form-status success';
      form.reset();
    } catch (err) {
      statusBox.textContent = err.message;
      statusBox.className = 'form-status error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
    }
  });
}

function initFaqAccordion() {
  document.querySelectorAll('.faq-item').forEach((item) => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((open) => open.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initContactForm();
  initFaqAccordion();
});

let applicationId = null;
let currentStep = 1;

// Applicant writable fields matching backend picked fields
const APPLICANT_WRITABLE_FIELDS = [
  'firstName', 'middleName', 'lastName', 'dateOfBirth', 'ssn', 'phone',
  'driverLicenseNumber', 'driverLicenseState', 'maritalStatus', 'citizenshipStatus',
  'street', 'apartment', 'city', 'state', 'zip', 'residenceType',
  'yearsAtAddress', 'monthlyHousingPayment',
  'employerName', 'employerPhone', 'occupation', 'employmentStatus',
  'monthlyIncome', 'additionalIncome', 'yearsEmployed', 'payFrequency',
  'bankName', 'routingNumber', 'accountNumber', 'accountType', 'directDepositConsent',
  'requestedAmount', 'purpose', 'preferredTermMonths', 'additionalComments',
];

// Helper to show messages in the form status box
function showWizardMessage(text, type) {
  const statusBox = document.getElementById('wizard-status');
  if (!statusBox) return;
  statusBox.textContent = text;
  statusBox.className = `form-status ${type}`;
  statusBox.style.display = 'block';
  statusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearWizardMessage() {
  const statusBox = document.getElementById('wizard-status');
  if (!statusBox) return;
  statusBox.style.display = 'none';
  statusBox.textContent = '';
  statusBox.className = 'form-status';
}

// Redirect if token is missing
function checkAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
  }
}

// Start application: fetch existing draft or create new one
async function initializeApplication() {
  checkAuth();
  const token = getToken();

  try {
    const res = await fetch(`${API_BASE}/applications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to initialize application.');
    }

    const app = data.application;
    applicationId = app.id;

    // Populate form with existing draft values
    populateForm(app);

  } catch (err) {
    showWizardMessage(err.message, 'error');
  }
}

// Populate the form fields with existing application data
function populateForm(app) {
  const form = document.getElementById('loan-application-form');
  if (!form) return;

  APPLICANT_WRITABLE_FIELDS.forEach(field => {
    const element = form.elements[field];
    if (!element) return;

    let val = app[field];

    // Handle sensitive masked fields
    if (field === 'ssn' && app.ssnMasked) {
      element.value = app.ssnMasked;
      element.removeAttribute('required'); // Let them submit without re-entering
      return;
    }
    if (field === 'accountNumber' && app.accountNumberMasked) {
      element.value = app.accountNumberMasked;
      element.removeAttribute('required'); // Let them submit without re-entering
      return;
    }
    if (field === 'routingNumber' && app.routingNumberEncrypted) {
      // Routing is encrypted, but not exposed. We set a placeholder/dummy value
      element.value = '*********';
      element.removeAttribute('required');
      return;
    }

    if (val === null || val === undefined) return;

    if (element.type === 'checkbox') {
      element.checked = !!val;
    } else {
      element.value = val;
    }
  });
}

// Build the request payload, filtering out masked data
function buildPayload() {
  const form = document.getElementById('loan-application-form');
  const payload = {};

  APPLICANT_WRITABLE_FIELDS.forEach(field => {
    const element = form.elements[field];
    if (!element) return;

    let val;
    if (element.type === 'checkbox') {
      val = element.checked;
    } else {
      val = element.value;
    }

    // Skip empty or untouched masked values so we don't save raw asterisks
    if (field === 'ssn' && val.includes('*')) return;
    if (field === 'accountNumber' && val.includes('*')) return;
    if (field === 'routingNumber' && val.includes('*')) return;

    // Type convert numbers
    if (element.type === 'number') {
      if (val === '') {
        val = null;
      } else {
        val = parseFloat(val);
      }
    }
    if (field === 'preferredTermMonths' && val !== '') {
      val = parseInt(val, 10);
    }

    payload[field] = val;
  });

  return payload;
}

// Save progress to the server
async function saveDraft(silent = false) {
  if (!applicationId) return false;
  const token = getToken();
  const payload = buildPayload();

  if (!silent) {
    showWizardMessage('Saving draft...', 'success');
  }

  try {
    const res = await fetch(`${API_BASE}/applications/${applicationId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save progress.');
    }

    if (!silent) {
      showWizardMessage('Progress saved successfully!', 'success');
      setTimeout(clearWizardMessage, 2000);
    }
    return true;
  } catch (err) {
    showWizardMessage(err.message, 'error');
    return false;
  }
}

// Navigation step controllers
function updateWizardUI() {
  // Hide all panels
  document.querySelectorAll('.wizard-step-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Show active panel
  document.getElementById(`panel-step-${currentStep}`).classList.add('active');

  // Update Stepper Circular nodes
  for (let i = 1; i <= 5; i++) {
    const node = document.getElementById(`step-node-${i}`);
    if (i < currentStep) {
      node.className = 'step-node completed';
    } else if (i === currentStep) {
      node.className = 'step-node active';
    } else {
      node.className = 'step-node';
    }
  }

  // Update Progress Line width
  const progressFill = document.getElementById('progress-fill');
  progressFill.style.width = `${(currentStep - 1) / 4 * 100}%`;

  // Update buttons state
  const backBtn = document.getElementById('btn-back');
  const nextBtn = document.getElementById('btn-next');

  backBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  nextBtn.textContent = currentStep === 5 ? 'Submit Application' : 'Next Step';
}

function validateCurrentStep() {
  const panel = document.getElementById(`panel-step-${currentStep}`);
  const inputs = panel.querySelectorAll('input, select, textarea');
  let isValid = true;

  // Utilize standard HTML validation
  for (let input of inputs) {
    if (!input.checkValidity()) {
      input.reportValidity();
      isValid = false;
      break;
    }
  }
  return isValid;
}

async function goNext() {
  clearWizardMessage();

  // Validate step inputs
  if (!validateCurrentStep()) return;

  // Save progress silently before moving
  const saved = await saveDraft(true);
  if (!saved) return;

  if (currentStep < 5) {
    currentStep++;
    updateWizardUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // Final Submit
    submitApplication();
  }
}

function goBack() {
  clearWizardMessage();
  if (currentStep > 1) {
    currentStep--;
    updateWizardUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Submit final application
async function submitApplication() {
  const token = getToken();
  const submitBtn = document.getElementById('btn-next');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const res = await fetch(`${API_BASE}/applications/${applicationId}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestedAmount: parseFloat(document.getElementById('requestedAmount').value),
        purpose: document.getElementById('purpose').value
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Submission failed. Please check all fields.');
    }

    showWizardMessage('Application submitted successfully!', 'success');
    setTimeout(() => {
      window.location.href = 'dashboard.html?submitted=true';
    }, 1500);

  } catch (err) {
    showWizardMessage(err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Application';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeApplication();
  updateWizardUI();
});

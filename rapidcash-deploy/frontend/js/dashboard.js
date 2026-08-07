let activeApplicationId = null;

// Human readable status mapping
const STATUS_LABELS = {
  'received': 'Draft / In Progress',
  'verification': 'Identity Verification',
  'processing': 'Processing',
  'underwriting': 'Underwriting Review',
  'additional_documents_required': 'Documents Required',
  'decision_pending': 'Decision Pending',
  'approved': 'Approved',
  'declined': 'Declined',
  'funded': 'Funded',
  'closed': 'Closed'
};

const DOC_TYPE_LABELS = {
  'government_id': "Driver's License / Passport",
  'bank_statement': 'Bank Statement',
  'pay_stub': 'Recent Paystub',
  'tax_return': 'Federal Tax Return',
  'w2': 'W-2 Form',
  'proof_of_address': 'Proof of Address',
  'other': 'Other Document'
};

// Check auth on load
function initDashboard() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const userString = localStorage.getItem('rapidcash_user');
  if (userString) {
    const user = JSON.parse(userString);
    document.getElementById('welcome-header').textContent = `Welcome, ${user.firstName || 'User'}!`;
  }

  // Check URL params for successful submission
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('submitted') === 'true') {
    showDashboardAlert('Your application has been submitted successfully!', 'success');
  }

  fetchApplications();
}

function showDashboardAlert(text, type) {
  const alertBox = document.getElementById('doc-status-alert');
  if (!alertBox) return;
  alertBox.textContent = text;
  alertBox.className = `form-status ${type}`;
  alertBox.style.display = 'block';
}

// Fetch active applications
async function fetchApplications() {
  const token = getToken();
  const listContainer = document.getElementById('applications-list');

  try {
    const res = await fetch(`${API_BASE}/applications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch applications.');
    }

    const apps = data.applications || [];

    if (apps.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
          <p style="color: var(--gray-600); margin-bottom: 20px;">You do not have any active applications.</p>
          <a href="apply.html" class="btn btn-primary">Start a New Application</a>
        </div>
      `;
      document.getElementById('doc-center-card').style.display = 'none';
      return;
    }

    // Display primary application (newest first)
    const primaryApp = apps[0];
    activeApplicationId = primaryApp.id;

    // Set badge style
    let badgeClass = 'badge-processing';
    if (primaryApp.status === 'received') badgeClass = 'badge-received';
    else if (primaryApp.status === 'verification') badgeClass = 'badge-verification';
    else if (primaryApp.status === 'underwriting') badgeClass = 'badge-underwriting';
    else if (primaryApp.status === 'additional_documents_required') badgeClass = 'badge-action-needed';
    else if (primaryApp.status === 'approved' || primaryApp.status === 'funded') badgeClass = 'badge-approved';
    else if (primaryApp.status === 'declined') badgeClass = 'badge-declined';

    const submitDate = primaryApp.submittedAt 
      ? new Date(primaryApp.submittedAt).toLocaleDateString() 
      : 'Not submitted yet';

    const isDraft = primaryApp.status === 'received';

    listContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
        <div>
          <div style="font-size: 13px; font-weight: 700; color: var(--gray-600); margin-bottom: 6px;">APPLICATION ID</div>
          <div style="font-family: monospace; font-size: 15px; font-weight: 600; color: var(--gray-900); margin-bottom: 16px;">${primaryApp.id}</div>
          
          <div style="font-size: 13px; font-weight: 700; color: var(--gray-600); margin-bottom: 6px;">REQUESTED AMOUNT</div>
          <div style="font-size: 24px; font-weight: 700; color: var(--deep-blue); margin-bottom: 16px;">$${(primaryApp.requestedAmount || 0).toLocaleString()}</div>
          
          <div style="font-size: 13px; font-weight: 700; color: var(--gray-600); margin-bottom: 4px;">DATE SUBMITTED</div>
          <div style="font-size: 15px; color: var(--gray-900); font-weight: 500;">${submitDate}</div>
        </div>

        <div style="text-align: right; min-width: 150px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--gray-600); margin-bottom: 6px;">STATUS</div>
          <div style="margin-bottom: 24px;">
            <span class="badge ${badgeClass}">${STATUS_LABELS[primaryApp.status] || primaryApp.status}</span>
          </div>

          ${isDraft ? `
            <a href="apply.html" class="btn btn-primary" style="padding: 10px 20px; font-size: 14px;">Resume Application</a>
          ` : `
            <span style="font-size: 13.5px; color: var(--gray-600); display: block;">Undergoing verification reviews.</span>
          `}
        </div>
      </div>
    `;

    // Show/hide document center based on status
    // If application is submitted (not in received draft mode), show document center
    if (!isDraft) {
      document.getElementById('doc-center-card').style.display = 'block';
      fetchDocuments();
    } else {
      document.getElementById('doc-center-card').style.display = 'none';
    }

  } catch (err) {
    listContainer.innerHTML = `<p style="color: var(--danger);">${err.message}</p>`;
  }
}

// Fetch uploaded documents for the active application
async function fetchDocuments() {
  if (!activeApplicationId) return;
  const token = getToken();
  const tbody = document.getElementById('uploaded-docs-list');

  try {
    const res = await fetch(`${API_BASE}/documents/${activeApplicationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch documents.');
    }

    const docs = data.documents || [];

    if (docs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--gray-600); padding: 20px 0;">No documents uploaded yet.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = docs.map(doc => {
      let statusClass = 'doc-pending';
      let statusLbl = 'Pending Review';

      if (doc.status === 'accepted') {
        statusClass = 'doc-accepted';
        statusLbl = 'Accepted';
      } else if (doc.status === 'rejected') {
        statusClass = 'doc-rejected';
        statusLbl = 'Rejected';
      }

      const uploadDate = new Date(doc.uploadedAt).toLocaleDateString();

      return `
        <tr>
          <td style="font-weight: 600; color: var(--gray-900);">${DOC_TYPE_LABELS[doc.type] || doc.type}</td>
          <td style="font-family: monospace; color: var(--gray-600); font-size: 13px;">${doc.originalFilename}</td>
          <td><span class="doc-status-badge ${statusClass}">${statusLbl}</span></td>
          <td>${uploadDate}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="color: var(--danger); text-align: center;">${err.message}</td>
      </tr>
    `;
  }
}

// Handle Document Upload form submission
async function handleDocUpload(event) {
  event.preventDefault();
  if (!activeApplicationId) return;

  const token = getToken();
  const docType = document.getElementById('doc-type').value;
  const fileInput = document.getElementById('doc-file');
  const file = fileInput.files[0];
  const submitBtn = document.getElementById('btn-upload-submit');

  const alertBox = document.getElementById('doc-status-alert');
  alertBox.style.display = 'none';

  if (!docType || !file) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  // Create FormData
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', docType);

  try {
    const res = await fetch(`${API_BASE}/documents/${activeApplicationId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Do NOT set Content-Type header; browser automatically sets it for FormData with boundary
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload document.');
    }

    showDashboardAlert('File uploaded successfully! It is now pending verification review.', 'success');
    document.getElementById('doc-upload-form').reset();
    fetchDocuments(); // Refresh table

  } catch (err) {
    showDashboardAlert(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload File';
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);

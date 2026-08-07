let selectedApplicationId = null;

// Human-readable status mapping
const STATUS_LABELS = {
  'received': 'Draft / Received',
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

function showAdminAlert(text, type) {
  const alertBox = document.getElementById('admin-global-alert');
  if (!alertBox) return;
  alertBox.textContent = text;
  alertBox.className = `form-status ${type}`;
  alertBox.style.display = 'block';
  setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
}

function showModalAlert(text, type) {
  const alertBox = document.getElementById('modal-alert');
  if (!alertBox) return;
  alertBox.textContent = text;
  alertBox.className = `form-status ${type}`;
  alertBox.style.display = 'block';
  setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
}

// Check authorization on load
async function initAdminPortal() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // Double check role
  const userProfile = await checkUserProfile();
  if (!userProfile || !['admin', 'underwriter', 'loan_officer'].includes(userProfile.role)) {
    // Not authorized staff
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('staff-welcome-lbl').textContent = `Logged in as: ${userProfile.email} (${userProfile.role.toUpperCase()})`;

  // Admin specific tabs
  if (userProfile.role === 'admin') {
    document.getElementById('tab-btn-staff').style.display = 'block';
    document.getElementById('tab-btn-audit').style.display = 'block';
  }

  // Load Initial Panel Data
  showPanel('applications');
}

// Show active panel
function showPanel(panelName) {
  // Update tabs active state
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`tab-btn-${panelName}`).classList.add('active');

  // Update panels active state
  document.querySelectorAll('.admin-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.getElementById(`panel-${panelName}`).classList.add('active');

  // Load panel specific data
  if (panelName === 'applications') {
    fetchAdminStats();
    fetchApplicationsList();
  } else if (panelName === 'staff') {
    fetchStaff();
  } else if (panelName === 'audit') {
    fetchAuditLogs();
  } else if (panelName === 'messages') {
    fetchContactMessages();
  }
}

// Fetch dashboard stats
async function fetchAdminStats() {
  const token = getToken();
  try {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const stats = data.stats;
    document.getElementById('stat-today').textContent = stats.applicationsToday;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-docs').textContent = stats.documentsPending;
    document.getElementById('stat-approved').textContent = stats.approved;
  } catch (err) {
    console.error('Failed to fetch stats:', err);
  }
}

// Fetch applications list
async function fetchApplicationsList() {
  const token = getToken();
  const search = document.getElementById('app-search').value;
  const status = document.getElementById('app-filter-status').value;
  const tbody = document.getElementById('app-list-tbody');

  let url = `${API_BASE}/admin/applications?pageSize=50`;
  if (search) url += `&q=${encodeURIComponent(search)}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const apps = data.applications || [];

    if (apps.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--gray-600); padding: 24px 0;">No applications found matching criteria.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = apps.map(app => {
      const submitDate = app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'Draft';
      const fullName = `${app.firstName || ''} ${app.lastName || ''}`.trim() || 'Untitled Application';
      const location = `${app.city || ''}, ${app.state || ''}`.trim().replace(/^,\s*|,\s*$/g, '') || '-';
      
      let badgeClass = 'badge-processing';
      if (app.status === 'received') badgeClass = 'badge-received';
      else if (app.status === 'verification') badgeClass = 'badge-verification';
      else if (app.status === 'underwriting') badgeClass = 'badge-underwriting';
      else if (app.status === 'additional_documents_required') badgeClass = 'badge-action-needed';
      else if (app.status === 'approved' || app.status === 'funded') badgeClass = 'badge-approved';
      else if (app.status === 'declined') badgeClass = 'badge-declined';

      return `
        <tr>
          <td>
            <strong style="color: var(--gray-900); display: block;">${fullName}</strong>
            <span style="font-family: monospace; font-size: 11px; color: var(--gray-600);">${app.id}</span>
          </td>
          <td style="font-weight: 700; color: var(--deep-blue);">$${(app.requestedAmount || 0).toLocaleString()}</td>
          <td>${location}</td>
          <td><span class="badge ${badgeClass}">${STATUS_LABELS[app.status] || app.status}</span></td>
          <td>${submitDate}</td>
          <td>
            <button class="btn btn-primary" onclick="openModal('${app.id}')" style="padding: 6px 12px; font-size: 13px; border-radius: 6px;">Review</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color: var(--danger); text-align: center;">${err.message}</td></tr>`;
  }
}

// Open application detail modal
async function openModal(appId) {
  selectedApplicationId = appId;
  const token = getToken();
  const modal = document.getElementById('app-detail-modal');

  try {
    const res = await fetch(`${API_BASE}/admin/applications/${appId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const app = data.application;

    // Set header
    document.getElementById('modal-title').textContent = `Review: ${app.firstName || ''} ${app.lastName || ''}`;

    // Pop Personal Details
    document.getElementById('det-fullname').textContent = `${app.firstName || ''} ${app.middleName || ''} ${app.lastName || ''}`.trim() || '-';
    document.getElementById('det-dob').textContent = app.dateOfBirth || '-';
    document.getElementById('det-ssn').textContent = app.ssnMasked || '-';
    document.getElementById('det-phone').textContent = app.phone || '-';
    document.getElementById('det-dl').textContent = `${app.driverLicenseNumber || '-'} (${app.driverLicenseState || '-'})`;
    document.getElementById('det-citizen').textContent = `${app.citizenshipStatus || '-'} / ${app.maritalStatus || '-'}`;

    // Pop Address Details
    document.getElementById('det-street').textContent = app.street || '-';
    document.getElementById('det-apt').textContent = app.apartment || '-';
    document.getElementById('det-citystate').textContent = `${app.city || ''}, ${app.state || ''} ${app.zip || ''}`.trim() || '-';
    document.getElementById('det-rentown').textContent = app.residenceType || '-';
    document.getElementById('det-housingpayment').textContent = app.monthlyHousingPayment ? `$${app.monthlyHousingPayment.toLocaleString()}` : '-';
    document.getElementById('det-yearsaddress').textContent = app.yearsAtAddress || '-';

    // Pop Employment
    document.getElementById('det-employer').textContent = app.employerName || '-';
    document.getElementById('det-occupation').textContent = app.occupation || '-';
    document.getElementById('det-income').textContent = app.monthlyIncome ? `$${app.monthlyIncome.toLocaleString()}` : '-';
    document.getElementById('det-empstatus').textContent = `${app.employmentStatus || '-'} (${app.yearsEmployed || 0} years)`;
    document.getElementById('det-payfreq').textContent = app.payFrequency || '-';
    document.getElementById('det-empphone').textContent = app.employerPhone || '-';

    // Pop Bank Details
    document.getElementById('det-bankname').textContent = app.bankName || '-';
    document.getElementById('det-acctype').textContent = app.accountType || '-';
    document.getElementById('det-accnum').textContent = app.accountNumberMasked || '-';
    document.getElementById('det-depositconsent').textContent = app.directDepositConsent ? 'Authorized (Yes)' : 'Not Authorized (No)';

    // Pop Documents list
    const docsTbody = document.getElementById('modal-docs-tbody');
    const docs = app.Documents || [];

    if (docs.length === 0) {
      docsTbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--gray-600); padding: 14px 0;">No documents uploaded.</td>
        </tr>
      `;
    } else {
      docsTbody.innerHTML = docs.map(doc => {
        return `
          <tr>
            <td style="font-weight:600; color: var(--gray-900);">${DOC_TYPE_LABELS[doc.type] || doc.type}</td>
            <td style="font-family: monospace; font-size:12.5px; color: var(--gray-600);">${doc.originalFilename}</td>
            <td>
              <button class="btn btn-outline" onclick="downloadDocument('${doc.id}', '${doc.originalFilename}')" style="padding: 4px 10px; font-size: 12px; border-radius: 4px; border-color: var(--deep-blue); color: var(--deep-blue);">Download File</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Pre-pop Underwriting Panel
    document.getElementById('ctrl-risk-score').value = app.riskScore || '';
    document.getElementById('ctrl-status').value = app.status;
    document.getElementById('ctrl-note-history').value = app.internalNotes || 'No notes appended yet.';

    // Show modal
    modal.style.display = 'flex';

  } catch (err) {
    showAdminAlert(err.message, 'error');
  }
}

function closeModal() {
  document.getElementById('app-detail-modal').style.display = 'none';
  selectedApplicationId = null;
  fetchApplicationsList(); // Refresh list to reflect updates
}

// Download Document file via API using authentication header
async function downloadDocument(docId, filename) {
  const token = getToken();
  try {
    const res = await fetch(`${API_BASE}/documents/download/${docId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('File download failed. The file may be missing on disk.');
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
}

// Update risk score
async function updateRiskScore() {
  if (!selectedApplicationId) return;
  const token = getToken();
  const riskScore = parseFloat(document.getElementById('ctrl-risk-score').value);

  if (isNaN(riskScore) || riskScore < 0 || riskScore > 100) {
    showModalAlert('Please specify a risk score between 0 and 100.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/applications/${selectedApplicationId}/risk-score`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ riskScore })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showModalAlert('Risk score updated successfully!', 'success');
  } catch (err) {
    showModalAlert(err.message, 'error');
  }
}

// Update application status
async function updateApplicationStatus() {
  if (!selectedApplicationId) return;
  const token = getToken();
  const status = document.getElementById('ctrl-status').value;

  try {
    const res = await fetch(`${API_BASE}/admin/applications/${selectedApplicationId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showModalAlert('Application status updated successfully!', 'success');
  } catch (err) {
    showModalAlert(err.message, 'error');
  }
}

// Add internal note
async function addInternalNote() {
  if (!selectedApplicationId) return;
  const token = getToken();
  const noteBox = document.getElementById('ctrl-note');
  const note = noteBox.value.trim();

  if (!note) return;

  try {
    const res = await fetch(`${API_BASE}/admin/applications/${selectedApplicationId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('ctrl-note-history').value = data.internalNotes;
    noteBox.value = '';
    showModalAlert('Note appended successfully!', 'success');
  } catch (err) {
    showModalAlert(err.message, 'error');
  }
}

// Fetch staff accounts (Admin only)
async function fetchStaff() {
  const token = getToken();
  const tbody = document.getElementById('staff-list-tbody');
  try {
    const res = await fetch(`${API_BASE}/admin/staff`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const staffList = data.staff || [];

    if (staffList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No staff found.</td></tr>`;
      return;
    }

    tbody.innerHTML = staffList.map(member => {
      const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Staff';
      const statusLbl = member.isActive ? 'Active' : 'Deactivated';
      const btnText = member.isActive ? 'Deactivate' : 'Reactivate';
      const btnClass = member.isActive ? 'border-color: var(--danger); color: var(--danger);' : 'border-color: var(--success); color: var(--success);';

      return `
        <tr>
          <td><strong>${name}</strong></td>
          <td style="font-family: monospace;">${member.email}</td>
          <td><span class="badge badge-processing">${member.role.toUpperCase()}</span></td>
          <td><strong style="color: ${member.isActive ? 'var(--success)' : 'var(--danger)'};">${statusLbl}</strong></td>
          <td>
            <button class="btn btn-outline" style="padding: 4px 10px; font-size:12px; ${btnClass}" onclick="toggleStaffStatus('${member.id}', ${member.isActive})">${btnText}</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: var(--danger); text-align: center;">${err.message}</td></tr>`;
  }
}

// Handle onboarding staff submission
async function handleCreateStaff(event) {
  event.preventDefault();
  const token = getToken();

  const firstName = document.getElementById('staff-first').value;
  const lastName = document.getElementById('staff-last').value;
  const email = document.getElementById('staff-email').value;
  const role = document.getElementById('staff-role').value;
  const password = document.getElementById('staff-pass').value;

  try {
    const res = await fetch(`${API_BASE}/admin/staff`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ firstName, lastName, email, role, password })
    });
    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.errors ? data.errors.map(e => e.msg).join(', ') : (data.error || 'Failed to onboarding staff.');
      throw new Error(errMsg);
    }

    showAdminAlert(`Onboarded ${email} successfully!`, 'success');
    document.getElementById('create-staff-form').reset();
    fetchStaff();
  } catch (err) {
    showAdminAlert(err.message, 'error');
  }
}

// Deactivate / Reactivate staff account
async function toggleStaffStatus(userId, currentStatus) {
  const token = getToken();
  try {
    const res = await fetch(`${API_BASE}/admin/staff/${userId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isActive: !currentStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showAdminAlert('Staff account status toggled!', 'success');
    fetchStaff();
  } catch (err) {
    showAdminAlert(err.message, 'error');
  }
}

// Fetch system audit logs (Admin only)
async function fetchAuditLogs() {
  const token = getToken();
  const tbody = document.getElementById('audit-list-tbody');
  try {
    const res = await fetch(`${API_BASE}/admin/audit-logs?pageSize=100`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const logs = data.auditLogs || [];

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No audit logs.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(log => {
      const logDate = new Date(log.createdAt).toLocaleString();
      return `
        <tr>
          <td style="font-family: monospace; font-size:11.5px; color:var(--gray-600);">${log.actorUserId || 'system'}</td>
          <td><strong>${log.action}</strong></td>
          <td>${log.targetType} (${log.targetId})</td>
          <td style="font-family: monospace; font-size:12px;">${log.ipAddress || '-'}</td>
          <td>${logDate}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: var(--danger); text-align: center;">${err.message}</td></tr>`;
  }
}

// Fetch public contact form messages
async function fetchContactMessages() {
  const token = getToken();
  const tbody = document.getElementById('messages-list-tbody');

  try {
    const res = await fetch(`${API_BASE}/admin/contact-messages?pageSize=50`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const messages = data.messages || [];

    if (messages.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px 0;">No inquiries received.</td></tr>`;
      return;
    }

    tbody.innerHTML = messages.map(msg => {
      const name = `${msg.firstName || ''} ${msg.lastName || ''}`.trim() || 'Inquiry';
      
      let statusClass = 'doc-pending';
      let toggleBtnText = 'Resolve';
      let nextStatus = 'resolved';

      if (msg.status === 'resolved') {
        statusClass = 'doc-accepted';
        toggleBtnText = 'Mark New';
        nextStatus = 'new';
      }

      return `
        <tr>
          <td>
            <strong>${name}</strong>
            <span style="display:block; font-size:11.5px; color:var(--gray-600);">${new Date(msg.createdAt).toLocaleDateString()}</span>
          </td>
          <td>
            <a href="mailto:${msg.email}" style="color: var(--deep-blue); font-weight:500;">${msg.email}</a>
            <span style="display:block; font-size:12.5px; color:var(--gray-600);">${msg.phone || '-'}</span>
          </td>
          <td><strong style="color: var(--gray-900);">${msg.topic}</strong></td>
          <td style="max-width:320px; font-size:13.5px; color: var(--gray-600); line-height:1.5;">${msg.message}</td>
          <td>
            <span class="doc-status-badge ${statusClass}" style="display:block; text-align:center; margin-bottom: 8px;">${msg.status.toUpperCase()}</span>
            <button class="btn btn-outline" style="padding: 2px 8px; font-size:11.5px; width:100%; border-color: var(--deep-blue); color: var(--deep-blue);" onclick="toggleMessageStatus('${msg.id}', '${nextStatus}')">${toggleBtnText}</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: var(--danger); text-align: center;">${err.message}</td></tr>`;
  }
}

// Toggle inquiry message status
async function toggleMessageStatus(msgId, status) {
  const token = getToken();
  try {
    const res = await fetch(`${API_BASE}/admin/contact-messages/${msgId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showAdminAlert('Inquiry status updated!', 'success');
    fetchContactMessages();
  } catch (err) {
    showAdminAlert(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initAdminPortal);

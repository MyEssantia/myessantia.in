// notify.js - All notification functionality

// Global Variables
let allRequests = [];
let filteredRequests = [];
let currentFilter = 'all';
let currentPage = 1;
const itemsPerPage = 20;
let products = {};

// Email Template
let emailTemplate = {
  subject: 'Good news! {{product}} is now available at MyEssantia',
  body: `Hi there,\n\nGreat news! The product you were interested in is now available:\n\n✨ {{product}}\n💰 Price: ₹{{price}}\n\nClick here to view: {{productLink}}\n\nWe have limited stock available, so don't wait too long!\n\nThank you for your interest,\nMyEssantia Team`,
  cc: '',
  bcc: ''
};

// Load template from localStorage
function loadTemplate() {
  const saved = localStorage.getItem('myessantia_email_template');
  if (saved) {
    try {
      emailTemplate = JSON.parse(saved);
      const subjectEl = document.getElementById('email-subject');
      const bodyEl = document.getElementById('email-body');
      const ccEl = document.getElementById('email-cc');
      const bccEl = document.getElementById('email-bcc');
      
      if (subjectEl) subjectEl.value = emailTemplate.subject || '';
      if (bodyEl) bodyEl.value = emailTemplate.body || '';
      if (ccEl) ccEl.value = emailTemplate.cc || '';
      if (bccEl) bccEl.value = emailTemplate.bcc || '';
    } catch (e) {
      console.error('Error loading template:', e);
    }
  }
  updatePreview();
}

// Save template
window.saveTemplate = function() {
  emailTemplate = {
    subject: document.getElementById('email-subject').value,
    body: document.getElementById('email-body').value,
    cc: document.getElementById('email-cc').value,
    bcc: document.getElementById('email-bcc').value
  };
  localStorage.setItem('myessantia_email_template', JSON.stringify(emailTemplate));
  showNotification('Email template saved');
  toggleTemplatePanel();
};

// Reset template to default
window.resetTemplate = function() {
  const subjectEl = document.getElementById('email-subject');
  const bodyEl = document.getElementById('email-body');
  const ccEl = document.getElementById('email-cc');
  const bccEl = document.getElementById('email-bcc');
  
  if (subjectEl) subjectEl.value = 'Good news! {{product}} is now available at MyEssantia';
  if (bodyEl) bodyEl.value = `Hi there,

Great news! The product you were interested in is now available:

✨ {{product}}
💰 Price: ₹{{price}}

Click here to view: {{productLink}}

We have limited stock available, so don't wait too long!

Thank you for your interest,
MyEssantia Team`;
  if (ccEl) ccEl.value = '';
  if (bccEl) bccEl.value = '';
  updatePreview();
};

// Update preview with sample data
function updatePreview() {
  const subject = document.getElementById('email-subject')?.value || '';
  const body = document.getElementById('email-body')?.value || '';
  
  const previewSubject = subject
    .replace('{{product}}', 'Premium Leather Backpack')
    .replace('{{price}}', '2499')
    .replace('{{productLink}}', 'https://myessantia.com/product/123')
    .replace('{{email}}', 'user@example.com');
  
  const previewBody = body
    .replace('{{product}}', 'Premium Leather Backpack')
    .replace('{{price}}', '2499')
    .replace('{{productLink}}', 'https://myessantia.com/product/123')
    .replace('{{email}}', 'user@example.com');
  
  const previewSubjectEl = document.getElementById('preview-subject');
  const previewBodyEl = document.getElementById('preview-body');
  
  if (previewSubjectEl) previewSubjectEl.textContent = 'Subject: ' + previewSubject;
  if (previewBodyEl) previewBodyEl.textContent = previewBody;
}

// Add input listeners for preview
document.addEventListener('DOMContentLoaded', function() {
  const subjectInput = document.getElementById('email-subject');
  const bodyInput = document.getElementById('email-body');
  
  if (subjectInput) subjectInput.addEventListener('input', updatePreview);
  if (bodyInput) bodyInput.addEventListener('input', updatePreview);
});

// Toggle template panel
window.toggleTemplatePanel = function() {
  const panel = document.getElementById('emailTemplatePanel');
  if (panel) panel.classList.toggle('show');
};

// Load products for reference
async function loadProducts() {
  try {
    const snapshot = await db.collection('products').get();
    snapshot.docs.forEach(doc => {
      products[doc.id] = {
        title: doc.data().title,
        price: doc.data().price,
        primaryImg: doc.data().primaryImg || (doc.data().media?.[0]?.url) || 'https://via.placeholder.com/300/f0f0f0/999999?text=no+image',
        category: doc.data().category
      };
    });
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

// Load notifications from Firestore
async function loadNotifications() {
  try {
    const loadingEl = document.getElementById('loading');
    const tableWrapper = document.getElementById('table-wrapper');
    const mobileCards = document.getElementById('mobile-cards');
    const emptyState = document.getElementById('empty-state');
    
    if (loadingEl) loadingEl.style.display = 'flex';
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (mobileCards) mobileCards.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';

    const snapshot = await db.collection('notifications')
      .orderBy('timestamp', 'desc')
      .get();

    allRequests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(doc.data().timestamp)
    }));

    await loadProducts();
    applyFilter(currentFilter);
    updateStats();
    
    if (loadingEl) loadingEl.style.display = 'none';
    
    if (filteredRequests.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
    } else {
      if (tableWrapper) tableWrapper.style.display = 'block';
      if (mobileCards) mobileCards.style.display = 'block';
      renderRequests();
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
    showNotification('Failed to load notifications', 'error');
    const loadingEl = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
  }
}

// Filter requests
window.filterRequests = function(filter) {
  currentFilter = filter;
  currentPage = 1;
  
  document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
  const activeTab = document.getElementById(`filter-${filter}`);
  if (activeTab) activeTab.classList.add('active');
  
  applyFilter(filter);
  renderRequests();
};

function applyFilter(filter) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  filteredRequests = allRequests.filter(req => {
    switch(filter) {
      case 'pending':
        return req.status === 'pending' || !req.status;
      case 'notified':
        return req.status === 'notified';
      case 'today':
        return req.timestamp && req.timestamp >= today;
      default:
        return true;
    }
  });
}

// Search functionality
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search-requests');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      
      if (!searchTerm) {
        applyFilter(currentFilter);
      } else {
        filteredRequests = allRequests.filter(req => {
          const product = products[req.productId] || { title: 'Unknown Product' };
          return req.email?.toLowerCase().includes(searchTerm) ||
                 product.title?.toLowerCase().includes(searchTerm) ||
                 req.productId?.toLowerCase().includes(searchTerm);
        });
      }
      
      currentPage = 1;
      renderRequests();
    });
  }
});

// Update statistics
function updateStats() {
  const total = allRequests.length;
  const pending = allRequests.filter(r => r.status === 'pending' || !r.status).length;
  const notified = allRequests.filter(r => r.status === 'notified').length;
  const uniqueProducts = new Set(allRequests.map(r => r.productId)).size;

  const totalEl = document.getElementById('total-requests');
  const pendingEl = document.getElementById('pending-requests');
  const notifiedEl = document.getElementById('notified-requests');
  const uniqueEl = document.getElementById('unique-products');
  
  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (notifiedEl) notifiedEl.textContent = notified;
  if (uniqueEl) uniqueEl.textContent = uniqueProducts;
}

// Render requests
function renderRequests() {
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageRequests = filteredRequests.slice(start, end);
  
  const tableWrapper = document.getElementById('table-wrapper');
  const mobileCards = document.getElementById('mobile-cards');
  const emptyState = document.getElementById('empty-state');
  const pagination = document.getElementById('pagination');
  
  if (pageRequests.length === 0) {
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (mobileCards) mobileCards.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    if (pagination) pagination.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (tableWrapper) tableWrapper.style.display = 'block';
  if (mobileCards) mobileCards.style.display = 'block';
  if (pagination) pagination.style.display = filteredRequests.length > itemsPerPage ? 'flex' : 'none';
  
  // Render table rows
  const tableBody = document.getElementById('table-body');
  if (tableBody) {
    tableBody.innerHTML = pageRequests.map(req => {
      const product = products[req.productId] || { 
        title: 'Unknown Product', 
        price: 0,
        primaryImg: 'https://via.placeholder.com/300/f0f0f0/999999?text=no+image' 
      };
      
      const status = req.status || 'pending';
      const statusClass = status === 'pending' ? 'pending' : status === 'notified' ? 'notified' : 'expired';
      
      const date = req.timestamp ? new Date(req.timestamp) : new Date();
      const formattedDate = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const formattedTime = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="product-thumb" style="background-image: url('${product.primaryImg}');"></div>
              <div class="product-info">
                <span class="product-title">${product.title}</span>
                <span class="product-id">${req.productId?.substring(0, 8)}...</span>
              </div>
            </div>
          </td>
          <td>
            <div class="user-email">
              <i class="fa-regular fa-envelope"></i>
              ${req.email}
            </div>
          </td>
          <td>
            <span style="text-transform: uppercase; font-weight: 600; background: #f0f0f0; padding: 4px 12px; border-radius: 40px; border: 1px solid #000;">
              ${req.actionType || 'buy'}
            </span>
          </td>
          <td>
            <span class="status-badge ${statusClass}">
              <i class="fa-solid ${status === 'pending' ? 'fa-clock' : status === 'notified' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i>
              ${status}
            </span>
          </td>
          <td>
            <div class="timestamp">
              <span class="date">${formattedDate}</span>
              <span class="time">${formattedTime}</span>
            </div>
          </td>
          <td>
            <span style="font-family: monospace; font-size: 0.75rem;">${req.productId}</span>
          </td>
          <td>
            <div class="action-btns">
              <button class="action-btn email-btn" onclick="sendEmail('${req.id}')" title="Send email" ${status === 'notified' ? 'disabled' : ''}>
                <i class="fa-solid fa-envelope"></i>
              </button>
              <button class="action-btn" onclick="markAsNotified('${req.id}')" title="Mark as notified" ${status === 'notified' ? 'disabled' : ''}>
                <i class="fa-solid fa-check"></i>
              </button>
              <button class="action-btn" onclick="viewProduct('${req.productId}')" title="View product">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button class="action-btn" onclick="copyEmail('${req.email}')" title="Copy email">
                <i class="fa-regular fa-copy"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Render mobile cards
  const mobileCardsEl = document.getElementById('mobile-cards');
  if (mobileCardsEl) {
    mobileCardsEl.innerHTML = pageRequests.map(req => {
      const product = products[req.productId] || { 
        title: 'Unknown Product', 
        price: 0,
        primaryImg: 'https://via.placeholder.com/300/f0f0f0/999999?text=no+image' 
      };
      
      const status = req.status || 'pending';
      const statusClass = status === 'pending' ? 'pending' : status === 'notified' ? 'notified' : 'expired';
      
      const date = req.timestamp ? new Date(req.timestamp) : new Date();
      const formattedDate = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const formattedTime = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="notification-card">
          <div class="card-header">
            <div class="card-thumb" style="background-image: url('${product.primaryImg}');"></div>
            <div class="card-title">
              <h4>${product.title}</h4>
              <span class="product-id">${req.productId?.substring(0, 12)}...</span>
            </div>
          </div>
          <div class="card-body">
            <div class="card-row">
              <i class="fa-regular fa-envelope"></i>
              <span>${req.email}</span>
            </div>
            <div class="card-row">
              <i class="fa-solid fa-bolt"></i>
              <span>Action: <strong>${req.actionType || 'buy'}</strong></span>
            </div>
            <div class="card-row">
              <i class="fa-regular fa-calendar"></i>
              <span>${formattedDate} at ${formattedTime}</span>
            </div>
            <div class="card-row">
              <i class="fa-regular fa-circle-check"></i>
              <span>Status: </span>
              <span class="status-badge ${statusClass}" style="margin-left: 0;">
                ${status}
              </span>
            </div>
          </div>
          <div class="card-footer">
            <span style="font-family: monospace; font-size: 0.7rem;">ID: ${req.id.substring(0, 8)}</span>
            <div class="card-actions">
              <button class="action-btn email-btn" onclick="sendEmail('${req.id}')" title="Send email" ${status === 'notified' ? 'disabled' : ''}>
                <i class="fa-solid fa-envelope"></i>
              </button>
              <button class="action-btn" onclick="markAsNotified('${req.id}')" title="Mark as notified" ${status === 'notified' ? 'disabled' : ''}>
                <i class="fa-solid fa-check"></i>
              </button>
              <button class="action-btn" onclick="viewProduct('${req.productId}')" title="View product">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button class="action-btn" onclick="copyEmail('${req.email}')" title="Copy email">
                <i class="fa-regular fa-copy"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  updatePagination();
}

// Send email function using mailto
window.sendEmail = function(requestId) {
  const request = allRequests.find(r => r.id === requestId);
  if (!request) return;
  
  const product = products[request.productId] || { title: 'Unknown Product', price: 0 };
  
  const subject = document.getElementById('email-subject')?.value || emailTemplate.subject;
  const body = document.getElementById('email-body')?.value || emailTemplate.body;
  const cc = document.getElementById('email-cc')?.value || '';
  const bcc = document.getElementById('email-bcc')?.value || '';
  
  const processedSubject = subject
    .replace('{{product}}', product.title)
    .replace('{{price}}', product.price)
    .replace('{{productLink}}', `${window.location.origin}/product.html?id=${request.productId}`)
    .replace('{{email}}', request.email);
  
  const processedBody = body
    .replace('{{product}}', product.title)
    .replace('{{price}}', product.price)
    .replace('{{productLink}}', `${window.location.origin}/product.html?id=${request.productId}`)
    .replace('{{email}}', request.email);
  
  let mailtoLink = `mailto:${request.email}`;
  const params = [];
  
  if (cc) params.push(`cc=${encodeURIComponent(cc)}`);
  if (bcc) params.push(`bcc=${encodeURIComponent(bcc)}`);
  params.push(`subject=${encodeURIComponent(processedSubject)}`);
  params.push(`body=${encodeURIComponent(processedBody)}`);
  
  if (params.length > 0) {
    mailtoLink += '?' + params.join('&');
  }
  
  window.location.href = mailtoLink;
  
  setTimeout(() => {
    if (confirm('Email client opened. Mark this request as notified?')) {
      markAsNotified(requestId);
    }
  }, 1000);
};

// Send bulk emails to all pending
window.sendBulkEmails = function() {
  const pendingRequests = filteredRequests.filter(r => r.status !== 'notified');
  
  if (pendingRequests.length === 0) {
    showNotification('No pending requests to email', 'error');
    return;
  }
  
  if (pendingRequests.length === 1) {
    sendEmail(pendingRequests[0].id);
    return;
  }
  
  const choice = confirm(
    `You have ${pendingRequests.length} pending requests.\n\n` +
    `Choose OK to open separate emails for each (will open ${pendingRequests.length} tabs/windows)\n` +
    `Choose Cancel to copy all emails to clipboard for manual sending`
  );
  
  if (choice) {
    pendingRequests.forEach((req, index) => {
      setTimeout(() => {
        sendEmail(req.id);
      }, index * 1500);
    });
    showNotification(`Opening ${pendingRequests.length} email windows...`);
  } else {
    const emails = pendingRequests.map(r => r.email).join(', ');
    navigator.clipboard.writeText(emails);
    showNotification('Emails copied to clipboard');
  }
};

// Pagination
function updatePagination() {
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const pagination = document.getElementById('pagination');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageNumbers = document.getElementById('page-numbers');
  
  if (totalPages <= 1) {
    if (pagination) pagination.style.display = 'none';
    return;
  }

  if (pagination) pagination.style.display = 'flex';
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages;

  let pageNumbersHTML = '';
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  for (let i = startPage; i <= endPage; i++) {
    pageNumbersHTML += `
      <button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">
        ${i}
      </button>
    `;
  }

  if (pageNumbers) pageNumbers.innerHTML = pageNumbersHTML;
}

window.changePage = function(direction) {
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  
  if (direction === 'prev' && currentPage > 1) {
    currentPage--;
  } else if (direction === 'next' && currentPage < totalPages) {
    currentPage++;
  }
  
  renderRequests();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.goToPage = function(page) {
  currentPage = page;
  renderRequests();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Mark notification as notified
window.markAsNotified = async function(notificationId) {
  try {
    await db.collection('notifications').doc(notificationId).update({
      status: 'notified',
      notifiedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showNotification('Marked as notified');
    loadNotifications();
  } catch (error) {
    console.error('Error updating notification:', error);
    showNotification('Failed to update status', 'error');
  }
};

// View product in new tab
window.viewProduct = function(productId) {
  window.open(`product.html?id=${productId}`, '_blank');
};

// Copy email to clipboard
window.copyEmail = function(email) {
  navigator.clipboard.writeText(email);
  showNotification('Email copied to clipboard');
};

// Export to CSV
window.exportRequests = function() {
  const data = filteredRequests.map(req => {
    const product = products[req.productId] || { title: 'Unknown Product', price: 0 };
    const date = req.timestamp ? new Date(req.timestamp) : new Date();
    
    return {
      'Email': req.email,
      'Product ID': req.productId,
      'Product Title': product.title,
      'Product Price': product.price,
      'Action Type': req.actionType || 'buy',
      'Status': req.status || 'pending',
      'Requested Date': date.toLocaleDateString('en-IN'),
      'Requested Time': date.toLocaleTimeString('en-IN'),
      'Notification ID': req.id
    };
  });

  const csv = convertToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notification_requests_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  showNotification('Exported to CSV');
};

function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]?.toString() || '';
      return `"${value.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Show notification
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Initialize when notify page is loaded
document.addEventListener('DOMContentLoaded', function() {
  loadTemplate();
  loadNotifications();
  
  // Set up real-time listener
  db.collection('notifications')
    .orderBy('timestamp', 'desc')
    .onSnapshot(() => {
      loadNotifications();
    });
});

// admin_dashboard.js

// ============================================
// AUTH & SESSION MANAGEMENT
// ============================================

async function verifyAuth() {
    try {
        const response = await fetch('/api/verify-auth', { credentials: 'include' });
        if (response.status === 401 || !response.ok) {
            window.location.replace('/');
            return false;
        }
        const data = await response.json();
        if (!data.authenticated || data.role !== 'admin') {
            window.location.replace('/');
            return false;
        }
        return true;
    } catch (error) {
        window.location.replace('/');
        return false;
    }
}

// Run auth check on load
verifyAuth();

// Auto-logout timer
let autoLogoutTimer;
function startAutoLogoutCheck() {
    if (autoLogoutTimer) clearInterval(autoLogoutTimer);
    autoLogoutTimer = setInterval(async () => {
        try {
            const response = await fetch('/api/check-session', { credentials: 'include' });
            if (response.status === 401 || !response.ok) {
                clearInterval(autoLogoutTimer);
                alert('Your session has expired. Please login again.');
                window.location.replace('/logout');
            } else {
                const data = await response.json();
                if (!data.valid) {
                    clearInterval(autoLogoutTimer);
                    alert('Your session has expired. Please login again.');
                    window.location.replace('/logout');
                }
            }
        } catch (error) {
            clearInterval(autoLogoutTimer);
            window.location.replace('/logout');
        }
    }, 2000);
}
startAutoLogoutCheck();

// Prevent back button
window.history.pushState(null, '', window.location.href);
window.addEventListener('popstate', function() {
    window.history.pushState(null, '', window.location.href);
    if (confirm('Are you sure you want to leave the admin dashboard?')) {
        window.location.href = '/logout';
    }
});

// Prevent caching
window.onpageshow = function(event) {
    if (event.persisted) {
        verifyAuth().then(isValid => {
            if (!isValid) window.location.replace('/');
        });
    }
};

// ============================================
// SIDEBAR NAVIGATION
// ============================================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page-section').forEach(page => {
        page.classList.remove('active');
    });

    // Remove active from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected page
    document.getElementById(pageId).classList.add('active');

    // Add active to clicked nav item
    event.currentTarget.classList.add('active');

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        toggleSidebar();
    }

    // Load headings when switching to manage-content
    if (pageId === 'manage-content') {
        loadHeadings();
    }
}

// ============================================
// GUEST ACCESS TOGGLE - FIXED VERSION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const guestToggle = document.getElementById('guestToggle');
    if (guestToggle) {
        guestToggle.addEventListener('change', async (e) => {
            try {
                const response = await fetch('/admin/toggle-guest-access', {
                    method: 'POST',
                    credentials: 'include'
                });
                const data = await response.json();

                const statusText = document.getElementById('statusText');
                statusText.textContent = data.enabled ? 'Enabled' : 'Disabled';
                statusText.className = 'toggle-status ' + (data.enabled ? 'enabled' : 'disabled');

                // UPDATE STATISTICS CARD TOO
                updateGuestAccessStats(data.enabled);
            } catch (error) {
                console.error('Toggle failed:', error);
                alert('Failed to toggle guest access');
                e.target.checked = !e.target.checked;
            }
        });
    }

    // Load headings on initial page load
    loadHeadings();
});

// Update guest access statistics in real-time
function updateGuestAccessStats(enabled) {
    const statsCards = document.querySelectorAll('.control-card');
    if (statsCards.length > 1) {
        const statsContent = statsCards[1].querySelector('div[style*="display: grid"]');
        if (statsContent) {
            const guestAccessDiv = statsContent.children[1];
            if (guestAccessDiv) {
                const statusDiv = guestAccessDiv.querySelector('div[style*="font-size: 1.8rem"]');
                if (statusDiv) {
                    statusDiv.textContent = enabled ? 'ON' : 'OFF';
                    statusDiv.style.color = enabled ? '#44ff44' : '#ff4444';
                }
            }
        }
    }
}

// ============================================
// PASSWORD MANAGEMENT
// ============================================

function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    const button = field.parentElement.querySelector('.toggle-password');

    if (field.type === 'password') {
        field.type = 'text';
        button.textContent = '🙈';
    } else {
        field.type = 'password';
        button.textContent = '👁️';
    }
}

async function changePassword(e) {
    e.preventDefault();

    const errorMsg = document.getElementById('errorMessage');
    const successMsg = document.getElementById('successMessage');
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const confirmCheckbox = document.getElementById('confirmCheckbox').checked;

    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    if (newPassword !== confirmPassword) {
        errorMsg.textContent = 'New passwords do not match!';
        errorMsg.style.display = 'block';
        return;
    }

    if (!confirmCheckbox) {
        errorMsg.textContent = 'You must confirm by checking the box!';
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const formData = new FormData();
        formData.append('current_password', currentPassword);
        formData.append('new_password', newPassword);
        formData.append('confirm_checkbox', confirmCheckbox ? 'true' : 'false');

        const response = await fetch('/admin/change-password', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            successMsg.textContent = data.message;
            successMsg.style.display = 'block';
            document.getElementById('passwordForm').reset();
            setTimeout(() => {
                window.location.href = '/logout';
            }, 3000);
        } else {
            errorMsg.textContent = data.error || 'Failed to change password';
            errorMsg.style.display = 'block';
        }
    } catch (error) {
        errorMsg.textContent = 'An error occurred. Please try again.';
        errorMsg.style.display = 'block';
    }
}

// ============================================
// LOGOUT
// ============================================

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/logout';
    }
}

// ============================================
// CREATE CONTENT SYSTEM
// ============================================

let selectedContentType = null;

// Show create options popup
function showCreateOptions() {
    document.getElementById('createOptionsOverlay').classList.add('active');
}

// Show confirmation popup with specific message
function showConfirmation(type) {
    selectedContentType = type;
    closePopup('createOptionsOverlay');

    const messages = {
        'heading': 'Are you sure you want to create a Heading?',
        'subheading': 'Are you sure you want to create a Sub Heading?',
        'smallheading': 'Are you sure you want to create a Small Heading?'
    };

    document.getElementById('confirmationMessage').textContent = messages[type];
    document.getElementById('confirmationOverlay').classList.add('active');
}

async function confirmCreate() {
    closePopup('confirmationOverlay');

    // Set current date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    if (selectedContentType === 'heading') {
        // Reset form FIRST
        const form = document.getElementById('headingFormMain');
        form.reset();

        // THEN set values
        document.getElementById('dateCreatedHeading').value = dateStr;
        document.getElementById('timeCreatedHeading').value = timeStr;
        form.querySelector('input[name="visibility"][value="public"]').checked = true;

        document.getElementById('formErrorHeading').style.display = 'none';
        document.getElementById('formSuccessHeading').style.display = 'none';
        document.getElementById('formOverlayHeading').classList.add('active');

    } else if (selectedContentType === 'subheading') {
        // Reset form FIRST
        const form = document.getElementById('subheadingFormMain');
        form.reset();

        // Load parent headings
        await loadParentHeadings();

        // THEN set values
        document.getElementById('dateCreatedSubheading').value = dateStr;
        document.getElementById('timeCreatedSubheading').value = timeStr;
        document.getElementById('subheadingNumber').value = '';
        form.querySelector('input[name="visibility"][value="public"]').checked = true;

        document.getElementById('formErrorSubheading').style.display = 'none';
        document.getElementById('formSuccessSubheading').style.display = 'none';
        document.getElementById('formOverlaySubheading').classList.add('active');

    } else if (selectedContentType === 'smallheading') {
        const form = document.getElementById('smallheadingFormMain');
        form.reset();

        await loadHeadingsForSmallHeading();

        document.getElementById('dateCreatedSmallheading').value = dateStr;
        document.getElementById('timeCreatedSmallheading').value = timeStr;
        document.getElementById('smallHeadingNumber').value = '';
        form.querySelector('input[name="visibility"][value="public"]').checked = true;

        document.getElementById('formErrorSmallheading').style.display = 'none';
        document.getElementById('formSuccessSmallheading').style.display = 'none';
        document.getElementById('formOverlaySmallheading').classList.add('active');
    }
}

// Load parent headings for dropdown
async function loadParentHeadings() {
    try {
        const response = await fetch('/api/headings/list', {
            credentials: 'include'
        });
        const data = await response.json();

        const select = document.getElementById('parentHeadingSelect');
        select.innerHTML = '<option value="">-- Select a heading --</option>';

        if (data.success && data.headings.length > 0) {
            data.headings.forEach(heading => {
                const option = document.createElement('option');
                option.value = heading.id;
                option.textContent = heading.name;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">-- No headings available --</option>';
        }
    } catch (error) {
        console.error('Failed to load headings:', error);
    }
}

// Update subheading number when parent is selected
async function updateSubheadingNumber() {
    const parentId = document.getElementById('parentHeadingSelect').value;
    if (!parentId) {
        document.getElementById('subheadingNumber').value = '';
        return;
    }

    try {
        const response = await fetch(`/api/subheading/next-number/${parentId}`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('subheadingNumber').value = data.next_number;
        }
    } catch (error) {
        console.error('Failed to get subheading number:', error);
    }
}

// Submit heading form (works for all types)
async function submitHeading(e) {
    e.preventDefault();

    const formId = e.target.id;
    let errorMsgId, successMsgId;

    if (formId === 'headingFormMain') {
        errorMsgId = 'formErrorHeading';
        successMsgId = 'formSuccessHeading';
    } else if (formId === 'subheadingFormMain') {
        errorMsgId = 'formErrorSubheading';
        successMsgId = 'formSuccessSubheading';
    } else if (formId === 'smallheadingFormMain') {
        errorMsgId = 'formErrorSmallheading';
        successMsgId = 'formSuccessSmallheading';
    }

    const errorMsg = document.getElementById(errorMsgId);
    const successMsg = document.getElementById(successMsgId);

    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    try {
        const formData = new FormData(e.target);

        const response = await fetch('/admin/heading/create', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            successMsg.textContent = data.message;
            successMsg.style.display = 'block';

            // Reset form
            e.target.reset();

            // Reload headings
            loadHeadings();

            // Close after 2 seconds
            setTimeout(() => {
                if (formId === 'headingFormMain') {
                    closePopup('formOverlayHeading');
                } else if (formId === 'subheadingFormMain') {
                    closePopup('formOverlaySubheading');
                } else if (formId === 'smallheadingFormMain') {
                    closePopup('formOverlaySmallheading');
                }
            }, 2000);
        } else {
            errorMsg.textContent = data.error || 'Failed to create';
            errorMsg.style.display = 'block';
        }
    } catch (error) {
        errorMsg.textContent = 'An error occurred. Please try again.';
        errorMsg.style.display = 'block';
    }
}

// Close popup by ID
function closePopup(popupId) {
    document.getElementById(popupId).classList.remove('active');
}

// Close popups on ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.popup-overlay.active').forEach(popup => {
            popup.classList.remove('active');
        });
    }
});

// ============================================
// LOAD AND DISPLAY HEADINGS
// ============================================

async function loadHeadings() {
    try {
        const response = await fetch('/api/headings', {
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Failed to fetch headings:', response.status);
            document.getElementById('headingsContainer').innerHTML = '';
            document.getElementById('noHeadingsPlaceholder').style.display = 'block';
            return;
        }

        const data = await response.json();

        if (data.success && data.headings.length > 0) {
            displayHeadings(data.headings);
        } else {
            document.getElementById('headingsContainer').innerHTML = '';
            document.getElementById('noHeadingsPlaceholder').style.display = 'block';
        }
    } catch (error) {
        console.error('Failed to load headings:', error);
        document.getElementById('headingsContainer').innerHTML = '';
        document.getElementById('noHeadingsPlaceholder').style.display = 'block';
    }
}

function displayHeadings(headings) {
    const container = document.getElementById('headingsContainer');
    document.getElementById('noHeadingsPlaceholder').style.display = 'none';

    // Group by type
    const mainHeadings = headings.filter(h => h.heading_type === 'heading');
    const subheadings = headings.filter(h => h.heading_type === 'subheading');
    const smallheadings = headings.filter(h => h.heading_type === 'smallheading');

    let html = '';

    mainHeadings.forEach(heading => {
        // Display main heading
        html += `
            <div class="heading-card">
                <div class="heading-card-header">
                    <span class="heading-type-badge heading">HEADING</span>
                    <div class="heading-badges">
                        <span class="heading-visibility ${heading.visibility}">${heading.visibility.toUpperCase()}</span>
                        <button class="btn-more" onclick="showDetails(${heading.id}, 'heading', '${heading.heading_name}', '${heading.created_at}')">⋮</button>
                    </div>
                </div>

                <h3 class="heading-card-title">${heading.heading_name}</h3>

                <div class="heading-card-meta">
                    <div class="heading-meta-item">
                        <span class="heading-meta-icon">📅</span>
                        <span>${heading.created_at}</span>
                    </div>
                    ${heading.tags ? `
                    <div class="heading-meta-item">
                        <span class="heading-meta-icon">🏷️</span>
                        <span class="heading-tag">${heading.tags}</span>
                    </div>
                    ` : ''}
                </div>
        `;

        // Display subheadings under this heading
        const childSubheadings = subheadings.filter(sh => sh.parent_heading_id === heading.id);
        if (childSubheadings.length > 0) {
            html += '<div class="subheadings-list">';

            childSubheadings.forEach(subheading => {
                html += `
                    <div class="subheading-item">
                        <div class="subheading-header">
                            <span class="subheading-number">${subheading.subheading_number})</span>
                            <span class="subheading-name">${subheading.heading_name}</span>
                            <div class="subheading-badges">
                                <span class="heading-visibility ${subheading.visibility}">${subheading.visibility.toUpperCase()}</span>
                                <button class="btn-more" onclick="showDetails(${subheading.id}, 'subheading', '${subheading.heading_name}', '${subheading.created_at}')">⋮</button>
                            </div>
                        </div>
                `;

                // Display small headings UNDER this specific subheading
                const childSmallHeadings = smallheadings.filter(smh => smh.parent_heading_id === subheading.id);
                if (childSmallHeadings.length > 0) {
                    html += '<div class="smallheadings-list">';
                    childSmallHeadings.forEach(smallheading => {
                        html += `
                            <div class="smallheading-item">
                                <div class="smallheading-content">
                                    <span class="smallheading-number">${smallheading.subheading_number})</span>
                                    <span class="smallheading-name">${smallheading.heading_name}</span>
                                </div>
                                <div class="smallheading-badges">
                                    <span class="heading-visibility ${smallheading.visibility}">${smallheading.visibility.toUpperCase()}</span>
                                    <button class="btn-more" onclick="showDetails(${smallheading.id}, 'smallheading', '${smallheading.heading_name}', '${smallheading.created_at}')">⋮</button>
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>'; // Close smallheadings-list
                }

                html += '</div>'; // Close subheading-item
            });

            html += '</div>'; // Close subheadings-list
        }

        html += '</div>'; // Close heading-card
    });

    container.innerHTML = html;
}

// Show details popup
function showDetails(id, type, name, createdAt) {
    // Parse the date string (format: "January 28, 2026 11:07 PM")
    const parts = createdAt.split(' ');
    const datePart = `${parts[0]} ${parts[1]} ${parts[2]}`; // "January 28, 2026"
    const timePart = `${parts[3]} ${parts[4]}`; // "11:07 PM"

    // Update popup title
    const titleMap = {
        'heading': 'Heading Details',
        'subheading': 'Sub Heading Details',
        'smallheading': 'Small Heading Details'
    };
    document.getElementById('detailsPopupTitle').textContent = titleMap[type];

    // Update date and time
    document.getElementById('detailsDate').textContent = datePart;
    document.getElementById('detailsTime').textContent = timePart;

    // Update button actions
    document.getElementById('detailsEditBtn').onclick = () => {
        closePopup('detailsOverlay');
        editHeading(id);
    };
    document.getElementById('detailsDeleteBtn').onclick = () => {
        closePopup('detailsOverlay');
        deleteHeading(id);
    };

    // Show popup
    document.getElementById('detailsOverlay').classList.add('active');
}





function editHeading(id) {
    alert('Edit feature coming soon! Heading ID: ' + id);
}

async function deleteHeading(id) {
    if (!confirm('Are you sure you want to delete this heading?')) return;

    alert('Delete feature coming soon! Heading ID: ' + id);
    // TODO: Implement delete endpoint
}

// ============================================
// SMALL HEADING FUNCTIONS
// ============================================

// Load headings for small heading form
async function loadHeadingsForSmallHeading() {
    try {
        const response = await fetch('/api/headings/list', {
            credentials: 'include'
        });
        const data = await response.json();

        const select = document.getElementById('smallHeadingParentSelect');
        select.innerHTML = '<option value="">-- Select a heading --</option>';

        if (data.success && data.headings.length > 0) {
            data.headings.forEach(heading => {
                const option = document.createElement('option');
                option.value = heading.id;
                option.textContent = heading.name;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">-- No headings available --</option>';
        }

        // Clear subheading dropdown
        document.getElementById('smallHeadingSubheadingSelect').innerHTML = '<option value="">-- Select a heading first --</option>';
        document.getElementById('smallHeadingNumber').value = '';
    } catch (error) {
        console.error('Failed to load headings:', error);
    }
}

// Load subheadings when heading is selected
async function loadSubheadingsForSmallHeading() {
    const headingId = document.getElementById('smallHeadingParentSelect').value;
    const subheadingSelect = document.getElementById('smallHeadingSubheadingSelect');

    if (!headingId) {
        subheadingSelect.innerHTML = '<option value="">-- Select a heading first --</option>';
        document.getElementById('smallHeadingNumber').value = '';
        return;
    }

    try {
        const response = await fetch(`/api/subheadings/by-heading/${headingId}`, {
            credentials: 'include'
        });
        const data = await response.json();

        subheadingSelect.innerHTML = '<option value="">-- Select a sub heading --</option>';

        if (data.success && data.subheadings.length > 0) {
            data.subheadings.forEach(subheading => {
                const option = document.createElement('option');
                option.value = subheading.id;
                option.textContent = subheading.name;
                subheadingSelect.appendChild(option);
            });
        } else {
            subheadingSelect.innerHTML = '<option value="">-- No sub headings available --</option>';
        }

        // Clear small heading number
        document.getElementById('smallHeadingNumber').value = '';
    } catch (error) {
        console.error('Failed to load subheadings:', error);
    }
}

// Update small heading number when subheading is selected
async function updateSmallHeadingNumber() {
    const subheadingId = document.getElementById('smallHeadingSubheadingSelect').value;
    if (!subheadingId) {
        document.getElementById('smallHeadingNumber').value = '';
        return;
    }

    try {
        const response = await fetch(`/api/smallheading/next-number/${subheadingId}`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('smallHeadingNumber').value = data.next_number;
        }
    } catch (error) {
        console.error('Failed to get small heading number:', error);
    }
}

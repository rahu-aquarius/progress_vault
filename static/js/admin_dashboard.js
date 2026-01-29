// admin_dashboard.js

// ============================================
// CUSTOM ALERT & CONFIRM SYSTEM
// ============================================

let alertResolve = null;

function customAlert(message, title = 'Alert', type = 'info') {
    return new Promise((resolve) => {
        alertResolve = resolve;

        const overlay = document.getElementById('customAlertOverlay');
        const icon = document.getElementById('customAlertIcon');
        const titleEl = document.getElementById('customAlertTitle');
        const messageEl = document.getElementById('customAlertMessage');
        const actionsEl = document.getElementById('customAlertActions');

        titleEl.textContent = title;
        messageEl.textContent = message;

        icon.className = 'custom-alert-icon ' + type;
        const icons = {
            'info': 'ℹ️',
            'warning': '⚠️',
            'error': '❌',
            'success': '✅'
        };
        icon.textContent = icons[type] || icons['info'];

        actionsEl.innerHTML = '<button class="custom-alert-btn custom-alert-btn-confirm" onclick="closeCustomAlert()">OK</button>';

        overlay.classList.add('active');
    });
}

function customConfirm(message, title = 'Confirm', type = 'warning') {
    return new Promise((resolve) => {
        alertResolve = resolve;

        const overlay = document.getElementById('customAlertOverlay');
        const icon = document.getElementById('customAlertIcon');
        const titleEl = document.getElementById('customAlertTitle');
        const messageEl = document.getElementById('customAlertMessage');
        const actionsEl = document.getElementById('customAlertActions');

        titleEl.textContent = title;
        messageEl.textContent = message;

        icon.className = 'custom-alert-icon ' + type;
        const icons = {
            'info': 'ℹ️',
            'warning': '⚠️',
            'error': '❌',
            'success': '✅'
        };
        icon.textContent = icons[type] || icons['info'];

        if (type === 'error' || message.toLowerCase().includes('delete')) {
            actionsEl.innerHTML = `
                <button class="custom-alert-btn custom-alert-btn-cancel" onclick="closeCustomAlert(false)">Cancel</button>
                <button class="custom-alert-btn custom-alert-btn-delete" onclick="closeCustomAlert(true)">Delete</button>
            `;
        } else {
            actionsEl.innerHTML = `
                <button class="custom-alert-btn custom-alert-btn-cancel" onclick="closeCustomAlert(false)">No</button>
                <button class="custom-alert-btn custom-alert-btn-confirm" onclick="closeCustomAlert(true)">Yes</button>
            `;
        }

        overlay.classList.add('active');
    });
}

function closeCustomAlert(result = true) {
    const overlay = document.getElementById('customAlertOverlay');
    overlay.classList.remove('active');

    if (alertResolve) {
        alertResolve(result);
        alertResolve = null;
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('customAlertOverlay');
        if (overlay && overlay.classList.contains('active')) {
            closeCustomAlert(false);
        }
    }
});

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

verifyAuth();

let autoLogoutTimer;
function startAutoLogoutCheck() {
    if (autoLogoutTimer) clearInterval(autoLogoutTimer);
    autoLogoutTimer = setInterval(async () => {
        try {
            const response = await fetch('/api/check-session', { credentials: 'include' });
            if (response.status === 401 || !response.ok) {
                clearInterval(autoLogoutTimer);
                await customAlert('Your session has expired. Please login again.', 'Session Expired', 'warning');
                window.location.replace('/logout');
            } else {
                const data = await response.json();
                if (!data.valid) {
                    clearInterval(autoLogoutTimer);
                    await customAlert('Your session has expired. Please login again.', 'Session Expired', 'warning');
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

window.history.pushState(null, '', window.location.href);
window.addEventListener('popstate', async function() {
    window.history.pushState(null, '', window.location.href);
    if (await customConfirm('Are you sure you want to leave the admin dashboard?', 'Leave Dashboard?', 'warning')) {
        window.location.href = '/logout';
    }
});

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
    document.querySelectorAll('.page-section').forEach(page => {
        page.classList.remove('active');
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    document.getElementById(pageId).classList.add('active');
    event.currentTarget.classList.add('active');

    if (window.innerWidth <= 768) {
        toggleSidebar();
    }

    if (pageId === 'manage-content') {
        loadHeadings();
    }
}

// ============================================
// GUEST ACCESS TOGGLE
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

                updateGuestAccessStats(data.enabled);
            } catch (error) {
                console.error('Toggle failed:', error);
                await customAlert('Failed to toggle guest access', 'Error', 'error');
                e.target.checked = !e.target.checked;
            }
        });
    }

    loadHeadings();
});

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

async function logout() {
    if (await customConfirm('Are you sure you want to logout?', 'Logout?', 'warning')) {
        window.location.href = '/logout';
    }
}

// ============================================
// CREATE CONTENT SYSTEM
// ============================================

let selectedContentType = null;

function showCreateOptions() {
    document.getElementById('createOptionsOverlay').classList.add('active');
}

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
        const form = document.getElementById('headingFormMain');
        form.reset();

        document.getElementById('dateCreatedHeading').value = dateStr;
        document.getElementById('timeCreatedHeading').value = timeStr;
        form.querySelector('input[name="visibility"][value="public"]').checked = true;

        document.getElementById('formErrorHeading').style.display = 'none';
        document.getElementById('formSuccessHeading').style.display = 'none';
        document.getElementById('formOverlayHeading').classList.add('active');

    } else if (selectedContentType === 'subheading') {
        const form = document.getElementById('subheadingFormMain');
        form.reset();

        await loadParentHeadings();

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

            e.target.reset();
            loadHeadings();

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

function closePopup(popupId) {
    document.getElementById(popupId).classList.remove('active');
}

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
            await displayHeadings(data.headings);
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

async function displayHeadings(headings) {
    const container = document.getElementById('headingsContainer');
    document.getElementById('noHeadingsPlaceholder').style.display = 'none';

    const mainHeadings = headings.filter(h => h.heading_type === 'heading');
    const subheadings = headings.filter(h => h.heading_type === 'subheading');
    const smallheadings = headings.filter(h => h.heading_type === 'smallheading');

    let html = '';

    for (const heading of mainHeadings) {
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

                </div>
        `;

        const childSubheadings = subheadings.filter(sh => sh.parent_heading_id === heading.id);
        if (childSubheadings.length > 0) {
            html += '<div class="subheadings-list">';

            for (const subheading of childSubheadings) {
                html += `
                    <div class="subheading-item" id="subheading-${subheading.id}">
                        <div class="subheading-header">
                            <span class="subheading-number">${subheading.subheading_number})</span>
                            <span class="subheading-name">${subheading.heading_name}</span>
                            <div class="subheading-badges">
                                <span class="heading-visibility ${subheading.visibility}">${subheading.visibility.toUpperCase()}</span>
                                <button class="btn-more" onclick="showDetails(${subheading.id}, 'subheading', '${subheading.heading_name}', '${subheading.created_at}')">⋮</button>
                            </div>
                        </div>
                `;

                const childSmallHeadings = smallheadings.filter(smh => smh.parent_heading_id === subheading.id);
                if (childSmallHeadings.length > 0) {
                    html += '<div class="smallheadings-list">';
                    for (const smallheading of childSmallHeadings) {
                        html += `
                            <div class="smallheading-item" id="smallheading-${smallheading.id}">
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

                        html += `<div id="posts-${smallheading.id}"></div>`;
                    }
                    html += '</div>';
                } else {
                    html += `<div id="posts-${subheading.id}"></div>`;
                }

                html += '</div>';
            }

            html += '</div>';
        }

        html += '</div>';
    }

    container.innerHTML = html;

    for (const subheading of subheadings) {
        const hasSmallHeadings = smallheadings.some(sh => sh.parent_heading_id === subheading.id);
        if (!hasSmallHeadings) {
            await loadPosts(subheading.id);
        }
    }

    for (const smallheading of smallheadings) {
        await loadPosts(smallheading.id);
    }
}

function showDetails(id, type, name, createdAt) {
    const parts = createdAt.split(' ');
    const datePart = `${parts[0]} ${parts[1]} ${parts[2]}`;
    const timePart = `${parts[3]} ${parts[4]}`;

    const titleMap = {
        'heading': 'Heading Details',
        'subheading': 'Sub Heading Details',
        'smallheading': 'Small Heading Details'
    };
    document.getElementById('detailsPopupTitle').textContent = titleMap[type];

    document.getElementById('detailsDate').textContent = datePart;
    document.getElementById('detailsTime').textContent = timePart;

    document.getElementById('detailsEditBtn').onclick = () => {
        closePopup('detailsOverlay');
        editHeading(id);
    };
    document.getElementById('detailsDeleteBtn').onclick = () => {
        closePopup('detailsOverlay');
        deleteHeading(id);
    };

    document.getElementById('detailsOverlay').classList.add('active');
}

// ============================================
// EDIT HEADING FUNCTIONS
// ============================================

let editingHeadingId = null;

async function editHeading(id) {
    editingHeadingId = id;

    try {
        const response = await fetch(`/api/heading/${id}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            await customAlert('Failed to load heading data', 'Error', 'error');
            return;
        }

        const data = await response.json();

        if (!data.success) {
            await customAlert('Failed to load heading data', 'Error', 'error');
            return;
        }

        const heading = data.heading;

        if (heading.heading_type === 'heading') {
            openEditFormHeading(heading);
        } else if (heading.heading_type === 'subheading') {
            openEditFormSubheading(heading);
        } else if (heading.heading_type === 'smallheading') {
            openEditFormSmallheading(heading);
        }

    } catch (error) {
        console.error('Failed to load heading:', error);
        await customAlert('An error occurred while loading heading data', 'Error', 'error');
    }
}

function openEditFormHeading(heading) {
    document.getElementById('editHeadingName').value = heading.heading_name;
    document.getElementById('editHeadingId').value = heading.id;

    const visibilityRadio = document.querySelector(
        `#editFormHeading input[name="visibility"][value="${heading.visibility}"]`
    );
    if (visibilityRadio) visibilityRadio.checked = true;

    document.getElementById('editFormOverlayHeading').classList.add('active');
}

async function openEditFormSubheading(heading) {
    await loadParentHeadingsForEdit();

    document.getElementById('editSubheadingName').value = heading.heading_name;
    document.getElementById('editSubheadingId').value = heading.id;
    document.getElementById('editParentHeadingSelect').value = heading.parent_heading_id;
    document.getElementById('editSubheadingNumber').value = heading.subheading_number;

    const visibilityRadio = document.querySelector(
        `#editFormSubheading input[name="visibility"][value="${heading.visibility}"]`
    );
    if (visibilityRadio) visibilityRadio.checked = true;

    document.getElementById('editFormOverlaySubheading').classList.add('active');
}

async function openEditFormSmallheading(heading) {
    const subheadingResponse = await fetch(`/api/heading/${heading.parent_heading_id}`, {
        credentials: 'include'
    });
    const subheadingData = await subheadingResponse.json();

    await loadHeadingsForSmallHeadingEdit();

    document.getElementById('editSmallHeadingParentSelect').value = subheadingData.heading.parent_heading_id;

    await loadSubheadingsForSmallHeadingEdit();

    document.getElementById('editSmallHeadingName').value = heading.heading_name;
    document.getElementById('editSmallHeadingId').value = heading.id;
    document.getElementById('editSmallHeadingSubheadingSelect').value = heading.parent_heading_id;
    document.getElementById('editSmallHeadingNumber').value = heading.subheading_number;

    const visibilityRadio = document.querySelector(
        `#editFormSmallheading input[name="visibility"][value="${heading.visibility}"]`
    );
    if (visibilityRadio) visibilityRadio.checked = true;

    document.getElementById('editFormOverlaySmallheading').classList.add('active');
}

async function loadParentHeadingsForEdit() {
    try {
        const response = await fetch('/api/headings/list', { credentials: 'include' });
        const data = await response.json();

        const select = document.getElementById('editParentHeadingSelect');
        select.innerHTML = '<option value="">-- Select a heading --</option>';

        if (data.success && data.headings.length > 0) {
            data.headings.forEach(heading => {
                const option = document.createElement('option');
                option.value = heading.id;
                option.textContent = heading.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load headings:', error);
    }
}

async function loadHeadingsForSmallHeadingEdit() {
    try {
        const response = await fetch('/api/headings/list', { credentials: 'include' });
        const data = await response.json();

        const select = document.getElementById('editSmallHeadingParentSelect');
        select.innerHTML = '<option value="">-- Select a heading --</option>';

        if (data.success && data.headings.length > 0) {
            data.headings.forEach(heading => {
                const option = document.createElement('option');
                option.value = heading.id;
                option.textContent = heading.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load headings:', error);
    }
}

async function loadSubheadingsForSmallHeadingEdit() {
    const headingId = document.getElementById('editSmallHeadingParentSelect').value;
    if (!headingId) return;

    try {
        const response = await fetch(`/api/subheadings/by-heading/${headingId}`, {
            credentials: 'include'
        });
        const data = await response.json();

        const select = document.getElementById('editSmallHeadingSubheadingSelect');
        select.innerHTML = '<option value="">-- Select a sub heading --</option>';

        if (data.success && data.subheadings.length > 0) {
            data.subheadings.forEach(subheading => {
                const option = document.createElement('option');
                option.value = subheading.id;
                option.textContent = subheading.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load subheadings:', error);
    }
}

async function submitEditHeading(event, formType) {
    event.preventDefault();

    let headingId, errorMsgId, successMsgId;

    if (formType === 'heading') {
        headingId = document.getElementById('editHeadingId').value;
        errorMsgId = 'editFormErrorHeading';
        successMsgId = 'editFormSuccessHeading';
    } else if (formType === 'subheading') {
        headingId = document.getElementById('editSubheadingId').value;
        errorMsgId = 'editFormErrorSubheading';
        successMsgId = 'editFormSuccessSubheading';
    } else if (formType === 'smallheading') {
        headingId = document.getElementById('editSmallHeadingId').value;
        errorMsgId = 'editFormErrorSmallheading';
        successMsgId = 'editFormSuccessSmallheading';
    }

    const errorMsg = document.getElementById(errorMsgId);
    const successMsg = document.getElementById(successMsgId);

    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    try {
        const formData = new FormData(event.target);

        const response = await fetch(`/admin/heading/edit/${headingId}`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            successMsg.textContent = data.message;
            successMsg.style.display = 'block';

            loadHeadings();

            setTimeout(() => {
                if (formType === 'heading') {
                    closePopup('editFormOverlayHeading');
                } else if (formType === 'subheading') {
                    closePopup('editFormOverlaySubheading');
                } else if (formType === 'smallheading') {
                    closePopup('editFormOverlaySmallheading');
                }
            }, 2000);
        } else {
            errorMsg.textContent = data.error || 'Failed to update';
            errorMsg.style.display = 'block';
        }
    } catch (error) {
        errorMsg.textContent = 'An error occurred. Please try again.';
        errorMsg.style.display = 'block';
    }
}

// ============================================
// DELETE HEADING FUNCTION
// ============================================

async function deleteHeading(id) {
    try {
        const response = await fetch(`/api/heading/${id}`, { credentials: 'include' });
        const data = await response.json();

        if (!data.success) {
            await customAlert('Failed to load heading data', 'Error', 'error');
            return;
        }

        const heading = data.heading;
        let warningMessage = `Are you sure you want to delete this ${heading.heading_type}?`;

        if (heading.heading_type === 'heading') {
            warningMessage += '\n\n⚠️ WARNING: This will also delete all subheadings and small headings under it!';
        } else if (heading.heading_type === 'subheading') {
            warningMessage += '\n\n⚠️ WARNING: This will also delete all small headings and posts under it!';
        } else if (heading.heading_type === 'smallheading') {
            warningMessage += '\n\n⚠️ WARNING: This will also delete all posts under it!';
        }

        if (!await customConfirm(warningMessage, 'Delete Confirmation', 'error')) {
            return;
        }

        const deleteResponse = await fetch(`/admin/heading/delete/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const deleteData = await deleteResponse.json();

        if (deleteData.success) {
            await customAlert(deleteData.message, 'Success', 'success');
            loadHeadings();
        } else {
            await customAlert('Error: ' + (deleteData.error || 'Failed to delete'), 'Error', 'error');
        }

    } catch (error) {
        console.error('Delete failed:', error);
        await customAlert('An error occurred while deleting', 'Error', 'error');
    }
}

// ============================================
// SMALL HEADING FUNCTIONS
// ============================================

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

        document.getElementById('smallHeadingSubheadingSelect').innerHTML = '<option value="">-- Select a heading first --</option>';
        document.getElementById('smallHeadingNumber').value = '';
    } catch (error) {
        console.error('Failed to load headings:', error);
    }
}

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

        document.getElementById('smallHeadingNumber').value = '';
    } catch (error) {
        console.error('Failed to load subheadings:', error);
    }
}

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

// POST FUNCTIONS
async function loadPosts(headingId) {
    try {
        const response = await fetch(`/api/posts/by-heading/${headingId}`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            displayPosts(headingId, data.posts);
        }
    } catch (error) {
        console.error('Failed to load posts:', error);
    }
}

function displayPosts(headingId, posts) {
    const container = document.getElementById(`posts-${headingId}`);
    if (!container) return;

    let html = '<div class="posts-container">';

    if (posts.length > 0) {
        posts.forEach(post => {
            const videoId = extractYouTubeID(post.video_url);
            const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

            html += `
                <div class="post-item" onclick="playVideo('${videoId}', '${escapeHtml(post.post_title)}')">
                    <div class="post-video-thumbnail">
                        <img src="${thumbnail}" alt="${escapeHtml(post.post_title)}" onerror="this.src='https://img.youtube.com/vi/${videoId}/hqdefault.jpg'">
                        <div class="video-play-overlay">▶</div>
                        <div class="post-title-overlay">${escapeHtml(post.post_title)}</div>
                    </div>
                    <div class="post-header">
                        <span class="post-visibility ${post.visibility}">${post.visibility.toUpperCase()}</span>
                        <button class="btn-post-more" onclick="showPostMorePopup(event, ${post.id}, ${headingId}, '${post.created_at}', '${escapeHtml(post.post_description || '')}')">⋮</button>
                    </div>
                </div>
            `;
        });
    }

    html += `
        <button class="btn-add-post" onclick="openCreatePost(${headingId})">
            <span>➕</span>
            <span>Add Post</span>
        </button>
    </div>`;

    container.innerHTML = html;
}

// Show Post More Popup
function showPostMorePopup(event, postId, headingId, createdAt, description) {
    event.stopPropagation();

    window.currentPostData = {
        postId: postId,
        headingId: headingId,
        createdAt: createdAt,
        description: description
    };

    document.getElementById('postMoreOverlay').classList.add('active');
}

// Close Post More Popup
function closePostMorePopup() {
    document.getElementById('postMoreOverlay').classList.remove('active');
}

// Post Action: Edit
function postActionEdit() {
    closePostMorePopup();
    openEditPost(window.currentPostData.postId, window.currentPostData.headingId);
}

// Post Action: Description
function postActionDescription() {
    closePostMorePopup();
    document.getElementById('postDescriptionContent').textContent = window.currentPostData.description || 'No description available.';
    document.getElementById('postDescriptionOverlay').classList.add('active');
}

// Post Action: Delete
async function postActionDelete() {
    closePostMorePopup();
    await deletePost(window.currentPostData.postId, window.currentPostData.headingId);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openCreatePost(headingId) {
    document.getElementById('postParentHeadingId').value = headingId;
    document.getElementById('createPostForm').reset();
    document.getElementById('formErrorPost').style.display = 'none';
    document.getElementById('formSuccessPost').style.display = 'none';
    document.getElementById('createPostOverlay').classList.add('active');
}

async function submitPost(e) {
    e.preventDefault();

    const errorMsg = document.getElementById('formErrorPost');
    const successMsg = document.getElementById('formSuccessPost');

    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    try {
        const formData = new FormData(e.target);

        const response = await fetch('/admin/post/create', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            successMsg.textContent = data.message;
            successMsg.style.display = 'block';

            const headingId = document.getElementById('postParentHeadingId').value;
            await loadPosts(headingId);

            setTimeout(() => {
                closePopup('createPostOverlay');
            }, 1500);
        } else {
            errorMsg.textContent = data.error || 'Failed to create post';
            errorMsg.style.display = 'block';
        }
    } catch (error) {
        errorMsg.textContent = 'An error occurred. Please try again.';
        errorMsg.style.display = 'block';
    }
}

let currentEditingHeadingId = null;

async function openEditPost(postId, headingId) {
    event.stopPropagation();
    currentEditingHeadingId = headingId;

    try {
        const response = await fetch(`/api/post/${postId}`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('editPostId').value = data.post.id;
            document.getElementById('editPostTitle').value = data.post.post_title;
            document.getElementById('editPostVideoUrl').value = data.post.video_url;
            document.getElementById('editPostDescription').value = data.post.post_description || '';

            document.getElementById('editPostCreatedDate').textContent = data.post.created_at.split(' ').slice(0, 3).join(' ');
            document.getElementById('editPostCreatedTime').textContent = data.post.created_at.split(' ').slice(3).join(' ');

            const visibilityRadio = document.querySelector(
                `#editPostForm input[name="visibility"][value="${data.post.visibility}"]`
            );
            if (visibilityRadio) visibilityRadio.checked = true;

            document.getElementById('formErrorEditPost').style.display = 'none';
            document.getElementById('formSuccessEditPost').style.display = 'none';
            document.getElementById('editPostOverlay').classList.add('active');
        }
    } catch (error) {
        await customAlert('Failed to load post data', 'Error', 'error');
    }
}

async function submitEditPost(e) {
    e.preventDefault();

    const errorMsg = document.getElementById('formErrorEditPost');
    const successMsg = document.getElementById('formSuccessEditPost');

    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    const postId = document.getElementById('editPostId').value;

    try {
        const formData = new FormData(e.target);

        const response = await fetch(`/admin/post/edit/${postId}`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            successMsg.textContent = data.message;
            successMsg.style.display = 'block';

            if (currentEditingHeadingId) {
                await loadPosts(currentEditingHeadingId);
            }

            setTimeout(() => {
                closePopup('editPostOverlay');
            }, 1500);
        } else {
            errorMsg.textContent = data.error || 'Failed to update post';
            errorMsg.style.display = 'block';
        }
    } catch (error) {
        errorMsg.textContent = 'An error occurred. Please try again.';
        errorMsg.style.display = 'block';
    }
}

async function deletePost(postId, headingId) {
    if (!await customConfirm('Are you sure you want to delete this post?', 'Delete Post?', 'error')) {
        return;
    }

    try {
        const response = await fetch(`/admin/post/delete/${postId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            await loadPosts(headingId);
        } else {
            await customAlert('Error: ' + (data.error || 'Failed to delete post'), 'Error', 'error');
        }
    } catch (error) {
        await customAlert('An error occurred while deleting the post', 'Error', 'error');
    }
}

// ============================================
// VIDEO POST FUNCTIONS
// ============================================

// Extract YouTube Video ID
function extractYouTubeID(url) {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
}

// Global player reference
let currentPlayer = null;

// Play Video with Plyr (FIXED - NO CUT OFF)
function playVideo(videoId, title) {
    event.stopPropagation();

    // Close any existing player
    if (currentPlayer) {
        currentPlayer.destroy();
        currentPlayer = null;
    }

    const modal = document.createElement('div');
    modal.className = 'video-modal';
    modal.innerHTML = `
        <div class="video-modal-backdrop" onclick="closeVideoModal(this)"></div>
        <div class="video-modal-content">
            <div class="video-modal-header">
                <h3>${title}</h3>
                <button class="video-modal-close" onclick="closeVideoModal(this)">✕</button>
            </div>
            <div class="video-player-wrapper">
                <div id="player" data-plyr-provider="youtube" data-plyr-embed-id="${videoId}"></div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Prevent body scroll but allow modal scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    setTimeout(() => modal.classList.add('active'), 10);

    // Initialize Plyr with better sizing
    setTimeout(() => {
        const playerElement = document.getElementById('player');
        if (playerElement) {
            currentPlayer = new Plyr(playerElement, {
                controls: [
                    'play-large',
                    'play',
                    'progress',
                    'current-time',
                    'mute',
                    'volume',
                    'settings',
                    'fullscreen'
                ],
                youtube: {
                    noCookie: true,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    modestbranding: 1
                },
                hideControls: false,
                ratio: '16:9',
                fullscreen: {
                    enabled: true,
                    fallback: true,
                    iosNative: true
                }
            });

            // Auto-play when ready
            currentPlayer.on('ready', () => {
                currentPlayer.play();
            });
        }
    }, 100);
}


// Close Video Modal (FIXED SCROLL RESTORE)
function closeVideoModal(element) {
    const modal = element.closest('.video-modal');
    if (!modal) return;

    // Destroy player
    if (currentPlayer) {
        currentPlayer.destroy();
        currentPlayer = null;
    }

    modal.classList.remove('active');

    // Restore body scroll properly
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';

    setTimeout(() => modal.remove(), 300);
}


// Close video modal on ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const videoModal = document.querySelector('.video-modal.active');
        if (videoModal) {
            const closeBtn = videoModal.querySelector('.video-modal-close');
            if (closeBtn) {
                closeVideoModal(closeBtn);
            }
        }
    }
});

// ============================================
// VIEWER MODE - PUBLIC CONTENT DISPLAY
// ============================================

// Modified showPage to load public content when viewer mode is opened
const originalShowPage = showPage;
showPage = function(pageId) {
    originalShowPage(pageId);

    if (pageId === 'viewer-mode') {
        loadPublicContent();
    }
};

// Load public content from API
async function loadPublicContent() {
    const container = document.getElementById('publicContentContainer');
    const placeholder = document.getElementById('noPublicContentPlaceholder');
    const loading = document.getElementById('publicContentLoading');

    // Show loading
    container.innerHTML = '';
    placeholder.style.display = 'none';
    loading.style.display = 'block';

    try {
        const response = await fetch('/api/public-content', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch public content');
        }

        const data = await response.json();

        loading.style.display = 'none';

        if (data.success && data.content.length > 0) {
            displayPublicContent(data.content);
        } else {
            container.innerHTML = '';
            placeholder.style.display = 'block';
        }
    } catch (error) {
        console.error('Failed to load public content:', error);
        loading.style.display = 'none';
        placeholder.style.display = 'block';
    }
}

// Display public content hierarchically (READ-ONLY - NO BADGES, ONLY DATE)
function displayPublicContent(content) {
    const container = document.getElementById('publicContentContainer');
    let html = '';

    content.forEach(heading => {
        // Extract only the date (remove time)
        const dateOnly = heading.created_at.split(' ').slice(0, 3).join(' '); // "January 29, 2026"

        html += `
            <div class="heading-card">
                <h3 class="heading-card-title">${escapeHtml(heading.name)}</h3>

                <div class="heading-card-meta">
                    <div class="heading-meta-item">
                        <span class="heading-meta-icon">📅</span>
                        <span>${dateOnly}</span>
                    </div>
                </div>
        `;

        if (heading.subheadings && heading.subheadings.length > 0) {
            html += '<div class="subheadings-list">';

            heading.subheadings.forEach(subheading => {
                html += `
                    <div class="subheading-item">
                        <div class="subheading-header">
                            <span class="subheading-number">${subheading.number})</span>
                            <span class="subheading-name">${escapeHtml(subheading.name)}</span>
                        </div>
                `;

                // Check if subheading has small headings
                if (subheading.smallheadings && subheading.smallheadings.length > 0) {
                    html += '<div class="smallheadings-list">';

                    subheading.smallheadings.forEach(smallheading => {
                        html += `
                            <div class="smallheading-item">
                                <div class="smallheading-content">
                                    <span class="smallheading-number">${smallheading.number})</span>
                                    <span class="smallheading-name">${escapeHtml(smallheading.name)}</span>
                                </div>
                            </div>
                        `;

                        // Display posts under small heading
                        if (smallheading.posts && smallheading.posts.length > 0) {
                            html += displayPublicPosts(smallheading.posts);
                        }
                    });

                    html += '</div>';
                } else if (subheading.posts && subheading.posts.length > 0) {
                    // Display posts directly under subheading
                    html += displayPublicPosts(subheading.posts);
                }

                html += '</div>';
            });

            html += '</div>';
        }

        html += '</div>';
    });

    container.innerHTML = html;
}

// Display public posts (video cards - WITH INFO BUTTON)
function displayPublicPosts(posts) {
    let html = '<div class="posts-container">';

    posts.forEach(post => {
        // Extract only the date (remove time)
        const dateOnly = post.created_at.split(' ').slice(0, 3).join(' '); // "January 29, 2026"

        html += `
            <div class="post-item" onclick="playViewerVideo('${post.video_id}', '${escapeHtml(post.title)}')">
                <div class="post-video-thumbnail">
                    <img src="${post.thumbnail_url}" alt="${escapeHtml(post.title)}" onerror="this.src='https://img.youtube.com/vi/${post.video_id}/hqdefault.jpg'">
                    <div class="video-play-overlay">▶</div>
                    <div class="post-title-overlay">${escapeHtml(post.title)}</div>
                </div>
                <div class="post-header">
                    <button class="btn-post-info" onclick="event.stopPropagation(); showViewerPostInfo('${escapeHtml(post.title)}', '${escapeHtml(post.description || 'No description available')}', '${dateOnly}')">i</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}


// Show post info popup (for viewer mode)
function showViewerPostInfo(title, description, date) {
    customAlert(
        `📹 ${title}\n\n${description}\n\n📅 Created: ${date}`,
        'Video Information',
        'info'
    );
}




// ============================================
// VIEWER MODE VIDEO PLAYER (FIXED - MATCHES MANAGE CONTENT)
// ============================================

let viewerPlayer = null;

function playViewerVideo(videoId, title) {
    // Close existing player if any
    if (viewerPlayer) {
        viewerPlayer.destroy();
        viewerPlayer = null;
    }

    const modal = document.getElementById('viewerVideoModal');
    const titleEl = document.getElementById('viewerVideoTitle');
    const playerContainer = document.getElementById('viewerVideoPlayer');

    titleEl.textContent = title;

    // Create the exact same structure as manage content player
    playerContainer.innerHTML = `<div id="temp-viewer-player" data-plyr-provider="youtube" data-plyr-embed-id="${videoId}"></div>`;

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    // Show modal
    modal.classList.add('active');

    // Initialize Plyr with SAME config as manage content
    setTimeout(() => {
        const playerElement = document.getElementById('temp-viewer-player');
        if (playerElement && typeof Plyr !== 'undefined') {
            viewerPlayer = new Plyr(playerElement, {
                controls: [
                    'play-large',
                    'play',
                    'progress',
                    'current-time',
                    'duration',
                    'mute',
                    'volume',
                    'settings',
                    'fullscreen'
                ],
                youtube: {
                    noCookie: true,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    playsinline: 1
                },
                hideControls: false,
                keyboard: { focused: true, global: true },
                tooltips: { controls: true, seek: true },
                ratio: '16:9',
                fullscreen: {
                    enabled: true,
                    fallback: true,
                    iosNative: true,
                    container: null
                },
                autoplay: true,
                muted: false
            });

            // Auto-play when ready
            viewerPlayer.on('ready', () => {
                viewerPlayer.play().catch(e => {
                    console.log('Autoplay prevented:', e);
                });
            });

            // Error handling
            viewerPlayer.on('error', (error) => {
                console.error('Plyr error:', error);
            });
        } else {
            console.error('Plyr not available or element not found');
        }
    }, 100);
}

function closeViewerVideo() {
    const modal = document.getElementById('viewerVideoModal');

    // Destroy player
    if (viewerPlayer) {
        try {
            viewerPlayer.destroy();
        } catch (e) {
            console.error('Error destroying player:', e);
        }
        viewerPlayer = null;
    }

    // Hide modal
    modal.classList.remove('active');

    // Restore body scroll (IMPORTANT!)
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';

    // Clear player container
    document.getElementById('viewerVideoPlayer').innerHTML = '';
}




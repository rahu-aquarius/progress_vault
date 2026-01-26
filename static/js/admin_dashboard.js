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
            } catch (error) {
                console.error('Toggle failed:', error);
                alert('Failed to toggle guest access');
                e.target.checked = !e.target.checked;
            }
        });
    }
});

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

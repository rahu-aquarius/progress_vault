// viewing_section.js

// ============================================
// AUTH VERIFICATION
// ============================================
async function verifyAuth() {
    try {
        const response = await fetch('/api/verify-auth', {
            credentials: 'include'
        });

        if (response.status === 401 || !response.ok) {
            console.log('Not authenticated, redirecting to login');
            window.location.replace('/');
            return false;
        }

        const data = await response.json();
        if (!data.authenticated) {
            window.location.replace('/');
            return false;
        }

        return true;
    } catch (error) {
        console.error('Auth verification failed:', error);
        window.location.replace('/');
        return false;
    }
}

// Run auth check immediately
verifyAuth();

// ============================================
// AUTO-LOGOUT TIMER
// ============================================
let autoLogoutTimer;

function startAutoLogoutCheck() {
    if (autoLogoutTimer) {
        clearInterval(autoLogoutTimer);
    }

    autoLogoutTimer = setInterval(async () => {
        try {
            const response = await fetch('/api/check-session', {
                credentials: 'include'
            });

            if (response.status === 401 || !response.ok) {
                console.log('Session expired - logging out');
                clearInterval(autoLogoutTimer);
                alert('Your session has expired. Please login again.');
                window.location.replace('/logout');
            } else {
                const data = await response.json();
                if (!data.valid) {
                    console.log('Session invalid - logging out');
                    clearInterval(autoLogoutTimer);
                    alert('Your session has expired. Please login again.');
                    window.location.replace('/logout');
                }
                console.log(`Session expires in ${data.expires_in} seconds`);
            }
        } catch (error) {
            console.error('Session check failed:', error);
            clearInterval(autoLogoutTimer);
            window.location.replace('/logout');
        }
    }, 2000);
}

startAutoLogoutCheck();

// ============================================
// BACK BUTTON PROTECTION
// ============================================
window.history.pushState(null, '', window.location.href);

window.addEventListener('popstate', function() {
    window.history.pushState(null, '', window.location.href);

    // Show confirmation popup
    if (confirm('Are you sure you want to log out?')) {
        // User confirmed - logout
        window.location.href = '/logout';
    }
    // If user cancels, stay on page
});

// ============================================
// CACHE PREVENTION
// ============================================
window.onpageshow = function(event) {
    if (event.persisted) {
        verifyAuth().then(isValid => {
            if (!isValid) {
                window.location.replace('/');
            }
        });
    }
};

// ============================================
// VIDEO PLAYER
// ============================================
function playVideo(url) {
    window.open(url, '_blank');
}

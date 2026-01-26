// failed.js

// Replace history to prevent back button loop
window.history.replaceState(null, '', window.location.href);

// Clear any cookies
document.cookie.split(";").forEach(function(c) {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});

// Handle "Try Again" click
function goHome(e) {
    e.preventDefault();
    // Clear everything and go home
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/');
}

// Prevent caching
window.onpageshow = function(event) {
    if (event.persisted) {
        window.location.replace('/');
    }
};

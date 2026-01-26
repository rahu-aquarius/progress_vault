// processing.js

// Prevent back button from getting stuck here
window.history.replaceState(null, '', window.location.href);

// Detect if arrived via back button
let navigationEntries = performance.getEntriesByType('navigation');
let navigationType = navigationEntries.length > 0 ? navigationEntries[0].type : '';

if (navigationType === 'back_forward') {
    // User pressed back button - redirect to home
    console.log('Back button detected, redirecting to home');
    window.location.replace('/');
} else {
    // Normal access - proceed with authentication check
    setTimeout(async () => {
        try {
            const response = await fetch('/api/check-guest-access');
            const data = await response.json();

            if (data.allowed) {
                // Use replace to prevent back button issues
                window.location.replace('/viewing');
            } else {
                window.location.replace('/failed-login');
            }
        } catch (error) {
            console.error('Error checking access:', error);
            window.location.replace('/failed-login');
        }
    }, 3000);
}

// Additional protection: prevent caching
window.onpageshow = function(event) {
    if (event.persisted) {
        window.location.replace('/');
    }
};

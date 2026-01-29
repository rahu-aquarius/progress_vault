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

// ============================================
// BACK BUTTON PROTECTION
// ============================================
window.history.pushState(null, '', window.location.href);

window.addEventListener('popstate', function() {
    window.history.pushState(null, '', window.location.href);
    if (confirm('Are you sure you want to log out?')) {
        window.location.href = '/logout';
    }
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
// FETCH AND DISPLAY PUBLIC CONTENT
// ============================================
async function fetchPublicContent() {
    const loadingDiv = document.getElementById('publicContentLoading');
    const containerDiv = document.getElementById('publicContentContainer');

    try {
        const response = await fetch('/api/public-content', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch content');
        }

        const data = await response.json();

        loadingDiv.style.display = 'none';

        if (!data.success || !data.content || data.content.length === 0) {
            containerDiv.innerHTML = `
                <div style="text-align: center; padding: 4rem 2rem; color: #666;">
                    <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem; color: #888;">No content available</h3>
                    <p style="font-size: 0.95rem;">Check back later for new content</p>
                </div>
            `;
            return;
        }

        containerDiv.innerHTML = data.content.map(heading => renderHeading(heading)).join('');

    } catch (error) {
        console.error('Error fetching content:', error);
        loadingDiv.style.display = 'none';
        containerDiv.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: #ff4444;">
                <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">Error loading content</h3>
                <p style="font-size: 0.95rem;">Please try refreshing the page</p>
            </div>
        `;
    }
}

// ============================================
// RENDER HEADING CARD
// ============================================
function renderHeading(heading) {
    const subheadingsHtml = heading.subheadings && heading.subheadings.length > 0
        ? `<div class="subheadings-list">${heading.subheadings.map(sub => renderSubheading(sub)).join('')}</div>`
        : '';

    const postsHtml = heading.posts && heading.posts.length > 0
        ? `<div class="posts-container">${heading.posts.map(post => renderPost(post)).join('')}</div>`
        : '';

    return `
        <div class="heading-card">
            <h2 class="heading-card-title">${escapeHtml(heading.name)}</h2>
            ${subheadingsHtml}
            ${postsHtml}
        </div>
    `;
}

// ============================================
// RENDER SUBHEADING
// ============================================
function renderSubheading(subheading) {
    const smallheadingsHtml = subheading.smallheadings && subheading.smallheadings.length > 0
        ? `<div class="smallheadings-list">${subheading.smallheadings.map(small => renderSmallheading(small)).join('')}</div>`
        : '';

    const postsHtml = subheading.posts && subheading.posts.length > 0
        ? `<div class="posts-container">${subheading.posts.map(post => renderPost(post)).join('')}</div>`
        : '';

    return `
        <div class="subheading-item">
            <div class="subheading-header">
                <span class="subheading-number">${subheading.number}</span>
                <span class="subheading-name">${escapeHtml(subheading.name)}</span>
            </div>
            ${smallheadingsHtml}
            ${postsHtml}
        </div>
    `;
}

// ============================================
// RENDER SMALL HEADING - FIXED! VIDEOS NOW APPEAR BELOW
// ============================================
function renderSmallheading(smallheading) {
    const postsHtml = smallheading.posts && smallheading.posts.length > 0
        ? `<div class="posts-container">${smallheading.posts.map(post => renderPost(post)).join('')}</div>`
        : '';

    return `
        <div class="smallheading-wrapper">
            <div class="smallheading-item">
                <div class="smallheading-content">
                    <span class="smallheading-number">${smallheading.number}</span>
                    <span class="smallheading-name">${escapeHtml(smallheading.name)}</span>
                </div>
            </div>
            ${postsHtml}
        </div>
    `;
}

// ============================================
// RENDER POST CARD - WITH DATE & ALWAYS SHOW INFO BUTTON
// ============================================
function renderPost(post) {
    const thumbnailUrl = post.thumbnail_url || post.thumbnailurl || post.thumbnail || '';
    const title = post.title || post.posttitle || post.post_title || 'Untitled';
    const description = post.description || post.postdescription || post.post_description || 'No description available';
    const videoUrl = post.video_url || post.videourl || post.youtube_url || post.youtubeurl || '';
    const videoId = post.video_id || post.videoid || extractYouTubeId(videoUrl);
    const createdAt = post.createdat || post.created_at || '';

    // Extract only date (remove time)
    const dateOnly = createdAt.split(' ').slice(0, 3).join(' ');

    const finalThumbnail = thumbnailUrl || (videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '');

    // Always show info button, pass all data including date
    return `
        <div class="post-item" onclick="openVideoModal('${escapeHtml(videoUrl)}', '${escapeHtml(title)}')">
            <div class="post-video-thumbnail">
                ${finalThumbnail ?
                    `<img src="${finalThumbnail}" alt="${escapeHtml(title)}" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${videoId}/hqdefault.jpg'">`
                    :
                    `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;background:#1a1a1a;">No Thumbnail</div>`
                }
                <div class="video-play-overlay">▶</div>
                <div class="post-title-overlay">${escapeHtml(title)}</div>
            </div>
            <div class="post-header">
                <button class="btn-post-info" onclick="event.stopPropagation(); showPostInfo('${escapeHtml(title)}', '${escapeHtml(description)}', '${dateOnly}')">i</button>
            </div>
        </div>
    `;
}

// ============================================
// VIDEO MODAL FUNCTIONS
// ============================================
let guestPlayer = null;

function openVideoModal(url, title) {
    if (guestPlayer) {
        guestPlayer.destroy();
        guestPlayer = null;
    }

    const modal = document.getElementById('guestVideoModal');
    const titleEl = document.getElementById('guestVideoTitle');
    const playerContainer = document.getElementById('guestVideoPlayer');

    titleEl.textContent = title;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    modal.classList.add('active');

    const videoId = extractYouTubeId(url);

    if (videoId) {
        playerContainer.innerHTML = `<div id="temp-guest-player" data-plyr-provider="youtube" data-plyr-embed-id="${videoId}"></div>`;

        setTimeout(() => {
            const playerElement = document.getElementById('temp-guest-player');
            if (playerElement && typeof Plyr !== 'undefined') {
                guestPlayer = new Plyr(playerElement, {
                    controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'fullscreen'],
                    youtube: { noCookie: true, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1 },
                    hideControls: false,
                    keyboard: { focused: true, global: true },
                    tooltips: { controls: true, seek: true },
                    ratio: '16:9',
                    fullscreen: { enabled: true, fallback: true, iosNative: true, container: null },
                    autoplay: true,
                    muted: false
                });

                guestPlayer.on('ready', () => {
                    guestPlayer.play().catch(e => console.log('Autoplay prevented:', e));
                });

                guestPlayer.on('error', (error) => {
                    console.error('Plyr error:', error);
                });
            } else {
                alert('Video player failed to load. Please refresh the page.');
            }
        }, 100);
    } else {
        alert('Invalid video URL');
        closeGuestVideo();
    }
}

function closeGuestVideo() {
    const modal = document.getElementById('guestVideoModal');

    if (guestPlayer) {
        try {
            guestPlayer.destroy();
        } catch (e) {
            console.error('Error destroying player:', e);
        }
        guestPlayer = null;
    }

    modal.classList.remove('active');

    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';

    document.getElementById('guestVideoPlayer').innerHTML = '';
}

function extractYouTubeId(url) {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// ============================================
// POST INFO MODAL - NICE POPUP LIKE ADMIN
// ============================================
function showPostInfo(title, description, date) {
    document.getElementById('postDescriptionTitle').textContent = title;
    document.getElementById('postDescriptionDate').textContent = `Created: ${date}`;
    document.getElementById('postDescriptionContent').textContent = description;
    document.getElementById('postDescriptionOverlay').classList.add('active');
}

function closePostDescription() {
    document.getElementById('postDescriptionOverlay').classList.remove('active');
}

// ============================================
// UTILITY
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    fetchPublicContent();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const videoModal = document.querySelector('.video-modal.active');
            if (videoModal) {
                closeGuestVideo();
            }
            const infoModal = document.querySelector('.popup-overlay.active');
            if (infoModal) {
                closePostDescription();
            }
        }
    });
});

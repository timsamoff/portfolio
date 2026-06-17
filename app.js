document.addEventListener('DOMContentLoaded', () => {
    // ========================================
    // THEME ENGINE
    // ========================================
    const themeToggle = document.getElementById('theme-toggle');
    const storedTheme = localStorage.getItem('portfolio-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', storedTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', targetTheme);
            localStorage.setItem('portfolio-theme', targetTheme);
        });
    }

    // ========================================
    // STICKY HEADER SHADOW ON SCROLL
    // ========================================
    function handleHeaderScroll() {
        const header = document.getElementById('site-header');
        if (!header) return;

        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleHeaderScroll, { passive: true });
    handleHeaderScroll();

    // ========================================
    // MODAL SYSTEM
    // ========================================
    const modal = document.getElementById('media-modal');
    const modalClose = document.querySelector('.modal-close');
    let currentModalSwiper = null;
    let currentVideoElements = new Map();
    let modalManuallyClosed = false;

    function closeModal() {
        if (!modal) return;
        modal.style.display = 'none';
        modalManuallyClosed = true;
        saveAllVideoProgress();
        if (currentModalSwiper) {
            currentModalSwiper.destroy(true, true);
            currentModalSwiper = null;
        }
        if (window.location.hash) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // ========================================
    // VIDEO PROGRESS TRACKING
    // ========================================
    function saveVideoProgress(videoUrl, currentTime) {
        const key = `video_progress_${btoa(videoUrl)}`;
        localStorage.setItem(key, currentTime.toString());
    }

    function getVideoProgress(videoUrl) {
        const key = `video_progress_${btoa(videoUrl)}`;
        const saved = localStorage.getItem(key);
        return saved ? parseFloat(saved) : 0;
    }

    function saveAllVideoProgress() {
        currentVideoElements.forEach((video, url) => {
            if (video && !video.paused && video.currentTime > 0) {
                saveVideoProgress(url, video.currentTime);
            }
        });
    }

    // ========================================
    // SHARE & NOTIFICATION SYSTEM
    // ========================================
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    }

    function showCardNotification(card, message, isError = false) {
        const existing = card.querySelector('.card-share-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'card-share-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${isError ? 'var(--accent-red)' : '#10b981'};
            color: white;
            padding: 8px 16px;
            border-radius: 24px;
            font-size: 0.85rem;
            font-weight: 500;
            z-index: 20;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            pointer-events: none;
            animation: fadeInOut 1.5s ease forwards;
        `;

        if (!document.querySelector('#share-animation-style')) {
            const style = document.createElement('style');
            style.id = 'share-animation-style';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                    15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                }
            `;
            document.head.appendChild(style);
        }

        card.style.position = 'relative';
        card.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 1500);
    }

// ========================================
// DESCRIPTION RENDERER
// ========================================
function renderDescription(raw) {
    if (!raw) return '';

    const isHtml = /<[a-z][\s\S]*>/i.test(raw);

    if (isHtml) {
        const tmp = document.createElement('div');
        tmp.innerHTML = raw;

        tmp.querySelectorAll('a').forEach(a => {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        });

        const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                return node.parentElement.closest('a')
                    ? NodeFilter.FILTER_REJECT
                    : NodeFilter.FILTER_ACCEPT;
            }
        });
        const textNodes = [];
        let n;
        while ((n = walker.nextNode())) textNodes.push(n);

        textNodes.forEach(textNode => {
            const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
            if (!urlRegex.test(textNode.nodeValue)) return;
            urlRegex.lastIndex = 0;
            const span = document.createElement('span');
            span.innerHTML = textNode.nodeValue.replace(
                /(https?:\/\/[^\s<>"']+)/g,
                url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
            );
            textNode.parentNode.replaceChild(span, textNode);
        });

        tmp.querySelectorAll('award').forEach(el => {
            const badge = document.createElement('span');
            badge.className = 'award-badge';
            badge.innerHTML = '🏆 ' + el.innerHTML;
            el.parentNode.replaceChild(badge, el);
        });

        // In renderDescription() - replace the existing <live> handler

tmp.querySelectorAll('live').forEach(el => {
    const badge = document.createElement('span');
    badge.className = 'live-badge';
    
    // Check if there's an <a> tag inside
    const innerLink = el.querySelector('a');
    let url = el.getAttribute('href') || '';
    let text = el.textContent || 'Live';
    
    if (innerLink) {
        url = innerLink.getAttribute('href') || '';
        text = innerLink.textContent || 'Live';
        // Remove the inner <a> from the live element
        while (innerLink.firstChild) {
            el.insertBefore(innerLink.firstChild, innerLink);
        }
        el.removeChild(innerLink);
    }
    
    // Clean up any remaining text
    text = el.textContent.trim() || 'Live';
    
    // If there's a valid URL, wrap the badge in an <a>
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'live-badge-link';
        
        // Build the badge content inside the link
        const dot = document.createElement('span');
        dot.className = 'live-dot';
        const label = document.createTextNode(text);
        
        link.appendChild(dot);
        link.appendChild(label);
        
        el.parentNode.replaceChild(link, el);
    } else {
        // No URL — just show the badge as a non-interactive element
        const dot = document.createElement('span');
        dot.className = 'live-dot';
        const label = document.createTextNode(text);
        
        badge.appendChild(dot);
        badge.appendChild(label);
        
        el.parentNode.replaceChild(badge, el);
    }
});

        return tmp.innerHTML;
    }

    let escaped = raw.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
    escaped = escaped.replace(
        /(https?:\/\/[^\s]+)/g,
        url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
}

// ========================================
// FLOATING NOTIFICATION (for Live button)
// ========================================
function showFloatingNotification(message, isSuccess = true) {
    // Remove existing notification
    const existing = document.querySelector('.floating-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'floating-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: ${isSuccess ? '#10b981' : '#ef4444'};
        color: white;
        padding: 10px 20px;
        border-radius: 40px;
        font-size: 0.85rem;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        pointer-events: none;
        animation: slideInRight 0.3s ease;
    `;

    if (!document.querySelector('#notification-style')) {
        const style = document.createElement('style');
        style.id = 'notification-style';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        notification.style.transition = 'opacity 0.3s, transform 0.3s';
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 300);
    }, 2500);
}

    // ========================================
    // MEDIA HELPERS
    // ========================================
    function isVideoUrl(url) {
        const videoExtensions = /\.(mp4|webm|mov|ogg)$/i;
        const youtubePattern = /(youtube\.com\/watch\?v=|youtu\.be\/)/;
        const vimeoPattern = /vimeo\.com\/\d+/;
        return videoExtensions.test(url) || youtubePattern.test(url) || vimeoPattern.test(url);
    }

    function getYouTubeEmbedUrl(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
    }

    function getYouTubeVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? match[2] : null;
    }

    function getVimeoEmbedUrl(url) {
        const regExp = /vimeo\.com\/(\d+)/;
        const match = url.match(regExp);
        return match ? `https://player.vimeo.com/video/${match[1]}` : null;
    }

    function getObjectPosition(alignSetting) {
        switch (alignSetting) {
            case 'top':
                return 'top';
            case 'bottom':
                return 'bottom';
            default:
                return 'center';
        }
    }

    function supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
    }

    function getOptimizedImageUrl(url) {
        if (!url) return url;
        if (url.match(/^https?:\/\//)) return url;
        if (url.match(/\.(mp4|webm|mov|ogg|avi)$/i)) return url;
        if (!url.match(/\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i)) return url;

        const webpUrl = url.replace(/\.[^.]+$/, '.webp');
        const webpSupported = supportsWebP();
        if (webpSupported) {
            return webpUrl;
        }
        return url;
    }

    function generateSrcSet(mediaUrl) {
        if (!mediaUrl || mediaUrl.match(/^https?:\/\//)) return '';
        if (mediaUrl.match(/\.(mp4|webm|mov|ogg|avi)$/i)) return '';
        if (!mediaUrl.match(/\.(jpg|jpeg|png|gif|bmp|tiff|tif|webp)$/i)) return '';
        return mediaUrl;
    }

    function getPlaceholderSVG() {
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f0f0f0'/%3E%3C/svg%3E`;
    }

    function generateThumbnailHtml(mediaUrl, alignSetting = 'center') {
        const isVideo = isVideoUrl(mediaUrl);
        const objectPosition = getObjectPosition(alignSetting);

        if (!isVideo) {
            const imageUrl = mediaUrl;
            const placeholder = getPlaceholderSVG();

            if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
                const videoId = getYouTubeVideoId(mediaUrl);
                if (videoId) {
                    return `<img 
                        data-src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" 
                        src="${placeholder}"
                        alt="YouTube thumbnail" 
                        loading="lazy"
                        style="object-position: ${objectPosition}; background: var(--bg-secondary);"
                        class="lazy-image"
                        width="400"
                        height="300">`;
                }
            }

            if (mediaUrl.includes('vimeo.com')) {
                const vimeoId = (mediaUrl.match(/vimeo\.com\/(\d+)/) || [])[1];
                if (vimeoId) {
                    return '<img src="' + placeholder + '" alt="Vimeo thumbnail" class="vimeo-thumb lazy-image" loading="lazy"'
                        + ' data-vimeo-id="' + vimeoId + '"'
                        + ' style="object-position: ' + objectPosition + '; background:#1a1a2e; width:100%; height:100%;">';
                }
            }

            return `<img 
                data-src="${imageUrl}" 
                src="${placeholder}"
                alt="Portfolio media" 
                loading="lazy"
                style="object-position: ${objectPosition}; background: var(--bg-secondary);"
                class="lazy-image"
                width="400"
                height="300">`;
        }

        const youtubeEmbed = getYouTubeEmbedUrl(mediaUrl);
        if (youtubeEmbed) {
            const videoId = getYouTubeVideoId(mediaUrl);
            const placeholder = getPlaceholderSVG();
            return `<img 
                data-src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" 
                src="${placeholder}"
                alt="YouTube thumbnail" 
                loading="lazy"
                style="object-position: ${objectPosition}; background: var(--bg-secondary);"
                class="lazy-image"
                width="400"
                height="300">`;
        }

        const vimeoId = (mediaUrl.match(/vimeo\.com\/(\d+)/) || [])[1];
        if (vimeoId) {
            const placeholder = getPlaceholderSVG();
            return '<img src="' + placeholder + '" alt="Vimeo thumbnail" class="vimeo-thumb lazy-image" loading="lazy"'
                + ' data-vimeo-id="' + vimeoId + '"'
                + ' style="object-position: ' + objectPosition + '; background:#1a1a2e; width:100%; height:100%;">';
        }

        return `<video muted><source src="${mediaUrl}" type="video/mp4"></video>`;
    }

    // ========================================
    // LAZY LOADING
    // ========================================
    function setupLazyLoading() {
        if (!('IntersectionObserver' in window)) {
            document.querySelectorAll('img.lazy-image').forEach(img => {
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
                if (img.dataset.srcset) {
                    img.srcset = img.dataset.srcset;
                }
                img.classList.add('loaded');
            });
            return;
        }

        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;

                    if (img.classList.contains('loaded')) {
                        observer.unobserve(img);
                        return;
                    }

                    img.classList.add('loading');

                    if (img.dataset.src) {
                        const imgSrc = img.dataset.src;
                        img.src = imgSrc;
                        img.removeAttribute('data-src');
                    }

                    if (img.dataset.srcset) {
                        img.srcset = img.dataset.srcset;
                        img.removeAttribute('data-srcset');
                    }

                    img.onload = () => {
                        img.classList.remove('loading');
                        img.classList.add('loaded');
                        img.style.opacity = '0';
                        setTimeout(() => {
                            img.style.transition = 'opacity 0.3s ease';
                            img.style.opacity = '1';
                        }, 50);
                    };

                    img.onerror = () => {
                        img.classList.remove('loading');
                        img.classList.add('error');
                        if (img.dataset.fallback) {
                            img.src = img.dataset.fallback;
                            img.removeAttribute('data-fallback');
                        } else if (img.dataset.src && img.dataset.src !== img.src) {
                            const originalSrc = img.dataset.src;
                            if (originalSrc.match(/\.webp$/i)) {
                                const fallbackUrl = originalSrc.replace(/\.webp$/i, '.jpg');
                                if (fallbackUrl !== originalSrc) {
                                    img.src = fallbackUrl;
                                    img.dataset.fallback = originalSrc;
                                    return;
                                }
                            }
                            img.style.background = 'var(--bg-primary)';
                            img.style.display = 'flex';
                            img.style.alignItems = 'center';
                            img.style.justifyContent = 'center';
                            img.style.color = 'var(--text-muted)';
                            img.style.fontSize = '0.7rem';
                            img.alt = 'Image failed to load';
                        }
                    };

                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '100px 0px',
            threshold: 0.01
        });

        document.querySelectorAll('img.lazy-image:not(.loaded)').forEach(img => {
            imageObserver.observe(img);
        });
    }

    function setupLazyLoadingAfterRender() {
        setTimeout(setupLazyLoading, 100);
    }

    // ========================================
    // VIMEO THUMBNAILS
    // ========================================
    async function loadVimeoThumbnails() {
        const placeholders = document.querySelectorAll('img.vimeo-thumb[data-vimeo-id]');
        const seen = new Set();
        const fetches = [];
        placeholders.forEach(function(img) {
        const id = img.getAttribute('data-vimeo-id');
        if (seen.has(id)) return;
        seen.add(id);
        
        // Make sure loading class is applied
        img.classList.add('loading');
        
        const p = fetch('https://vimeo.com/api/oembed.json?url=https://vimeo.com/' + id + '&width=640')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.thumbnail_url) return;
                document.querySelectorAll('img.vimeo-thumb[data-vimeo-id="' + id + '"]')
                    .forEach(function(el) {
                        el.src = data.thumbnail_url;
                        el.removeAttribute('data-vimeo-id');
                        el.classList.remove('vimeo-thumb');
                        el.classList.remove('loading');
                        el.classList.add('loaded');
                        el.style.opacity = '1';
                    });
            })
            .catch(function() {
                document.querySelectorAll('img.vimeo-thumb[data-vimeo-id="' + id + '"]')
                    .forEach(function(el) {
                        el.style.background = 'linear-gradient(135deg,#1a1a2e,#16213e)';
                        el.removeAttribute('data-vimeo-id');
                        el.classList.remove('loading');
                        el.classList.add('loaded');
                    });
            });
        fetches.push(p);
    });
        return Promise.all(fetches);
    }

    // ========================================
// SHARE URL GENERATION
// ========================================

function generateShareUrl(projectIndex, mediaIndex = 0, mediaArray = []) {
    const shareData = {
        p: projectIndex,
        m: mediaIndex
    };
    const hash = btoa(JSON.stringify(shareData));
    return `${window.location.origin}${window.location.pathname}#share=${hash}`;
}


// ========================================
// DYNAMIC OPEN GRAPH / SOCIAL SHARING
// ========================================

function updateSocialMetaTags(project, mediaArray, mediaIndex) {
    // Get the preview image
    let previewImage = '';
    if (mediaArray && mediaArray.length > 0) {
        const media = mediaArray[mediaIndex || 0];
        if (media) {
            try {
                previewImage = new URL(media, window.location.href).href;
            } catch (e) {
                previewImage = media;
            }
        }
    }
    
    // Fallback to default social image
    if (!previewImage) {
        previewImage = new URL('tsp_social.png', window.location.href).href;
    }
    
    // Strip HTML from description and truncate
    let description = project.description || '';
    description = description.replace(/<[^>]*>/g, '');
    if (description.length > 150) {
        description = description.substring(0, 147) + '...';
    }
    if (!description) {
        description = 'Interactive Production, Design & Development. A curated collection of games, software, websites, and creative experiments.';
    }
    
    // Remove existing dynamic meta tags
    document.querySelectorAll('meta[data-dynamic]').forEach(el => el.remove());
    
    // Create dynamic meta tags
    const tags = [
        { property: 'og:title', content: `Tim Samoff | Portfolio - ${project.title}` },
        { property: 'og:description', content: description },
        { property: 'og:image', content: previewImage },
        { property: 'og:url', content: window.location.href },
        { property: 'twitter:title', content: `Tim Samoff | Portfolio - ${project.title}` },
        { property: 'twitter:description', content: description },
        { property: 'twitter:image', content: previewImage }
    ];
    
    tags.forEach(tag => {
        const meta = document.createElement('meta');
        meta.setAttribute('data-dynamic', 'true');
        meta.setAttribute('property', tag.property);
        meta.setAttribute('content', tag.content);
        document.head.appendChild(meta);
    });
    
    // Update page title
    document.title = `Tim Samoff | Portfolio - ${project.title}`;
}


function parseShareUrl() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#share=')) {
        try {
            const encoded = hash.substring(7);
            const shareData = JSON.parse(atob(encoded));
            
            // Update meta tags for this specific project
            if (shareData.p !== undefined && window.__projectsData) {
                const project = window.__projectsData[shareData.p];
                if (project) {
                    const mediaArray = project.media || [];
                    const mediaIndex = shareData.m || 0;
                    updateSocialMetaTags(project, mediaArray, mediaIndex);
                }
            }
            
            return shareData;
        } catch (e) {
            console.error('Invalid share URL', e);
        }
    }
    return null;
}

    function openMediaModal(mediaArray, startIndex = 0, projectId = null) {
        const modalWrapper = document.getElementById('modal-swiper-wrapper');
        if (!modalWrapper) return;

        modalManuallyClosed = false;

        let slidesHtml = '';
        mediaArray.forEach((mediaUrl, idx) => {
            const mediaHtml = generateModalMediaHtml(mediaUrl, idx);
            slidesHtml += `<div class="swiper-slide"><div class="modal-media-container">${mediaHtml}</div></div>`;
        });

        modalWrapper.innerHTML = slidesHtml;

        if (currentModalSwiper) {
            currentModalSwiper.destroy(true, true);
            currentModalSwiper = null;
        }

        modal.style.display = 'block';

        setTimeout(() => {
            currentModalSwiper = new Swiper('.modal-swiper', {
                loop: true,
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                initialSlide: startIndex,
                keyboard: { enabled: true },
                autoplay: false,
            });

            setTimeout(() => {
                const activeSlide = document.querySelector('.swiper-slide-active');
                if (activeSlide) {
                    const video = activeSlide.querySelector('video');
                    if (video && video.dataset.savedTime) {
                        video.currentTime = parseFloat(video.dataset.savedTime);
                        currentVideoElements.set(video.dataset.url, video);

                        video.addEventListener('timeupdate', () => {
                            if (video.dataset.url) {
                                saveVideoProgress(video.dataset.url, video.currentTime);
                            }
                        });
                    }
                }
            }, 200);

            if (currentModalSwiper && projectId !== null) {
                currentModalSwiper.on('slideChange', () => {
                    if (!modalManuallyClosed) {
                        const newIndex = currentModalSwiper.realIndex;
                        const shareUrl = generateShareUrl(projectId, newIndex, mediaArray);
                        window.history.replaceState({}, '', shareUrl);
                    }
                });
            }
        }, 100);
    }

    // ========================================
    // FORMATTING HELPERS
    // ========================================
    function formatCategoryForDisplay(cat) {
        if (!cat) return '';
        return cat.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ').replace(/&/g, '&');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================
    // FILTERING SYSTEM
    // ========================================
    let currentFilterValue = 'all';
    let allPortfolioItems = [];

    function setupFiltering() {
        const filterButtons = document.querySelectorAll('.filter-nav .filter-btn');

        filterButtons.forEach(button => {
            button.removeEventListener('click', filterHandler);
            button.removeEventListener('touchstart', filterHandler);
            button.addEventListener('click', filterHandler);
            button.addEventListener('touchstart', filterHandler, { passive: true });
        });

        function filterHandler(e) {
            // Prevent duplicate triggers on mobile
            if (e.type === 'touchstart' && e.target.closest('.filter-btn') !== e.currentTarget) {
                return;
            }
            
            const button = e.currentTarget;
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            currentFilterValue = button.getAttribute('data-filter');
            applyFilter();
        }
    }

    function applyFilter() {
    const grid = document.getElementById('portfolio-grid');
    const items = allPortfolioItems;
    let visibleCount = 0;
    
    // Create document fragment for visible items
    const fragment = document.createDocumentFragment();
    const visibleItems = [];
    
    // Collect visible items in order
    items.forEach((item) => {
        const itemCategory = item.getAttribute('data-category');
        let shouldShow = false;
        
        if (currentFilterValue === 'all') {
            shouldShow = true;
        } else if (currentFilterValue === 'uncategorized') {
            shouldShow = (!itemCategory || itemCategory === 'uncategorized' || itemCategory === '');
        } else {
            shouldShow = (itemCategory === currentFilterValue);
        }
        
        if (shouldShow) {
            visibleItems.push(item);
        }
    });
    
    // Clear grid
    grid.innerHTML = '';
    
    // Re-add visible items with animation
    visibleItems.forEach((item, index) => {
        // Reset item's display
        item.style.display = 'flex';
        item.style.visibility = 'visible';
        item.style.height = '';
        item.style.minHeight = '';
        item.style.maxHeight = '';
        item.style.padding = '';
        item.style.margin = '';
        item.style.overflow = '';
        item.style.border = '';
        item.style.opacity = '';
        item.style.order = index;
        
        // Remove all animation classes
        item.classList.remove('hidden-item', 'fly-out', 'fly-in', 'initial-load');
        
        // Set item index for stagger
        item.style.setProperty('--item-index', index);
        
        // Add to grid
        grid.appendChild(item);
        
        // Trigger animation with delay
        setTimeout(() => {
            item.classList.add('fly-in');
        }, 50 + (index * 40));
    });
    
    // Re-setup swipers for visible items
    const projects = window.__projectsData || [];
    projects.forEach((project, idx) => {
        if (project.published === false) return;
        const mediaArray = project.media || (project.image ? [project.image] : []);
        if (mediaArray.length > 1) {
            const swiperContainer = document.querySelector(`.card-swiper-${idx}`);
            if (swiperContainer) {
                // Create swiper instance
                const swiper = new Swiper(`.card-swiper-${idx}`, {
                    loop: true,
                    navigation: {
                        nextEl: `.card-swiper-next-${idx}`,
                        prevEl: `.card-swiper-prev-${idx}`,
                    },
                    pagination: {
                        el: `.card-swiper-pagination-${idx}`,
                        clickable: true,
                    },
                    autoplay: false,
                });
                
                // Store swiper instance on container for later use
                swiperContainer.swiper = swiper;
                
                // Store media array on the container
                swiperContainer.dataset.mediaArray = JSON.stringify(mediaArray);
                swiperContainer.dataset.projectIndex = idx;
            }
        }
    });
}

    // ========================================
    // SCROLL BUTTON FUNCTIONALITY
    // ========================================
    function setupScrollButton() {
        const scrollBtn = document.querySelector('.scroll-btn');
        const filterNav = document.getElementById('filter-nav');

        if (!scrollBtn || !filterNav) return;

        scrollBtn.addEventListener('click', function(e) {
            e.preventDefault();

            // Get header height
            const header = document.getElementById('site-header');
            const headerHeight = header ? header.offsetHeight : 0;

            // Get filter nav's position relative to the document
            const filterRect = filterNav.getBoundingClientRect();
            const filterTop = filterRect.top + window.pageYOffset;

            // Target: filter nav should be positioned just below the header
            const targetScrollY = filterTop - headerHeight;

            const startPosition = window.pageYOffset;
            const distance = targetScrollY - startPosition;
            const duration = 800;
            let startTime = null;

            function smoothScroll(currentTime) {
                if (startTime === null) startTime = currentTime;
                const timeElapsed = currentTime - startTime;
                const progress = Math.min(timeElapsed / duration, 1);

                const ease = progress < 0.5 ?
                    4 * progress * progress * progress :
                    1 - Math.pow(-2 * progress + 2, 3) / 2;

                window.scrollTo(0, startPosition + distance * ease);

                if (timeElapsed < duration) {
                    requestAnimationFrame(smoothScroll);
                }
            }

            requestAnimationFrame(smoothScroll);
        });
    }

    // ========================================
    // PROJECT LOADING
    // ========================================
    function loadProjects(projects) {
    console.log('Projects loaded:', projects.length);

    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const visibleProjects = projects.filter(project => project.published !== false);

    if (visibleProjects.length === 0) {
        grid.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-muted); grid-column: 1 / -1; width: 100%;">
            📭 No published projects yet.
        </div>`;
        return;
    }

    visibleProjects.forEach((project, visibleIdx) => {
        const originalIndex = projects.findIndex(p => p === project);
        let mediaArray = project.media;
        if (!mediaArray || mediaArray.length === 0) {
            mediaArray = project.image ? [project.image] : [];
        }

        const imageAlign = project.imageAlign || 'center';

        const article = document.createElement('article');
        article.className = 'portfolio-item';
        article.setAttribute('data-category', project.category || 'uncategorized');
        article.setAttribute('data-project-id', originalIndex);

        let thumbnailHtml = '';
        if (mediaArray.length === 1) {
            thumbnailHtml = `<div class="item-image">${generateThumbnailHtml(mediaArray[0], imageAlign)}</div>`;
        } else if (mediaArray.length > 1) {
            let swiperSlides = '';
            mediaArray.forEach((mediaUrl) => {
                swiperSlides += `<div class="swiper-slide">${generateThumbnailHtml(mediaUrl, imageAlign)}</div>`;
            });
            thumbnailHtml = `
                <div class="item-image card-swiper-container">
                    <div class="swiper card-swiper-${originalIndex}">
                        <div class="swiper-wrapper">${swiperSlides}</div>
                        <div class="swiper-button-prev card-swiper-prev-${originalIndex}"></div>
                        <div class="swiper-button-next card-swiper-next-${originalIndex}"></div>
                        <div class="swiper-pagination card-swiper-pagination-${originalIndex}"></div>
                    </div>
                </div>
            `;
        } else {
            thumbnailHtml = `<div class="item-image"><div class="no-media">No media</div></div>`;
        }

        const displayHeading = project.cardHeading || project.tag || '';
        const displayCategory = project.category ? formatCategoryForDisplay(project.category) : 'Uncategorized';

        article.innerHTML = `
            ${thumbnailHtml}
            <div class="item-content">
                <span class="category-tag" data-category-filter="${escapeHtml(project.category || 'uncategorized')}">${escapeHtml(displayCategory)}</span>
                <h3>${escapeHtml(project.title)}</h3>
                <p>${renderDescription(project.description)}</p>
            </div>
            <div class="share-hint">🔗 Click to Share</div>
        `;

        article.addEventListener('click', (e) => {
        if (e.target.closest('.share-hint')) return;
        if (e.target.closest('.swiper-button-prev') || e.target.closest('.swiper-button-next')) {
            e.stopPropagation();
            return;
        }
        if (e.target.closest('.swiper-pagination') || e.target.closest('.swiper-pagination-bullet')) {
            e.stopPropagation();
            return;
        }
        if (e.target.tagName === 'A') {
            e.stopPropagation();
            return;
        }

        if (mediaArray.length > 0) {
            // Get the active slide index from the swiper if it exists
            let startIndex = 0;
            const swiperContainer = article.querySelector('.card-swiper-container .swiper');
            if (swiperContainer && swiperContainer.swiper) {
                // Get real index (not looped index)
                startIndex = swiperContainer.swiper.realIndex || 0;
            }
            
            openMediaModal(mediaArray, startIndex, originalIndex);
            const shareUrl = generateShareUrl(originalIndex, startIndex, mediaArray);
            window.history.pushState({}, '', shareUrl);
        }
    });

        const shareHint = article.querySelector('.share-hint');
        if (shareHint) {
            shareHint.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const shareUrl = generateShareUrl(originalIndex, 0, mediaArray);
                const copied = await copyToClipboard(shareUrl);

                if (copied) {
                    showCardNotification(article, '✓ Copied!');
                } else {
                    showCardNotification(article, 'Failed to copy', true);
                }
            });
        }

        grid.appendChild(article);
    });

    allPortfolioItems = document.querySelectorAll('.portfolio-item');

    // Set initial animation with stagger
    allPortfolioItems.forEach((item, index) => {
        item.style.setProperty('--item-index', index);
        // Add initial-load class after a small delay
        setTimeout(() => {
            item.classList.add('initial-load');
        }, 50 + (index * 30));
    });

    const categories = [...new Set(visibleProjects.map(p => p.category).filter(c => c && c !== ''))].sort((a, b) => a.localeCompare(b));

    const filterNav = document.querySelector('.filter-nav');
    if (filterNav) {
        filterNav.innerHTML = '';

        const gamesCategory = categories.find(cat => cat.toLowerCase().includes('game'));
        const otherCategories = categories.filter(cat => cat !== gamesCategory);

        const allBtn = document.createElement('button');
        allBtn.className = 'filter-btn active';
        allBtn.setAttribute('data-filter', 'all');
        allBtn.textContent = 'All Projects';
        filterNav.appendChild(allBtn);

        const hasUncategorizedProjects = visibleProjects.some(p => !p.category || p.category === '');
        if (hasUncategorizedProjects) {
            const uncatBtn = document.createElement('button');
            uncatBtn.className = 'filter-btn';
            uncatBtn.setAttribute('data-filter', 'uncategorized');
            uncatBtn.textContent = 'Uncategorized';
            filterNav.appendChild(uncatBtn);
        }

        if (gamesCategory || otherCategories.length > 0) {
            const divider = document.createElement('span');
            divider.className = 'filter-divider';
            filterNav.appendChild(divider);
        }

        if (gamesCategory) {
            const gamesBtn = document.createElement('button');
            gamesBtn.className = 'filter-btn filter-btn-games';
            gamesBtn.setAttribute('data-filter', gamesCategory);
            gamesBtn.textContent = formatCategoryForDisplay(gamesCategory);
            filterNav.appendChild(gamesBtn);

            if (otherCategories.length > 0) {
                const divider = document.createElement('span');
                divider.className = 'filter-divider';
                filterNav.appendChild(divider);
            }
        }

        otherCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.setAttribute('data-filter', cat);
            btn.textContent = formatCategoryForDisplay(cat);
            filterNav.appendChild(btn);
        });
    }

    projects.forEach((project, idx) => {
        if (project.published === false) return;
        const mediaArray = project.media || (project.image ? [project.image] : []);
        if (mediaArray.length > 1) {
            const swiperContainer = document.querySelector(`.card-swiper-${idx}`);
            if (swiperContainer) {
                new Swiper(`.card-swiper-${idx}`, {
                    loop: true,
                    navigation: {
                        nextEl: `.card-swiper-next-${idx}`,
                        prevEl: `.card-swiper-prev-${idx}`,
                    },
                    pagination: {
                        el: `.card-swiper-pagination-${idx}`,
                        clickable: true,
                    },
                    autoplay: false,
                });
            }
        }
    });

    setupLazyLoadingAfterRender();
    loadVimeoThumbnails();

    document.querySelectorAll('.category-tag').forEach(tag => {
        const newTag = tag.cloneNode(true);
        tag.parentNode.replaceChild(newTag, tag);

        newTag.addEventListener('click', (e) => {
            e.stopPropagation();
            const category = newTag.getAttribute('data-category-filter');
            if (category) {
                const filterButtons = document.querySelectorAll('.filter-nav .filter-btn');
                filterButtons.forEach(btn => {
                    const btnFilter = btn.getAttribute('data-filter');
                    if (btnFilter === category) {
                        btn.click();
                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }
        });
    });

    setupFiltering();
    setupScrollButton();

    const shareData = parseShareUrl();
    if (shareData && shareData.p !== undefined && !modalManuallyClosed) {
        const targetProject = projects[shareData.p];
        if (targetProject && targetProject.published !== false) {
            const mediaArray = targetProject.media || [];
            if (mediaArray.length > 0) {
                setTimeout(() => {
                    openMediaModal(mediaArray, shareData.m || 0, shareData.p);
                }, 500);
            }
        }
    }
}

    // ========================================
    // TOUCH SUPPORT
    // ========================================
    function applyFilter() {
        const grid = document.getElementById('portfolio-grid');
        const items = allPortfolioItems;
        let visibleCount = 0;
        
        // Create document fragment for visible items
        const fragment = document.createDocumentFragment();
        const visibleItems = [];
        
        // Collect visible items in order
        items.forEach((item) => {
            const itemCategory = item.getAttribute('data-category');
            let shouldShow = false;
            
            if (currentFilterValue === 'all') {
                shouldShow = true;
            } else if (currentFilterValue === 'uncategorized') {
                shouldShow = (!itemCategory || itemCategory === 'uncategorized' || itemCategory === '');
            } else {
                shouldShow = (itemCategory === currentFilterValue);
            }
            
            if (shouldShow) {
                visibleItems.push(item);
            }
        });
        
        // Clear grid
        grid.innerHTML = '';
        
        // Re-add visible items with animation
        visibleItems.forEach((item, index) => {
            // Reset item's display
            item.style.display = 'flex';
            item.style.visibility = 'visible';
            item.style.height = '';
            item.style.minHeight = '';
            item.style.maxHeight = '';
            item.style.padding = '';
            item.style.margin = '';
            item.style.overflow = '';
            item.style.border = '';
            item.style.opacity = '';
            item.style.order = index;
            
            // Remove all animation classes
            item.classList.remove('hidden-item', 'fly-out', 'fly-in', 'initial-load');
            
            // Set item index for stagger
            item.style.setProperty('--item-index', index);
            
            // Add to grid
            grid.appendChild(item);
            
            // Force reflow for mobile (critical for animations on touch devices)
            void item.offsetHeight;
            
            // Trigger animation with delay - use requestAnimationFrame for mobile
            setTimeout(() => {
                requestAnimationFrame(() => {
                    item.classList.add('fly-in');
                });
            }, 50 + (index * 40));
        });
        
        // Re-setup swipers for visible items
        const projects = window.__projectsData || [];
        projects.forEach((project, idx) => {
            if (project.published === false) return;
            const mediaArray = project.media || (project.image ? [project.image] : []);
            if (mediaArray.length > 1) {
                const swiperContainer = document.querySelector(`.card-swiper-${idx}`);
                if (swiperContainer) {
                    // Create swiper instance
                    const swiper = new Swiper(`.card-swiper-${idx}`, {
                        loop: true,
                        navigation: {
                            nextEl: `.card-swiper-next-${idx}`,
                            prevEl: `.card-swiper-prev-${idx}`,
                        },
                        pagination: {
                            el: `.card-swiper-pagination-${idx}`,
                            clickable: true,
                        },
                        autoplay: false,
                    });
                    
                    // Store swiper instance on container for later use
                    swiperContainer.swiper = swiper;
                    
                    // Store media array on the container
                    swiperContainer.dataset.mediaArray = JSON.stringify(mediaArray);
                    swiperContainer.dataset.projectIndex = idx;
                }
            }
        });
    }

    // ========================================
    // INITIALIZATION
    // ========================================
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    fetch('projects.json')
        .then(response => response.json())
        .then(data => {
            loadProjects(data);
        })
        .catch(error => {
            console.error('Error loading projects:', error);
            grid.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--accent-red);">Error loading projects. Make sure projects.json exists.</div>';
        });
});
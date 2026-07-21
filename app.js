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
    // DOM REFERENCES
    // ========================================
    const modal = document.getElementById('media-modal');
    const modalClose = document.querySelector('.modal-close');
    const overlayElement = document.getElementById('modal-description-overlay');
    const overlayToggleBtn = document.getElementById('overlay-toggle-btn');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayDesc = document.getElementById('overlay-desc');
    const overlayHeader = document.querySelector('.overlay-header');
    const grid = document.getElementById('portfolio-grid');
    
    let currentModalSwiper = null;
    let currentVideoElements = new Map();
    let modalManuallyClosed = false;
    let currentFilterValue = 'selected';
    let allPortfolioItems = [];

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
    function closeModal() {
        if (!modal) return;
        modal.style.display = 'none';
        modalManuallyClosed = true;

        hideModalOverlay();
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
    // MODAL OVERLAY
    // ========================================
    function showModalOverlay(title, descriptionHTML) {
        if (!overlayElement) return;
        if (overlayTitle) overlayTitle.textContent = title || 'Untitled';
        
        if (descriptionHTML) {
            overlayDesc.innerHTML = renderDescription(descriptionHTML);
        } else {
            overlayDesc.innerHTML = 'No description available.';
        }
        
        // Always start collapsed when showing
        overlayElement.classList.add('collapsed');
        overlayElement.classList.add('active');
        
        // Set correct icon state
        updateToggleIcon();
    }

    function hideModalOverlay() {
        if (overlayElement) overlayElement.classList.remove('active');
    }

    function updateToggleIcon() {
        if (!overlayToggleBtn) return;
        const icon = overlayToggleBtn.querySelector('i');
        if (!icon) return;
        
        if (overlayElement.classList.contains('collapsed')) {
            icon.className = 'fas fa-info-circle icon-info';
        } else {
            icon.className = 'fas fa-chevron-down icon-chevron';
        }
    }

    // Toggle button click handler
    if (overlayToggleBtn) {
        overlayToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            overlayElement.classList.toggle('collapsed');
            updateToggleIcon();
        });
    }

    // Make the header clickable to toggle as well
    if (overlayHeader) {
        overlayHeader.addEventListener('click', (e) => {
            if (e.target.closest('#overlay-toggle-btn')) return;
            overlayElement.classList.toggle('collapsed');
            updateToggleIcon();
        });
    }

    // ========================================
    // MODAL MEDIA HTML GENERATION
    // ========================================
    function generateModalMediaHtml(mediaUrl, mediaIndex) {
        const isVideo = isVideoUrl(mediaUrl);
        const youtubeEmbed = getYouTubeEmbedUrl(mediaUrl);
        const vimeoEmbed = getVimeoEmbedUrl(mediaUrl);

        if (isVideo) {
            if (youtubeEmbed) {
                return `<iframe src="${youtubeEmbed}?autoplay=0&enablejsapi=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%; height:100%;"></iframe>`;
            } else if (vimeoEmbed) {
                return `<iframe src="${vimeoEmbed}?autoplay=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%; height:100%;"></iframe>`;
            } else {
                const savedProgress = getVideoProgress(mediaUrl);
                return `<video controls data-url="${mediaUrl}" data-media-index="${mediaIndex}" data-saved-time="${savedProgress}" style="width:100%; height:100%;"><source src="${mediaUrl}" type="video/mp4">Your browser does not support video.</video>`;
            }
        } else {
            return `<img src="${mediaUrl}" alt="Portfolio image" style="max-width:100%; max-height:100%; object-fit:contain;">`;
        }
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
            background: ${isError ? 'var(--color-error)' : 'var(--color-success)'};
            color: white;
            padding: 8px 16px;
            border-radius: 24px;
            font-size: 0.85rem;
            font-weight: 500;
            z-index: 20;
            white-space: nowrap;
            box-shadow: var(--shadow-sm);
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

    function showFloatingNotification(message, isSuccess = true) {
        const existing = document.querySelector('.floating-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'floating-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: ${isSuccess ? 'var(--color-success)' : 'var(--color-error)'};
            color: white;
            padding: 10px 20px;
            border-radius: 40px;
            font-size: 0.85rem;
            font-weight: 500;
            z-index: 10000;
            box-shadow: var(--shadow-sm);
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

            tmp.querySelectorAll('live').forEach(el => {
                const innerLink = el.querySelector('a');
                let url = el.getAttribute('href') || '';
                let text = el.textContent || 'Live';
                
                if (innerLink) {
                    url = innerLink.getAttribute('href') || '';
                    text = innerLink.textContent || 'Live';
                    while (innerLink.firstChild) {
                        el.insertBefore(innerLink.firstChild, innerLink);
                    }
                    el.removeChild(innerLink);
                }
                
                text = el.textContent.trim() || 'Live';
                
                if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.className = 'live-badge-link';
                    
                    const dot = document.createElement('span');
                    dot.className = 'live-dot';
                    const label = document.createTextNode(text);
                    
                    link.appendChild(dot);
                    link.appendChild(label);
                    
                    el.parentNode.replaceChild(link, el);
                } else {
                    const badge = document.createElement('span');
                    badge.className = 'live-badge';
                    
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

    function generateThumbnailHtml(mediaUrl, alignSetting = 'center') {
        const isVideo = isVideoUrl(mediaUrl);
        const objectPosition = getObjectPosition(alignSetting);

        if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
            const videoId = getYouTubeVideoId(mediaUrl);
            if (videoId) {
                return `<div class="thumb-shimmer">
                    <img
                        data-src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg"
                        alt="YouTube thumbnail"
                        style="object-position: ${objectPosition};"
                        class="thumb-media"
                        width="400"
                        height="300">
                </div>`;
            }
        }

        if (mediaUrl.includes('vimeo.com')) {
            const vimeoId = (mediaUrl.match(/vimeo\.com\/(\d+)/) || [])[1];
            if (vimeoId) {
                return `<div class="thumb-shimmer">
                    <img
                        data-src="https://vumbnail.com/${vimeoId}.jpg"
                        data-vimeo-fallback="https://i.vimeocdn.com/video/${vimeoId}_640.jpg"
                        alt="Vimeo thumbnail"
                        style="object-position: ${objectPosition};"
                        class="thumb-media"
                        width="400"
                        height="300">
                </div>`;
            }
        }

        if (!isVideo) {
            return `<div class="thumb-shimmer">
                <img
                    data-src="${mediaUrl}"
                    alt="Portfolio media"
                    style="object-position: ${objectPosition};"
                    class="thumb-media"
                    width="400"
                    height="300">
            </div>`;
        }

        return `<div class="thumb-shimmer">
            <video class="thumb-media" muted playsinline preload="metadata">
                <source src="${mediaUrl}#t=0.1" type="video/mp4">
            </video>
        </div>`;
    }

    // ========================================
    // LAZY LOADING
    // ========================================
    function setupLazyLoading() {
        if (!('IntersectionObserver' in window)) {
            document.querySelectorAll('.thumb-shimmer').forEach(wrapper => {
                const img = wrapper.querySelector('img.thumb-media[data-src]');
                if (img) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                wrapper.classList.add('loaded');
            });
            return;
        }

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const wrapper = entry.target;
                if (wrapper.classList.contains('loaded')) {
                    obs.unobserve(wrapper);
                    return;
                }

                obs.unobserve(wrapper);
                wrapper.classList.add('loading');

                const img = wrapper.querySelector('img.thumb-media');
                const video = wrapper.querySelector('video.thumb-media');

                if (img) {
                    const onLoad = () => {
                        wrapper.classList.remove('loading');
                        wrapper.classList.add('loaded');
                    };
                    const onError = () => {
                        if (img.dataset.vimeoFallback) {
                            img.src = img.dataset.vimeoFallback;
                            delete img.dataset.vimeoFallback;
                        } else {
                            wrapper.classList.remove('loading');
                            wrapper.classList.add('error');
                        }
                    };
                    img.addEventListener('load', onLoad, { once: true });
                    img.addEventListener('error', onError, { once: true });
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    } else if (img.complete && img.naturalWidth > 0) {
                        onLoad();
                    }
                } else if (video) {
                    const finish = () => {
                        wrapper.classList.remove('loading');
                        wrapper.classList.add('loaded');
                    };
                    video.addEventListener('loadeddata', finish, { once: true });
                    video.addEventListener('error', () => {
                        wrapper.classList.remove('loading');
                        wrapper.classList.add('error');
                    }, { once: true });
                    if (video.readyState >= 2) {
                        finish();
                    } else {
                        video.load();
                    }
                }
            });
        }, {
            rootMargin: '100px 0px',
            threshold: 0.01
        });

        document.querySelectorAll('.thumb-shimmer:not(.loaded)').forEach(wrapper => {
            observer.observe(wrapper);
        });
    }

    // ========================================
    // SHARE URL GENERATION
    // ========================================
    function generateShareUrl(projectIndex, mediaIndex = 0) {
        const shareData = {
            p: projectIndex,
            m: mediaIndex
        };
        const data = btoa(JSON.stringify(shareData));
        return `${window.location.origin}${window.location.pathname}share.html?share=${data}`;
    }

    // ========================================
    // DYNAMIC OPEN GRAPH / SOCIAL SHARING
    // ========================================
    function updateSocialMetaTags(project, mediaArray, mediaIndex) {
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
        
        if (!previewImage) {
            previewImage = new URL('tsp_social.png', window.location.href).href;
        }
        
        let description = project.description || '';
        description = description.replace(/<[^>]*>/g, '');
        if (description.length > 150) {
            description = description.substring(0, 147) + '...';
        }
        if (!description) {
            description = 'Interactive Production, Design & Development. A curated collection of games, software, websites, and creative experiments.';
        }
        
        document.querySelectorAll('meta[data-dynamic]').forEach(el => el.remove());
        
        const tags = [
            { property: 'og:title', content: `Tim Samoff | Portfolio - ${project.title}` },
            { property: 'og:description', content: description },
            { property: 'og:image', content: previewImage },
            { property: 'og:url', content: window.location.href.split('?')[0] },
            { name: 'twitter:title', content: `Tim Samoff | Portfolio - ${project.title}` },
            { name: 'twitter:description', content: description },
            { name: 'twitter:image', content: previewImage }
        ];
        
        tags.forEach(tag => {
            const meta = document.createElement('meta');
            meta.setAttribute('data-dynamic', 'true');
            if (tag.property) {
                meta.setAttribute('property', tag.property);
            }
            if (tag.name) {
                meta.setAttribute('name', tag.name);
            }
            meta.setAttribute('content', tag.content);
            document.head.appendChild(meta);
        });
        
        document.title = `Tim Samoff | Portfolio - ${project.title}`;
    }

    function parseShareUrl() {
        const params = new URLSearchParams(window.location.search);
        let encoded = params.get('share');
        let shareData = null;
        
        if (encoded) {
            try {
                try {
                    shareData = JSON.parse(atob(encoded));
                } catch(e) {
                    shareData = JSON.parse(atob(decodeURIComponent(encoded)));
                }
            } catch(e) {
                console.error('Invalid share data:', e);
            }
        }
        
        if (!shareData) {
            const hash = window.location.hash;
            if (hash && hash.startsWith('#share=')) {
                try {
                    const encodedHash = hash.substring(7);
                    shareData = JSON.parse(atob(encodedHash));
                } catch(e) {
                    console.error('Invalid share URL in hash:', e);
                }
            }
        }
        
        if (shareData && shareData.p !== undefined && window.__projectsData) {
            const project = window.__projectsData[shareData.p];
            if (project) {
                const mediaArray = project.media || [];
                const mediaIndex = shareData.m || 0;
                updateSocialMetaTags(project, mediaArray, mediaIndex);
            }
        }
        
        return shareData;
    }

    // ========================================
    // OPEN MEDIA MODAL
    // ========================================
    function openMediaModal(mediaArray, startIndex = 0, projectId = null) {
        const modalWrapper = document.getElementById('modal-swiper-wrapper');
        
        if (!modalWrapper) return;

        modalManuallyClosed = false;

        let project = null;
        if (projectId !== null && window.__projectsData) {
            project = window.__projectsData[projectId];
        }
        
        if (project) {
            showModalOverlay(project.title, project.description);
        } else {
            if (window.__projectsData) {
                for (const p of window.__projectsData) {
                    if (p.media && arraysEqual(p.media, mediaArray)) {
                        project = p;
                        showModalOverlay(p.title, p.description);
                        break;
                    }
                }
            }
            if (!project) {
                showModalOverlay('', '');
            }
        }

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
                        const shareUrl = generateShareUrl(projectId, newIndex);
                        window.history.replaceState({}, '', shareUrl);
                    }
                });
            }
        }, 100);
    }

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================
    function arraysEqual(a, b) {
        if (a === b) return true;
        if (!a || !b) return false;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

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
    // FILTERING SYSTEM WITH URL SYNC
    // ========================================
    const filterAliases = {
        'game': 'game_design_&_development',
        'brand': 'brand_&_identity',
        'web': 'web_design_&_development',
        'production': 'production_&_installation',
        'digital': 'digital_art_&_design',
        'motion': 'motion_graphics_&_animation',
        'app': 'app_design_&_development',
        'ux': 'user_experience',
        'selected': 'selected',
        'all': 'all',
        'uncategorized': 'uncategorized'
    };

    function setupFiltering() {
        const filterButtons = document.querySelectorAll('.filter-nav .filter-btn');

        filterButtons.forEach(button => {
            button.removeEventListener('click', filterHandler);
            button.removeEventListener('touchstart', filterHandler);
            button.addEventListener('click', filterHandler);
            button.addEventListener('touchstart', filterHandler, { passive: true });
        });

        function filterHandler(e) {
            if (e.type === 'touchstart' && e.target.closest('.filter-btn') !== e.currentTarget) {
                return;
            }
            
            const button = e.currentTarget;
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            currentFilterValue = button.getAttribute('data-filter');
            updateURLWithFilter(currentFilterValue);
            applyFilter();
        }
    }

    function updateURLWithFilter(filterValue) {
        if (window.history && window.history.pushState) {
            const url = new URL(window.location);
            
            if (filterValue === 'all' || filterValue === 'selected') {
                url.searchParams.delete('filter');
            } else {
                let alias = null;
                for (const [key, value] of Object.entries(filterAliases)) {
                    if (value === filterValue) {
                        alias = key;
                        break;
                    }
                }
                url.searchParams.set('filter', alias || filterValue);
            }
            
            window.history.pushState({}, '', url);
        }
    }

    function applyFilter() {
        const grid = document.getElementById('portfolio-grid');
        const items = allPortfolioItems;
        
        const visibleItems = [];
        
        items.forEach((item) => {
            const itemCategories = item.__categories || [];
            const isSelected = item.getAttribute('data-selected') === 'true';
            let shouldShow = false;
            
            if (currentFilterValue === 'all') {
                shouldShow = true;
            } else if (currentFilterValue === 'selected') {
                shouldShow = isSelected;
            } else if (currentFilterValue === 'uncategorized') {
                shouldShow = itemCategories.length === 0;
            } else {
                shouldShow = itemCategories.includes(currentFilterValue);
            }
            
            if (shouldShow) {
                visibleItems.push(item);
            }
        });
        
        grid.innerHTML = '';
        
        visibleItems.forEach((item, index) => {
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
            
            item.classList.remove('hidden-item', 'fly-out', 'fly-in', 'initial-load');
            item.style.setProperty('--item-index', index);
            
            grid.appendChild(item);
            
            setTimeout(() => {
                item.classList.add('fly-in');
            }, 50 + (index * 40));
        });
        
        const projects = window.__projectsData || [];
        projects.forEach((project, idx) => {
            if (project.published === false) return;
            const mediaArray = project.media || (project.image ? [project.image] : []);
            if (mediaArray.length > 1) {
                const swiperContainer = document.querySelector(`.card-swiper-${idx}`);
                if (swiperContainer) {
                    if (swiperContainer.swiper) {
                        swiperContainer.swiper.destroy(true, true);
                    }
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
        
        setTimeout(setupLazyLoading, 100);
    }

    function applyFilterFromURL() {
        const params = new URLSearchParams(window.location.search);
        let filterValue = params.get('filter');
        
        if (!filterValue) return;
        
        if (filterAliases[filterValue]) {
            filterValue = filterAliases[filterValue];
        }
        
        const buttons = document.querySelectorAll('.filter-nav .filter-btn');
        let found = false;
        
        buttons.forEach(btn => {
            const btnFilter = btn.getAttribute('data-filter');
            if (btnFilter === filterValue) {
                btn.click();
                found = true;
            }
        });
        
        if (!found) {
            const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
            if (allBtn) allBtn.click();
        }
        
        scrollToFilterPills();
    }

    function scrollToFilterPills() {
        const filterNav = document.getElementById('filter-nav');
        if (!filterNav) {
            setTimeout(scrollToFilterPills, 200);
            return;
        }

        const header = document.getElementById('site-header');
        const headerHeight = header ? header.offsetHeight : 0;
        const filterRect = filterNav.getBoundingClientRect();
        const filterTop = filterRect.top + window.pageYOffset;
        const targetScrollY = filterTop - headerHeight;

        const startPosition = window.pageYOffset;
        const distance = targetScrollY - startPosition;
        const duration = 800;
        let startTime = null;

        if (Math.abs(distance) < 10) return;

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

        setTimeout(() => {
            requestAnimationFrame(smoothScroll);
        }, 400);
    }

    function setupScrollButton() {
        const scrollBtn = document.querySelector('.scroll-btn');
        const filterNav = document.getElementById('filter-nav');

        if (!scrollBtn || !filterNav) return;

        scrollBtn.addEventListener('click', function(e) {
            e.preventDefault();

            const header = document.getElementById('site-header');
            const headerHeight = header ? header.offsetHeight : 0;
            const filterRect = filterNav.getBoundingClientRect();
            const filterTop = filterRect.top + window.pageYOffset;
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
        window.__projectsData = projects;

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
            const isSelected = project.selected === true;
            const categories = project.categories || [];
            const categoryAttr = categories.length > 0 ? categories.join(',') : 'uncategorized';

            const article = document.createElement('article');
            article.className = 'portfolio-item';
            article.setAttribute('data-category', categoryAttr);
            article.setAttribute('data-project-id', originalIndex);
            article.setAttribute('data-selected', isSelected ? 'true' : 'false');
            article.__categories = categories;

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

            article.innerHTML = `
                ${thumbnailHtml}
                <div class="item-content">
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
                    let startIndex = 0;
                    const swiperContainer = article.querySelector('.card-swiper-container .swiper');
                    if (swiperContainer && swiperContainer.swiper) {
                        startIndex = swiperContainer.swiper.realIndex || 0;
                    }
                    
                    openMediaModal(mediaArray, startIndex, originalIndex);
                    const shareUrl = generateShareUrl(originalIndex, startIndex);
                    window.history.pushState({}, '', shareUrl);
                }
            });

            const shareHint = article.querySelector('.share-hint');
            if (shareHint) {
                shareHint.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const shareUrl = generateShareUrl(originalIndex, 0);
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

        allPortfolioItems.forEach((item, index) => {
            item.style.setProperty('--item-index', index);
            setTimeout(() => {
                item.classList.add('initial-load');
            }, 50 + (index * 30));
        });

        const allCategories = new Set();
        visibleProjects.forEach(p => {
            const cats = p.categories || [];
            cats.forEach(c => allCategories.add(c));
        });
        const categories = [...allCategories].filter(c => c && c !== '').sort((a, b) => a.localeCompare(b));
        const hasSelected = visibleProjects.some(p => p.selected === true);
        const hasUncategorized = visibleProjects.some(p => {
            const cats = p.categories || [];
            return cats.length === 0;
        });

        const filterNav = document.querySelector('.filter-nav');
        if (filterNav) {
            filterNav.innerHTML = '';

            const allBtn = document.createElement('button');
            allBtn.className = 'filter-btn';
            allBtn.setAttribute('data-filter', 'all');
            allBtn.textContent = 'All Projects';
            filterNav.appendChild(allBtn);

            if (hasSelected) {
                const divider1 = document.createElement('span');
                divider1.className = 'filter-divider';
                filterNav.appendChild(divider1);

                const selectedBtn = document.createElement('button');
                selectedBtn.className = 'filter-btn filter-btn-selected active';
                selectedBtn.setAttribute('data-filter', 'selected');
                selectedBtn.textContent = 'Selected Work';
                filterNav.appendChild(selectedBtn);
            }

            if (categories.length > 0 || hasUncategorized) {
                const divider = document.createElement('span');
                divider.className = 'filter-divider';
                filterNav.appendChild(divider);
            }

            if (hasUncategorized) {
                const uncatBtn = document.createElement('button');
                uncatBtn.className = 'filter-btn';
                uncatBtn.setAttribute('data-filter', 'uncategorized');
                uncatBtn.textContent = 'Uncategorized';
                filterNav.appendChild(uncatBtn);
            }

            categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'filter-btn';
                btn.setAttribute('data-filter', cat);
                const displayName = formatCategoryForDisplay(cat);
                btn.textContent = displayName;
                filterNav.appendChild(btn);
            });
        }

        currentFilterValue = hasSelected ? 'selected' : 'all';
        
        setTimeout(() => {
            const activeBtn = document.querySelector(`.filter-btn[data-filter="${currentFilterValue}"]`);
            if (activeBtn) {
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                activeBtn.classList.add('active');
            }
            applyFilter();
        }, 100);

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

        setTimeout(setupLazyLoading, 200);
        setupFiltering();
        setupScrollButton();

        setTimeout(() => {
            applyFilterFromURL();
        }, 150);

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
    // INITIALIZATION
    // ========================================
    if (!grid) return;

    fetch('projects.json')
        .then(response => response.json())
        .then(data => {
            const migratedData = data.map(project => {
                if (!project.categories && project.category) {
                    project.categories = [project.category];
                    delete project.category;
                }
                if (!project.categories) {
                    project.categories = [];
                }
                return project;
            });
            loadProjects(migratedData);
        })
        .catch(error => {
            console.error('Error loading projects:', error);
            grid.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--color-error);">Error loading projects. Make sure projects.json exists.</div>';
        });
});
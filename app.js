document.addEventListener('DOMContentLoaded', () => {
    // Dark/Light Preference Engine
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

    // Modal elements
    const modal = document.getElementById('media-modal');
    const modalClose = document.querySelector('.modal-close');
    let currentModalSwiper = null;
    let currentVideoElements = new Map();

    // Track if modal was manually closed
    let modalManuallyClosed = false;

    // Close modal function
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

    // Renders a description that may be either plain text (legacy) or HTML from the rich editor.
    // For HTML content, bare URLs outside of existing <a> tags are auto-linked.
    // All links in the output get target="_blank" and rel="noopener noreferrer".
    function renderDescription(raw) {
        if (!raw) return '';

        const isHtml = /<[a-z][\s\S]*>/i.test(raw);

        if (isHtml) {
            // Parse into a temporary container so we can manipulate safely
            const tmp = document.createElement('div');
            tmp.innerHTML = raw;

            // Ensure every <a> opens in a new tab
            tmp.querySelectorAll('a').forEach(a => {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            });

            // Auto-link bare URLs in text nodes that aren't already inside an <a>
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

            // Transform <award>text</award> into styled badge spans
            tmp.querySelectorAll('award').forEach(el => {
                const badge = document.createElement('span');
                badge.className = 'award-badge';
                badge.innerHTML = '🏆 ' + el.innerHTML;
                el.parentNode.replaceChild(badge, el);
            });

            return tmp.innerHTML;
        }

        // Legacy plain-text path: escape HTML, then auto-link URLs and convert newlines
        let escaped = raw.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
        escaped = escaped.replace(
            /(https?:\/\/[^\s]+)/g,
            url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
        );
        escaped = escaped.replace(/\n/g, '<br>');
        return escaped;
    }

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
        switch(alignSetting) {
            case 'top': return 'top';
            case 'bottom': return 'bottom';
            default: return 'center';
        }
    }

    // Check if browser supports WebP
    function supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
    }

    // Get optimized image URL (WebP if supported AND file exists)
    function getOptimizedImageUrl(url) {
        if (!url) return url;
        
        // Don't convert URLs or videos
        if (url.match(/^https?:\/\//)) return url;
        if (url.match(/\.(mp4|webm|mov|ogg|avi)$/i)) return url;
        
        // Check if it's an image
        if (!url.match(/\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i)) return url;
        
        // Try WebP version
        const webpUrl = url.replace(/\.[^.]+$/, '.webp');
        
        // Check if WebP file actually exists (if in media directory)
        const webpSupported = supportsWebP();
        if (webpSupported) {
            // If we're in a browser, we'll let the image load and fallback
            // We'll use a data attribute to try WebP first, then fallback to original
            return webpUrl;
        }
        
        return url;
    }

    // Generate responsive srcset - SIMPLIFIED to avoid broken images
    function generateSrcSet(mediaUrl) {
        // Skip for non-images or URLs
        if (!mediaUrl || mediaUrl.match(/^https?:\/\//)) return '';
        if (mediaUrl.match(/\.(mp4|webm|mov|ogg|avi)$/i)) return '';
        if (!mediaUrl.match(/\.(jpg|jpeg|png|gif|bmp|tiff|tif|webp)$/i)) return '';
        
        // Use the original URL as the only source - this prevents broken images
        // The actual responsive loading will be handled by CSS
        return mediaUrl;
    }

    // Generate a tiny placeholder SVG
    function getPlaceholderSVG() {
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f0f0f0'/%3E%3C/svg%3E`;
    }

    function generateThumbnailHtml(mediaUrl, alignSetting = 'center') {
        const isVideo = isVideoUrl(mediaUrl);
        const objectPosition = getObjectPosition(alignSetting);
        
        if (!isVideo) {
            // For images, use the original URL directly
            // Don't try to convert to WebP for thumbnails - it causes broken images
            const imageUrl = mediaUrl;
            const placeholder = getPlaceholderSVG();
            
            // Check if it's a YouTube or Vimeo thumbnail
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
            
            // Check if it's a Vimeo thumbnail
            if (mediaUrl.includes('vimeo.com')) {
                const vimeoId = (mediaUrl.match(/vimeo\.com\/(\d+)/) || [])[1];
                if (vimeoId) {
                    return '<img src="' + placeholder + '" alt="Vimeo thumbnail" class="vimeo-thumb lazy-image" loading="lazy"'
                        + ' data-vimeo-id="' + vimeoId + '"'
                        + ' style="object-position: ' + objectPosition + '; background:#1a1a2e; width:100%; height:100%;">';
                }
            }
            
            // Regular image - use the URL as-is without WebP conversion for thumbnails
            // This prevents broken images when WebP files don't exist
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
        
        // Video handling
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
    // LAZY LOADING WITH INTERSECTION OBSERVER
    // ========================================

    function setupLazyLoading() {
        // Skip if IntersectionObserver is not supported
        if (!('IntersectionObserver' in window)) {
            // Fallback: load all images
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
                    
                    // Skip if already loaded
                    if (img.classList.contains('loaded')) {
                        observer.unobserve(img);
                        return;
                    }
                    
                    // Add loading state
                    img.classList.add('loading');
                    
                    // Load the image
                    if (img.dataset.src) {
                        // Check if the image exists before loading
                        const imgSrc = img.dataset.src;
                        
                        // For regular images, load directly
                        img.src = imgSrc;
                        img.removeAttribute('data-src');
                    }
                    
                    if (img.dataset.srcset) {
                        img.srcset = img.dataset.srcset;
                        img.removeAttribute('data-srcset');
                    }
                    
                    // Handle load success
                    img.onload = () => {
                        img.classList.remove('loading');
                        img.classList.add('loaded');
                        // Trigger a smooth appearance
                        img.style.opacity = '0';
                        setTimeout(() => {
                            img.style.transition = 'opacity 0.3s ease';
                            img.style.opacity = '1';
                        }, 50);
                    };
                    
                    // Handle load error - try fallback
                    img.onerror = () => {
                        img.classList.remove('loading');
                        img.classList.add('error');
                        // If image fails, try the original URL as fallback (if different)
                        if (img.dataset.fallback) {
                            img.src = img.dataset.fallback;
                            img.removeAttribute('data-fallback');
                        } else if (img.dataset.src && img.dataset.src !== img.src) {
                            // Try loading the original URL
                            const originalSrc = img.dataset.src;
                            // If it's a WebP URL, try the original format
                            if (originalSrc.match(/\.webp$/i)) {
                                const fallbackUrl = originalSrc.replace(/\.webp$/i, '.jpg');
                                // Check if it's the same URL
                                if (fallbackUrl !== originalSrc) {
                                    img.src = fallbackUrl;
                                    img.dataset.fallback = originalSrc;
                                    return; // Let the new load attempt
                                }
                            }
                            // If still failing, show error state
                            img.style.background = 'var(--bg-primary)';
                            img.style.display = 'flex';
                            img.style.alignItems = 'center';
                            img.style.justifyContent = 'center';
                            img.style.color = 'var(--text-muted)';
                            img.style.fontSize = '0.7rem';
                            img.alt = 'Image failed to load';
                        }
                    };
                    
                    // Stop observing this image
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '100px 0px', // Start loading 100px before entering viewport
            threshold: 0.01
        });

        // Observe all lazy images
        document.querySelectorAll('img.lazy-image:not(.loaded)').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // Call this after rendering projects
    function setupLazyLoadingAfterRender() {
        // Wait for images to be in the DOM
        setTimeout(setupLazyLoading, 100);
    }

    async function loadVimeoThumbnails() {
        const placeholders = document.querySelectorAll('img.vimeo-thumb[data-vimeo-id]');
        const seen = new Set();
        const fetches = [];
        placeholders.forEach(function(img) {
            const id = img.getAttribute('data-vimeo-id');
            if (seen.has(id)) return;
            seen.add(id);
            const p = fetch('https://vimeo.com/api/oembed.json?url=https://vimeo.com/' + id + '&width=640')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (!data.thumbnail_url) return;
                    document.querySelectorAll('img.vimeo-thumb[data-vimeo-id="' + id + '"]')
                        .forEach(function(el) {
                            // Set the image source and mark as loaded
                            el.src = data.thumbnail_url;
                            el.removeAttribute('data-vimeo-id');
                            el.classList.remove('vimeo-thumb');
                            el.classList.add('loaded');
                            el.style.opacity = '1';
                        });
                })
                .catch(function() {
                    document.querySelectorAll('img.vimeo-thumb[data-vimeo-id="' + id + '"]')
                        .forEach(function(el) {
                            el.style.background = 'linear-gradient(135deg,#1a1a2e,#16213e)';
                            el.removeAttribute('data-vimeo-id');
                            el.classList.add('loaded');
                        });
                });
            fetches.push(p);
        });
        return Promise.all(fetches);
    }

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
            // For modal, use the original URL directly (no WebP conversion)
            return `<img src="${mediaUrl}" alt="Portfolio image" style="max-width:100%; max-height:100%; object-fit:contain;">`;
        }
    }

    function generateShareUrl(projectIndex, mediaIndex = 0, mediaArray = []) {
        const firstImage = mediaArray.find(m => m.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) || mediaArray[0] || '';
        const shareData = {
            p: projectIndex,
            m: mediaIndex,
            img: firstImage
        };
        const hash = btoa(JSON.stringify(shareData));
        return `${window.location.origin}${window.location.pathname}#share=${hash}`;
    }

    function parseShareUrl() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#share=')) {
            try {
                const encoded = hash.substring(7);
                const shareData = JSON.parse(atob(encoded));
                return shareData;
            } catch(e) {
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

    // Format category for display
    function formatCategoryForDisplay(cat) {
        if (!cat) return '';
        return cat.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ').replace(/&/g, '&');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Global variables for filtering
    let currentFilterValue = 'all';
    let allPortfolioItems = [];

    function setupFiltering() {
        const filterButtons = document.querySelectorAll('.filter-nav .filter-btn');
        
        filterButtons.forEach(button => {
            button.removeEventListener('click', filterHandler);
            button.addEventListener('click', filterHandler);
        });
        
        function filterHandler(e) {
            const button = e.currentTarget;
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            currentFilterValue = button.getAttribute('data-filter');
            applyFilter();
        }
    }

    function applyFilter() {
        allPortfolioItems.forEach(item => {
            const itemCategory = item.getAttribute('data-category');
            if (currentFilterValue === 'all') {
                item.style.display = 'flex';
            } else if (currentFilterValue === 'uncategorized') {
                item.style.display = (!itemCategory || itemCategory === 'uncategorized' || itemCategory === '') ? 'flex' : 'none';
            } else {
                item.style.display = (itemCategory === currentFilterValue) ? 'flex' : 'none';
            }
        });
    }

    // Load projects directly from projects.json
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
        
        // Create all portfolio items
        visibleProjects.forEach((project, visibleIdx) => {
            const originalIndex = projects.findIndex(p => p === project);
            let mediaArray = project.media;
            if (!mediaArray || mediaArray.length === 0) {
                mediaArray = project.image ? [project.image] : [];
            }
            
            const imageAlign = project.imageAlign || 'center';
            
            const article = document.createElement('article');
            article.className = 'portfolio-item';
            // For Uncategorized, store as empty string or 'uncategorized' for filtering
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
            
            // Display "Uncategorized" for empty category
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
                // Block clicks on ANY Swiper interactive elements
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
                    openMediaModal(mediaArray, 0, originalIndex);
                    const shareUrl = generateShareUrl(originalIndex, 0, mediaArray);
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
        
        // Store all portfolio items for filtering
        allPortfolioItems = document.querySelectorAll('.portfolio-item');
        
        // Get unique categories from projects (exclude empty)
        const categories = [...new Set(visibleProjects.map(p => p.category).filter(c => c && c !== ''))].sort((a, b) => a.localeCompare(b));

        const filterNav = document.querySelector('.filter-nav');
        if (filterNav) {
            // Clear existing content
            filterNav.innerHTML = '';
            
            // Check for the Games category
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
        
        // Initialize swipers for cards with multiple media
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
        
        // Setup lazy loading for images
        setupLazyLoadingAfterRender();
        
        // Load Vimeo thumbnails
        loadVimeoThumbnails();

        // Setup category tag click handlers
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
        
        // Setup filtering
        setupFiltering();
        
        // Check for share URL on load
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

    // Load projects directly from projects.json
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
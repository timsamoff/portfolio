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

    function linkify(text) {
        let escaped = text.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
        
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        escaped = escaped.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
        
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

    function generateThumbnailHtml(mediaUrl, alignSetting = 'center') {
        const isVideo = isVideoUrl(mediaUrl);
        const objectPosition = getObjectPosition(alignSetting);
        
        if (!isVideo) {
            return `<img src="${mediaUrl}" alt="Portfolio media" style="object-position: ${objectPosition};">`;
        }
        
        const youtubeEmbed = getYouTubeEmbedUrl(mediaUrl);
        if (youtubeEmbed) {
            const videoId = getYouTubeVideoId(mediaUrl);
            return `<img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="YouTube thumbnail" style="object-position: ${objectPosition};">`;
        }
        
        if (getVimeoEmbedUrl(mediaUrl)) {
            return `<div style="background: linear-gradient(135deg, #1a1a2e, #16213e); display:flex; align-items:center; justify-content:center; height:100%;"><span style="color:white;">🎬 Video</span></div>`;
        }
        
        return `<video muted><source src="${mediaUrl}" type="video/mp4"></video>`;
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

    // Format category for display (convert underscores to spaces, capitalize)
    function formatCategoryForDisplay(cat) {
        return cat
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
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
            } else {
                item.style.display = (itemCategory === currentFilterValue) ? 'flex' : 'none';
            }
        });
    }

    // Function to load and display projects (called from both localStorage and JSON)
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
            article.setAttribute('data-category', project.category);
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
            
            article.innerHTML = `
                ${thumbnailHtml}
                <div class="item-content">
                    <span class="category-tag" data-category-filter="${escapeHtml(project.category)}">${escapeHtml(project.tag)}</span>
                    <h3>${escapeHtml(project.title)}</h3>
                    <p>${linkify(project.description)}</p>
                </div>
                <div class="share-hint">🔗 Click to Share</div>
            `;
            
            article.addEventListener('click', (e) => {
                if (e.target.closest('.share-hint')) return;
                if (e.target.closest('.swiper-button-prev') || e.target.closest('.swiper-button-next')) {
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
        
        // Get unique categories from projects and generate pills
        const categories = [...new Set(visibleProjects.map(p => p.category))].sort((a, b) => a.localeCompare(b));
        
        const filterNav = document.querySelector('.filter-nav');
        if (filterNav) {
            let pillsHtml = `<button class="filter-btn active" data-filter="all">All Projects</button>`;
            categories.forEach(cat => {
                const displayName = formatCategoryForDisplay(cat);
                pillsHtml += `<button class="filter-btn" data-filter="${escapeHtml(cat)}">${escapeHtml(displayName)}</button>`;
            });
            filterNav.innerHTML = pillsHtml;
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

    // Try to load from localStorage first (for admin edits), fallback to projects.json
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    const localData = localStorage.getItem('portfolio_projects');
    if (localData && localData !== '[]') {
        try {
            const projects = JSON.parse(localData);
            console.log('Loaded from localStorage');
            loadProjects(projects);
        } catch(e) {
            console.error('Error parsing localStorage', e);
            // Fallback to JSON
            fetch('projects.json')
                .then(response => response.json())
                .then(data => loadProjects(data))
                .catch(error => console.error('Error loading projects:', error));
        }
    } else {
        // Fallback to projects.json
        fetch('projects.json')
            .then(response => response.json())
            .then(data => loadProjects(data))
            .catch(error => {
                console.error('Error loading projects:', error);
                grid.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--accent-red);">Error loading projects. Make sure projects.json exists.</div>';
            });
    }
});
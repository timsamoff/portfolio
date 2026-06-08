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

    // Close modal when clicking X
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            modal.style.display = 'none';
            if (currentModalSwiper) {
                currentModalSwiper.destroy(true, true);
                currentModalSwiper = null;
            }
        });
    }

    // Close modal when clicking outside content
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                if (currentModalSwiper) {
                    currentModalSwiper.destroy(true, true);
                    currentModalSwiper = null;
                }
            }
        });
    }

    // Helper function to detect URLs and convert them to hyperlinks (with line breaks)
    function linkify(text) {
        // First, escape HTML to prevent XSS
        let escaped = text.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
        
        // Convert URLs to clickable links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        escaped = escaped.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
        
        // Convert line breaks to <br> tags
        escaped = escaped.replace(/\n/g, '<br>');
        
        return escaped;
    }

    // Helper to detect if a URL is a video
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

    function getVimeoEmbedUrl(url) {
        const regExp = /vimeo\.com\/(\d+)/;
        const match = url.match(regExp);
        return match ? `https://player.vimeo.com/video/${match[1]}` : null;
    }

    // Get CSS object-position value based on alignment setting
    function getObjectPosition(alignSetting) {
        switch(alignSetting) {
            case 'top': return 'top';
            case 'bottom': return 'bottom';
            default: return 'center';
        }
    }

    // Thumbnail with forced crop and dynamic alignment
    function generateThumbnailHtml(mediaUrl, alignSetting = 'center') {
        const isVideo = isVideoUrl(mediaUrl);
        const objectPosition = getObjectPosition(alignSetting);
        
        if (!isVideo) {
            return `<img src="${mediaUrl}" alt="Portfolio media" style="object-position: ${objectPosition};">`;
        }
        
        const youtubeEmbed = getYouTubeEmbedUrl(mediaUrl);
        if (youtubeEmbed) {
            const videoId = youtubeEmbed.split('/embed/')[1];
            return `<img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="YouTube thumbnail" style="object-position: ${objectPosition};">`;
        }
        
        if (getVimeoEmbedUrl(mediaUrl)) {
            return `<div style="background: linear-gradient(135deg, #1a1a2e, #16213e); display:flex; align-items:center; justify-content:center; height:100%;"><span style="color:white;">🎬 Video</span></div>`;
        }
        
        return `<video muted><source src="${mediaUrl}" type="video/mp4"></video>`;
    }

    // Full modal media (uncropped)
    function generateModalMediaHtml(mediaUrl) {
        const isVideo = isVideoUrl(mediaUrl);
        const youtubeEmbed = getYouTubeEmbedUrl(mediaUrl);
        const vimeoEmbed = getVimeoEmbedUrl(mediaUrl);
        
        if (isVideo) {
            if (youtubeEmbed) {
                return `<iframe src="${youtubeEmbed}?autoplay=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else if (vimeoEmbed) {
                return `<iframe src="${vimeoEmbed}?autoplay=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
            } else {
                return `<video controls><source src="${mediaUrl}" type="video/mp4">Your browser does not support video.</video>`;
            }
        } else {
            return `<img src="${mediaUrl}" alt="Portfolio image">`;
        }
    }

    function openMediaModal(mediaArray, startIndex = 0) {
        const modalWrapper = document.getElementById('modal-swiper-wrapper');
        if (!modalWrapper) return;
        
        // Build slides
        let slidesHtml = '';
        mediaArray.forEach((mediaUrl) => {
            const mediaHtml = generateModalMediaHtml(mediaUrl);
            slidesHtml += `<div class="swiper-slide"><div class="modal-media-container">${mediaHtml}</div></div>`;
        });
        
        modalWrapper.innerHTML = slidesHtml;
        
        // Destroy existing swiper if present
        if (currentModalSwiper) {
            currentModalSwiper.destroy(true, true);
            currentModalSwiper = null;
        }
        
        // Show modal
        modal.style.display = 'block';
        
        // Initialize swiper
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
        }, 100);
    }

    // Load projects
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    fetch('projects.json')
        .then(response => response.json())
        .then(projects => {
            projects.forEach((project, idx) => {
                let mediaArray = project.media;
                if (!mediaArray || mediaArray.length === 0) {
                    mediaArray = project.image ? [project.image] : [];
                }
                
                // Get alignment setting (default to 'center')
                const imageAlign = project.imageAlign || 'center';
                
                const article = document.createElement('article');
                article.className = 'portfolio-item';
                article.setAttribute('data-category', project.category);
                
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
                            <div class="swiper card-swiper-${idx}">
                                <div class="swiper-wrapper">${swiperSlides}</div>
                                <div class="swiper-button-prev card-swiper-prev-${idx}"></div>
                                <div class="swiper-button-next card-swiper-next-${idx}"></div>
                                <div class="swiper-pagination card-swiper-pagination-${idx}"></div>
                            </div>
                        </div>
                    `;
                } else {
                    thumbnailHtml = `<div class="item-image"><div class="no-media">No media</div></div>`;
                }
                
                article.innerHTML = `
                    ${thumbnailHtml}
                    <div class="item-content">
                        <span class="category-tag">${project.tag}</span>
                        <h3>${project.title}</h3>
                        <p>${linkify(project.description)}</p>
                    </div>
                `;
                
                // Click handler for modal - works for ALL cards
                article.addEventListener('click', (e) => {
                    // Don't open modal if clicking on swiper navigation buttons
                    if (e.target.closest('.swiper-button-prev') || 
                        e.target.closest('.swiper-button-next')) {
                        e.stopPropagation();
                        return;
                    }
                    // Don't open modal if clicking on a link inside description
                    if (e.target.tagName === 'A') {
                        e.stopPropagation();
                        return;
                    }
                    // Open modal for ANY card with media
                    if (mediaArray.length > 0) {
                        openMediaModal(mediaArray, 0);
                    }
                });
                
                grid.appendChild(article);
            });
            
            // Initialize swipers for cards with multiple media
            projects.forEach((project, idx) => {
                const mediaArray = project.media || (project.image ? [project.image] : []);
                if (mediaArray.length > 1) {
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
            });
            
            setupFiltering();
        })
        .catch(error => console.error('Error loading projects:', error));

    function setupFiltering() {
        const filterButtons = document.querySelectorAll('.filter-nav .filter-btn');
        const portfolioItems = document.querySelectorAll('.portfolio-item');

        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                const filterValue = button.getAttribute('data-filter');
                portfolioItems.forEach(item => {
                    const itemCategory = item.getAttribute('data-category');
                    item.style.display = (filterValue === 'all' || itemCategory === filterValue) ? 'flex' : 'none';
                });
            });
        });
    }
});
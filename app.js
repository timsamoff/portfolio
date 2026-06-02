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

    // Helper function to detect URLs and convert them to hyperlinks
    function linkify(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

    // Production View Content Loader & Filter Engine
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return; 

    fetch('projects.json')
        .then(response => response.json())
        .then(projects => {
            projects.forEach(project => {
                const article = document.createElement('article');
                article.className = 'portfolio-item';
                article.setAttribute('data-category', project.category);
                
                // Using linkify() on project.description here
                article.innerHTML = `
                    <div class="item-image"><img src="${project.image}" alt="${project.title}"></div>
                    <div class="item-content">
                        <span class="category-tag">${project.tag}</span>
                        <h3>${project.title}</h3>
                        <p>${linkify(project.description)}</p>
                    </div>`;
                grid.appendChild(article);
            });
            setupFiltering();
        })
        .catch(error => console.error('Error loading data payload:', error));

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
                    if (filterValue === 'all' || itemCategory === filterValue) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        });
    }
});
// demo/demo-data.js
// ========================================
// DEMO DATA - Fake portfolio projects with Unsplash images
// ========================================

const DEMO_CATEGORIES = [
    'creative_experiments',
    'interactive_media',
    'digital_craft',
    'visual_stories'
];

// Function to format category for display
function formatDemoCategory(cat) {
    if (!cat) return '';
    return cat.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

const DEMO_PROJECTS = [
    {
        "title": "Mountain Retreat",
        "category": "creative_experiments",
        "cardHeading": "Website",
        "media": [
            "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&h=600&fit=crop"
        ],
        "description": "A full-featured website for a luxury mountain retreat. Built with modern web technologies and a focus on immersive user experience.\n\n<live href=\"https://example.com\">Live Demo</live>",
        "imageAlign": "center",
        "selected": true,
        "published": true
    },
    {
        "title": "Urban Garden App",
        "category": "interactive_media",
        "cardHeading": "Mobile App",
        "media": [
            "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=600&fit=crop"
        ],
        "description": "Urban Garden is a mobile app that helps city dwellers grow their own food. Features include planting guides, watering reminders, and a community forum.\n\n<live>Coming Soon</live>\n\n<award>Best Urban Innovation 2024</award>",
        "imageAlign": "center",
        "selected": true,
        "published": true
    },
    {
        "title": "Deep Space Explorer",
        "category": "digital_craft",
        "cardHeading": "Game",
        "media": [
            "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1506703719100-a0f3a48c0b0c?w=800&h=600&fit=crop"
        ],
        "description": "A space exploration game where players navigate procedurally generated galaxies. Built with Unity and featuring stunning visual effects.\n\n<live href=\"https://example.com/game\">Play Now</live>",
        "imageAlign": "center",
        "selected": false,
        "published": true
    },
    {
        "title": "Minimalist Brand Identity",
        "category": "visual_stories",
        "cardHeading": "Branding",
        "media": [
            "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=600&fit=crop"
        ],
        "description": "A complete brand identity overhaul for a tech startup. Includes logo design, color palette, typography system, and brand guidelines.\n\n<strong>Services:</strong> Logo Design, Brand Strategy, Visual Identity",
        "imageAlign": "top",
        "selected": false,
        "published": true
    },
    {
        "title": "Coastal Living Magazine",
        "category": "creative_experiments",
        "cardHeading": "Editorial Design",
        "media": [
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=600&fit=crop"
        ],
        "description": "Editorial design for Coastal Living Magazine. A blend of modern typography and stunning coastal photography.\n\n<award>Magazine Design Award 2024</award>",
        "imageAlign": "center",
        "selected": false,
        "published": true
    },
    {
        "title": "Motion Reel 2024",
        "category": "interactive_media",
        "cardHeading": "Motion Reel",
        "media": [
            "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&h=600&fit=crop"
        ],
        "description": "A curated collection of motion graphics work from 2024. Featuring kinetic typography, abstract animations, and commercial projects.\n\n<live href=\"https://example.com/reel\">Watch Reel</live>",
        "imageAlign": "center",
        "selected": false,
        "published": true
    },
    {
        "title": "Eco-Friendly Packaging",
        "category": "digital_craft",
        "cardHeading": "Packaging",
        "media": [
            "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1532996128859-f73fda1733be?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1530822847156-5df684ec5ee4?w=800&h=600&fit=crop"
        ],
        "description": "Sustainable packaging design for a consumer goods brand. Focus on minimal materials, recyclability, and beautiful visual design.\n\n<strong>Materials:</strong> Recycled paper, soy-based inks",
        "imageAlign": "center",
        "selected": false,
        "published": true
    },
    {
        "title": "Portfolio Website Redesign",
        "category": "visual_stories",
        "cardHeading": "Web Design",
        "media": [
            "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1505765050516-f6bd2526c54b?w=800&h=600&fit=crop"
        ],
        "description": "A complete redesign of a creative professional's portfolio website. Focus on clean typography, smooth animations, and a responsive layout.\n\n<live href=\"https://example.com\">View Live Site</live>",
        "imageAlign": "center",
        "selected": false,
        "published": true
    },
    {
        "title": "User Research Platform",
        "category": "creative_experiments",
        "cardHeading": "UX Design",
        "media": [
            "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=600&fit=crop"
        ],
        "description": "A user research platform that helps teams gather and analyze feedback. Features include surveys, interviews, and analytics dashboards.\n\n<strong>Role:</strong> Lead UX Designer",
        "imageAlign": "center",
        "selected": true,
        "published": true
    },
    {
        "title": "Geometric Art Series",
        "category": "digital_craft",
        "cardHeading": "Art",
        "media": [
            "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=600&fit=crop"
        ],
        "description": "A series of geometric abstract artworks exploring color theory and composition. Created using digital tools and inspired by mid-century modern design.\n\n<award>Featured in Digital Art Monthly</award>",
        "imageAlign": "center",
        "selected": false,
        "published": true
    },
    {
        "title": "Music Visualizer",
        "category": "interactive_media",
        "cardHeading": "Visualizer",
        "media": [
            "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=600&fit=crop"
        ],
        "description": "A real-time music visualizer that creates stunning visual experiences from audio input. Built with WebGL and audio processing libraries.\n\n<live href=\"https://example.com/visualizer\">Try Demo</live>",
        "imageAlign": "center",
        "selected": false,
        "published": true
    },
    {
        "title": "Smart Home Dashboard",
        "category": "visual_stories",
        "cardHeading": "Dashboard",
        "media": [
            "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=600&fit=crop"
        ],
        "description": "A comprehensive smart home dashboard that controls lighting, temperature, and security systems. Features real-time updates and voice control integration.",
        "imageAlign": "center",
        "selected": false,
        "published": true
    },
    {
        "title": "Experimental Typography",
        "category": "digital_craft",
        "cardHeading": "Typography",
        "media": [
            "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=600&fit=crop"
        ],
        "description": "An experimental typography project exploring the boundaries of letterforms and visual communication. Includes custom typefaces and dynamic layouts.",
        "imageAlign": "center",
        "selected": false,
        "published": false
    }
];

// ========================================
// LOCAL STORAGE HELPERS
// ========================================

const DEMO_STORAGE_KEY = 'demo_portfolio_projects';
const DEMO_CATEGORIES_KEY = 'demo_portfolio_categories';

// Make these globally available
window.DEMO_STORAGE_KEY = DEMO_STORAGE_KEY;
window.DEMO_CATEGORIES_KEY = DEMO_CATEGORIES_KEY;
window.DEMO_PROJECTS = DEMO_PROJECTS;

function loadDemoProjects() {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (e) {
            console.warn('Failed to parse stored projects, using defaults');
        }
    }
    return null;
}

function saveDemoProjects(projects) {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(projects));
}

function loadDemoCategories() {
    const stored = localStorage.getItem(DEMO_CATEGORIES_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (e) {
            console.warn('Failed to parse stored categories, using defaults');
        }
    }
    return null;
}

function saveDemoCategories(categories) {
    localStorage.setItem(DEMO_CATEGORIES_KEY, JSON.stringify(categories));
}

function getDemoCategoriesFromProjects(projects) {
    const cats = new Set();
    projects.forEach(p => {
        if (p.category && p.category.trim()) {
            cats.add(p.category);
        }
    });
    // If no categories found in projects, use defaults
    if (cats.size === 0) {
        DEMO_CATEGORIES.forEach(c => cats.add(c));
    }
    return Array.from(cats);
}

function resetDemoData() {
    const freshProjects = DEMO_PROJECTS.map(project => ({
        ...project
    }));
    saveDemoProjects(freshProjects);
    const categories = getDemoCategoriesFromProjects(freshProjects);
    saveDemoCategories(categories);
    return { projects: freshProjects, categories: categories };
}

function getDemoData() {
    let projects = loadDemoProjects();
    let categories = loadDemoCategories();
    
    if (!projects) {
        console.log('No demo data found, loading defaults...');
        projects = DEMO_PROJECTS.map(project => ({
            ...project
        }));
        saveDemoProjects(projects);
    }
    
    if (!categories) {
        categories = getDemoCategoriesFromProjects(projects);
        saveDemoCategories(categories);
    }
    
    // Ensure 'selected' field exists on all projects
    projects = projects.map(project => {
        if (project.selected === undefined) {
            project.selected = false;
        }
        return project;
    });
    saveDemoProjects(projects);
    
    // Clean up categories - only keep ones that actually exist in projects
    const projectCats = getDemoCategoriesFromProjects(projects);
    categories = categories.filter(c => projectCats.includes(c));
    if (categories.length !== projectCats.length) {
        categories = projectCats;
        saveDemoCategories(categories);
    }
    
    return { projects, categories };
}

// Make functions globally available
window.getDemoData = getDemoData;
window.resetDemoData = resetDemoData;
window.saveDemoProjects = saveDemoProjects;
window.saveDemoCategories = saveDemoCategories;
window.loadDemoProjects = loadDemoProjects;
window.loadDemoCategories = loadDemoCategories;
window.formatDemoCategory = formatDemoCategory;
window.DEMO_CATEGORIES = DEMO_CATEGORIES;

// Initialize immediately
(function initDemoData() {
    console.log('Initializing demo data...');
    const data = getDemoData();
    console.log(`Loaded ${data.projects.length} projects and ${data.categories.length} categories`);
    console.log('Categories:', data.categories.map(c => formatDemoCategory(c)).join(', '));
})();
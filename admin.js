// Admin panel functionality - pure localStorage (no page refresh)
let localProjectCache = [];
let currentMediaArray = [];
let draggedMediaIndexForReorder = null;
let currentSearchTerm = '';
let availableCategories = ['brand', 'production', 'games', 'web'];

// Auto-save tracking
let autoSaveTimeout = null;
let isEditingMode = false;
let currentEditIndex = null;
let lastSavedFormData = null;

// Get DOM elements
const sortableListElement = document.getElementById('sortable-list');
const addForm = document.getElementById('add-project-form');
const formActionTitle = document.getElementById('form-action-title');
const formEditIndex = document.getElementById('form-edit-index');
const submitBtn = document.getElementById('submit-btn');
const newProjectBtn = document.getElementById('new-project-btn');

// Media elements
const mediaInput = document.getElementById('media-input');
const addMediaBtn = document.getElementById('add-media-btn');
const mediaBadgesContainer = document.getElementById('media-badges');
const togglePasteBtn = document.getElementById('toggle-paste-btn');
const pasteArea = document.getElementById('paste-area');
const pasteUrls = document.getElementById('paste-urls');
const processPasteBtn = document.getElementById('process-paste-btn');
const multiFileInput = document.getElementById('multi-file-input');

// Form elements
const descriptionTextarea = document.getElementById('form-description');
const charCounter = document.getElementById('char-counter');
const adminSearchInput = document.getElementById('admin-search-input');
const formTitle = document.getElementById('form-title');
const formCategory = document.getElementById('form-category');
const formTag = document.getElementById('form-tag');
const formPublished = document.getElementById('form-published');
const formImageAlign = document.getElementById('form-image-align');

// Create floating notification (bottom-right, same as auto-save)
let floatingNotification = null;
let notificationTimeout = null;

function showFloatingNotification(message, isSuccess = true) {
    if (floatingNotification) {
        floatingNotification.remove();
        if (notificationTimeout) clearTimeout(notificationTimeout);
    }
    
    floatingNotification = document.createElement('div');
    floatingNotification.textContent = message;
    floatingNotification.style.cssText = `
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
    
    document.body.appendChild(floatingNotification);
    
    notificationTimeout = setTimeout(() => {
        if (floatingNotification) {
            floatingNotification.style.opacity = '0';
            floatingNotification.style.transform = 'translateX(100%)';
            floatingNotification.style.transition = 'opacity 0.3s, transform 0.3s';
            setTimeout(() => {
                if (floatingNotification) floatingNotification.remove();
                floatingNotification = null;
            }, 300);
        }
        notificationTimeout = null;
    }, 2500);
}

// Auto-save notification (reuses the same function)
function showAutoSaveNotification() {
    showFloatingNotification("✓ Auto-saved");
}

// Prevent form submission - handle manually
if (addForm) {
    addForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const projectData = {
            title: formTitle.value,
            category: formCategory.value,
            tag: formTag.value,
            media: [...currentMediaArray],
            description: descriptionTextarea.value,
            imageAlign: formImageAlign.value,
            published: formPublished.checked
        };
        projectData.media = projectData.media.filter(m => m && m.trim());
        
        localProjectCache.push(projectData);
        renderAdminView();
        saveToLocalStorage();
        startNewProject();
        showFloatingNotification("✓ Project added!");
        
        return false;
    });
}

// Save to localStorage only (no file write = no page refresh)
function saveToLocalStorage() {
    localStorage.setItem('portfolio_projects', JSON.stringify(localProjectCache));
    // Also save a timestamp so portfolio knows to reload
    localStorage.setItem('portfolio_last_updated', Date.now().toString());
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getMediaIcon(url) {
    if (!url) return '📄';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return '🖼️';
    if (lowerUrl.match(/\.(mp4|webm|mov|ogg)$/)) return '🎥';
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return '📺';
    if (lowerUrl.includes('vimeo.com')) return '🎬';
    return '🔗';
}

function getMediaPreview(mediaArray) {
    if (!mediaArray || mediaArray.length === 0) return "No media";
    const icons = mediaArray.map(m => getMediaIcon(m)).join(' ');
    return `${icons} ${mediaArray.length} media item(s)`;
}

function formatCategoryForDisplay(cat) {
    return cat.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Load data from localStorage only
function loadData() {
    const saved = localStorage.getItem('portfolio_projects');
    
    if (saved && saved !== '[]') {
        try {
            localProjectCache = JSON.parse(saved);
            renderAdminView();
            showFloatingNotification(`✓ Loaded ${localProjectCache.length} projects`);
            return;
        } catch(e) {}
    }
    
    // First time - try to load from projects.json as initial seed
    fetch('projects.json')
        .then(res => res.json())
        .then(data => {
            localProjectCache = data;
            renderAdminView();
            saveToLocalStorage();
            showFloatingNotification(`✓ Loaded ${localProjectCache.length} projects from JSON`);
        })
        .catch(() => {
            localProjectCache = [];
            renderAdminView();
            showFloatingNotification("✨ No projects yet. Add your first one!");
        });
}

function renderAdminView() {
    if (!sortableListElement) return;
    sortableListElement.innerHTML = '';
    
    if (localProjectCache.length === 0) {
        sortableListElement.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No projects yet. Fill out the form and click "Add Portfolio Project".</div>';
        return;
    }
    
    const filteredProjects = currentSearchTerm 
        ? localProjectCache.filter(project => project.title.toLowerCase().includes(currentSearchTerm))
        : [...localProjectCache];
    
    filteredProjects.forEach((project) => {
        const originalIndex = localProjectCache.findIndex(p => p === project);
        const li = document.createElement('li');
        li.className = 'sort-item';
        li.draggable = true;
        li.setAttribute('data-index', originalIndex);
        
        const mediaArray = project.media || [];
        const mediaPreview = getMediaPreview(mediaArray);
        const draftBadge = project.published === false ? ' [DRAFT]' : '';
        
        li.innerHTML = `
            <div class="sort-content" style="flex-grow:1; cursor:pointer;">
                <strong>${escapeHtml(project.title)}${draftBadge}</strong> 
                <small style="color:var(--text-muted); margin-left:0.5rem;">(${escapeHtml(project.tag)})</small>
                <div style="font-size:0.7rem; color:var(--accent-red); margin-top:0.2rem;">${mediaPreview}</div>
            </div>
            <div style="display:flex; gap:1.2rem; align-items:center;">
                <span class="delete-item-btn" style="cursor:pointer; color:var(--text-muted); font-weight:bold; font-size:1.1rem; padding: 0 0.25rem;" data-index="${originalIndex}" title="Delete Project">✕</span>
                <span class="sort-handle" style="cursor:grab; padding: 0 0.25rem;">☰</span>
            </div>
        `;
        
        li.querySelector('.sort-content').addEventListener('click', () => loadProjectIntoForm(originalIndex));
        li.querySelector('.delete-item-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm(`Remove "${project.title}" permanently?`)) {
                localProjectCache.splice(originalIndex, 1);
                renderAdminView();
                saveToLocalStorage();
                if (isEditingMode && currentEditIndex === originalIndex) startNewProject();
            }
        });

        li.addEventListener('dragstart', () => li.classList.add('dragging'));
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            recalculateCacheOrder();
        });
        sortableListElement.appendChild(li);
    });
}

// Drag and drop sorting
if (sortableListElement) {
    sortableListElement.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(sortableListElement, e.clientY);
        const draggingItem = document.querySelector('.dragging');
        if (afterElement == null) {
            sortableListElement.appendChild(draggingItem);
        } else {
            sortableListElement.insertBefore(draggingItem, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.sort-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        }
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function recalculateCacheOrder() {
    const currentRows = [...sortableListElement.querySelectorAll('.sort-item')];
    localProjectCache = currentRows.map(row => localProjectCache[row.getAttribute('data-index')]);
    currentRows.forEach((row, i) => row.setAttribute('data-index', i));
    saveToLocalStorage();
}

function getCurrentFormData() {
    return {
        title: formTitle.value,
        category: formCategory.value,
        tag: formTag.value,
        media: [...currentMediaArray],
        description: descriptionTextarea.value,
        imageAlign: formImageAlign.value,
        published: formPublished.checked
    };
}

function hasFormDataChanged() {
    if (!lastSavedFormData) return true;
    const currentData = getCurrentFormData();
    return JSON.stringify(currentData) !== JSON.stringify(lastSavedFormData);
}

function autoSaveEditingProject() {
    if (!isEditingMode || currentEditIndex === null) return;
    if (!hasFormDataChanged()) return;
    
    const projectData = getCurrentFormData();
    projectData.media = projectData.media.filter(m => m && m.trim());
    
    localProjectCache[currentEditIndex] = projectData;
    renderAdminView();
    saveToLocalStorage();
    
    lastSavedFormData = JSON.parse(JSON.stringify(projectData));
    showAutoSaveNotification();
}

function debouncedAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(autoSaveEditingProject, 1000);
}

let autoSaveListenersActive = false;

function setupAutoSaveListeners(enable) {
    const inputs = [formTitle, formCategory, formTag, descriptionTextarea, formImageAlign];
    const checkboxes = [formPublished];
    
    inputs.forEach(input => {
        if (input) {
            if (enable) {
                input.addEventListener('input', debouncedAutoSave);
            } else {
                input.removeEventListener('input', debouncedAutoSave);
            }
        }
    });
    
    checkboxes.forEach(checkbox => {
        if (checkbox) {
            if (enable) {
                checkbox.addEventListener('change', debouncedAutoSave);
            } else {
                checkbox.removeEventListener('change', debouncedAutoSave);
            }
        }
    });
    
    autoSaveListenersActive = enable;
}

function startNewProject() {
    if (autoSaveListenersActive) {
        setupAutoSaveListeners(false);
    }
    
    isEditingMode = false;
    currentEditIndex = null;
    lastSavedFormData = null;
    
    formActionTitle.textContent = "New Portfolio Project";
    formEditIndex.value = "";
    
    formTitle.value = "";
    formCategory.value = availableCategories[0] || "brand";
    formTag.value = "";
    formPublished.checked = true;
    formImageAlign.value = "center";
    currentMediaArray = [];
    renderMediaBadges();
    descriptionTextarea.value = "";
    if (charCounter) updateCharCount();
    
    document.querySelectorAll('.sort-item').forEach(el => el.style.borderColor = 'var(--border-color)');
    
    // Hide New Project button, show Add button
    if (newProjectBtn) newProjectBtn.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'block';
}

function loadProjectIntoForm(index) {
    const target = localProjectCache[index];
    if (!target) return;
    
    if (autoSaveListenersActive) {
        setupAutoSaveListeners(false);
    }
    
    isEditingMode = true;
    currentEditIndex = index;
    
    formActionTitle.textContent = `Editing: ${target.title}`;
    formEditIndex.value = index;
    
    formTitle.value = target.title;
    formCategory.value = target.category;
    formTag.value = target.tag;
    formPublished.checked = target.published !== false;
    formImageAlign.value = target.imageAlign || 'center';
    
    currentMediaArray = target.media ? [...target.media] : [];
    renderMediaBadges();
    
    descriptionTextarea.value = target.description;
    if (charCounter) updateCharCount();
    
    lastSavedFormData = getCurrentFormData();
    setupAutoSaveListeners(true);
    
    document.querySelectorAll('.sort-item').forEach(el => el.style.borderColor = 'var(--border-color)');
    const selectedRow = document.querySelector(`.sort-item[data-index="${index}"]`);
    if (selectedRow) selectedRow.style.borderColor = 'var(--accent-red)';
    
    // Show New Project button, hide Add button
    if (newProjectBtn) newProjectBtn.style.display = 'inline-block';
    if (submitBtn) submitBtn.style.display = 'none';
}

// New Project button handler
if (newProjectBtn) {
    newProjectBtn.addEventListener('click', () => {
        startNewProject();
    });
}

// Media functions
function renderMediaBadges() {
    if (!mediaBadgesContainer) return;
    mediaBadgesContainer.innerHTML = '';
    if (currentMediaArray.length === 0) {
        mediaBadgesContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 0.5rem; font-size: 0.75rem;">No media added yet.</div>';
        return;
    }
    
    currentMediaArray.forEach((media, index) => {
        const badge = document.createElement('div');
        badge.className = 'media-badge';
        badge.setAttribute('data-index', index);
        badge.innerHTML = `
            <span class="drag-handle" style="cursor: grab; opacity: 0.5; margin-right: 4px;">⋮⋮</span>
            <span class="media-badge-icon">${getMediaIcon(media)}</span>
            <span class="media-badge-text" title="${escapeHtml(media)}">${media.length > 45 ? media.substring(0, 42) + '...' : media}</span>
            <span class="media-badge-edit" data-index="${index}" title="Edit">✏️</span>
            <span class="media-badge-delete" data-index="${index}" title="Delete">✕</span>
        `;
        
        badge.querySelector('.media-badge-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            const newValue = prompt('Edit media URL:', media);
            if (newValue && newValue.trim()) {
                currentMediaArray[index] = newValue.trim();
                renderMediaBadges();
                if (isEditingMode) debouncedAutoSave();
            }
        });
        
        badge.querySelector('.media-badge-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            currentMediaArray.splice(index, 1);
            renderMediaBadges();
            if (isEditingMode) debouncedAutoSave();
        });
        
        mediaBadgesContainer.appendChild(badge);
    });
    
    makeMediaBadgesDraggable();
}

function makeMediaBadgesDraggable() {
    const badges = document.querySelectorAll('.media-badge');
    let draggedIndex = null;
    
    badges.forEach((badge) => {
        badge.setAttribute('draggable', 'true');
        
        badge.addEventListener('dragstart', (e) => {
            draggedIndex = parseInt(badge.getAttribute('data-index'));
            badge.style.opacity = '0.4';
        });
        
        badge.addEventListener('dragend', (e) => {
            badge.style.opacity = '1';
            draggedIndex = null;
        });
        
        badge.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        badge.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetIndex = parseInt(badge.getAttribute('data-index'));
            if (draggedIndex !== null && draggedIndex !== targetIndex) {
                const draggedItem = currentMediaArray[draggedIndex];
                currentMediaArray.splice(draggedIndex, 1);
                currentMediaArray.splice(targetIndex, 0, draggedItem);
                renderMediaBadges();
                if (isEditingMode) debouncedAutoSave();
            }
        });
    });
}

function handleAddButtonClick() {
    const textValue = mediaInput.value.trim();
    if (textValue) {
        if (!currentMediaArray.includes(textValue)) {
            currentMediaArray.push(textValue);
            renderMediaBadges();
            mediaInput.value = '';
            if (isEditingMode) debouncedAutoSave();
        } else {
            alert('Already in list');
        }
    } else {
        multiFileInput.click();
    }
}

function addFilesToMediaList(files) {
    if (!files || files.length === 0) return;
    let added = 0;
    for (let i = 0; i < files.length; i++) {
        const path = `media/${files[i].name.replace(/[#?&]/g, '_').replace(/\s+/g, '_')}`;
        if (!currentMediaArray.includes(path)) {
            currentMediaArray.push(path);
            added++;
        }
    }
    if (added > 0) {
        renderMediaBadges();
        if (isEditingMode) debouncedAutoSave();
    }
    multiFileInput.value = '';
}

if (addMediaBtn) addMediaBtn.addEventListener('click', handleAddButtonClick);
if (multiFileInput) multiFileInput.addEventListener('change', (e) => addFilesToMediaList(multiFileInput.files));
if (togglePasteBtn) togglePasteBtn.addEventListener('click', () => {
    pasteArea.style.display = pasteArea.style.display === 'none' ? 'block' : 'none';
});
if (processPasteBtn) processPasteBtn.addEventListener('click', () => {
    const lines = pasteUrls.value.split(/\r?\n/);
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !currentMediaArray.includes(trimmed)) currentMediaArray.push(trimmed);
    });
    renderMediaBadges();
    pasteUrls.value = '';
    pasteArea.style.display = 'none';
    if (isEditingMode) debouncedAutoSave();
});

// Character counter
function updateCharCount() {
    if (charCounter) charCounter.textContent = `${descriptionTextarea.value.length} characters`;
}
if (descriptionTextarea && charCounter) {
    descriptionTextarea.addEventListener('input', updateCharCount);
}

// Search
if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        renderAdminView();
    });
}

// Category management
const manageBtn = document.getElementById('manage-categories-btn');
const categoryManager = document.getElementById('category-manager');
const closeCategoryManager = document.getElementById('close-category-manager');
const addCategoryBtn = document.getElementById('add-category-btn');
const newCategoryNameInput = document.getElementById('new-category-name');

function updateCategoryDropdown() {
    const categorySelect = document.getElementById('form-category');
    if (!categorySelect) return;
    const currentValue = categorySelect.value;
    categorySelect.innerHTML = '';
    availableCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = formatCategoryForDisplay(cat);
        categorySelect.appendChild(option);
    });
    if (availableCategories.includes(currentValue)) categorySelect.value = currentValue;
}

function renderCategoriesList() {
    const container = document.getElementById('categories-list');
    if (!container) return;
    container.innerHTML = '';
    availableCategories.forEach(cat => {
        const badge = document.createElement('div');
        badge.className = 'media-badge';
        badge.style.cursor = 'pointer';
        badge.innerHTML = `<span>${escapeHtml(formatCategoryForDisplay(cat))}</span><span class="media-badge-delete" data-category="${escapeHtml(cat)}" style="margin-left: 0.5rem;">✕</span>`;
        badge.querySelector('.media-badge-delete').addEventListener('click', () => {
            if (confirm(`Delete category "${formatCategoryForDisplay(cat)}"?`)) {
                availableCategories = availableCategories.filter(c => c !== cat);
                localStorage.setItem('portfolio_categories', JSON.stringify(availableCategories));
                updateCategoryDropdown();
                renderCategoriesList();
            }
        });
        container.appendChild(badge);
    });
}

if (manageBtn && categoryManager) {
    const savedCats = localStorage.getItem('portfolio_categories');
    if (savedCats) availableCategories = JSON.parse(savedCats);
    updateCategoryDropdown();
    
    manageBtn.addEventListener('click', () => {
        renderCategoriesList();
        categoryManager.style.display = categoryManager.style.display === 'none' ? 'block' : 'none';
    });
}
if (closeCategoryManager) closeCategoryManager.addEventListener('click', () => categoryManager.style.display = 'none');
if (addCategoryBtn && newCategoryNameInput) {
    addCategoryBtn.addEventListener('click', () => {
        let raw = newCategoryNameInput.value.trim();
        if (!raw) return;
        const newCat = raw.toLowerCase().replace(/\s+/g, '_');
        if (!availableCategories.includes(newCat)) {
            availableCategories.push(newCat);
            localStorage.setItem('portfolio_categories', JSON.stringify(availableCategories));
            updateCategoryDropdown();
            renderCategoriesList();
            newCategoryNameInput.value = '';
        } else alert('Category exists');
    });
}

function init() {
    renderMediaBadges();
    loadData();
}

init();
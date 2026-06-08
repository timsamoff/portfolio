// Admin panel functionality with media badges and integrated file picker
let localProjectCache = [];
let currentMediaArray = [];
let draggedItemIndex = null;
let draggedMediaIndexForReorder = null;
let currentSearchTerm = '';
let availableCategories = [];

// Format category for display (convert underscores to spaces, capitalize)
function formatCategoryForDisplay(cat) {
    return cat
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Load categories from localStorage or use defaults from projects
function loadCategories() {
    const saved = localStorage.getItem('portfolio_categories');
    if (saved && JSON.parse(saved).length > 0) {
        availableCategories = JSON.parse(saved);
    } else if (localProjectCache.length > 0) {
        // Extract unique categories from existing projects
        const cats = [...new Set(localProjectCache.map(p => p.category).filter(c => c))];
        availableCategories = cats.length > 0 ? cats : ['brand', 'production', 'games', 'web'];
        saveCategories();
    } else {
        availableCategories = ['brand', 'production', 'games', 'web'];
    }
    updateCategoryDropdown();
}

function saveCategories() {
    localStorage.setItem('portfolio_categories', JSON.stringify(availableCategories));
    updateCategoryDropdown();
}

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
    
    if (availableCategories.includes(currentValue)) {
        categorySelect.value = currentValue;
    }
}

function renderCategoriesList() {
    const container = document.getElementById('categories-list');
    if (!container) return;
    
    container.innerHTML = '';
    availableCategories.forEach(cat => {
        const badge = document.createElement('div');
        badge.className = 'media-badge';
        badge.style.cursor = 'pointer';
        badge.innerHTML = `
            <span>${escapeHtml(formatCategoryForDisplay(cat))}</span>
            <span class="media-badge-delete" data-category="${escapeHtml(cat)}" style="margin-left: 0.5rem;">✕</span>
        `;
        badge.querySelector('.media-badge-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete category "${formatCategoryForDisplay(cat)}"? This will only remove it from the dropdown. Projects with this category will keep it.`)) {
                availableCategories = availableCategories.filter(c => c !== cat);
                saveCategories();
                renderCategoriesList();
            }
        });
        container.appendChild(badge);
    });
    
    if (availableCategories.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.75rem; padding: 0.5rem;">No categories yet. Add one above!</div>';
    }
}

// Category management UI
const manageBtn = document.getElementById('manage-categories-btn');
const categoryManager = document.getElementById('category-manager');
const closeCategoryManager = document.getElementById('close-category-manager');
const addCategoryBtn = document.getElementById('add-category-btn');
const newCategoryName = document.getElementById('new-category-name');

if (manageBtn && categoryManager) {
    manageBtn.addEventListener('click', () => {
        renderCategoriesList();
        categoryManager.style.display = categoryManager.style.display === 'none' ? 'block' : 'none';
    });
}

if (closeCategoryManager) {
    closeCategoryManager.addEventListener('click', () => {
        categoryManager.style.display = 'none';
    });
}

if (addCategoryBtn && newCategoryName) {
    addCategoryBtn.addEventListener('click', () => {
        // Convert input to category key (lowercase, underscores for spaces)
        let rawInput = newCategoryName.value.trim();
        if (!rawInput) {
            alert('Please enter a category name');
            return;
        }
        // Convert to key format: lowercase, spaces to underscores
        const newCat = rawInput.toLowerCase().replace(/\s+/g, '_');
        
        if (!availableCategories.includes(newCat)) {
            availableCategories.push(newCat);
            saveCategories();
            renderCategoriesList();
            newCategoryName.value = '';
            updateStatus(`Category "${formatCategoryForDisplay(newCat)}" added`, '#34d399');
        } else {
            alert('Category already exists!');
        }
    });
    
    newCategoryName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCategoryBtn.click();
        }
    });
}

const sortableListElement = document.getElementById('sortable-list');
const statusMsg = document.getElementById('status-msg');
const addForm = document.getElementById('add-project-form');

const formActionTitle = document.getElementById('form-action-title');
const formEditIndex = document.getElementById('form-edit-index');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Media management elements
const mediaInput = document.getElementById('media-input');
const addMediaBtn = document.getElementById('add-media-btn');
const mediaBadgesContainer = document.getElementById('media-badges');
const togglePasteBtn = document.getElementById('toggle-paste-btn');
const pasteArea = document.getElementById('paste-area');
const pasteUrls = document.getElementById('paste-urls');
const processPasteBtn = document.getElementById('process-paste-btn');

// Hidden file input for multi-select
const multiFileInput = document.getElementById('multi-file-input');

// Character counter
const descriptionTextarea = document.getElementById('form-description');
const charCounter = document.getElementById('char-counter');

// Admin search
const adminSearchInput = document.getElementById('admin-search-input');

// Helper function to detect media type for icon
function getMediaIcon(url) {
    if (!url) return '📄';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return '🖼️';
    if (lowerUrl.match(/\.(mp4|webm|mov|ogg)$/)) return '🎥';
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return '📺';
    if (lowerUrl.includes('vimeo.com')) return '🎬';
    return '🔗';
}

// Validate and preview media URL
function validateAndPreviewMediaUrl(url) {
    if (!url || !url.trim()) return null;
    const trimmedUrl = url.trim();
    
    const isImage = trimmedUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
    const isYouTube = trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be');
    const isVimeo = trimmedUrl.includes('vimeo.com');
    
    if (isImage) {
        return { type: 'image', url: trimmedUrl, preview: trimmedUrl };
    } else if (isYouTube) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = trimmedUrl.match(regExp);
        const videoId = match && match[2].length === 11 ? match[2] : null;
        if (videoId) {
            return { type: 'youtube', url: trimmedUrl, preview: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, videoId };
        }
    } else if (isVimeo) {
        return { type: 'vimeo', url: trimmedUrl, preview: null };
    } else if (trimmedUrl.match(/\.(mp4|webm|mov|ogg)$/i)) {
        return { type: 'video', url: trimmedUrl, preview: null };
    }
    
    return { type: 'link', url: trimmedUrl, preview: null };
}

// Get relative path from file object
function getRelativePathFromFile(file) {
    let cleanName = file.name.replace(/[#?&]/g, '_').replace(/\s+/g, '_');
    return `media/${cleanName}`;
}

// Process multiple files from input
function addFilesToMediaList(files) {
    if (!files || files.length === 0) return;
    let addedCount = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = getRelativePathFromFile(file);
        if (!currentMediaArray.includes(relativePath)) {
            currentMediaArray.push(relativePath);
            addedCount++;
        }
    }
    if (addedCount > 0) {
        renderMediaBadges();
        updateStatus(`✅ Added ${addedCount} media file(s)`, '#34d399');
        setTimeout(() => {
            if (statusMsg && statusMsg.style.color === 'rgb(52, 211, 153)') {
                updateStatus("Connected locally. Auto-write enabled.", "#34d399");
            }
        }, 2000);
    } else if (files.length > 0) {
        alert("All selected files were already in the media list (duplicates ignored).");
    }
    multiFileInput.value = '';
}

// Handle Add button click
function handleAddButtonClick() {
    const textValue = mediaInput.value.trim();
    
    if (textValue !== '') {
        const validation = validateAndPreviewMediaUrl(textValue);
        if (validation) {
            let confirmMessage = `Add this media?\n\nType: ${validation.type}\nURL: ${validation.url}`;
            if (validation.preview) {
                confirmMessage += `\n\nPreview available after adding.`;
            }
            if (confirm(confirmMessage)) {
                addMediaItem(textValue);
            }
        } else {
            addMediaItem(textValue);
        }
    } else {
        multiFileInput.click();
    }
}

// Add single media item
function addMediaItem(url) {
    if (!url || !url.trim()) return;
    const trimmedUrl = url.trim();
    if (!currentMediaArray.includes(trimmedUrl)) {
        currentMediaArray.push(trimmedUrl);
        renderMediaBadges();
        mediaInput.value = '';
        updateStatus(`Added: ${trimmedUrl.substring(0, 40)}`, "#34d399");
    } else {
        alert('This media URL is already in the list.');
    }
}

// Add multiple media items via paste
function addMultipleMediaItems(urlsText) {
    const lines = urlsText.split(/\r?\n/);
    let added = 0;
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !currentMediaArray.includes(trimmed)) {
            currentMediaArray.push(trimmed);
            added++;
        }
    });
    if (added > 0) {
        renderMediaBadges();
        pasteUrls.value = '';
        pasteArea.style.display = 'none';
        updateStatus(`Pasted & added ${added} new media item(s)`, "#34d399");
        if (added !== lines.filter(l => l.trim()).length) {
            alert(`Added ${added} new items. Some were duplicates or empty.`);
        } else if (added > 0) {
            alert(`Added ${added} media items.`);
        }
    } else {
        alert("No new valid media entries found (duplicates or empty).");
    }
}

// File picker change event
if (multiFileInput) {
    multiFileInput.addEventListener('change', (e) => {
        if (multiFileInput.files && multiFileInput.files.length > 0) {
            addFilesToMediaList(multiFileInput.files);
        }
    });
}

// Character counter for description
if (descriptionTextarea && charCounter) {
    function updateCharCount() {
        const length = descriptionTextarea.value.length;
        charCounter.textContent = `${length} characters (recommended: 300-800)`;
        if (length > 800) {
            charCounter.style.color = 'var(--accent-red)';
        } else {
            charCounter.style.color = 'var(--text-muted)';
        }
    }
    descriptionTextarea.addEventListener('input', updateCharCount);
    updateCharCount();
}

// Admin search functionality
if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        renderAdminView();
    });
}

// Make media badges draggable
function makeMediaBadgesDraggable() {
    const badges = document.querySelectorAll('.media-badge');
    
    badges.forEach((badge) => {
        badge.setAttribute('draggable', 'true');
        
        badge.addEventListener('dragstart', (e) => {
            draggedMediaIndexForReorder = parseInt(badge.getAttribute('data-index'));
            badge.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedMediaIndexForReorder);
        });
        
        badge.addEventListener('dragend', (e) => {
            badge.style.opacity = '1';
            draggedMediaIndexForReorder = null;
            badges.forEach(b => b.classList.remove('dragging-over'));
        });
        
        badge.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const targetIndex = parseInt(badge.getAttribute('data-index'));
            if (draggedMediaIndexForReorder !== null && draggedMediaIndexForReorder !== targetIndex) {
                badge.classList.add('dragging-over');
            }
        });
        
        badge.addEventListener('dragleave', () => {
            badge.classList.remove('dragging-over');
        });
        
        badge.addEventListener('drop', (e) => {
            e.preventDefault();
            badge.classList.remove('dragging-over');
            const targetIndex = parseInt(badge.getAttribute('data-index'));
            
            if (draggedMediaIndexForReorder !== null && draggedMediaIndexForReorder !== targetIndex) {
                const draggedItem = currentMediaArray[draggedMediaIndexForReorder];
                currentMediaArray.splice(draggedMediaIndexForReorder, 1);
                const newTargetIndex = (draggedMediaIndexForReorder < targetIndex) ? targetIndex - 1 : targetIndex;
                currentMediaArray.splice(newTargetIndex, 0, draggedItem);
                renderMediaBadges();
                updateStatus("Media order updated", "#f59e0b");
            }
        });
    });
}

// Render media badges
function renderMediaBadges() {
    if (!mediaBadgesContainer) return;
    mediaBadgesContainer.innerHTML = '';
    if (currentMediaArray.length === 0) {
        mediaBadgesContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 0.5rem; font-size: 0.75rem;">No media added yet. Type a path and click Add, or click Add with empty field to select files.</div>';
        return;
    }
    
    currentMediaArray.forEach((media, index) => {
        const validation = validateAndPreviewMediaUrl(media);
        const previewBadge = validation && validation.preview ? '🔍' : '';
        
        const badge = document.createElement('div');
        badge.className = 'media-badge';
        badge.setAttribute('data-index', index);
        badge.innerHTML = `
            <span class="drag-handle" style="cursor: grab; opacity: 0.5; margin-right: 4px;">⋮⋮</span>
            <span class="media-badge-icon">${getMediaIcon(media)}</span>
            <span class="media-badge-text" title="${escapeHtml(media)}">${media.length > 45 ? media.substring(0, 42) + '...' : media}</span>
            ${previewBadge ? `<span class="media-badge-preview" data-url="${escapeHtml(media)}" style="cursor: pointer; opacity: 0.6;" title="Preview">🔍</span>` : ''}
            <span class="media-badge-edit" data-index="${index}" title="Edit URL/Path">✏️</span>
            <span class="media-badge-delete" data-index="${index}" title="Delete">✕</span>
        `;
        
        const previewSpan = badge.querySelector('.media-badge-preview');
        if (previewSpan) {
            previewSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = previewSpan.getAttribute('data-url');
                const validation = validateAndPreviewMediaUrl(url);
                if (validation && validation.preview) {
                    const previewModal = document.createElement('div');
                    previewModal.style.cssText = `
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(0,0,0,0.9); z-index: 20000;
                        display: flex; align-items: center; justify-content: center;
                        cursor: pointer;
                    `;
                    previewModal.innerHTML = `
                        <div style="max-width: 90%; max-height: 90%;">
                            <img src="${validation.preview}" style="max-width: 100%; max-height: 80vh; border-radius: 8px;">
                            <p style="color: white; text-align: center; margin-top: 1rem;">${validation.url}</p>
                        </div>
                    `;
                    previewModal.addEventListener('click', () => previewModal.remove());
                    document.body.appendChild(previewModal);
                } else {
                    alert(`Preview not available for:\n${url}`);
                }
            });
        }
        
        badge.querySelector('.media-badge-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            const newValue = prompt('Edit media URL/relative path:', media);
            if (newValue && newValue.trim()) {
                const trimmedNew = newValue.trim();
                if (!currentMediaArray.includes(trimmedNew) || currentMediaArray[index] === trimmedNew) {
                    currentMediaArray[index] = trimmedNew;
                    renderMediaBadges();
                    updateStatus("Media item updated", "#f59e0b");
                } else {
                    alert("This URL/path already exists in the media list.");
                }
            }
        });
        
        badge.querySelector('.media-badge-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            currentMediaArray.splice(index, 1);
            renderMediaBadges();
            updateStatus("Media removed", "#f59e0b");
        });
        
        mediaBadgesContainer.appendChild(badge);
    });
    
    makeMediaBadgesDraggable();
}

// Event listeners
if (addMediaBtn) {
    addMediaBtn.addEventListener('click', handleAddButtonClick);
}

if (mediaInput) {
    mediaInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddButtonClick();
        }
    });
}

if (togglePasteBtn) {
    togglePasteBtn.addEventListener('click', () => {
        pasteArea.style.display = pasteArea.style.display === 'none' ? 'block' : 'none';
    });
}

if (processPasteBtn) {
    processPasteBtn.addEventListener('click', () => {
        addMultipleMediaItems(pasteUrls.value);
    });
}

function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

// Load projects
fetch('projects.json')
    .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
    })
    .then(data => {
        localProjectCache = data;
        renderAdminView();
        updateStatus("Connected locally. Auto-write enabled.", "#34d399");
        loadCategories();
    })
    .catch(() => {
        updateStatus("projects.json not detected. Creating fresh list on first save.", "#f59e0b");
        localProjectCache = [];
        renderAdminView();
        loadCategories();
    });

// Save to disk
function saveToDiskLocally() {
    fetch('http://localhost:3001/api/save-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localProjectCache)
    })
    .then(res => res.json())
    .then(res => {
        if(res.success) {
            updateStatus("Changes auto-saved to projects.json!", "#34d399");
        } else {
            updateStatus("Write Error: " + res.error, "#d32f2f");
        }
    })
    .catch(() => updateStatus("Server connection lost. Changes not persisted.", "#d32f2f"));
}

function updateStatus(text, color) {
    if (statusMsg) {
        statusMsg.textContent = text;
        statusMsg.style.color = color;
    }
}

function getMediaPreview(mediaArray) {
    if (!mediaArray || mediaArray.length === 0) return "No media";
    const icons = mediaArray.map(m => getMediaIcon(m)).join(' ');
    return `${icons} ${mediaArray.length} media item(s)`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render Admin View with search and draft status
function renderAdminView() {
    if (!sortableListElement) return;
    sortableListElement.innerHTML = '';
    
    const filteredProjects = currentSearchTerm 
        ? localProjectCache.filter(project => project.title.toLowerCase().includes(currentSearchTerm))
        : [...localProjectCache];
    
    filteredProjects.forEach((project, filteredIndex) => {
        const originalIndex = localProjectCache.findIndex(p => p === project);
        const li = document.createElement('li');
        li.className = 'sort-item';
        li.draggable = true;
        li.setAttribute('data-index', originalIndex);
        
        const mediaArray = project.media ? (Array.isArray(project.media) ? project.media : [project.media]) : [];
        const mediaPreview = getMediaPreview(mediaArray);
        const alignHint = project.imageAlign ? ` (${project.imageAlign})` : '';
        const draftBadge = project.published === false ? ' [DRAFT]' : '';
        
        li.innerHTML = `
            <div class="sort-content" style="flex-grow:1; cursor:pointer;">
                <strong>${escapeHtml(project.title)}${draftBadge}</strong> 
                <small style="color:var(--text-muted); margin-left:0.5rem;">(${escapeHtml(project.tag)})</small>
                <div style="font-size:0.7rem; color:var(--accent-red); margin-top:0.2rem;">${mediaPreview}${alignHint}</div>
                <div class="link-preview-pane" style="font-size:0.75rem; margin-top:0.25rem; opacity:0.85; max-width:400px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${linkify(project.description.substring(0, 100))}
                </div>
            </div>
            <div style="display:flex; gap:1.2rem; align-items:center;">
                <span class="delete-item-btn" style="cursor:pointer; color:var(--text-muted); font-weight:bold; font-size:1.1rem; padding: 0 0.25rem;" data-index="${originalIndex}" title="Delete Project">✕</span>
                <span class="sort-handle" style="cursor:grab; padding: 0 0.25rem;">☰</span>
            </div>
        `;
        
        li.querySelector('.sort-content').addEventListener('click', (e) => {
            if (e.target.tagName === 'A') return;
            loadProjectIntoForm(originalIndex);
        });
        
        li.querySelector('.delete-item-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm(`Remove "${project.title}" from layout grid permanently?`)) {
                localProjectCache.splice(originalIndex, 1);
                renderAdminView();
                saveToDiskLocally();
                resetFormState();
            }
        });

        li.addEventListener('dragstart', () => li.classList.add('dragging'));
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            recalculateCacheOrder();
        });
        sortableListElement.appendChild(li);
    });
    
    if (filteredProjects.length === 0 && currentSearchTerm) {
        sortableListElement.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No projects match "${escapeHtml(currentSearchTerm)}"</div>`;
    }
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
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function recalculateCacheOrder() {
    const currentRows = [...sortableListElement.querySelectorAll('.sort-item')];
    localProjectCache = currentRows.map(row => localProjectCache[row.getAttribute('data-index')]);
    currentRows.forEach((row, i) => row.setAttribute('data-index', i));
    saveToDiskLocally();
}

// Form handling
if (addForm) {
    addForm.addEventListener('submit', e => {
        e.preventDefault();
        
        const projectData = {
            title: document.getElementById('form-title').value,
            category: document.getElementById('form-category').value,
            tag: document.getElementById('form-tag').value,
            media: [...currentMediaArray],
            description: document.getElementById('form-description').value,
            imageAlign: document.getElementById('form-image-align').value,
            published: document.getElementById('form-published').checked
        };

        projectData.media = projectData.media.filter(m => m && m.trim());
        const editIndex = formEditIndex.value;

        if (editIndex !== "") {
            localProjectCache[editIndex] = projectData;
        } else {
            localProjectCache.push(projectData);
        }

        renderAdminView();
        saveToDiskLocally();
        resetFormState();
        updateStatus("Project saved successfully", "#34d399");
    });
}

function loadProjectIntoForm(index) {
    const target = localProjectCache[index];
    formActionTitle.textContent = "Modify Selected Entry";
    formEditIndex.value = index;
    
    document.getElementById('form-title').value = target.title;
    document.getElementById('form-category').value = target.category;
    document.getElementById('form-tag').value = target.tag;
    
    const publishedCheckbox = document.getElementById('form-published');
    publishedCheckbox.checked = target.published !== false;
    
    const alignSelect = document.getElementById('form-image-align');
    if (target.imageAlign) {
        alignSelect.value = target.imageAlign;
    } else {
        alignSelect.value = 'center';
    }
    
    currentMediaArray = target.media ? [...target.media] : [];
    renderMediaBadges();
    
    document.getElementById('form-description').value = target.description;
    if (charCounter) updateCharCount();

    submitBtn.textContent = "Update Portfolio Project";
    cancelEditBtn.style.display = "inline-block";
    
    document.querySelectorAll('.sort-item').forEach(el => el.style.borderColor = 'var(--border-color)');
    const selectedRow = document.querySelector(`.sort-item[data-index="${index}"]`);
    if (selectedRow) selectedRow.style.borderColor = 'var(--accent-red)';
}

function resetFormState() {
    if (addForm) addForm.reset();
    formEditIndex.value = "";
    formActionTitle.textContent = "Insert New Project";
    submitBtn.textContent = "Add to Layout Stack";
    cancelEditBtn.style.display = "none";
    currentMediaArray = [];
    renderMediaBadges();
    if (mediaInput) mediaInput.value = '';
    if (pasteUrls) pasteUrls.value = '';
    if (pasteArea) pasteArea.style.display = 'none';
    const alignSelect = document.getElementById('form-image-align');
    if (alignSelect) alignSelect.value = 'center';
    const publishedCheckbox = document.getElementById('form-published');
    if (publishedCheckbox) publishedCheckbox.checked = true;
    document.querySelectorAll('.sort-item').forEach(el => el.style.borderColor = 'var(--border-color)');
    if (charCounter) updateCharCount();
}

if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', resetFormState);
}

// Initialize
renderMediaBadges();
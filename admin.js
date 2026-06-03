// Admin panel functionality with media badges
let localProjectCache = [];
let currentMediaArray = [];
let draggedItemIndex = null;
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

// Make media badges draggable for reordering
function makeMediaBadgesDraggable() {
    const badges = document.querySelectorAll('.media-badge');
    
    badges.forEach((badge) => {
        badge.setAttribute('draggable', 'true');
        
        badge.addEventListener('dragstart', (e) => {
            draggedItemIndex = parseInt(badge.getAttribute('data-index'));
            badge.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        });
        
        badge.addEventListener('dragend', (e) => {
            badge.style.opacity = '1';
            draggedItemIndex = null;
        });
        
        badge.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        badge.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetIndex = parseInt(badge.getAttribute('data-index'));
            
            if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
                const draggedItem = currentMediaArray[draggedItemIndex];
                currentMediaArray.splice(draggedItemIndex, 1);
                currentMediaArray.splice(targetIndex, 0, draggedItem);
                renderMediaBadges();
            }
        });
    });
}

// Render media badges
function renderMediaBadges() {
    mediaBadgesContainer.innerHTML = '';
    if (currentMediaArray.length === 0) {
        mediaBadgesContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 0.5rem; font-size: 0.75rem;">No media added yet. Add images, videos, or YouTube/Vimeo links above.</div>';
        return;
    }
    
    currentMediaArray.forEach((media, index) => {
        const badge = document.createElement('div');
        badge.className = 'media-badge';
        badge.setAttribute('data-index', index);
        badge.innerHTML = `
            <span class="drag-handle" style="cursor: grab; opacity: 0.5; margin-right: 4px;">⋮⋮</span>
            <span class="media-badge-icon">${getMediaIcon(media)}</span>
            <span class="media-badge-text" title="${media}">${media.length > 40 ? media.substring(0, 37) + '...' : media}</span>
            <span class="media-badge-edit" data-index="${index}" title="Edit">✏️</span>
            <span class="media-badge-delete" data-index="${index}" title="Delete">✕</span>
        `;
        
        badge.querySelector('.media-badge-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            const newValue = prompt('Edit media URL:', media);
            if (newValue && newValue.trim()) {
                currentMediaArray[index] = newValue.trim();
                renderMediaBadges();
            }
        });
        
        badge.querySelector('.media-badge-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            currentMediaArray.splice(index, 1);
            renderMediaBadges();
        });
        
        mediaBadgesContainer.appendChild(badge);
    });
    
    // Make badges draggable for reordering
    makeMediaBadgesDraggable();
}

// Add single media item
function addMediaItem(url) {
    if (!url || !url.trim()) return;
    const trimmedUrl = url.trim();
    if (!currentMediaArray.includes(trimmedUrl)) {
        currentMediaArray.push(trimmedUrl);
        renderMediaBadges();
        mediaInput.value = '';
    } else {
        alert('This media URL is already in the list.');
    }
}

// Add multiple media items
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
    }
    if (added !== lines.filter(l => l.trim()).length) {
        alert(`Added ${added} new items. Some were duplicates or empty.`);
    } else if (added > 0) {
        alert(`Added ${added} media items.`);
    }
}

// Event listeners for media management
if (addMediaBtn) {
    addMediaBtn.addEventListener('click', () => {
        addMediaItem(mediaInput.value);
    });
}

if (mediaInput) {
    mediaInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addMediaItem(mediaInput.value);
        }
    });
}

if (togglePasteBtn) {
    togglePasteBtn.addEventListener('click', () => {
        if (pasteArea.style.display === 'none') {
            pasteArea.style.display = 'block';
        } else {
            pasteArea.style.display = 'none';
        }
    });
}

if (processPasteBtn) {
    processPasteBtn.addEventListener('click', () => {
        addMultipleMediaItems(pasteUrls.value);
    });
}

// Helper function to turn raw URLs into clickable anchor tags
function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

// Auto-Load configurations from local projects.json file
fetch('projects.json')
    .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
    })
    .then(data => {
        localProjectCache = data;
        renderAdminView();
        updateStatus("Connected locally. Auto-write enabled.", "#34d399");
    })
    .catch(() => {
        updateStatus("projects.json not detected. Creating fresh list on first save.", "#f59e0b");
    });

// Write to local file system via node server.js api endpoint
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
    .catch(() => updateStatus("Server connection lost.", "#d32f2f"));
}

function updateStatus(text, color) {
    if (statusMsg) {
        statusMsg.textContent = text;
        statusMsg.style.color = color;
    }
}

// Helper to get media preview text for admin list
function getMediaPreview(mediaArray) {
    if (!mediaArray || mediaArray.length === 0) return "No media";
    const icons = mediaArray.map(m => getMediaIcon(m)).join(' ');
    return `${icons} ${mediaArray.length} media item(s)`;
}

// Render Dashboard Row Elements
function renderAdminView() {
    if (!sortableListElement) return;
    sortableListElement.innerHTML = '';
    localProjectCache.forEach((project, index) => {
        const li = document.createElement('li');
        li.className = 'sort-item';
        li.draggable = true;
        li.setAttribute('data-index', index);
        
        const mediaArray = project.media ? (Array.isArray(project.media) ? project.media : [project.media]) : [];
        const mediaPreview = getMediaPreview(mediaArray);
        
        li.innerHTML = `
            <div class="sort-content" style="flex-grow:1; cursor:pointer;">
                <strong>${escapeHtml(project.title)}</strong> 
                <small style="color:var(--text-muted); margin-left:0.5rem;">(${escapeHtml(project.tag)})</small>
                <div style="font-size:0.7rem; color:var(--accent-red); margin-top:0.2rem;">${mediaPreview}</div>
                <div class="link-preview-pane" style="font-size:0.75rem; margin-top:0.25rem; opacity:0.85; max-width:400px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${linkify(project.description)}
                </div>
            </div>
            <div style="display:flex; gap:1.2rem; align-items:center;">
                <span class="delete-item-btn" style="cursor:pointer; color:var(--text-muted); font-weight:bold; font-size:1.1rem; padding: 0 0.25rem;" data-index="${index}" title="Delete Project">✕</span>
                <span class="sort-handle" style="cursor:grab; padding: 0 0.25rem;">☰</span>
            </div>
        `;
        
        li.querySelector('.sort-content').addEventListener('click', (e) => {
            if (e.target.tagName === 'A') return;
            loadProjectIntoForm(index);
        });
        
        li.querySelector('.delete-item-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm(`Remove "${project.title}" from layout grid permanently?`)) {
                localProjectCache.splice(index, 1);
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
}

// Helper to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

// Form Action Routing Controls (Inserts & Updates)
if (addForm) {
    addForm.addEventListener('submit', e => {
        e.preventDefault();
        
        const projectData = {
            title: document.getElementById('form-title').value,
            category: document.getElementById('form-category').value,
            tag: document.getElementById('form-tag').value,
            media: [...currentMediaArray],
            description: document.getElementById('form-description').value
        };

        // Remove any empty strings
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
    });
}

function loadProjectIntoForm(index) {
    const target = localProjectCache[index];
    formActionTitle.textContent = "Modify Selected Entry";
    formEditIndex.value = index;
    
    document.getElementById('form-title').value = target.title;
    document.getElementById('form-category').value = target.category;
    document.getElementById('form-tag').value = target.tag;
    
    // Load media array into currentMediaArray
    currentMediaArray = target.media ? [...target.media] : [];
    renderMediaBadges();
    
    document.getElementById('form-description').value = target.description;

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
    document.querySelectorAll('.sort-item').forEach(el => el.style.borderColor = 'var(--border-color)');
}

if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', resetFormState);
}

// Initialize empty media badges
renderMediaBadges();
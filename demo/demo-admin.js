// demo/demo-admin.js
// ========================================
// DEMO ADMIN - localStorage version of admin.js
// ========================================

let localProjectCache = [];
let currentMediaArray = [];
let draggedMediaIndexForReorder = null;
let currentSearchTerm = '';
let availableCategories = [];

// Auto-save tracking
let autoSaveTimeout = null;
let isEditingMode = false;
let currentEditIndex = null;
let lastSavedFormData = null;

// Modal tracking
let activeModal = null;
let inlineErrorTimeout = null;

// Selection captured on toolbar mousedown
let capturedSel = null;

// Description textarea
const descTextarea = document.getElementById('form-description');
const charCounter = document.getElementById('char-counter');

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

// Form elements
const adminSearchInput = document.getElementById('admin-search-input');
const formTitle = document.getElementById('form-title');
const formCategory = document.getElementById('form-category');
const formTag = document.getElementById('form-tag');
const formPublished = document.getElementById('form-published');
const formImageAlign = document.getElementById('form-image-align');
const categoryHelpText = document.getElementById('category-help-text');

// Category management elements
const addCategoryBtn = document.getElementById('add-category-btn');
const addCategoryField = document.getElementById('add-category-field');
const newCategoryNameInput = document.getElementById('new-category-name');
const confirmAddCategoryBtn = document.getElementById('confirm-add-category-btn');
const cancelAddCategoryBtn = document.getElementById('cancel-add-category-btn');
const manageBtn = document.getElementById('manage-categories-btn');
const categoryManager = document.getElementById('category-manager');
const closeCategoryManager = document.getElementById('close-category-manager');
const resetDataBtn = document.getElementById('reset-data-btn');

// Toolbar buttons
const toolbarBold = document.getElementById('toolbar-bold');
const toolbarItalic = document.getElementById('toolbar-italic');
const toolbarUl = document.getElementById('toolbar-ul');
const toolbarLink = document.getElementById('toolbar-link');
const toolbarAward = document.getElementById('toolbar-award');

// Floating notification
let floatingNotification = null;
let notificationTimeout = null;

if (window.history.scrollRestoration) {
    window.history.scrollRestoration = 'manual';
}

// ========================
// SMART QUOTES
// ========================
function convertToSmartQuotes(text) {
    if (!text) return '';
    
    if (!/<[a-z][\s\S]*>/i.test(text)) {
        let r = text.replace(/(^|[-—\s(\[{])"/g, '$1“');
        r = r.replace(/"/g, '”');
        r = r.replace(/(^|[-—\s(\[{])'/g, '$1‘');
        r = r.replace(/'/g, '’');
        return r;
    }
    
    let result = '';
    let inTag = false;
    let inAttribute = false;
    let attributeQuoteChar = '';
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (char === '<') {
            inTag = true;
            inAttribute = false;
            result += char;
            continue;
        }
        if (char === '>') {
            inTag = false;
            inAttribute = false;
            result += char;
            continue;
        }
        
        if (inTag) {
            if (char === '"' || char === "'") {
                if (!inAttribute) {
                    inAttribute = true;
                    attributeQuoteChar = char;
                } else if (char === attributeQuoteChar) {
                    inAttribute = false;
                }
                result += char;
                continue;
            }
            result += char;
            continue;
        }
        
        if (!inTag && !inAttribute) {
            if (char === '"') {
                const prevChar = text[i-1] || '';
                if (/[\s(\[{]/.test(prevChar) || i === 0) {
                    result += '“';
                } else {
                    result += '”';
                }
            } else if (char === "'") {
                const prevChar = text[i-1] || '';
                if (/[\s(\[{]/.test(prevChar) || i === 0) {
                    result += '‘';
                } else {
                    result += '’';
                }
            } else {
                result += char;
            }
        } else {
            result += char;
        }
    }
    
    return result;
}

// ========================
// LINK CLEANUP
// ========================
function cleanupMalformedLinks(html) {
    if (!html) return html;
    let cleaned = html;
    cleaned = cleaned.replace(/href=["'”‘’]\s*["'”‘’]?(https?:\/\/[^"'\s>]+)["'”‘’]\s*["'”‘’]?/g, 'href="$1"');
    cleaned = cleaned.replace(/href=”(https?:\/\/[^”\s>]+)”/g, 'href="$1"');
    cleaned = cleaned.replace(/href=‘([^’\s>]+)’/g, 'href="$1"');
    cleaned = cleaned.replace(/href="https?:\/\/[^"]*?(https?:\/\/[^"]+)/g, function(match, captured) {
        return 'href="' + captured;
    });
    cleaned = cleaned.replace(/%E2%80%9C/g, '').replace(/%E2%80%9D/g, '');
    cleaned = cleaned.replace(/%E2%80%98/g, '').replace(/%E2%80%99/g, '');
    cleaned = cleaned.replace(/target=”(_blank|_self|_parent|_top)”/g, 'target="$1"');
    cleaned = cleaned.replace(/target=‘(_blank|_self|_parent|_top)’/g, 'target="$1"');
    cleaned = cleaned.replace(/rel=”(noopener noreferrer|nofollow|noopener)”/g, 'rel="$1"');
    cleaned = cleaned.replace(/rel=‘(noopener noreferrer|nofollow|noopener)’/g, 'rel="$1"');
    return cleaned;
}

// ========================
// TEXTAREA EDITOR HELPERS
// ========================
function updateCharCount() {
    if (charCounter && descTextarea) {
        charCounter.textContent = descTextarea.value.length + ' characters';
    }
}

function insertAtCursor(before, after, selStart, selEnd, selText) {
    if (after === undefined) after = '';
    if (!descTextarea) return;
    const start = (selStart !== undefined) ? selStart : 0;
    const end = (selEnd !== undefined) ? selEnd : 0;
    const sel = (selText !== undefined) ? selText : '';
    const val = descTextarea.value;
    const replacement = before + sel + after;
    descTextarea.value = val.slice(0, start) + replacement + val.slice(end);
    const cursorPos = (start === end) ? start + before.length : start + replacement.length;
    descTextarea.focus();
    descTextarea.setSelectionRange(cursorPos, cursorPos);
    updateCharCount();
    if (isEditingMode) debouncedAutoSave();
}

function setEditorContent(html) {
    if (descTextarea) {
        descTextarea.value = html || '';
        updateCharCount();
    }
}

function getEditorContent() {
    return descTextarea ? descTextarea.value : '';
}

function applySmartQuotesToEditor() {
    if (!descTextarea) return;
    const pos = descTextarea.selectionStart;
    descTextarea.value = convertToSmartQuotes(descTextarea.value);
    descTextarea.setSelectionRange(pos, pos);
    updateCharCount();
}

// ========================
// TOOLBAR FUNCTIONS
// ========================
function applyInlineFormat(tagName) {
    if (!descTextarea || !capturedSel) return;
    const open = '<' + tagName + '>';
    const close = '</' + tagName + '>';
    const start = capturedSel.start;
    const end = capturedSel.end;
    const val = capturedSel.val;
    const sel = capturedSel.sel;

    if (sel.startsWith(open) && sel.endsWith(close) && sel.length > open.length + close.length) {
        const inner = sel.slice(open.length, sel.length - close.length);
        descTextarea.setRangeText(inner, start, end, 'select');
        descTextarea.focus();
        updateCharCount();
        if (isEditingMode) debouncedAutoSave();
        return;
    }

    const beforeSel = val.slice(0, start);
    const afterSel = val.slice(end);
    if (beforeSel.endsWith(open) && afterSel.startsWith(close)) {
        const newVal = val.slice(0, start - open.length) + sel + val.slice(end + close.length);
        descTextarea.value = newVal;
        descTextarea.setSelectionRange(start - open.length, start - open.length + sel.length);
        descTextarea.focus();
        updateCharCount();
        if (isEditingMode) debouncedAutoSave();
        return;
    }

    const openIdx = val.lastIndexOf(open, start);
    const closeIdx = val.indexOf(close, end);
    if (openIdx !== -1 && closeIdx !== -1) {
        const between = val.slice(openIdx + open.length, closeIdx);
        const hasNestedOpen = between.includes(open);
        const hasNestedClose = between.includes(close);
        if (!hasNestedOpen && !hasNestedClose) {
            const inner = between;
            const newVal = val.slice(0, openIdx) + inner + val.slice(closeIdx + close.length);
            const newStart = openIdx + (start - (openIdx + open.length));
            const newEnd = newStart + sel.length;
            descTextarea.value = newVal;
            descTextarea.setSelectionRange(newStart, newEnd);
            descTextarea.focus();
            updateCharCount();
            if (isEditingMode) debouncedAutoSave();
            return;
        }
    }

    insertAtCursor(open, close, start, end, sel);
}

function applyAwardTag() {
    if (!descTextarea || !capturedSel) return;
    const start = capturedSel.start;
    const end = capturedSel.end;
    const sel = capturedSel.sel;
    
    if (!sel || sel.trim() === '') {
        insertAtCursor('<award>', '</award>', start, end, sel);
        return;
    }
    
    if (sel.startsWith('<award>') && sel.endsWith('</award>')) {
        const inner = sel.slice(7, sel.length - 8);
        descTextarea.setRangeText(inner, start, end, 'select');
        descTextarea.focus();
        updateCharCount();
        if (isEditingMode) debouncedAutoSave();
        return;
    }
    
    const beforeSel = capturedSel.val.slice(0, start);
    const afterSel = capturedSel.val.slice(end);
    if (beforeSel.endsWith('<award>') && afterSel.startsWith('</award>')) {
        const newVal = capturedSel.val.slice(0, start - 7) + sel + capturedSel.val.slice(end + 8);
        descTextarea.value = newVal;
        descTextarea.setSelectionRange(start - 7, start - 7 + sel.length);
        descTextarea.focus();
        updateCharCount();
        if (isEditingMode) debouncedAutoSave();
        return;
    }
    
    insertAtCursor('<award>', '</award>', start, end, sel);
}

function applyUnorderedList() {
    if (!descTextarea || !capturedSel) return;
    const start = capturedSel.start;
    const end = capturedSel.end;
    const val = capturedSel.val;
    const sel = capturedSel.sel.trim();

    if (sel) {
        const lines = sel.split('\n').map(l => l.replace(/\r$/, '').trim()).filter(l => l.length > 0);
        const items = lines.map(line => '<li>' + line + '</li>').join('\n');
        const ul = '<ul>\n' + items + '\n</ul>';
        descTextarea.setRangeText(ul, start, end, 'end');
    } else {
        insertAtCursor('<ul>\n<li>', '</li>\n</ul>');
    }
    descTextarea.focus();
    updateCharCount();
    if (isEditingMode) debouncedAutoSave();
}

function insertLink() {
    if (!descTextarea || !capturedSel) return;
    const start = capturedSel.start;
    const end = capturedSel.end;
    const sel = capturedSel.sel;

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'link-modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
        z-index: 20000; display: flex; align-items: center; justify-content: center;
    `;
    const preview = sel ? `<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:1rem;">Wrapping: <em>&ldquo;${escapeHtml(sel.length > 60 ? sel.slice(0,60)+'…' : sel)}&rdquo;</em></p>` : '';
    modalOverlay.innerHTML = `
        <div style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:24px;padding:1.5rem;max-width:450px;width:90%;">
            <h3 style="margin-bottom:0.5rem;font-size:1.1rem;">Insert Link</h3>
            ${preview}
            <input type="text" id="link-url-input" placeholder="https://example.com or /relative/path" value=""
                style="width:100%;padding:0.8rem;border-radius:12px;background:var(--bg-primary);
                       border:1px solid var(--border-color);color:var(--text-primary);
                       margin-bottom:1rem;box-sizing:border-box;">
            <div style="display:flex;gap:1rem;justify-content:flex-end;">
                <button id="link-modal-cancel" class="btn-small">Cancel</button>
                <button id="link-modal-insert" class="filter-btn">Insert Link</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalOverlay);

    const urlInput = modalOverlay.querySelector('#link-url-input');
    urlInput.focus();

    const closeModal = () => modalOverlay.remove();

    const doInsert = () => {
        let url = urlInput.value.trim();
        if (!url) { closeModal(); return; }
        if (!url.startsWith('http://') && !url.startsWith('https://') && 
            !url.startsWith('/') && !url.startsWith('./') && !url.startsWith('../') && 
            !url.startsWith('#') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
            url = 'https://' + url;
        }
        const tag = '<a href="' + url + '" target="_blank" rel="noopener noreferrer">';
        insertAtCursor(tag, '</a>', start, end, sel);
        closeModal();
    };

    modalOverlay.querySelector('#link-modal-insert').addEventListener('click', doInsert);
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doInsert(); } });
    modalOverlay.querySelector('#link-modal-cancel').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
}

// ========================
// NOTIFICATION SYSTEM
// ========================
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

function showAutoSaveNotification() {
    showFloatingNotification("✓ Auto-saved");
}

// ========================
// CONFIRMATION MODAL
// ========================
function showConfirmModal(message, onConfirm, onCancel) {
    if (activeModal) {
        activeModal.remove();
    }
    
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 24px;
        padding: 1.5rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    `;
    
    modalContent.innerHTML = `
        <p style="margin-bottom: 1.5rem; line-height: 1.5; color: var(--text-primary); white-space: pre-wrap;">${escapeHtml(message)}</p>
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="modal-cancel-btn" class="btn-small" style="padding: 0.5rem 1rem;">Cancel</button>
            <button id="modal-confirm-btn" class="filter-btn" style="padding: 0.5rem 1rem; background: var(--accent-red);">Confirm</button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    activeModal = modalOverlay;
    
    const confirmBtn = modalContent.querySelector('#modal-confirm-btn');
    confirmBtn.addEventListener('click', () => {
        modalOverlay.remove();
        activeModal = null;
        if (onConfirm) onConfirm();
    });
    
    const cancelBtn = modalContent.querySelector('#modal-cancel-btn');
    cancelBtn.addEventListener('click', () => {
        modalOverlay.remove();
        activeModal = null;
        if (onCancel) onCancel();
    });
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
            activeModal = null;
            if (onCancel) onCancel();
        }
    });
}

function showEditMediaModal(currentUrl, index) {
    if (activeModal) activeModal.remove();
    
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 24px;
        padding: 1.5rem;
        max-width: 500px;
        width: 90%;
    `;
    
    modalContent.innerHTML = `
        <h3 style="margin-bottom: 1rem; font-size: 1.1rem;">Edit Media URL</h3>
        <input type="text" id="edit-media-input" value="${escapeHtml(currentUrl)}" style="width: 100%; padding: 0.8rem; border-radius: 12px; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); margin-bottom: 1rem;">
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="edit-media-cancel" class="btn-small">Cancel</button>
            <button id="edit-media-save" class="filter-btn">Save</button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    activeModal = modalOverlay;
    
    const input = modalContent.querySelector('#edit-media-input');
    input.focus();
    
    const saveBtn = modalContent.querySelector('#edit-media-save');
    saveBtn.addEventListener('click', () => {
        const newValue = input.value.trim();
        if (newValue) {
            currentMediaArray[index] = newValue;
            renderMediaBadges();
            if (isEditingMode) debouncedAutoSave();
        }
        modalOverlay.remove();
        activeModal = null;
    });
    
    const cancelBtn = modalContent.querySelector('#edit-media-cancel');
    cancelBtn.addEventListener('click', () => {
        modalOverlay.remove();
        activeModal = null;
    });
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
            activeModal = null;
        }
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const newValue = input.value.trim();
            if (newValue) {
                currentMediaArray[index] = newValue;
                renderMediaBadges();
                if (isEditingMode) debouncedAutoSave();
            }
            modalOverlay.remove();
            activeModal = null;
        }
    });
}

function showInlineError(inputElement, message) {
    const existingError = inputElement.parentElement?.querySelector('.inline-error');
    if (existingError) existingError.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'inline-error';
    errorDiv.style.cssText = `
        color: var(--accent-red);
        font-size: 0.7rem;
        margin-top: 0.4rem;
        padding-left: 0.25rem;
        display: flex;
        align-items: center;
        gap: 0.3rem;
    `;
    errorDiv.innerHTML = `⚠️ ${escapeHtml(message)}`;
    inputElement.insertAdjacentElement('afterend', errorDiv);
    
    if (inlineErrorTimeout) clearTimeout(inlineErrorTimeout);
    inlineErrorTimeout = setTimeout(() => {
        const error = inputElement.parentElement?.querySelector('.inline-error');
        if (error) error.remove();
        inlineErrorTimeout = null;
    }, 3000);
}

// ========================
// CATEGORY MANAGEMENT
// ========================
function normalizeCategoryName(name) {
    if (!name || !name.trim()) return '';
    let normalized = name.trim().toLowerCase();
    normalized = normalized.replace(/&/g, '_&_');
    normalized = normalized.replace(/\s+/g, ' ');
    normalized = normalized.replace(/ /g, '_');
    normalized = normalized.replace(/_+/g, '_');
    normalized = normalized.replace(/^_|_$/g, '');
    return normalized;
}

function formatCategoryForDisplay(cat) {
    if (!cat) return '';
    return cat.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ').replace(/&/g, '&');
}

function updateCategoryDropdown() {
    if (!formCategory) return;
    const currentValue = formCategory.value;
    formCategory.innerHTML = '';
    
    const uncategorizedOption = document.createElement('option');
    uncategorizedOption.value = '';
    uncategorizedOption.textContent = 'Uncategorized';
    formCategory.appendChild(uncategorizedOption);
    
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '──────────';
    formCategory.appendChild(separator);
    
    const sortedCategories = [...availableCategories].sort((a, b) => {
        return formatCategoryForDisplay(a).localeCompare(formatCategoryForDisplay(b));
    });
    
    sortedCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = formatCategoryForDisplay(cat);
        formCategory.appendChild(option);
    });
    
    if (currentValue === '' || currentValue === 'uncategorized') {
        formCategory.value = '';
    } else if (availableCategories.includes(currentValue)) {
        formCategory.value = currentValue;
    } else {
        formCategory.value = '';
    }
}

function addNewCategory(rawName, applyToCurrentProject = true) {
    if (!rawName || !rawName.trim()) {
        showInlineError(newCategoryNameInput, 'Category name cannot be blank');
        return false;
    }
    
    const normalized = normalizeCategoryName(rawName);
    
    if (normalized === 'uncategorized') {
        showInlineError(newCategoryNameInput, '"Uncategorized" is a reserved category name');
        return false;
    }
    
    if (!normalized) {
        showInlineError(newCategoryNameInput, 'Category name cannot be blank');
        return false;
    }
    
    if (availableCategories.includes(normalized)) {
        showInlineError(newCategoryNameInput, `Category "${formatCategoryForDisplay(normalized)}" already exists`);
        return false;
    }
    
    availableCategories.push(normalized);
    updateCategoryDropdown();
    
    if (applyToCurrentProject) {
        formCategory.value = normalized;
        if (isEditingMode) {
            debouncedAutoSave();
        }
    }
    
    // Save categories to localStorage
    saveDemoCategories(availableCategories);
    
    showFloatingNotification(`✓ Added category "${formatCategoryForDisplay(normalized)}"`);
    return true;
}

function showAddCategoryField() {
    addCategoryField.style.display = 'block';
    if (categoryHelpText) categoryHelpText.style.display = 'none';
    newCategoryNameInput.value = '';
    newCategoryNameInput.focus();
}

function hideAddCategoryField() {
    addCategoryField.style.display = 'none';
    if (categoryHelpText) categoryHelpText.style.display = 'block';
    newCategoryNameInput.value = '';
}

function deleteCategory(categoryToDelete) {
    const displayName = formatCategoryForDisplay(categoryToDelete);
    const projectsUsing = localProjectCache.filter(p => p.category === categoryToDelete).length;
    let warning = `Delete category "${displayName}"?`;
    if (projectsUsing > 0) {
        warning += `\n\n⚠️ ${projectsUsing} project(s) currently use this category. They will become Uncategorized.`;
    }
    
    showConfirmModal(warning, () => {
        availableCategories = availableCategories.filter(c => c !== categoryToDelete);
        
        localProjectCache.forEach(project => {
            if (project.category === categoryToDelete) {
                project.category = '';
            }
        });
        
        updateCategoryDropdown();
        renderAdminView();
        saveToLocalStorage();
        if (categoryManager) categoryManager.style.display = 'none';
        saveDemoCategories(availableCategories);
        showFloatingNotification(`✓ Deleted category "${displayName}"`);
    }, () => {});
}

function renderCategoriesList() {
    const container = document.getElementById('categories-list');
    if (!container) return;
    container.innerHTML = '';
    
    const sortedCategories = [...availableCategories].sort((a, b) => {
        return formatCategoryForDisplay(a).localeCompare(formatCategoryForDisplay(b));
    });
    
    sortedCategories.forEach(cat => {
        const badge = document.createElement('div');
        badge.className = 'media-badge';
        badge.style.cursor = 'pointer';
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '0.5rem';
        badge.innerHTML = `
            <span>${escapeHtml(formatCategoryForDisplay(cat))}</span>
            <span class="media-badge-delete" data-category="${escapeHtml(cat)}" style="margin-left: 0.5rem; cursor: pointer;">✕</span>
        `;
        badge.querySelector('.media-badge-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCategory(cat);
        });
        container.appendChild(badge);
    });
    
    if (availableCategories.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.75rem; padding: 0.5rem;">No categories yet. Add one using the "+ Add Category" button above.</div>';
    }
}

// ========================
// PROJECT CRUD
// ========================
if (addForm) {
    addForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const mediaToSave = [...currentMediaArray].filter(m => m && m.trim());
        
        const projectData = {
            title: formTitle.value,
            category: formCategory.value,
            cardHeading: formTag.value,
            media: mediaToSave,
            description: getEditorContent(),
            imageAlign: formImageAlign.value,
            published: formPublished.checked
        };
        
        localProjectCache.push(projectData);
        renderAdminView();
        saveToLocalStorage();
        startNewProject();
        showFloatingNotification("✓ Project added with " + mediaToSave.length + " media item(s)!");
        return false;
    });
}

function saveToLocalStorage() {
    // Clean up malformed links
    localProjectCache = localProjectCache.map(project => {
        if (project.description) {
            project.description = cleanupMalformedLinks(project.description);
        }
        return project;
    });
    
    saveDemoProjects(localProjectCache);
    
    // Also save categories
    const cats = [...new Set(localProjectCache.map(p => p.category).filter(c => c && c !== ''))];
    if (cats.length > 0) {
        availableCategories = cats;
        saveDemoCategories(cats);
        updateCategoryDropdown();
    }
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
    if (lowerUrl.includes('unsplash.com')) return '📷';
    return '🔗';
}

function getMediaPreview(mediaArray) {
    if (!mediaArray || mediaArray.length === 0) return "No media";
    const icons = mediaArray.map(m => getMediaIcon(m)).join(' ');
    return `${icons} ${mediaArray.length} media item(s)`;
}

function loadData() {
    const data = getDemoData();
    localProjectCache = data.projects;
    availableCategories = data.categories;
    
    // Clean up malformed links
    localProjectCache = localProjectCache.map(project => {
        if (project.description) {
            project.description = cleanupMalformedLinks(project.description);
        }
        return project;
    });
    
    updateCategoryDropdown();
    renderAdminView();
    showFloatingNotification(`✓ Loaded ${localProjectCache.length} projects from localStorage`);
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
        const heading = project.cardHeading || project.tag || '';
        
        if (project.published === false) li.style.opacity = '0.5';
        li.innerHTML = `
            <div class="sort-content" style="flex-grow:1; cursor:pointer; min-width:0; overflow:hidden;">
                <strong>${escapeHtml(project.title)}${draftBadge}</strong>
                <small style="color:var(--text-muted); margin-left:0.5rem;">(${escapeHtml(heading)})</small>
                <div style="font-size:0.7rem; color:var(--accent-red); margin-top:0.2rem;">${mediaPreview}</div>
            </div>
            <div style="display:flex; gap:0.25rem; align-items:center; flex-shrink:0; margin-left:0.5rem;">
                <span class="row-btn move-top-btn" title="Move to top">⇈</span>
                <span class="row-btn move-up-btn" title="Move up">↑</span>
                <span class="row-btn move-down-btn" title="Move down">↓</span>
                <span class="row-btn move-bottom-btn" title="Move to bottom">⇊</span>
                <span class="row-btn delete-item-btn" data-index="${originalIndex}" title="Delete">✕</span>
                <span class="sort-handle row-btn" style="cursor:grab;" title="Drag to reorder">☰</span>
            </div>
        `;
        
        li.querySelector('.sort-content').addEventListener('click', () => loadProjectIntoForm(originalIndex));

        const moveProject = (fromIdx, toIdx) => {
            toIdx = Math.max(0, Math.min(localProjectCache.length - 1, toIdx));
            if (fromIdx === toIdx) return;
            const [item] = localProjectCache.splice(fromIdx, 1);
            localProjectCache.splice(toIdx, 0, item);
            renderAdminView();
            saveToLocalStorage();
        };
        li.querySelector('.move-top-btn').addEventListener('click', e => { e.stopPropagation(); moveProject(originalIndex, 0); });
        li.querySelector('.move-up-btn').addEventListener('click', e => { e.stopPropagation(); moveProject(originalIndex, originalIndex - 1); });
        li.querySelector('.move-down-btn').addEventListener('click', e => { e.stopPropagation(); moveProject(originalIndex, originalIndex + 1); });
        li.querySelector('.move-bottom-btn').addEventListener('click', e => { e.stopPropagation(); moveProject(originalIndex, localProjectCache.length - 1); });

        li.querySelector('.delete-item-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirmModal(`Remove "${project.title}" permanently? This cannot be undone.`, () => {
                localProjectCache.splice(originalIndex, 1);
                renderAdminView();
                saveToLocalStorage();
                if (isEditingMode && currentEditIndex === originalIndex) startNewProject();
            }, () => {});
        });

        li.addEventListener('dragstart', () => li.classList.add('dragging'));
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            recalculateCacheOrder();
        });
        sortableListElement.appendChild(li);
    });
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
        cardHeading: formTag.value,
        media: [...currentMediaArray].filter(m => m && m.trim()),
        description: getEditorContent(),
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
    const inputs = [formTitle, formCategory, formTag, formImageAlign];
    const checkboxes = [formPublished];
    const editor = descTextarea;
    
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
    
    if (editor) {
        if (enable) {
            editor.addEventListener('input', debouncedAutoSave);
            editor.addEventListener('blur', () => {
                if (isEditingMode) debouncedAutoSave();
            });
        } else {
            editor.removeEventListener('input', debouncedAutoSave);
            editor.removeEventListener('blur', debouncedAutoSave);
        }
    }
    
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
    formCategory.value = "";
    formTag.value = "";
    formPublished.checked = false;
    formImageAlign.value = "center";
    currentMediaArray = [];
    renderMediaBadges();
    setEditorContent("");
    
    document.querySelectorAll('.sort-item').forEach(el => el.style.borderColor = 'var(--border-color)');
    
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
    formCategory.value = target.category || "";
    formTag.value = target.cardHeading || target.tag || "";
    formPublished.checked = target.published !== false;
    formImageAlign.value = target.imageAlign || 'center';
    
    currentMediaArray = target.media ? [...target.media] : [];
    renderMediaBadges();
    
    setEditorContent(target.description || "");
    
    lastSavedFormData = getCurrentFormData();
    setupAutoSaveListeners(true);
    
    document.querySelectorAll('.sort-item').forEach(el => el.style.borderColor = 'var(--border-color)');
    const selectedRow = document.querySelector(`.sort-item[data-index="${index}"]`);
    if (selectedRow) selectedRow.style.borderColor = 'var(--accent-red)';
    
    if (newProjectBtn) newProjectBtn.style.display = 'inline-block';
    if (submitBtn) submitBtn.style.display = 'none';
}

if (newProjectBtn) {
    newProjectBtn.addEventListener('click', () => {
        startNewProject();
    });
}

// Category button handlers
if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
        showAddCategoryField();
    });
}

if (confirmAddCategoryBtn) {
    confirmAddCategoryBtn.addEventListener('click', () => {
        const newCategory = newCategoryNameInput.value.trim();
        if (addNewCategory(newCategory, true)) {
            hideAddCategoryField();
        }
    });
}

if (cancelAddCategoryBtn) {
    cancelAddCategoryBtn.addEventListener('click', () => {
        hideAddCategoryField();
    });
}

if (newCategoryNameInput) {
    newCategoryNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newCategory = newCategoryNameInput.value.trim();
            if (addNewCategory(newCategory, true)) {
                hideAddCategoryField();
            }
        }
    });
}

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

// ========================
// MEDIA FUNCTIONS
// ========================
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
            showEditMediaModal(media, index);
        });
        
        badge.querySelector('.media-badge-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirmModal(`Remove this media item?\n\n${media.substring(0, 80)}${media.length > 80 ? '...' : ''}`, () => {
                currentMediaArray.splice(index, 1);
                renderMediaBadges();
                if (isEditingMode) debouncedAutoSave();
            }, () => {});
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
            showFloatingNotification("Media already in list", false);
        }
    } else {
        showFloatingNotification("Please enter a URL or path", false);
    }
}

if (addMediaBtn) addMediaBtn.addEventListener('click', handleAddButtonClick);

if (togglePasteBtn) togglePasteBtn.addEventListener('click', () => {
    pasteArea.style.display = pasteArea.style.display === 'none' ? 'block' : 'none';
});

if (processPasteBtn) processPasteBtn.addEventListener('click', () => {
    const lines = pasteUrls.value.split(/\r?\n/);
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
        if (isEditingMode) debouncedAutoSave();
        showFloatingNotification(`✓ Added ${added} media item(s)`);
    }
    pasteUrls.value = '';
    pasteArea.style.display = 'none';
});

if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        const clearBtn = document.getElementById('admin-search-clear');
        if (clearBtn) clearBtn.style.display = e.target.value ? 'flex' : 'none';
        renderAdminView();
    });
}
const adminSearchClear = document.getElementById('admin-search-clear');
if (adminSearchClear) {
    adminSearchClear.addEventListener('click', () => {
        adminSearchInput.value = '';
        currentSearchTerm = '';
        adminSearchClear.style.display = 'none';
        adminSearchInput.focus();
        renderAdminView();
    });
}

// ========================
// CLEANUP LINKS BUTTON
// ========================
const cleanupBtn = document.getElementById('cleanup-links-btn');
if (cleanupBtn) {
    cleanupBtn.addEventListener('click', function() {
        let cleaned = 0;
        localProjectCache = localProjectCache.map(project => {
            if (project.description) {
                const original = project.description;
                project.description = cleanupMalformedLinks(project.description);
                if (project.description !== original) cleaned++;
            }
            return project;
        });
        if (cleaned > 0) {
            renderAdminView();
            saveToLocalStorage();
            showFloatingNotification(`✓ Cleaned ${cleaned} project(s)`);
        } else {
            showFloatingNotification('No malformed links found');
        }
    });
}

// ========================
// RESET DATA BUTTON
// ========================
if (resetDataBtn) {
    resetDataBtn.addEventListener('click', () => {
        showConfirmModal(
            'Reset all demo data to the original defaults?\n\nThis will remove all your changes and restore the demo projects.',
            () => {
                const data = resetDemoData();
                localProjectCache = data.projects;
                availableCategories = data.categories;
                updateCategoryDropdown();
                renderAdminView();
                startNewProject();
                showFloatingNotification('✓ Demo data reset successfully!');
            },
            () => {}
        );
    });
}

// ========================
// RICH TEXT TOOLBAR HANDLERS
// ========================
function captureTextareaSel(e) {
    e.preventDefault();
    capturedSel = {
        start: descTextarea.selectionStart,
        end: descTextarea.selectionEnd,
        val: descTextarea.value,
        sel: descTextarea.value.slice(descTextarea.selectionStart, descTextarea.selectionEnd)
    };
}

[toolbarBold, toolbarItalic, toolbarUl, toolbarLink, toolbarAward].forEach(btn => {
    if (btn) btn.addEventListener('mousedown', captureTextareaSel);
});

if (toolbarBold) toolbarBold.addEventListener('click', () => applyInlineFormat('strong'));
if (toolbarItalic) toolbarItalic.addEventListener('click', () => applyInlineFormat('em'));
if (toolbarUl) toolbarUl.addEventListener('click', () => applyUnorderedList());
if (toolbarLink) toolbarLink.addEventListener('click', () => insertLink());
if (toolbarAward) toolbarAward.addEventListener('click', () => applyAwardTag());

if (descTextarea) {
    descTextarea.addEventListener('input', () => {
        updateCharCount();
        if (isEditingMode) debouncedAutoSave();
    });
    descTextarea.addEventListener('blur', applySmartQuotesToEditor);
}

function init() {
    renderMediaBadges();
    loadData();
    updateCharCount();
}

init();
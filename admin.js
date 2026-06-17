// Admin panel functionality - with save-server.js backend
let localProjectCache = [];
let currentMediaArray = [];
let draggedMediaIndexForReorder = null;
let currentSearchTerm = '';
let availableCategories = ['brand_&_identity', 'production_&_installation', 'game_design', 'web_&_interactive'];

// Auto-save tracking
let autoSaveTimeout = null;
let isEditingMode = false;
let currentEditIndex = null;
let lastSavedFormData = null;

// Modal tracking
let activeModal = null;
let inlineErrorTimeout = null;

// Selection captured on toolbar mousedown, before the button steals focus
let capturedSel = null; // { start, end, val, sel }

// Description textarea (plain-text tag editor)
const descTextarea = document.getElementById('form-description');
const charCounter   = document.getElementById('char-counter');

// Legacy aliases so unchanged call-sites keep working
const richTextEditor  = descTextarea;
const hiddenDescription = descTextarea;

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
const adminSearchInput = document.getElementById('admin-search-input');
const formTitle = document.getElementById('form-title');
const formCategory = document.getElementById('form-category');
const formTag = document.getElementById('form-tag'); // May be null if removed from HTML
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

// Toolbar buttons
const toolbarBold = document.getElementById('toolbar-bold');
const toolbarItalic = document.getElementById('toolbar-italic');
const toolbarUl = document.getElementById('toolbar-ul');
const toolbarLink = document.getElementById('toolbar-link');
const toolbarAward = document.getElementById('toolbar-award');
const toolbarLive = document.getElementById('toolbar-live');

// Floating notification
let floatingNotification = null;
let notificationTimeout = null;

if (window.history.scrollRestoration) {
    window.history.scrollRestoration = 'manual';
}

// ========================
// SMART QUOTES - FIXED TO PRESERVE HTML
// ========================
function convertToSmartQuotes(text) {
    if (!text) return '';
    
    // If there are no HTML tags, just do the simple conversion
    if (!/<[a-z][\s\S]*>/i.test(text)) {
        let r = text.replace(/(^|[-—\s(\[{])"/g, '$1“');
        r = r.replace(/"/g, '”');
        r = r.replace(/(^|[-—\s(\[{])'/g, '$1‘');
        r = r.replace(/'/g, '’');
        return r;
    }
    
    // For HTML content, only convert quotes outside of tags
    let result = '';
    let inTag = false;
    let inAttribute = false;
    let attributeQuoteChar = '';
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        // Toggle tag state
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
        
        // Inside a tag, check if we're in an attribute value
        if (inTag) {
            if (char === '"' || char === "'") {
                if (!inAttribute) {
                    inAttribute = true;
                    attributeQuoteChar = char;
                } else if (char === attributeQuoteChar) {
                    inAttribute = false;
                }
                result += char; // Keep straight quotes in HTML attributes
                continue;
            }
            result += char;
            continue;
        }
        
        // Only convert quotes when not inside a tag or attribute
        if (!inTag && !inAttribute) {
            if (char === '"') {
                // Opening quote if preceded by space, start, or opening bracket
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
// LINK CLEANUP FUNCTIONS
// ========================
function cleanupMalformedLinks(html) {
    if (!html) return html;
    
    let cleaned = html;
    
    // Fix href with smart quotes - pattern: href="”URL”" or href=”URL”
    cleaned = cleaned.replace(/href=["'”‘’]\s*["'”‘’]?(https?:\/\/[^"'\s>]+)["'”‘’]\s*["'”‘’]?/g, 'href="$1"');
    cleaned = cleaned.replace(/href=”(https?:\/\/[^”\s>]+)”/g, 'href="$1"');
    cleaned = cleaned.replace(/href=‘([^’\s>]+)’/g, 'href="$1"');
    
    // Fix URLs that got double-wrapped (http://domain.com/"http://actual.com")
    cleaned = cleaned.replace(/href="https?:\/\/[^"]*?(https?:\/\/[^"]+)/g, function(match, captured) {
        return 'href="' + captured;
    });
    
    // Remove any stray quotes that got URL-encoded
    cleaned = cleaned.replace(/%E2%80%9C/g, '').replace(/%E2%80%9D/g, '');
    cleaned = cleaned.replace(/%E2%80%98/g, '').replace(/%E2%80%99/g, '');
    
    // Fix target and rel attributes with smart quotes
    cleaned = cleaned.replace(/target=”(_blank|_self|_parent|_top)”/g, 'target="$1"');
    cleaned = cleaned.replace(/target=‘(_blank|_self|_parent|_top)’/g, 'target="$1"');
    cleaned = cleaned.replace(/rel=”(noopener noreferrer|nofollow|noopener)”/g, 'rel="$1"');
    cleaned = cleaned.replace(/rel=‘(noopener noreferrer|nofollow|noopener)’/g, 'rel="$1"');
    
    return cleaned;
}

// ========================
// TEXTAREA EDITOR HELPERS
// ========================
function syncDescriptionToHidden() { /* no-op: textarea IS the store */ }

function updateCharCount() {
    if (charCounter && descTextarea) {
        charCounter.textContent = descTextarea.value.length + ' characters';
    }
}

/** Insert or wrap text at the textarea cursor. */
function insertAtCursor(before, after, selStart, selEnd, selText) {
    if (after === undefined) after = '';
    if (!descTextarea) return;
    const start = (selStart !== undefined) ? selStart : 0;
    const end   = (selEnd   !== undefined) ? selEnd   : 0;
    const sel   = (selText  !== undefined) ? selText  : '';
    const val = descTextarea.value;
    const replacement = before + sel + after;
    descTextarea.value = val.slice(0, start) + replacement + val.slice(end);
    const cursorPos = (start === end)
        ? start + before.length
        : start + replacement.length;
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

// Apply smart quotes to editor - FIXED to preserve HTML
function applySmartQuotesToEditor() {
    if (!descTextarea) return;
    const pos = descTextarea.selectionStart;
    descTextarea.value = convertToSmartQuotes(descTextarea.value);
    descTextarea.setSelectionRange(pos, pos);
    updateCharCount();
}

// ========================
// APPLY / TOGGLE FORMATTING
// ========================
function applyInlineFormat(tagName) {
    if (!descTextarea || !capturedSel) return;
    const open  = '<' + tagName + '>';
    const close = '</' + tagName + '>';
    const start = capturedSel.start;
    const end   = capturedSel.end;
    const val   = capturedSel.val;
    const sel   = capturedSel.sel;

    // ── Toggle OFF case 1 ──────────────────────────────────────────────────
    // Selection is exactly <tag>content</tag> — strip both tags
    if (sel.startsWith(open) && sel.endsWith(close) && sel.length > open.length + close.length) {
        const inner = sel.slice(open.length, sel.length - close.length);
        descTextarea.setRangeText(inner, start, end, 'select');
        descTextarea.focus();
        updateCharCount();
        if (isEditingMode) debouncedAutoSave();
        return;
    }

    // ── Toggle OFF case 2 ──────────────────────────────────────────────────
    // Tags are immediately outside the selection: <tag>[sel]</tag>
    const beforeSel = val.slice(0, start);
    const afterSel  = val.slice(end);
    if (beforeSel.endsWith(open) && afterSel.startsWith(close)) {
        const newVal = val.slice(0, start - open.length) + sel + val.slice(end + close.length);
        descTextarea.value = newVal;
        descTextarea.setSelectionRange(start - open.length, start - open.length + sel.length);
        descTextarea.focus();
        updateCharCount();
        if (isEditingMode) debouncedAutoSave();
        return;
    }

    // ── Toggle OFF case 3 ──────────────────────────────────────────────────
    // Selection is somewhere inside an enclosing <tag>…[sel]…</tag>.
    const openIdx  = val.lastIndexOf(open, start);
    const closeIdx = val.indexOf(close, end);
    if (openIdx !== -1 && closeIdx !== -1) {
        const between = val.slice(openIdx + open.length, closeIdx);
        const hasNestedOpen  = between.includes(open);
        const hasNestedClose = between.includes(close);
        if (!hasNestedOpen && !hasNestedClose) {
            const inner = between;
            const newVal = val.slice(0, openIdx) + inner + val.slice(closeIdx + close.length);
            const newStart = openIdx + (start - (openIdx + open.length));
            const newEnd   = newStart + sel.length;
            descTextarea.value = newVal;
            descTextarea.setSelectionRange(newStart, newEnd);
            descTextarea.focus();
            updateCharCount();
            if (isEditingMode) debouncedAutoSave();
            return;
        }
    }

    // ── Toggle ON ─────────────────────────────────────────────────────────
    insertAtCursor(open, close, start, end, sel);
}

// LIVE BUTTON - wraps selected text in <live></live>
function applyLiveTag() {
    if (!descTextarea || !capturedSel) return;
    const start = capturedSel.start;
    const end   = capturedSel.end;
    const sel   = capturedSel.sel;
    
    // If no text selected, insert placeholder
    if (!sel || sel.trim() === '') {
        insertAtCursor('<live>', '</live>', start, end, sel);
        return;
    }
    
    // Toggle OFF if already wrapped
    if (sel.startsWith('<live>') && sel.endsWith('</live>')) {
        const inner = sel.slice(6, sel.length - 7); // <live> is 6 chars, </live> is 7 chars
        descTextarea.setRangeText(inner, start, end, 'select');
        descTextarea.focus();
        updateCharCount();
        if (isEditingMode) debouncedAutoSave();
        return;
    }
    
    // Check if tags are immediately outside selection
    const beforeSel = capturedSel.val.slice(0, start);
    const afterSel = capturedSel.val.slice(end);
    if (beforeSel.endsWith('<live>') && afterSel.startsWith('</live>')) {
        const newVal = capturedSel.val.slice(0, start - 6) + sel + capturedSel.val.slice(end + 7);
        descTextarea.value = newVal;
        descTextarea.setSelectionRange(start - 6, start - 6 + sel.length);
        descTextarea.focus();
        updateCharCount();
        if (isEditingMode) debouncedAutoSave();
        return;
    }
    
    // Wrap selection
    insertAtCursor('<live>', '</live>', start, end, sel);
}

// AWARD BUTTON - wraps selected text in <award></award>
function applyAwardTag() {
    if (!descTextarea || !capturedSel) return;
    const start = capturedSel.start;
    const end   = capturedSel.end;
    const sel   = capturedSel.sel;
    
    // If no text selected, insert placeholder
    if (!sel || sel.trim() === '') {
        insertAtCursor('<award>', '</award>', start, end, sel);
        return;
    }
    
    // Toggle OFF if already wrapped
    if (sel.startsWith('<award>') && sel.endsWith('</award>')) {
        const inner = sel.slice(7, sel.length - 8); // <award> is 7 chars, </award> is 8 chars
        descTextarea.setRangeText(inner, start, end, 'select');
        descTextarea.focus();
        updateCharCount();
        if (isEditingMode) debouncedAutoSave();
        return;
    }
    
    // Check if tags are immediately outside selection
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
    
    // Wrap selection
    insertAtCursor('<award>', '</award>', start, end, sel);
}

function applyUnorderedList() {
    if (!descTextarea || !capturedSel) return;
    const start = capturedSel.start;
    const end   = capturedSel.end;
    const val   = capturedSel.val;
    const sel   = capturedSel.sel.trim();

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
    const end   = capturedSel.end;
    const sel   = capturedSel.sel;

    // Build and show the URL modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'link-modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
        z-index: 20000; display: flex; align-items: center; justify-content: center;
    `;
    const preview = sel ? `<p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:1rem;">Wrapping: <em>&ldquo;${escapeHtml(sel.length > 60 ? sel.slice(0,60)+'…' : sel)}&rdquo;</em></p>` : '';
    modalOverlay.innerHTML = `
        <div style="background:var(--color-card);border:1px solid var(--color-border);border-radius:24px;padding:1.5rem;max-width:450px;width:90%;">
            <h3 style="margin-bottom:0.5rem;font-size:1.1rem;color:var(--color-text);">Insert Link</h3>
            ${preview}
            <input type="text" id="link-url-input" placeholder="https://example.com or /relative/path" value=""
                style="width:100%;padding:0.8rem;border-radius:12px;background:var(--color-bg);
                       border:1px solid var(--color-border);color:var(--color-text);
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
        
        // Only add https:// if the URL looks like a domain without protocol
        if (!url.startsWith('http://') && !url.startsWith('https://') && 
            !url.startsWith('/') && !url.startsWith('./') && !url.startsWith('../') && 
            !url.startsWith('#') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
            url = 'https://' + url;
        }
        
        // Use straight quotes (") not smart quotes
        const tag = '<a href="' + url + '" target="_blank" rel="noopener noreferrer">';
        insertAtCursor(tag, '</a>', start, end, sel);
        closeModal();
    };

    modalOverlay.querySelector('#link-modal-insert').addEventListener('click', doInsert);
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doInsert(); } });
    modalOverlay.querySelector('#link-modal-cancel').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
}

function handlePaste(e) {
    setTimeout(() => { updateCharCount(); if (isEditingMode) debouncedAutoSave(); }, 0);
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
        background: var(--color-card);
        border: 1px solid var(--color-border);
        border-radius: 24px;
        padding: 1.5rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    `;
    
    modalContent.innerHTML = `
        <p style="margin-bottom: 1.5rem; line-height: 1.5; color: var(--color-text); white-space: pre-wrap;">${escapeHtml(message)}</p>
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="modal-cancel-btn" class="btn-small" style="padding: 0.5rem 1rem;">Cancel</button>
            <button id="modal-confirm-btn" class="filter-btn" style="padding: 0.5rem 1rem; background: var(--color-accent); color: var(--color-white);">Confirm</button>
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
    // Remove any existing modal
    if (activeModal) {
        activeModal.remove();
        activeModal = null;
    }
    
    // Create overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Create content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--color-card);
        border: 1px solid var(--color-border);
        border-radius: 24px;
        padding: 1.5rem;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    `;
    
    modalContent.innerHTML = `
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: var(--color-text);">Edit Media URL</h3>
        <input type="text" id="edit-media-input" value="${escapeHtml(currentUrl)}" placeholder="Enter media URL..." style="
            width: 100%;
            padding: 0.8rem;
            border-radius: 12px;
            background: var(--color-bg);
            border: 1px solid var(--color-border);
            color: var(--color-text);
            font-size: 0.9rem;
            box-sizing: border-box;
            margin: 0.5rem 0 1rem 0;
        ">
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="edit-media-cancel" style="
                font-size: 0.75rem;
                padding: 0.5rem 1rem;
                background: var(--color-filter-bg);
                border: 1px solid var(--color-border);
                border-radius: 8px;
                cursor: pointer;
                color: var(--color-text-secondary);
                transition: all 0.2s;
            ">Cancel</button>
            <button id="edit-media-save" style="
                background: var(--color-filter-bg);
                border: 1px solid var(--color-border);
                padding: 0.5rem 1rem;
                border-radius: 100px;
                font-size: 0.85rem;
                font-weight: 500;
                cursor: pointer;
                color: var(--color-text-secondary);
                transition: all 0.2s;
            ">Save</button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    activeModal = modalOverlay;
    
    const input = modalContent.querySelector('#edit-media-input');
    input.focus();
    input.select();
    
    // Add hover effects for buttons
    const saveBtn = modalContent.querySelector('#edit-media-save');
    const cancelBtn = modalContent.querySelector('#edit-media-cancel');
    
    saveBtn.addEventListener('mouseenter', () => {
        saveBtn.style.background = 'var(--color-accent)';
        saveBtn.style.borderColor = 'var(--color-accent)';
        saveBtn.style.color = 'var(--color-white)';
    });
    saveBtn.addEventListener('mouseleave', () => {
        saveBtn.style.background = 'var(--color-filter-bg)';
        saveBtn.style.borderColor = 'var(--color-border)';
        saveBtn.style.color = 'var(--color-text-secondary)';
    });
    
    cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'var(--color-border)';
        cancelBtn.style.color = 'var(--color-text)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'var(--color-filter-bg)';
        cancelBtn.style.color = 'var(--color-text-secondary)';
    });
    
    function saveMedia() {
        const newValue = input.value.trim();
        if (newValue) {
            currentMediaArray[index] = newValue;
            renderMediaBadges();
            if (isEditingMode) debouncedAutoSave();
        }
        if (activeModal) {
            activeModal.remove();
            activeModal = null;
        }
    }
    
    saveBtn.addEventListener('click', saveMedia);
    
    cancelBtn.addEventListener('click', () => {
        if (activeModal) {
            activeModal.remove();
            activeModal = null;
        }
    });
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            if (activeModal) {
                activeModal.remove();
                activeModal = null;
            }
        }
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveMedia();
        }
    });
}

function showInlineError(inputElement, message) {
    const existingError = inputElement.parentElement?.querySelector('.inline-error');
    if (existingError) existingError.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'inline-error';
    errorDiv.style.cssText = `
        color: var(--color-accent);
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
        saveToServer();
        if (categoryManager) categoryManager.style.display = 'none';
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
        container.innerHTML = '<div style="color: var(--color-text-muted); font-size: 0.75rem; padding: 0.5rem;">No categories yet. Add one using the "+ Add Category" button above.</div>';
    }
}

// ========================
// PROJECT CRUD
// ========================
if (addForm) {
    addForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Make sure currentMediaArray is properly captured
        const mediaToSave = [...currentMediaArray].filter(m => m && m.trim());
        
        const projectData = {
            title: formTitle.value,
            category: formCategory.value,
            // cardHeading: formTag ? formTag.value : undefined,
            media: mediaToSave,
            description: getEditorContent(),
            imageAlign: formImageAlign.value,
            published: formPublished.checked
        };
        
        localProjectCache.push(projectData);
        renderAdminView();
        saveToServer();
        startNewProject();
        showFloatingNotification("✓ Project added with " + mediaToSave.length + " media resources(s)!");
        
        return false;
    });
}

function saveToServer() {
    // Clean up any malformed links before saving
    localProjectCache = localProjectCache.map(project => {
        if (project.description) {
            project.description = cleanupMalformedLinks(project.description);
        }
        return project;
    });
    
    fetch('http://localhost:3001/api/save-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localProjectCache)
    })
    .then(res => res.json())
    .then(res => {
        if (!res.success) {
            showFloatingNotification("Save error: " + res.error, false);
        }
    })
    .catch(() => showFloatingNotification("Server not running. Run: node save-server.js", false));
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
    return `${icons} ${mediaArray.length} media resources(s)`;
}

function loadData() {
    fetch('projects.json')
        .then(res => res.json())
        .then(data => {
            // Clean up any malformed links in the loaded data
            data = data.map(project => {
                if (project.description) {
                    project.description = cleanupMalformedLinks(project.description);
                }
                return project;
            });
            
            localProjectCache = data;
            
            const cats = [...new Set(localProjectCache.map(p => p.category).filter(c => c && c !== ''))];
            if (cats.length > 0) {
                availableCategories = cats;
                updateCategoryDropdown();
            }
            
            renderAdminView();
            showFloatingNotification(`✓ Loaded ${localProjectCache.length} projects`);
        })
        .catch(() => {
            localProjectCache = [];
            renderAdminView();
            showFloatingNotification("✨ No projects found. Add your first one!");
        });
}

function renderAdminView() {
    if (!sortableListElement) return;
    sortableListElement.innerHTML = '';
    
    if (localProjectCache.length === 0) {
        sortableListElement.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--color-text-muted);">No projects yet. Fill out the form and click "Add Portfolio Project".</div>';
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
        const category = project.category ? formatCategoryForDisplay(project.category) : 'Uncategorized';
        
        if (project.published === false) li.style.opacity = '0.5';
        li.innerHTML = `
            <div class="sort-content" style="flex-grow:1; cursor:pointer; min-width:0; overflow:hidden;">
                <strong>${escapeHtml(project.title)}${draftBadge}</strong>
                <small style="color:var(--color-text-muted); margin-left:0.5rem;">(${escapeHtml(category)})</small>
                <div style="font-size:0.7rem; color:var(--color-accent); margin-top:0.2rem;">${mediaPreview}</div>
            </div>
            <div style="display:flex; gap:0.25rem; align-items:center; flex-shrink:0; margin-left:0.5rem;">
                <span class="row-btn move-top-btn"    title="Move to top">⇈</span>
                <span class="row-btn move-up-btn"     title="Move up">↑</span>
                <span class="row-btn move-down-btn"   title="Move down">↓</span>
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
            saveToServer();
        };
        li.querySelector('.move-top-btn').addEventListener('click',    e => { e.stopPropagation(); moveProject(originalIndex, 0); });
        li.querySelector('.move-up-btn').addEventListener('click',     e => { e.stopPropagation(); moveProject(originalIndex, originalIndex - 1); });
        li.querySelector('.move-down-btn').addEventListener('click',   e => { e.stopPropagation(); moveProject(originalIndex, originalIndex + 1); });
        li.querySelector('.move-bottom-btn').addEventListener('click', e => { e.stopPropagation(); moveProject(originalIndex, localProjectCache.length - 1); });

        li.querySelector('.delete-item-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirmModal(`Remove "${project.title}" permanently? This cannot be undone.`, () => {
                localProjectCache.splice(originalIndex, 1);
                renderAdminView();
                saveToServer();
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
    saveToServer();
}

function getCurrentFormData() {
    return {
        title: formTitle.value,
        category: formCategory.value,
        cardHeading: formTag ? formTag.value : '',
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
    saveToServer();
    
    lastSavedFormData = JSON.parse(JSON.stringify(projectData));
    showAutoSaveNotification();
}

function debouncedAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(autoSaveEditingProject, 1000);
}

let autoSaveListenersActive = false;

function setupAutoSaveListeners(enable) {
    const inputs = [formTitle, formCategory, formImageAlign];
    // Only include formTag if it exists
    if (formTag) inputs.push(formTag);
    
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
                syncDescriptionToHidden();
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
    if (formTag) formTag.value = "";
    formPublished.checked = false;
    formImageAlign.value = "center";
    currentMediaArray = [];
    renderMediaBadges();
    setEditorContent("");
    
    // Remove highlight from ALL items
    document.querySelectorAll('.sort-item').forEach(el => {
        el.classList.remove('editing');
        el.style.borderColor = '';
        el.style.borderWidth = '';
        el.style.borderStyle = '';
        el.style.boxShadow = '';
        el.style.backgroundColor = '';
    });
    
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
    if (formTag) formTag.value = target.cardHeading || target.tag || "";
    formPublished.checked = target.published !== false;
    formImageAlign.value = target.imageAlign || 'center';
    
    currentMediaArray = target.media ? [...target.media] : [];
    renderMediaBadges();
    
    setEditorContent(target.description || "");
    
    lastSavedFormData = getCurrentFormData();
    setupAutoSaveListeners(true);
    
    // Remove highlight from ALL items first
    document.querySelectorAll('.sort-item').forEach(el => {
        el.classList.remove('editing');
        el.style.borderColor = '';
        el.style.borderWidth = '';
        el.style.borderStyle = '';
        el.style.boxShadow = '';
        el.style.backgroundColor = '';
    });
    
    // Then highlight only the selected one
    const selectedRow = document.querySelector(`.sort-item[data-index="${index}"]`);
    if (selectedRow) {
        selectedRow.classList.add('editing');
        selectedRow.style.borderColor = 'var(--color-accent)';
        selectedRow.style.borderWidth = '2px';
        selectedRow.style.borderStyle = 'solid';
        selectedRow.style.boxShadow = '0 0 0 2px rgba(229, 72, 77, 0.3)';
        selectedRow.style.backgroundColor = 'var(--color-bg-secondary)';
        
        // Scroll the selected row into view
        setTimeout(() => {
            selectedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
    
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
        mediaBadgesContainer.innerHTML = '<div style="color: var(--color-text-muted); text-align: center; padding: 0.5rem; font-size: 0.75rem;">No media added yet.</div>';
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
        multiFileInput.click();
    }
}

function showDirectoryPrompt(files) {
    if (!files || files.length === 0) return;
    
    // Convert FileList to array for easier handling
    const fileArray = Array.from(files);
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);z-index:20000;display:flex;align-items:center;justify-content:center;';
    const names = fileArray.map(f => f.name).join(', ');
    const truncated = names.length > 80 ? names.slice(0, 80) + '…' : names;
    overlay.innerHTML = `
        <div style="background:var(--color-card);border:1px solid var(--color-border);border-radius:24px;padding:1.5rem;max-width:480px;width:90%;">
            <h3 style="margin-bottom:0.4rem;font-size:1.05rem;color:var(--color-text);">Set Media Path</h3>
            <p style="font-size:0.78rem;color:var(--color-text-muted);margin-bottom:0.8rem;">${truncated}</p>
            <div style="display:flex;align-items:center;gap:0.5rem;background:var(--color-bg);border-radius:12px;border:1px solid var(--color-border);padding:0 0.75rem;margin-bottom:0.25rem;">
                <span style="color:var(--color-text-muted);font-weight:500;font-size:0.85rem;white-space:nowrap;">media/</span>
                <input type="text" id="dir-prompt-input" placeholder="subfolder/ (optional)" 
                    style="width:100%;padding:0.75rem 0;background:transparent;border:none;color:var(--color-text);font-family:monospace;outline:none;">
            </div>
            <p style="font-size:0.72rem;color:var(--color-text-muted);margin-bottom:1rem;">Files will be saved to: <code style="background:var(--color-bg-secondary);padding:0.1rem 0.4rem;border-radius:4px;color:var(--color-text-secondary);">media/<span id="dir-prompt-preview">...</span></code></p>
            <div style="display:flex;gap:1rem;justify-content:flex-end;">
                <button id="dir-prompt-cancel" class="btn-small">Cancel</button>
                <button id="dir-prompt-confirm" class="filter-btn">Add Files</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const input = overlay.querySelector('#dir-prompt-input');
    const preview = overlay.querySelector('#dir-prompt-preview');
    
    // Update preview on input
    input.addEventListener('input', () => {
        const val = input.value.trim();
        preview.textContent = val ? val + '/' : 'filename';
    });
    preview.textContent = 'filename';
    
    input.focus();
    
    const doConfirm = () => {
        let subfolder = input.value.trim();
        let prefix = 'media/';
        if (subfolder) {
            if (!subfolder.endsWith('/')) subfolder += '/';
            prefix += subfolder;
        }
        
        let added = 0;
        let skipped = 0;
        
        // Process each file
        fileArray.forEach(f => {
            // Sanitize the filename - replace spaces and special chars
            let filename = f.name.replace(/[#?&]/g, '_').replace(/\s+/g, '_');
            // Also replace any other problematic characters
            filename = filename.replace(/[\(\)\[\]\{\}]/g, '_');
            
            const fullPath = prefix + filename;
            
            // Check if this exact path already exists in the media array
            // Use a case-insensitive comparison to avoid duplicates with different casing
            const exists = currentMediaArray.some(existing => 
                existing.toLowerCase() === fullPath.toLowerCase()
            );
            
            if (!exists) {
                currentMediaArray.push(fullPath);
                added++;
                console.log('Added media:', fullPath); // Debug log
            } else {
                skipped++;
                console.log('Skipped duplicate:', fullPath); // Debug log
            }
        });
        
        overlay.remove();
        
        if (added > 0) {
            renderMediaBadges();
            // Trigger auto-save after adding media
            if (isEditingMode) {
                debouncedAutoSave();
            }
            let message = '✓ Added ' + added + ' file(s) to ' + prefix;
            if (skipped > 0) {
                message += ' (' + skipped + ' duplicate(s) skipped)';
            }
            showFloatingNotification(message);
        } else if (skipped > 0) {
            showFloatingNotification('All ' + skipped + ' file(s) were duplicates and were skipped', false);
        } else {
            showFloatingNotification('No files to add', false);
        }
    };
    
    overlay.querySelector('#dir-prompt-confirm').addEventListener('click', doConfirm);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doConfirm(); } });
    overlay.querySelector('#dir-prompt-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function addFilesToMediaList(files) {
    if (!files || files.length === 0) return;
    showDirectoryPrompt(files);
    multiFileInput.value = '';
}

if (addMediaBtn) addMediaBtn.addEventListener('click', handleAddButtonClick);
if (multiFileInput) multiFileInput.addEventListener('change', (e) => addFilesToMediaList(multiFileInput.files));
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
            saveToServer();
            showFloatingNotification(`✓ Cleaned ${cleaned} project(s)`);
        } else {
            showFloatingNotification('No malformed links found');
        }
    });
}

// ========================
// RICH TEXT TOOLBAR HANDLERS
// ========================

function captureTextareaSel(e) {
    e.preventDefault();
    capturedSel = {
        start: descTextarea.selectionStart,
        end:   descTextarea.selectionEnd,
        val:   descTextarea.value,
        sel:   descTextarea.value.slice(descTextarea.selectionStart, descTextarea.selectionEnd)
    };
}

// Add award button to the mousedown capture
[toolbarBold, toolbarItalic, toolbarUl, toolbarLink, toolbarAward, toolbarLive].forEach(btn => {
    if (btn) btn.addEventListener('mousedown', captureTextareaSel);
});

if (toolbarBold)   toolbarBold.addEventListener('click',   () => applyInlineFormat('strong'));
if (toolbarItalic) toolbarItalic.addEventListener('click', () => applyInlineFormat('em'));
if (toolbarUl)     toolbarUl.addEventListener('click',     () => applyUnorderedList());
if (toolbarLink)   toolbarLink.addEventListener('click',   () => insertLink());
if (toolbarAward)  toolbarAward.addEventListener('click',  () => applyAwardTag());
if (toolbarLive) toolbarLive.addEventListener('click', () => applyLiveTag());

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
    if (richTextEditor && hiddenDescription) {
        syncDescriptionToHidden();
        updateCharCount();
    }
}

init();
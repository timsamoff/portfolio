// ========================
// SHARED UTILITIES
// Small helpers used across every surface: index.html, demo/index.html,
// _admin.html, demo/admin.html, app.js, admin.js, demo-app.js, demo-admin.js.
// ========================

function formatCategoryForDisplay(cat) {
    if (!cat) return '';
    return cat.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

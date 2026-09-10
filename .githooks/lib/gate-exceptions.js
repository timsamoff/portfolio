// Shared helper: load and evaluate gate-exceptions.json
// Spec: INTEGRATION_CHECKLIST.md Part 3.4
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Load gate-exceptions.json from repo root. Returns [] if the file is
 * missing, empty, or malformed — absence of the file means "no exceptions
 * defined", not an error.
 */
function loadExceptions(repoRoot) {
    const filePath = path.join(repoRoot, 'gate-exceptions.json');
    if (!fs.existsSync(filePath)) return [];
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf8');
    } catch {
        return [];
    }
    if (!raw.trim()) return [];
    let data;
    try {
        data = JSON.parse(raw);
    } catch (err) {
        console.warn(`[gate-check] WARNING: gate-exceptions.json is not valid JSON (${err.message}) — treating as no exceptions.`);
        return [];
    }
    if (!Array.isArray(data)) return [];
    return data;
}

/**
 * Returns true if a live (non-expired) exception exists matching the given
 * category and exact file scope.
 */
function hasException(exceptions, category, filePath) {
    const today = new Date().toISOString().slice(0, 10);
    return exceptions.some(entry => {
        if (!entry || entry.category !== category || entry.file_scope !== filePath) return false;
        if (!entry.review_by || typeof entry.review_by !== 'string') return false;
        // Expired review_by = same as no exception.
        return entry.review_by >= today;
    });
}

function findException(exceptions, category, filePath) {
    const today = new Date().toISOString().slice(0, 10);
    return exceptions.find(entry => {
        if (!entry || entry.category !== category || entry.file_scope !== filePath) return false;
        if (!entry.review_by || typeof entry.review_by !== 'string') return false;
        return entry.review_by >= today;
    });
}

module.exports = { loadExceptions, hasException, findException };

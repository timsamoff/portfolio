// Part 4 tool: scans the CURRENT repo state (not a diff) for violations of
// the same rules the pre-commit hook enforces on future diffs.
//
// Wired into the pre-push hook (see .githooks/pre-push) — runs once per
// push, not per commit, since a full-repo scan is slow enough that running
// it on every commit would either discourage small commits or get bypassed.
// The pre-commit hook stays diff-scoped and unchanged.
//
// Findings with a matching, non-expired entry in gate-exceptions.json are
// reported as passed-with-exception and do not block; anything else with
// a finding blocks the push (exit 1). Can still be run manually:
//   node .githooks/lib/repo-wide-scan.js
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadExceptions, hasException, findException } = require('./gate-exceptions');

const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const read = f => {
    const p = path.join(repoRoot, f);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

const violations = [];
const passed = [];
const exceptions = loadExceptions(repoRoot);

// A finding is scoped to one file for exception-matching purposes (the same
// [category, file_scope] shape pre-commit-checks.js uses), even though the
// underlying check may read several files to produce it.
function report(category, fileScope, message) {
    if (hasException(exceptions, category, fileScope)) {
        const ex = findException(exceptions, category, fileScope);
        passed.push(`[${category}] ${fileScope}: exception applied — ${ex.reason} (owner: ${ex.owner}, review by ${ex.review_by})`);
        return;
    }
    violations.push(`[${category}] ${fileScope}: ${message}`);
}

// 1. --text-muted vs --color-text-muted
{
    const files = ['admin.js', 'app.js', '_admin.html', 'demo/admin.html', 'demo/demo-admin.js', 'demo/demo-app.js', 'demo/demo-override.css'];
    let total = 0;
    const perFile = [];
    for (const f of files) {
        const src = read(f);
        if (!src) continue;
        const matches = src.match(/var\(--text-muted\)/g) || [];
        if (matches.length > 0) {
            total += matches.length;
            perFile.push(`${f} (${matches.length})`);
        }
    }
    if (total > 0) {
        report('CSS custom property existence', 'style.css', `--text-muted used instead of --color-text-muted, ${total} occurrences across: ${perFile.join(', ')}`);
    }
}

// 2. Demo category parity (static)
{
    const cats = read('categories.json');
    const demoData = read('demo/demo-data.js');
    if (cats && demoData) {
        const catData = JSON.parse(cats);
        const demoArrMatch = demoData.match(/const DEMO_CATEGORIES = \[([\s\S]*?)\];/);
        const demoArr = demoArrMatch ? demoArrMatch[1] : '';
        const liveDisplays = Object.values(catData).map(v => v.display);
        const missing = liveDisplays.filter(d => !demoArr.includes(d));
        if (missing.length > 0) {
            report('Demo category parity', 'demo/demo-data.js', `categories.json display names not found in DEMO_CATEGORIES: ${missing.join(', ')}`);
        }
    }
}

// 3. generateShareUrl signature drift (static)
{
    const appjs = read('app.js');
    const demoapp = read('demo/demo-app.js');
    const mainSig = appjs && (appjs.match(/function\s+generateShareUrl\s*\(([^)]*)\)/) || [])[1];
    const demoSig = demoapp && (demoapp.match(/function\s+generateShareUrl\s*\(([^)]*)\)/) || [])[1];
    if (mainSig !== undefined && demoSig !== undefined) {
        const norm = s => s.replace(/\s+/g, ' ').trim();
        if (norm(mainSig) !== norm(demoSig)) {
            report('Share-URL signature match', 'demo/demo-app.js', `app.js generateShareUrl(${norm(mainSig)}) vs demo/demo-app.js generateShareUrl(${norm(demoSig)}) — signatures differ`);
        }
    }
}

// 4. cleanupMalformedLinks triplication (existence check only — presence in all 3, not sync)
{
    const files = ['admin.js', 'demo/demo-admin.js', 'utilities/fix-links.js'];
    const present = files.filter(f => {
        const src = read(f);
        return src && /cleanupMalformedLinks/.test(src);
    });
    if (present.length === files.length) {
        report('cleanupMalformedLinks triplication', 'admin.js', `function present independently in all 3 files (${files.join(', ')}) — structural duplication risk (cannot mechanically verify the regex bodies stay identical from a static scan)`);
    }
}

console.log('=== Repo-wide gate-check scan (Part 4) ===\n');

if (passed.length > 0) {
    console.log('Passed with exception:');
    passed.forEach(p => console.log(`  - ${p}`));
    console.log('');
}

if (violations.length === 0) {
    console.log('No unresolved violations found.');
} else {
    console.log('BLOCKED — violations found:');
    violations.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
    console.log('\nFix the above, or add a scoped gate-exceptions.json entry if this is intentional (see INTEGRATION_CHECKLIST.md Part 3.4).');
    process.exit(1);
}

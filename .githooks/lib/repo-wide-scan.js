// One-off Part 4 tool: scans the CURRENT repo state (not a diff) for violations
// of the same rules the pre-commit hook enforces on future diffs. This is NOT
// wired into the hook chain — the hook intentionally only checks staged diffs.
// Run manually: node .githooks/lib/repo-wide-scan.js
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const read = f => {
    const p = path.join(repoRoot, f);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

const findings = [];

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
    if (total > 0) findings.push(`CSS custom property existence: --text-muted used instead of --color-text-muted, ${total} occurrences across: ${perFile.join(', ')}`);
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
            findings.push(`Demo category parity: categories.json display names not found in demo/demo-data.js DEMO_CATEGORIES: ${missing.join(', ')} (note: DEMO_CATEGORIES is intentionally an independent seed list per CLAUDE.md/INTEGRATION_CHECKLIST.md, so this may be by design, not a bug)`);
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
            findings.push(`Share-URL signature match: app.js generateShareUrl(${norm(mainSig)}) vs demo/demo-app.js generateShareUrl(${norm(demoSig)}) — already drifted (demo has extra mediaArray param)`);
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
        findings.push(`cleanupMalformedLinks triplication: function present independently in all 3 files (${files.join(', ')}) — structural duplication risk, not a current sync bug (cannot mechanically verify the regex bodies are identical from a static scan)`);
    }
}

console.log('=== Repo-wide gate-check scan (Part 4, report-only, not blocking) ===\n');
if (findings.length === 0) {
    console.log('No pre-existing violations found by static scan.');
} else {
    findings.forEach((f, i) => console.log(`${i + 1}. ${f}`));
}

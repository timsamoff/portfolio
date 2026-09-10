// Pre-commit gate checks for the portfolio repo.
// Implements the rules described in INTEGRATION_CHECKLIST.md Part 3.2.
// Only inspects the STAGED diff — never flags pre-existing repo-wide state.
//
// Run modes:
//   node pre-commit-checks.js            -> normal pre-commit mode (exit 1 on violation)
//   node pre-commit-checks.js --dry-run  -> report-only mode against a given diff scope
//                                           (used by Part 4 to scan whole-repo state)
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadExceptions, hasException, findException } = require('./gate-exceptions');

const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const dryRun = process.argv.includes('--dry-run');

function readWorkingFile(relPath) {
    const full = path.join(repoRoot, relPath);
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, 'utf8');
}

// --- diff plumbing ---------------------------------------------------

function stagedFiles() {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', { cwd: repoRoot, encoding: 'utf8' });
    return out.split('\n').map(s => s.trim()).filter(Boolean);
}

function stagedDiffFor(relPath) {
    // Unified diff of staged changes for one file (added/removed lines only matter to us).
    try {
        return execSync(`git diff --cached -- "${relPath}"`, { cwd: repoRoot, encoding: 'utf8' });
    } catch {
        return '';
    }
}

// Added lines (prefixed with a single +, not +++) from a unified diff.
function addedLines(diffText) {
    return diffText.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
}

const violations = [];
const warnings = [];

function flag(rule, file, message, exceptionCategory) {
    const exceptions = loadExceptions(repoRoot);
    const cat = exceptionCategory || rule;
    if (hasException(exceptions, cat, file)) {
        const ex = findException(exceptions, cat, file);
        console.log(`[gate-check] Exception applied for "${cat}" on ${file}: ${ex.reason} (owner: ${ex.owner}, review by ${ex.review_by})`);
        return;
    }
    violations.push({ rule, file, message });
}

function warn(rule, file, message) {
    warnings.push({ rule, file, message });
}

// --- Rule 1: Category registry parity (categories.json -> filterAliases in app.js) ---

// --- Rule 2: Demo category parity (categories.json -> demo/demo-data.js DEMO_CATEGORIES) ---

function checkDemoCategoryParity(files) {
    if (!files.includes('categories.json')) return;
    const demoDataChanged = files.includes('demo/demo-data.js');
    const demoDiff = stagedDiffFor('demo/demo-data.js');
    const diffMentionsDemoCategories = /DEMO_CATEGORIES/.test(demoDiff);
    if (!demoDataChanged || !diffMentionsDemoCategories) {
        flag(
            'Demo category parity',
            'demo/demo-data.js',
            'categories.json changed but demo/demo-data.js\'s DEMO_CATEGORIES (line ~6) was not touched in this commit. Demo does not read categories.json — does DEMO_CATEGORIES need the same category added? (If this divergence is intentional, add a gate-exceptions.json entry.)'
        );
    }
}

// --- Rule 3: CSS custom property existence ---

function getDefinedCssVars() {
    const css = readWorkingFile('style.css') || '';
    // Collect all --token: definitions inside any :root or [data-theme=...] block —
    // these are the repo's "defined" custom properties regardless of theme block.
    const defs = new Set();
    const re = /--([a-zA-Z0-9-]+)\s*:/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        defs.add(`--${m[1]}`);
    }
    return defs;
}

function checkCssCustomPropertyExistence(files) {
    const definedVars = getDefinedCssVars();
    const varUsageRe = /var\(\s*(--[a-zA-Z0-9-]+)/g;

    for (const file of files) {
        if (!/\.(css|html|js)$/.test(file)) continue;
        const diff = stagedDiffFor(file);
        const added = addedLines(diff);
        for (const line of added) {
            let m;
            varUsageRe.lastIndex = 0;
            while ((m = varUsageRe.exec(line)) !== null) {
                const varName = m[1];
                if (!definedVars.has(varName)) {
                    flag(
                        'CSS custom property existence',
                        file,
                        `var(${varName}) is referenced but has no matching definition in style.css's :root/theme blocks. Either define it there or fix the typo (see the --text-muted / --color-text-muted bug for exactly this failure mode).`
                    );
                }
            }
        }
    }
}

// --- Rule 4: Demo/main parity (function-name diffing) ---

const FN_PATTERNS = [
    /function\s+([a-zA-Z0-9_$]+)\s*\(/,
    /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:function|\()/,
    /^\s*([a-zA-Z0-9_$]+)\s*[:=]\s*(?:async\s*)?function\s*\(/,
];

function matchFnName(line) {
    for (const p of FN_PATTERNS) {
        const m = line.match(p);
        if (m) return m[1];
    }
    return null;
}

function extractChangedFunctionNames(diff) {
    // Two signals, unioned:
    //  1. A +/- line IS a function declaration/assignment (signature itself changed).
    //  2. A +/- line falls inside a hunk whose nearest preceding context line (unchanged,
    //     starts with a space) is a function declaration — i.e. an edit to a function's
    //     body, not just its signature. git diff includes surrounding context lines by
    //     default, which is what lets us walk back to find the enclosing function.
    const names = new Set();
    const lines = diff.split('\n');
    let lastSeenFn = null;

    for (const raw of lines) {
        if (raw.startsWith('@@')) {
            lastSeenFn = null; // hunk boundary resets context tracking
            continue;
        }
        if (raw.startsWith('+++') || raw.startsWith('---')) continue;

        const isAdded = raw.startsWith('+');
        const isRemoved = raw.startsWith('-');
        const isContext = raw.startsWith(' ');

        const content = (isAdded || isRemoved || isContext) ? raw.slice(1) : null;
        if (content === null) continue;

        const fn = matchFnName(content);
        if (fn) lastSeenFn = fn;

        if ((isAdded || isRemoved)) {
            if (fn) {
                names.add(fn);
            } else if (lastSeenFn) {
                names.add(lastSeenFn);
            }
        }
    }
    return names;
}

function checkDemoMainParity(files) {
    const pairs = [
        ['app.js', 'demo/demo-app.js'],
        ['admin.js', 'demo/demo-admin.js'],
    ];
    for (const [mainFile, demoFile] of pairs) {
        if (!files.includes(mainFile)) continue;
        const mainDiff = stagedDiffFor(mainFile);
        const mainFns = extractChangedFunctionNames(mainDiff);
        if (mainFns.size === 0) continue; // nothing recognizable as a function change; skip

        const demoTouched = files.includes(demoFile);
        const demoDiff = demoTouched ? stagedDiffFor(demoFile) : '';
        const demoFns = extractChangedFunctionNames(demoDiff);

        const missing = [...mainFns].filter(fn => !demoFns.has(fn));
        if (missing.length > 0) {
            warn(
                'Demo/main parity',
                demoFile,
                `${mainFile} changed function(s) [${missing.join(', ')}] not matched by a change to the same name(s) in ${demoFile}. Per CLAUDE.md, demo/ must mirror behavioral changes to ./ unless this is a documented exception (localStorage, demo media, demo-only UI). If intentional, consider a gate-exceptions.json entry.`
            );
        }
    }
}

// --- Rule 5: Shared-style leakage (demo-override.css / admin-only stylesheets) ---

function getRootTokenValues() {
    const css = readWorkingFile('style.css') || '';
    // Map value -> token name, from :root/[data-theme] blocks, so we can flag
    // duplicated literal values used elsewhere instead of referencing the token.
    const values = new Map();
    const blockRe = /(:root(?:\[[^\]]*\])?|\[data-theme="[^"]*"\])\s*\{([^}]*)\}/g;
    let block;
    while ((block = blockRe.exec(css)) !== null) {
        const body = block[2];
        const declRe = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
        let d;
        while ((d = declRe.exec(body)) !== null) {
            const val = d[2].trim();
            // Only flag simple literal colors/lengths, not var()-based composites.
            if (/^var\(/.test(val)) continue;
            values.set(val, `--${d[1]}`);
        }
    }
    return values;
}

function checkSharedStyleLeakage(files) {
    const styleTargets = files.filter(f => f === 'demo/demo-override.css' || (/\.css$/.test(f) && /admin/i.test(f)));
    if (styleTargets.length === 0) return;
    const tokenValues = getRootTokenValues();

    for (const file of styleTargets) {
        const diff = stagedDiffFor(file);
        const added = addedLines(diff);
        for (const line of added) {
            for (const [val, token] of tokenValues) {
                if (val.length < 3) continue; // skip trivial values like "0"
                if (line.includes(val)) {
                    warn(
                        'Shared-style leakage',
                        file,
                        `Line reuses literal value "${val}" which already exists as ${token} in style.css :root. Per CLAUDE.md, shared values belong only in style.css — reference the token instead of duplicating the literal.`
                    );
                }
            }
        }
    }
}

// --- Rule 6: cleanupMalformedLinks triplication ---

function checkCleanupMalformedLinksSync(files) {
    const trio = ['admin.js', 'demo/demo-admin.js', 'utilities/fix-links.js'];
    const touchedNearFn = trio.filter(f => {
        if (!files.includes(f)) return false;
        const diff = stagedDiffFor(f);
        return /cleanupMalformedLinks/.test(diff);
    });
    if (touchedNearFn.length > 0 && touchedNearFn.length < trio.length) {
        const untouched = trio.filter(f => !touchedNearFn.includes(f));
        warn(
            'cleanupMalformedLinks triplication',
            untouched.join(', '),
            `cleanupMalformedLinks was changed in [${touchedNearFn.join(', ')}] but not in [${untouched.join(', ')}]. This regex chain is triplicated — confirm whether the same fix applies to the other copies.`
        );
    }
}

// --- Rule 7: generateShareUrl signature match ---

function extractShareUrlSignature(diff) {
    for (const raw of diff.split('\n')) {
        if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
        const m = raw.match(/function\s+generateShareUrl\s*\(([^)]*)\)/);
        if (m) return m[1].trim();
    }
    return null;
}

function checkShareUrlSignatureMatch(files) {
    const mainChanged = files.includes('app.js');
    const demoChanged = files.includes('demo/demo-app.js');
    if (!mainChanged && !demoChanged) return;

    const mainSigDiff = mainChanged ? extractShareUrlSignature(stagedDiffFor('app.js')) : null;
    const demoSigDiff = demoChanged ? extractShareUrlSignature(stagedDiffFor('demo/demo-app.js')) : null;
    if (!mainSigDiff && !demoSigDiff) return; // neither commit touched the signature line itself

    const mainSrc = readWorkingFile('app.js') || '';
    const demoSrc = readWorkingFile('demo/demo-app.js') || '';
    const mainFinal = (mainSrc.match(/function\s+generateShareUrl\s*\(([^)]*)\)/) || [])[1];
    const demoFinal = (demoSrc.match(/function\s+generateShareUrl\s*\(([^)]*)\)/) || [])[1];

    if (mainFinal !== undefined && demoFinal !== undefined) {
        const normalize = s => s.replace(/\s+/g, ' ').trim();
        if (normalize(mainFinal) !== normalize(demoFinal)) {
            warn(
                'Share-URL signature match',
                mainChanged ? 'app.js' : 'demo/demo-app.js',
                `generateShareUrl signatures differ: app.js(${normalize(mainFinal)}) vs demo/demo-app.js(${normalize(demoFinal)}). These have drifted before (demo has an extra mediaArray param). Confirm this change doesn't widen the gap, given past share-bug fixes.`
            );
        }
    }
}

// --- Rule 8: README currency ---

function checkReadmeCurrency(files) {
    const readmeChanged = files.includes('README.md');
    if (readmeChanged) return;

    const schemaFiles = ['projects.json', 'categories.json'];
    const behaviorFiles = ['app.js', 'admin.js'];
    // For app.js/admin.js, only trigger if the diff touches things README documents:
    // category logic, description-formatting tags, demo mode, admin security notes.
    const behaviorMarkers = /(filterAliases|categories|shortcut|<award>|<live>|renderDescription|DEMO_CATEGORIES|API_BASE|save-server)/;

    const schemaTouched = schemaFiles.filter(f => files.includes(f));
    const behaviorTouched = behaviorFiles.filter(f => {
        if (!files.includes(f)) return false;
        const diff = stagedDiffFor(f);
        return behaviorMarkers.test(diff);
    });

    if (schemaTouched.length > 0 || behaviorTouched.length > 0) {
        const culprits = [...schemaTouched, ...behaviorTouched];
        flag(
            'README currency',
            'README.md',
            `[${culprits.join(', ')}] changed in a way that may affect documented behavior (schema or a documented feature), but README.md was not updated in this commit. Does this change alter Data Format, Categories, Description Formatting, or Demo Mode sections? If yes, update the matching section.`
        );
    }
}

// --- Runner ---------------------------------------------------------

function run() {
    const files = stagedFiles();
    if (files.length === 0 && !dryRun) {
        return { violations: [], warnings: [] };
    }

    checkDemoCategoryParity(files);
    checkCssCustomPropertyExistence(files);
    checkDemoMainParity(files);
    checkSharedStyleLeakage(files);
    checkCleanupMalformedLinksSync(files);
    checkShareUrlSignatureMatch(files);
    checkReadmeCurrency(files);

    return { violations, warnings };
}

module.exports = { run, stagedFiles, stagedDiffFor, readWorkingFile, repoRoot };

if (require.main === module) {
    const { violations: v, warnings: w } = run();

    if (w.length > 0) {
        console.log('\n[gate-check] Warnings (non-blocking, judgment calls):');
        for (const item of w) {
            console.log(`  - [${item.rule}] ${item.file}: ${item.message}`);
        }
    }

    if (v.length > 0) {
        console.log('\n[gate-check] BLOCKED — violations found:');
        for (const item of v) {
            console.log(`  - [${item.rule}] ${item.file}: ${item.message}`);
        }
        console.log('\nFix the above, or add a scoped gate-exceptions.json entry if this is intentional (see INTEGRATION_CHECKLIST.md Part 3.4).');
        if (!dryRun) process.exit(1);
    } else if (!dryRun) {
        console.log('[gate-check] All checks passed.');
    }

    if (dryRun) {
        console.log(`\n[gate-check] Dry-run summary: ${v.length} violation(s), ${w.length} warning(s).`);
    }
}

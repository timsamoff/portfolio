# Portfolio — Deep Integration Audit

Date: 2026-09-10
Scope: every subsystem that adding, editing, or changing behavior around **a portfolio project** (and its categories/media/tags) has had to touch, across all three surfaces, grounded in actual code and git history — not generic best-practice guessing.

## Surfaces confirmed

1. **Main public site** — `index.html`, `app.js`, `style.css`, reads `projects.json`/`categories.json` via fetch. No auth, static hosting.
2. **Admin panel** — `_admin.html` (gitignored), `admin.js`, talks to `save-server.js` (port 3001, hardcoded, two fetches in `admin.js`), no auth, no build step.
3. **Demo site** — `demo/index.html`, `demo/admin.html`, `demo/demo-app.js`, `demo/demo-admin.js`, `demo/demo-data.js`, `demo/demo-override.css` — hand-maintained fork, `localStorage` instead of server, own media, own `DEMO_CATEGORIES` seed array (`demo/demo-data.js` line 6) and its own `demo_portfolio_categories` localStorage key — **not** read from the same `categories.json` file the other two surfaces share.

Registries are **not** fully shared: `index.html`/`_admin.html` both read the same `projects.json`/`categories.json` on disk (persistence differs — fetch vs local write — but the file is the same object). `demo/` has its own independent category store (`DEMO_CATEGORIES` seed + localStorage), so every touchpoint below that involves categories is listed **once per surface** where the logic is independently implemented, per the audit brief.

## Part 0 — Existing gate checks (confirmed, not inferred)

- No `.github/workflows/` directory exists.
- No `.git/hooks/pre-commit` (only the stock `.sample` files ship with git itself — none are installed/executable).
- No `package.json` anywhere in the repo — no npm scripts, no lint/test config, nothing to run in CI even if CI existed.

**Conclusion: zero automated gate-checking exists today.** Every item below is either caught by Tim noticing it in-browser, or not caught at all until a bug report. This matches `todo.md`'s own framing ("gate-check candidates" presented as decisions, not existing infrastructure).

`production_notes/todo.md`'s "Gate-check candidates" section (items 1-7) is folded into this checklist's touchpoints and known-gaps below rather than re-derived — see cross-references inline.

---

## Part 1 — Touchpoint inventory

Legend: **Loud** = breaks visibly/throws/renders obviously wrong. **Silent** = degrades quietly (wrong color, missing filter, dead code path) with no error and no visual signal unless you know to look.

### A. Definition / registry layer

| # | Touchpoint | Surface(s) | Change required when adding/editing a project | Failure mode | Real history | Coverage |
|---|---|---|---|---|---|---|
| A1 | `projects.json` schema (title, categories[], cardHeading, media[], description, imageAlign, selected, published) | Main, Admin | New field needs schema agreement across renderer + admin form + save-server passthrough | Loud if a renderer assumes a field exists and errors; silent if a new field is just never read | README (Data Format section) documents the current schema; matches actual fields in admin.js | Already covered (README documents it) |
| A2 | `categories.json` (display name + `shortcut` per key) | Main, Admin (shared file) | New category needs a unique key, display, and shortcut | Silent — nothing forces a shortcut to be unique or non-empty | `categories.json` confirmed to hold `shortcut` per category | Not covered |
| A3 | `DEMO_CATEGORIES` seed array | Demo | Demo's own category list, independent of `categories.json` | Silent divergence — demo can show different categories than the live site with no error | Commit `938b238` "Updated demo data so that some projects have multiple categories" — demo category data has needed separate hand-updates historically | Not covered |
| A4 | `filterAliases` hardcoded object literal in `app.js` (lines 812-824) | Main only | A brand-new category's shortcut (already in `categories.json`) must be **manually copy-pasted** into this literal or the main site gets no short URL alias for it | **Silent** — filtering still works via the full category key, just without the clean URL; no error, no console warning | CLAUDE.md flags this explicitly. Confirmed by reading code: `demo/demo-app.js` already fixed this exact problem via `buildFilterAliases(categoryData)` (line 817-832), which derives aliases from `categoryData[cat].shortcut` dynamically — **the main site is behind the demo site here**, an inversion of the usual parity direction | Partially covered (todo.md flagged it; not fixed) |
| A5 | `utilities/config.js` `imageExtensions` list (`.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.tif`) | utilities only | A new supported image format needs adding here | Silent to a one-off script user — file just gets skipped by webp-conversion tooling | Confirmed in code, line 20 | Not covered |
| A6 | Video-type detection regex literals (`videoExtensions`, `youtubePattern`, `vimeoPattern`) | Main (`app.js` ~413-416), Demo (`demo-app.js` ~365-368) | A new video host or extension needs the regex updated **in both files** | Silent — file just renders as a broken/blank media item, no thrown error | Confirmed identical regex text duplicated across both files independently | Not covered |

### B. Rendering / presentation layer

| # | Touchpoint | Surface(s) | Change required | Failure mode | Real history | Coverage |
|---|---|---|---|---|---|---|
| B1 | Card rendering (category tags, thumbnails) | Main, Demo | Must read `categories` array (not legacy `category` string) | Loud-ish (empty/wrong tag) if migration shim is skipped | See migration shim rows below | Already covered |
| B2 | Legacy `category` string → `categories` array fallback/migration | Main (`app.js` ~1310-1312), Demo (`demo-app.js` ~1061, 1172, 1212, 1424-1447), Demo (`demo-data.js` ~294-295, 354) | Same migration logic (`if (!project.categories && project.category) {...}`) reimplemented **independently three times** in three files, plus a fourth read-only fallback site in `demo-app.js` (line 1172/1212) that doesn't even do the write-back, just reads `p.category` inline | Silent — if one of the three copies gets a fix (e.g. handling empty-string category) and the other two don't, legacy-data projects render correctly on one surface and incorrectly on another with no error thrown anywhere | Confirmed: 3 separate implementations, not shared. Exactly the pattern flagged in the audit brief | Not covered |
| B3 | `<award>`/`<live>` custom tag → badge rendering (`renderDescription`) | Main (`app.js` ~344-346), Demo (`demo-app.js` ~246-248) | New custom tag type needs parser support added to both `renderDescription` copies | Silent — tag just renders as literal unrecognized HTML/text, no error | Confirmed both tags implemented in both files currently (in sync) — flagging as a duplication risk, not a current bug | Not covered (duplication risk, not yet diverged) |
| B4 | Thumbnail / video-embed generation (YouTube/Vimeo poster images, iframe embeds) | Main, Demo | Any new embed platform needs matching detection + embed-URL builder + thumbnail-URL builder, x2 files | Silent — falls through to no thumbnail / broken iframe | Confirmed duplicated function bodies (`getYouTubeEmbedUrl`, `getVimeoEmbedUrl`) | Not covered |
| B5 | Alt text on media/thumbnails | Main, Demo | Should use project title; demo currently doesn't | Silent (accessibility-only failure, no visual break) | todo.md demo-findings #4: generic `alt="Portfolio image"` never uses actual title, confirmed in demo-app.js | Not covered (already flagged in todo.md) |
| B6 | `--text-muted` vs `--color-text-muted` CSS token typo | Main, Admin, Demo (7 files, 31 occurrences: `_admin.html`, `demo/admin.html`, `admin.js`, `demo/demo-admin.js`, `demo/demo-override.css`, `app.js`, `demo/demo-app.js`) | Any new muted-text style must reference the *correct* defined token (`--color-text-muted`, only one defined in `:root` in `style.css`) | **Silent** — undefined CSS custom property falls back to `initial`/inherited color, not an error, not visually catastrophic, just wrong (looks like default text color instead of muted gray) | Confirmed via grep across all 7 files; this is the concrete symptom of "no gate verifies referenced CSS vars are defined" | Partially covered (todo.md flagged exact locations; not fixed) |

### C. Interaction / control layer

| # | Touchpoint | Surface(s) | Change required | Failure mode | Real history | Coverage |
|---|---|---|---|---|---|---|
| C1 | Admin form category checkboxes (`category-checkbox-list`) | Admin, Demo-admin | New category must appear as a checkbox; rendering function (`categoryCheckboxList.innerHTML = ...`) is separately implemented in `admin.js` and `demo-admin.js` | Loud if the container ID doesn't exist (`getElementById` returns null, guarded by `if (!categoryCheckboxList) return`) — so actually silent no-op if HTML is ever restructured and the ID changes, since the guard swallows it | Confirmed both files have near-identical checkbox-rendering blocks (lines ~93-152 admin.js, ~105-164 demo-admin.js) | Not covered |
| C2 | `formTag`/`#form-tag` reference in `demo-admin.js` | Demo-admin only | Dead: JS references an element (`#form-tag`) that does not exist in `demo/admin.html` | Silent — every `if (formTag)` branch is simply always false, dead code that looks functional | Confirmed in todo.md demo findings #9 | Already covered (documented, not fixed) |
| C3 | No access control on admin panel or save-server | Admin | N/A — explicitly flagged as a gap, not a bug | Loud in the sense that anyone with local network access to port 3001 can write `projects.json`, but silent in that nothing warns the user of this | CLAUDE.md confirms "no auth" by design for a local-only tool; flagging per audit instructions to note explicitly when access control is absent | Not covered (accepted design tradeoff per CLAUDE.md, not a bug — flagging as required) |
| C4 | Drag-drop project reordering | Admin, Demo-admin | Reorder logic must persist the new array order back through save-server / localStorage | Loud if save fails outright; silent if order silently reverts on next admin-panel reload due to a race with debounced auto-save | Not independently verified in this pass — no confirmed bug found, flagging as a plausible-but-unconfirmed gap | Not covered |

### D. Core logic / computation layer

| # | Touchpoint | Surface(s) | Change required | Failure mode | Real history | Coverage |
|---|---|---|---|---|---|---|
| D1 | Category-to-URL-alias resolution | Main (hardcoded `filterAliases`), Demo (`buildFilterAliases`, dynamic) | See A4 — same touchpoint, listed here from the resolution-logic angle | Silent | See A4 | Partially covered |
| D2 | `cleanupMalformedLinks` regex fixup | Admin (`admin.js`), Demo-admin (`demo-admin.js`), `utilities/fix-links.js` | Any new smart-quote-mangled-href pattern found in the wild needs the regex chain fixed in **three separate files** | Silent — a link just renders broken/unclickable, no thrown error, and a fix applied to only one of the three copies leaves the others broken | Confirmed triplicated; explicitly the subject of recent-ish commits chasing link/share bugs | Not covered |
| D3 | `generateShareUrl` — share-URL encode | Main (`app.js` line 585, signature `(projectIndex, mediaIndex = 0)`), Demo (`demo-app.js` line 549, signature `(projectIndex, mediaIndex = 0, mediaArray = [])`) | Both must stay in sync on what gets encoded into the share URL | Loud-ish when it fails visibly (share link opens wrong media), which matches the exact symptom implied by "Maybe this will fix the share bug" / "Hopefully fixing a share bug" commits | **Confirmed function signatures have already drifted**: demo's version takes an extra `mediaArray` parameter the main site's does not. Given two commits in the last 5 in the log are explicitly chasing an unresolved share bug, this signature mismatch is a strong candidate root cause worth checking directly | Not covered — this is the single most actionable finding in this audit |
| D4 | Share-URL decode / `share.html` redirect shim | Main (`share.html` + `app.js` `pathname.includes('share.html')` check), Demo (`demo/share.html` + `demo-app.js`) | Decode logic must match whatever the paired encode function produced | Loud if decode throws; silent if it decodes to a slightly-wrong media index and just shows the wrong image with no error | Same commit history as D3 | Not covered |
| D5 | Smart-quote conversion (`convertToSmartQuotes`) | Admin, Demo-admin | Companion to D2, same file-triplication risk pattern (though todo.md only confirms `cleanupMalformedLinks` as triplicated — `convertToSmartQuotes` duplication across admin.js/demo-admin.js not independently re-verified in this pass) | Silent | todo.md stylistic-judgment item #2 mentions both functions together in admin.js; cross-file duplication of `convertToSmartQuotes` specifically is a plausible-but-unconfirmed gap, flagging as such rather than fact | Not covered |
| D6 | Media-type detection (image/video/YouTube/Vimeo) | Main, Demo | See A6 — same touchpoint from the "core logic" angle | Silent | See A6 | Not covered |

### E. Persistence layer

| # | Touchpoint | Surface(s) | Change required | Failure mode | Real history | Coverage |
|---|---|---|---|---|---|---|
| E1 | `save-server.js` write path (`/api/save-projects`, `/api/save-categories`) | Admin | Writes directly to `projects.json`/`categories.json` via `fs.writeFileSync`, no validation of the incoming JSON shape before writing | Silent — a malformed payload gets written straight to disk, corrupting the live data file with no rollback | `utilities/fix-json-quote.js` existing as a one-off repair script is itself evidence this has happened before | Partially covered (repair tooling exists reactively; no preventive validation) |
| E2 | `localStorage` save path (demo) | Demo | `demo-admin.js` writes categories/projects to localStorage keys (`demo_categories_backup`, `category_shortcut_${key}`, etc.) | Silent — no disk artifact, no way to inspect/diff what got saved except devtools | Confirmed multiple `localStorage.setItem` call sites in demo-admin.js | Not covered |
| E3 | `backups/` timestamped snapshot on `save-server.js` startup | Admin | One snapshot per server **startup**, not per save | Silent, unbounded growth, no pruning | todo.md gate-check candidate #5, confirmed 9 categories + 9 projects backups already present June-September 2026 | Already covered (documented in todo.md as accepted-for-now) |
| E4 | Category-migration shim at persistence/save time | Main, Demo, Demo (data) | Same as B2, but specifically the save-time (not render-time) branch of the migration — confirmed separate call sites at `app.js` line 1310-1312 (inside what looks like a save/normalize path) vs render-time checks elsewhere | Silent | See B2 | Not covered |

### F. Wiring / registration layer

| # | Touchpoint | Surface(s) | Change required | Failure mode | Real history | Coverage |
|---|---|---|---|---|---|---|
| F1 | New category needs registering beyond `categories.json` | Main | Must also be added to `filterAliases` in `app.js` (A4/D1) for a clean URL | Silent | Confirmed | Not covered |
| F2 | New category needs registering in demo | Demo | Must also be added to `DEMO_CATEGORIES` in `demo-data.js` (A3) since demo doesn't read `categories.json` | Silent | Confirmed | Not covered |
| F3 | Style/icon/color mapping per category | Main, Admin, Demo | No confirmed per-category color/icon mapping was found in `style.css` in this pass — categories appear to render as plain text tags, not icon-coded. Flagging as "no confirmed history for this, plausible-but-unconfirmed": if such a mapping is ever added, it becomes a 3-surface wiring point like the others | N/A | Not independently confirmed | Not covered (speculative) |

### G. Cross-cutting assumptions (hardcoded-by-name lists — explicit flag per audit instructions)

Every one of these is a place where the code assumes a fixed, closed set of values rather than deriving from the registry:

1. `filterAliases` (app.js) — hardcoded map, see A4.
2. `imageExtensions` (utilities/config.js) — hardcoded array, see A5.
3. Video-platform detection regexes (app.js + demo-app.js, duplicated) — see A6/D6.
4. `DEMO_CATEGORIES` (demo-data.js) — hardcoded seed array acting as demo's entire category registry, see A3.

None of these four are mechanically validated against `categories.json` or against each other today.

### H. Documentation that isn't the README

| # | Item | Match to implementation? | Coverage |
|---|---|---|---|
| H1 | `CLAUDE.md` "Known architecture quirks" | Matches implementation — cross-checked `filterAliases`, port 3001 hardcoding, and `backups/` growth against actual code; all three confirmed accurate | Already covered |
| H2 | `CLAUDE.md` working agreements (demo parity, shared-styles-in-style.css) | These are stated as forward-looking policy, not yet-implemented fact — the `--text-muted` bug and `filterAliases`/`buildFilterAliases` divergence are both live violations of these two agreements today | Not covered (policy stated, not yet enforced) |
| H3 | `production_notes/todo.md` | Cross-referenced throughout this audit (see "Coverage" column citations above) — accurately reflects a real, unfixed state of the repo as of its own date | Already covered |

---

## Part 2 — README gate check

**README.md** (own category, per audit instructions).

Current state (read in full): documents overview, feature list, setup (`node save-server.js`, open `index.html`/`_admin.html`), project structure tree, `projects.json` data format with example, `categories.json` format with example (including the `shortcut` field), description-formatting tags (`<strong>`, `<em>`, `<ul>`, `<a>`, `<award>`, `<live>`), category management (add/shortcut/delete via admin), demo mode description, admin security note (`_admin.html` underscore-hiding from GitHub Pages), license.

Cross-referenced against `todo.md`: todo.md's Part 9 (comment cleanup) and gate-check candidates don't mention README-specific findings from the earlier design-quality audit's "Part 10" — no README-specific stale content was flagged there, so no confirmed stale-README finding exists to report; this pass's own read did not find factually wrong README content, but it does **not** mention:
- The `filterAliases` hardcoded-map caveat (A4) — README implies shortcuts "just work" once set in the category manager, which is only true for `categories.json`'s own `shortcut` field; it says nothing about a second, separate list in `app.js` that must also be updated. This is a real gap between documented behavior and actual behavior.
- Any mention of `save-server.js` writing without validation, or the no-auth posture (a one-line "local use only, no authentication" caveat would close this).

**Proposed README structure for mechanical checkability** (section list a gate check can grep for by heading, to confirm the README was touched when relevant code was):

1. Overview
2. Features
3. Setup
4. Project Structure
5. Data Format (`projects.json`)
6. Categories (`categories.json` + shortcut caveat — **add filterAliases caveat here**)
7. Description Formatting (tag list)
8. Category Management
9. Demo Mode (+ documented exceptions vs main site)
10. Admin Security (+ explicit no-auth/local-only statement)
11. License

Coverage label: **Partially covered** — README exists, is structured, and is largely accurate, but omits the filterAliases caveat and the no-auth caveat identified in this audit.

---

## Part 3 — Deliverables

### 3.1 Checklist (see Part 1 tables above — organized by subsystem, silent/loud and surface noted per item)

### 3.2 Pre-commit gate check — plain-language description

**What it would do:** on every commit, diff the staged changes against this checklist's touchpoint categories and flag any category that looks "plausibly touched but incompletely touched," using the diff's file list and a few targeted greps as signals — not full semantic understanding.

Concretely, for each category below, the check inspects which files changed and asks a yes/no self-review question. A "yes, should have but didn't" is a flagged violation; the flag names the rule, the exact file, and the fix.

| Rule | Trigger (files changed) | Flag condition | Required fix / self-review question |
|---|---|---|---|
| Category registry parity | `categories.json` changed | `app.js`'s `filterAliases` literal NOT changed in the same commit | "Did you add a new category with a shortcut? If so, add the same key/value to `filterAliases` in `app.js` (~line 812)." |
| Demo category parity | `categories.json` changed | `demo/demo-data.js`'s `DEMO_CATEGORIES` NOT changed in the same commit | "Demo doesn't read `categories.json` — does `DEMO_CATEGORIES` in `demo-data.js` (line 6) need the same category added?" |
| Category-migration shim sync | Any of `app.js` / `demo/demo-app.js` / `demo/demo-data.js` changed near a `project.category` / `.categories` reference | Only one of the three files touched in the commit | "This is one of three independent copies of the legacy-category migration shim (app.js ~1310, demo-app.js ~1061/1172/1212/1424, demo-data.js ~294/354). Does the same fix apply to the other two?" |
| CSS custom property existence | Any `.css`/`.html`/`.js` file adds a new `var(--...)` reference | The referenced token name has no matching definition found via grep in `style.css`'s `:root` block | "`var(--x)` is referenced in <file> but not defined in `style.css`'s `:root`. Either define it there or fix the typo (see the `--text-muted`/`--color-text-muted` bug, 7 files/31 occurrences, for exactly this failure mode)." |
| Demo/main parity | `app.js` or `admin.js` changed | Matching function name (by grep on function name) not touched in `demo/demo-app.js` / `demo/demo-admin.js` in the same commit | "Per CLAUDE.md working agreement, `demo/` must mirror behavioral changes to `./`. Is this change one of the documented exceptions (localStorage, demo media, demo-only UI)? If not, mirror it into demo, or add a `gate-exceptions.json` entry (see Part 5) explaining why not." |
| Shared-style leakage | `demo-override.css` or an admin-only stylesheet changed | The changed rule sets a color/spacing/type-scale value already defined in `style.css` `:root` as a token, rather than referencing the token | "Per CLAUDE.md, shared values belong only in `style.css`. Does this new rule duplicate a value that already has a token? Reference the token instead of a literal." |
| `cleanupMalformedLinks` triplication | Any of `admin.js` / `demo/demo-admin.js` / `utilities/fix-links.js` changed near `cleanupMalformedLinks` | Only one of the three files touched | "This regex chain is triplicated. Does the fix apply to the other two copies?" |
| Share-URL signature match | `generateShareUrl` changed in `app.js` or `demo/demo-app.js` | The function signature (param count/names) differs between the two after the change | "`generateShareUrl` signatures have already drifted once (demo has an extra `mediaArray` param main doesn't). Confirm this change doesn't widen that gap, given two of the last five commits were unresolved share-bug fixes." |
| README currency | `projects.json` schema, `categories.json` schema, or any documented feature (multi-category, shortcuts, `<award>`/`<live>` tags, demo mode) changed | README.md NOT changed in the same commit | "Does this change alter anything README.md's Data Format, Categories, Description Formatting, or Demo Mode sections describe? If yes, update the matching section (see Part 2's proposed structure)." |
| Commit message conventions | Every commit | Message is a sprawling multi-paragraph narrative, or contains a co-author line | "Keep to a single-line summary (or a few one-sentence bullets if genuinely needed). No co-author notes. One commit per session unless the change set is large enough to split." |
| Exception check | Any flagged violation above | A matching, unexpired entry exists in `gate-exceptions.json` scoped to this exact file | If found, suppress the flag and print the exception's reason/owner/review-by date instead of blocking. If the entry's review-by date has passed, treat it as if no exception exists — flag anyway. |

This is a description of intended behavior for a future script, not an implemented one — no script was written in this pass, per the audit's constraints.

### 3.3 Known gaps (real touchpoints, not mechanically gateable — tracked risk, not silent)

These cannot realistically be caught by a diff/grep-based gate check, and are listed here so they stay visible instead of silently unaddressed:

1. **`generateShareUrl` semantic correctness (D3/D4).** A gate check can catch a signature *mismatch* between the two copies, but not whether the share-bug logic is actually correct in either — that requires Tim testing an actual share link in-browser, which is exactly the kind of verification CLAUDE.md already says is his to do, not an automated check's.
2. **No access control on `save-server.js` (C3).** This is an accepted design tradeoff for a local-only tool per CLAUDE.md, not a defect — flagging as required by the audit brief, no action implied unless Tim decides the threat model has changed (e.g. if the admin panel is ever exposed beyond localhost).
3. **Drag-drop reorder persistence race (C4)** — no confirmed bug, flagged as plausible-but-unconfirmed. Not gateable without a runtime test; would need manual verification if reordering ever "loses" order after a reload.
4. **`convertToSmartQuotes` cross-file duplication (D5)** — plausible-but-unconfirmed duplication risk (only `cleanupMalformedLinks` triplication is independently confirmed in prior audits). Worth a direct diff between admin.js's and demo-admin.js's copies next time either is touched, but not something a gate check can currently target with confidence since the exact duplication wasn't independently re-verified line-by-line in this pass.
5. **`utilities/` scripts drifting from runtime logic (A5)** — `imageExtensions` in `utilities/config.js` is a one-off script's config, not read by `app.js`/`demo-app.js` at runtime. A gate check could flag "utilities/config.js changed, did the corresponding runtime regex change too" but the inverse (runtime regex changed, should utilities/config.js follow) is a judgment call, not a hard rule — proposing it as a **candidate** exception-eligible rule rather than a hard gate.
6. **Per-category style/icon mapping (F3)** — speculative; no such mapping currently exists to protect. Listed so that if one is ever added, it's immediately recognized as a new 3-surface wiring point rather than rediscovered from scratch.

### 3.4 Proposed `gate-exceptions.json` design (description only — not created)

Each entry:
```
{
  "category": "<exact rule name from the Part 3.2 table, e.g. 'Demo/main parity'>",
  "file_scope": "<exact file path, no globs — e.g. 'demo/demo-admin.js' not 'demo/*'>",
  "reason": "<concrete, specific — not 'not applicable'>",
  "owner": "Tim Samoff",
  "review_by": "<ISO date>"
}
```
Rules: no wildcard/catch-all file scopes (an exception for `demo/*` defeats the point of the parity check entirely — each exception should name the one file and ideally the one function/line range it covers). An expired `review_by` date makes the entry inert — the gate check treats it exactly as if the entry didn't exist, so an expired exception fails the same as no exception, not as a warning.

**Proposed entries for Tim to actually add** (none created by this pass):
- `{"category": "Demo/main parity", "file_scope": "demo/demo-override.css", "reason": "Demo-specific visual differences (placeholder branding, demo-info-modal styling) are intentional per CLAUDE.md's documented exception list", "owner": "Tim Samoff", "review_by": "<Tim to set>"}`
- `{"category": "Category registry parity", "file_scope": "demo/demo-data.js", "reason": "Demo's category set intentionally includes/excludes categories for demo-content reasons (e.g. showcasing multi-category assignment), not a missed sync", "owner": "Tim Samoff", "review_by": "<Tim to set>"} — only if Tim confirms this is truly intentional and not just unfixed drift; if the real answer is 'this needs fixing,' don't add the exception, fix DEMO_CATEGORIES instead.`

These are proposals only. Tim should review and decide whether either reflects genuine intent or just documents an unfixed bug (in which case the fix, not an exception, is the right move).

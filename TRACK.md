# TrackInvest — Audit & Fix Tracking

## Goal
Review all UI→Logic→BusinessLogic→DB flows. Fix CRUD, consistency, mobile-friendliness, MD3 compliance. Remove complexity/duplicacy.

---

## Phase 1 — Critical Bugs

| # | File | Issue | Status |
|---|------|-------|--------|
| 1 | All HTML files | `user-scalable=no, maximum-scale=1.0` blocks accessibility zoom — **REMOVED** | ✅ |
| 2 | `index.html:802` | Settings sheet `height:85vh` clips on small screens → `100dvh` | ✅ |
| 3 | All HTML Google Fonts | Missing `&display=swap` — added to all standalone pages | ✅ |
| 4 | `style.css` | Missing `--md-tertiary-container` / `--md-on-tertiary-container` vars — **ADDED** | ✅ |
| 5 | `monthly_plan.html:1114` | `callAIProvider(db, ...)` passes whole `db` — fixed to pass keys object | ✅ |
| 6 | `style.css:2002-2003` | Snackbar `bottom: 100px` → `16px` for proper mobile offset | ✅ |
| 7 | `index.html` multiple sheets | Inline `max-height:85-90vh` overrides removed (use class defaults `100dvh`) | ✅ |
| 8 | `style.css:1627-1628` | `.sheet-display` `height:85vh` → `100dvh` | ✅ |
| 9 | `style.css:1649` | `.sheet` `max-height:92vh` → `100dvh` | ✅ |

## Phase 2 — UI Consistency (MD3)

| # | File | Issue | Status |
|---|------|-------|--------|
| 10 | `index.html:689` | Category sheet `height:85vh` inline → uses `.sheet-display` class | ✅ |
| 11 | `market_watch.html` | Duplicate `.section-title`, `.chip`, `.chip-group` CSS → removed (use shared from style.css) | ✅ |
| 12 | `style.css` | `.sheet-display` consolidated as reusable flex-column sheet pattern | ✅ |

## Phase 3 — Mobile Scrollability

| # | File | Issue | Status |
|---|------|-------|--------|
| 13 | `style.css` `.sheet` | `overflow-y: auto` + `max-height:100dvh` ensures all sheets scroll on mobile | ✅ |
| 14 | `style.css` `.sheet-display` | `height:100dvh` + `display:flex; flex-direction:column; overflow:hidden` + inner `.scroll-y` for content | ✅ |
| 15 | All sub-sheets | Calculator sheets (sip, emi, inflation) flow naturally in `.sheet` with scroll | ✅ |
| 16 | `dividend-sheet`, `webrtc-sync-sheet` | Removed `max-height:90vh` — use class default | ✅ |

## Phase 4 — CRUD Verified

| # | Feature | Flow | Status |
|---|---------|------|--------|
| 17 | Investments | `saveInvestment()` — validates → sanitizes → dedup → save/update → undo | ✅ verified |
| 18 | Goals | `saveGoal()` / `deleteGoal()` — CRUD with target/saved/linked category | ✅ verified |
| 19 | Recurring SIPs | Add from invest sheet + recurring list in its own sheet | ✅ verified |
| 20 | Templates | Save as template on invest + quick-add chips | ✅ verified |
| 21 | Monthly Plan | `savePlanner()` / `resetPlanner()` — persists to `db.monthlyPlanConfig` | ✅ verified |
| 22 | Spend Tracker | Add expense via quick-add bar + AI categorization | ✅ verified |

## Phase 5 — Remove Complexity & Duplicacy

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| 23 | `user-scalable=no` in 4 HTML files | Removed from all | ✅ |
| 24 | `display=swap` missing in 3 HTML files | Added to all | ✅ |
| 25 | 5+ sheets with inline `max-height` overrides | Removed — `.sheet` class provides default | ✅ |
| 26 | Duplicate `.section-title`, `.chip` in market_watch.html | Removed (use shared style.css) | ✅ |
| 27 | Missing tertiary-container CSS vars | ✅ | |

---

## Key Architectural Patterns

### Sheet Pattern (MD3 Bottom Sheet)
```css
.sheet {
    position: fixed; bottom: 0; left: 0; right: 0;
    max-width: 600px; margin: 0 auto;
    background: var(--md-surface-container-low);
    border-radius: 28px 28px 0 0;
    padding: 24px;
    z-index: 1000;
    transform: translateY(100%);
    transition: transform 0.4s cubic-bezier(0.1, 0.7, 0.1, 1);
    max-height: 100dvh;
    overflow-y: auto;
}
.sheet.active { transform: translateY(0); }

.sheet-display {
    height: 100dvh; max-height: 100dvh;
    display: flex; flex-direction: column; overflow: hidden;
}
// Inner content wrapper: <div class="scroll-y" style="flex:1; padding-bottom:20px;">
```

### AI Provider Router (`shared_ai.js`)
- Single entry point `callAIProvider(keys, prompt, systemPrompt)`
- Fallback chain: Gemini → Groq → OpenRouter → Cerebras → GitHub Models
- Retry logic (2 retries, exponential backoff)
- Key validation + sanitization

### CRUD Pattern
1. Read from `db` (localStorage via `safeLocalStorageGet`)
2. Mutate array/object
3. `saveData()` → `localStorage.setItem('appHubInvestDb', JSON.stringify(db))`
4. `renderAll()` to update UI

---

## Fix Log

| Date | File | Fix |
|------|------|-----|
| — | All HTML | Removed `user-scalable=no, maximum-scale=1.0` from viewport meta |
| — | All HTML | Added `&display=swap` to Google Fonts links |
| — | `style.css` | Added `--md-tertiary-container`, `--md-on-tertiary-container` vars |
| — | `style.css` | `.sheet` max-height: `92vh` → `100dvh` |
| — | `style.css` | `.sheet-display` height: `85vh` → `100dvh` |
| — | `style.css` | Snackbar bottom: `100px` → `16px` |
| — | `index.html:802` | Settings sheet: `85vh` → `100dvh` |
| — | `index.html:689` | Category sheet: uses `.sheet-display` class |
| — | `index.html` | 5 sheets: removed inline `max-height` overrides |
| — | `monthly_plan.html:1114` | `callAIProvider(db, …)` → keys object |
| — | `market_watch.html` | Removed duplicate `.section-title`, `.chip`, `.chip-group` CSS |

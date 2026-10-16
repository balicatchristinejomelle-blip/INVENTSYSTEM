# Final frontend UX / layout lock — 2026-10-15

Scope: frontend presentation only, on top of local commit `b0aae1f`. No working Date, Location, product-filter, inventory, storage, barcode, workflow or permission logic was rewritten.

## Root causes

**Narrow Date:** the legacy date-only `.record-filter-bar:not(:has(...))` rule set `width: fit-content`, while the same bar had `container-type: inline-size`. Size containment removes the child's intrinsic-width contribution. On date-only report/filter bars the computed width became **0px**, so period buttons stacked and “All dates” wrapped to single letters. This was reproduced in the actual sidebar/header app shell, not just an isolated filter fixture.

The fix gives Date-bearing bars an explicit full available width and full grid span/flex basis. Search, Date, Active Filters and nested controls occupy separate full-width rows. Period buttons retain consistent minimum dimensions; the middle range gets flexible width, ordinary word wrapping, and non-shrinking arrows/clear controls. Only the short All-dates label and individual buttons use scoped nowrap. No global nowrap or fixed tall Date height was added.

**Disappearing Sizes:** the earlier all-dropdown inventory facet resolver derived options from matching inventory, rather than missing Product Master arrays. That cause was already corrected in `b0aae1f`; this pass keeps that implementation byte-for-byte unchanged and verifies the zero-stock **280mm** case through the real Finished Goods screen.

## Size Master and data scope

The restored/retained data scope is **Size / Diameter master availability only**. No operational/demo records were restored or recreated. All requested values already exist in `src/productMaster.ts` and remain consumed through `productFilterSizes()` in `src/productFilters.ts`; no duplicated role-specific Size arrays were added.

- Standard: **13, 20, 25, 32, 40, 50, 63, 75, 90, 110, 160, 225, 280, 315, 355, 400, 450, 500mm**.
- CTS: **1/2", 3/4", 1"**.
- Spiral: **12", 16"**.
- **110mm remains active. 100mm was not added as a new active standard Size.** Historical records remain readable.
- Zero-stock Sizes remain selectable. Size options do not depend on inventory, Available stock, Date, Location, Search or pagination.
- Existing Product compatibility, PE80/PE100, five Products, Colors, nine SDR ratings, Lengths, Stripes and Locations A–I are unchanged. SDR / Thickness remains one field.

## Pages and roles audited

The full app shell was audited for all six roles on these **46 pages**:

- **Owner / Super Admin:** Company Dashboard; Plants & Departments; Operations & Records; Reports & Analytics; Complete Audit Log; Employees / Users & Access; Settings.
- **Accounting:** Dashboard; Raw Materials; RR Records; Branch Requests; Transfers; Inventory Transactions; Reports.
- **Marketing:** Dashboard; Customers; Orders; Finished Goods; MO & Tracking; Reports.
- **Management:** Dashboard; Operations; Employees / Attendance & Shift Assignment; Reports & Analytics; Audit Logs.
- **Plant Manager:** Dashboard; Production Orders; Pellet Inventory; Material Usage; Incoming Transfers; Main Plant Requests; Finished Goods; Rejected & Recycling; Attendance; Shift Turnover; Reports.
- **Production:** Dashboard; Production Orders; Pellets; Barcode Scanner; Finished Pipes; Recycling; Shift Turnover; History; Clock Out; Shift Attendance.

Additional focused probes cover Login, unsaved RR/Transfer/Customer Order/Material Request/Replenishment PO/Production Output forms, actual report Week navigation, RR details/back, zero-stock master selection, and manual scanner error handling. No form data is saved by these layout probes.

## Layout changes and retained working UX

- **Date:** full-width natural-height section, readable horizontal desktop controls, controlled smaller-screen wrapping, and sufficient range width. Existing actual-range arrow placement/calculation, anchor preservation and exact-date search are unchanged.
- **Product filters:** existing desktop 4+4 grid remains separate from Date. Compact Active Filters remains full width. No filter logic or dropdown option source was rewritten.
- **Quick Actions:** shared grid classes on Accounting, Marketing, Plant Manager and Production dashboards. Four actions use four equal desktop columns and tablet 2×2; existing three/six-action groups remain balanced; mobile stacks naturally. Button labels, actions, primary/secondary meanings and navigation arguments are unchanged.
- **Inventory summaries:** five label/value cards stay together. Desktop retains five columns; tablet uses centered 3+2 rather than 2+2+1; mobile uses two columns with the final total spanning the row. No count or inventory formula changed.
- **Tables:** all audited populated header/body cell counts align. Existing Available, Reserved, Temporary Storage, Ready for Ship Out and On Hand columns remain distinct. Existing centered numeric cells and internal table scrolling are retained; no table data/column logic needed replacement.
- **Material usage:** retained the working four detail cards followed by the full-width three-total summary. No orphan Summary card was reintroduced.
- **Scanner:** retained separated Current Operation/control layout, hardware capture, manual fallback, actionable error feedback and readiness for the next scan. No camera dependency or workflow changes.
- **Login:** removed only the redundant SYSTEM ACCESS informational card and reclaimed its margin/padding. Authentication, validation, forgot-password UI, RBAC and protected routes are untouched.
- **Other UX:** existing empty-state explanations, details/back state, clickable authorized references, related records, status aliases, validation/success messages, consequential confirmations, unsaved-change protection, duplicate-submission guards, read-only fields and ten-row pagination are retained. No new confirmation was added to filters, dates, details, tabs or pagination.
- **Notices/natural height:** retained working compact notice styles. Removed the Date-collapse-generated excess vertical height; no new fixed-height blank areas were introduced. Purposeful charts and scroll viewports are retained.

## Files changed

Application presentation:

- `src/index.css` — append-only scoped Date/Quick Action/summary sizing rules; the old stylesheet is retained as an exact prefix.
- `src/pages/Login.tsx` — remove the four-line informational card only.
- `src/pages/accounting/Dashboard.tsx`
- `src/pages/marketing/Dashboard.tsx`
- `src/pages/plantmanager/Dashboard.tsx`
- `src/pages/production/Dashboard.tsx` — these four files add Quick Action layout classes only.

Verification/reporting:

- `package.json` — add `check:layout-lock` and `qa:layout-lock:browser`.
- `scripts/layout-lock-baseline.mjs` — exact reviewed presentation deltas relative to `b0aae1f`.
- `scripts/check-layout-lock.mjs` — independent unchanged-logic/action/authentication/source checks.
- `scripts/check-layout-lock-browser.mjs` — full-shell, six-role, responsive and focused form/scanner/layout probes in temporary browser profiles.
- `scripts/recovery-baseline.mjs` — route the exact reviewed presentation-only deltas through the existing regression guard chain; original behavioral assertions remain intact.
- `docs/frontend-layout-lock.md` — this report.

## Verification

- TypeScript and production build pass. The existing non-fatal large-bundle advisory is unchanged in significance.
- All previous **1,846** regression checks pass; the new layout-lock suite adds **128** checks, for **1,974** total.
- Full-shell layout measurements cover **644** page/viewport/theme combinations: 46 pages × 7 widths × 2 themes. Widths: **360, 375, 390, 412, 430, 768 and 1280px**. Viewport transitions are allowed to settle before measuring or capturing screenshots.
- Six unsaved forms are measured at seven widths in both themes (**84** additional form combinations), without saving any records.
- Focused checks verify actual Week range navigation, detail/back behavior, all 18 standard Size options including zero-stock 280mm, no new 100mm option, and scanner error feedback with no inventory writes.
- Before/after report and scanner screenshots are generated in the temporary directory, outside the repository. Browser tests use isolated temporary profiles, never the user's live browser or saved localhost state.
- The existing development server at `http://127.0.0.1:8443` returns HTTP 200. It is not restarted or duplicated; isolated QA fixture servers are closed by their own test scripts.

## Required confirmations

**THE EXISTING DATE NAVIGATION LOGIC WAS NOT CHANGED. THE EXISTING LOCATION AUTOMATION LOGIC WAS NOT CHANGED.** Both implementations, their helpers, shared master/filter modules and the operational store are byte-identical to `b0aae1f`.

**THE RESTORED DATA SCOPE WAS SIZE / DIAMETER MASTER DATA. ALL STANDARD SIZE OPTIONS REMAIN RESTORED/AVAILABLE. CTS AND SPIRAL SIZES REMAIN AVAILABLE. 110MM REMAINS ACTIVE. 100MM WAS NOT ADDED. ZERO-STOCK SIZES REMAIN SELECTABLE. SIZE OPTIONS COME FROM MASTER DATA, NOT CURRENT INVENTORY.** No transactional restoration was performed.

**THE DATE SECTION NO LONGER OCCUPIES A NARROW FILTER-GRID COLUMN. ALL / DAY / WEEK / MONTH / YEAR REMAIN READABLE. “ALL DATES” DOES NOT WRAP ONE LETTER PER LINE. DATE/RANGE TEXT HAS SUFFICIENT WIDTH. DATE USES NATURAL HEIGHT. THE 4+4 GRID REMAINS SEPARATE. ACTIVE FILTERS REMAIN FULL WIDTH.**

**TABLE VALUES REMAIN IN THEIR CORRECT COLUMNS. THE FIVE INVENTORY BUCKETS REMAIN VISUALLY DISTINCT. QUICK ACTIONS AND SUMMARY CARDS ARE BALANCED. NO FIXED-HEIGHT BLANK AREAS WERE OBSERVED IN THE AUDITED NOTICE/FILTER SECTIONS. ALL SIX ROLES, DESKTOP, TABLET AND MOBILE WERE CHECKED.**

**NO TRANSACTIONAL DATA WAS RESEEDED. NO SO/MO/PO/BATCH/PIPE DATA WAS RECREATED. NO INVENTORY QUANTITY WAS RESET. NO PEP MAPPING WAS CHANGED. NO EXISTING BARCODE WAS REGENERATED. NO LOCALSTORAGE DATA WAS WIPED. NO BUSINESS LOGIC OR RBAC WAS CHANGED. NO DATABASE CHANGES. NO SQL. NO SUPABASE MIGRATIONS. NO RLS CHANGES.**

Git scope: commit locally on `fix/safe-restoration-location-only`; **no push and no merge**. Main remains at `9f6d47b82ae9dcf4d22d69259ff29b21c32688ac`.

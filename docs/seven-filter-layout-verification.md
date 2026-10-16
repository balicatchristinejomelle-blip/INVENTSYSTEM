# Seven-filter layout: parent-container fix

## Reproduced cause

At a 1280px viewport, the toolbar had 1000px available, but its three-column parent grid gave the nested `.inventory-facet-panel` only a 328px slot. That legitimately triggered the panel's narrow-container rule, producing **2 + 2 + 2 + 1** and clipping the Material Grade reset value. A combined-grid wrapper reproduced the same problem with a 326.7px slot.

The legacy/master path also had an older eight-track layout that indented the second row rather than spreading three controls across it. Combined wrappers could flatten that grid with `display: contents`. Testing only a standalone full-width inventory-facet grid did not catch these parent/legacy cases.

## Minimal fix

- `src/sevenFilterLayout.css` gives only seven-field inventory panels and their filter-control wrappers `grid-column: 1 / -1`, full available width and stretch alignment.
- Both existing shared paths use twelve equal tracks: the first four controls span three tracks each, and the last three span four tracks each. There are exactly seven real fields, with no fake placeholder cells.
- `src/components/ProductFilters.tsx` gives only the seven-field legacy/master variant a width-query wrapper. Other field counts retain their existing fragment and parent layout. Existing options, values, event handlers and filtering behavior are unchanged.
- `src/index.css` imports the new narrowly scoped stylesheet. No existing shared CSS rules were rewritten.
- Higher-specificity seven-field rules prevent older `display: contents`, offset child spans and viewport-only tablet rules from overriding the intended desktop grid.
- Below 760px of actual container space, two columns preserve full reset-label readability; mobile viewports at 600px or below stack one control per row. Both shared paths have a width-query boundary, so no viewport-only tablet fallback is needed. A sufficiently wide desktop container no longer inherits a two-column tablet layout.

## Verification

The dedicated browser test creates a unique temporary browser profile and Vite cache. It never reads or clears the user's existing browser/localStorage.

- Before/after screenshots reproduced and then removed the narrow-toolbar defect.
- **276 final browser surfaces/checks**: both inventory and master paths inside plain, PeriodSelector, card, toolbar and combined wrappers; twelve widths (360, 375, 390, 412, 430, 768, 800, 1000, 1024, 1100, 1280, 1440); actual authorized pages across all six roles in light/dark themes; and existing popup behavior for both paths under all six roles.
- Measures actual parent and grid width, row positions, equal second-row widths and both row edges, full-cell trigger width, canvas-measured text fit, closed-value centering, page overflow, opened search alignment and popup/trigger width.
- First post-fix pass: **232 checks, zero issues**. Final expanded pass: **276 checks, zero issues**. No runtime exceptions. Before/after toolbar, legacy-grid, actual desktop-shell and 360px mobile screenshots were visually inspected.
- `pnpm.cmd check:filter-layout`: **23 exact-scope/preservation checks passed**.
- TypeScript and `pnpm.cmd build`: passed.
- `pnpm.cmd dev` was run. Port 8443 was already occupied by the existing server, which was preserved. An HTTP check confirmed **200 OK** and the Vite client on that server.

The focused existing UI/filter/date/pellet/production regressions also passed: UI 259, smart inventory 203, dates 86, pellet masters 205 and production output 95. Together with the 23 new scope checks, **871 automated checks passed**.

## Final confirmation

- Desktop seven-filter layout is **4 + 3**; Length is not alone.
- Second row has three equal controls spanning the full row.
- **All Products**, **All Material Grades**, **All Colors**, **All Sizes**, **All SDRs**, **All Locations** and **All Lengths** remain unchanged and fit completely at the tested appropriate widths.
- All triggers fill their grid cells; there are no fake empty cells or stale desktop two-column fallback on a sufficiently wide container.
- Existing SearchableSelect is reused: closed value centered, opened search left aligned, popup at least trigger width.
- Mobile and genuinely narrow tablet/container layouts remain responsive.
- Already-correct filter counts/pages were not rewritten. No records, IDs, mappings, inventory quantities, sample data, barcodes, localStorage, Date logic, Location automation, Size/Length masters, inventory calculations or RBAC were overwritten or changed.
- The preceding uncommitted production-output implementation and pre-existing report edit were preserved. No commit, push or merge was performed for this layout request.

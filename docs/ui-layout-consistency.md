# System-wide UI layout consistency pass

Date: 2026-10-15. Baseline: `30ba566`. Branch: `frontend-ui-layout-consistency`.
Frontend/localhost presentation only. Commit and push this branch; **do not merge**.

## Implemented layout confirmations

- Main page search text and placeholders are left-aligned. A small search icon is positioned at the left using the input background. Searches remain single-line, normal-height, full-width controls above filter rows, not textareas.
- Closed searchable dropdown labels, placeholders and values remain centered. Open dropdown internal search text/placeholders are left-aligned. Portaled dropdown options have their own centered styling. Selection, clear, keyboard and filtering behavior are unchanged.
- Shared desktop filter/peer-card grids respond to their actual child counts: four → one row of four when space permits; five → 3+2 with a centered equal-width pair; six → 3+3; seven → 4+3; eight → 4+4; nine → 3+3+3. Single/two/three-control sections keep only their real controls.
- Filter-container queries reduce four controls to 2×2 when the container is too narrow. Narrow containers/tablets use two columns; mobile uses one. Existing conditional controls still come from the same page logic. No fake spacer controls, reserved empty rows, negative-margin layout fixes or new arbitrary absolute-position fixes were added.
- Filter boxes have natural content height and compact padding/gaps. Primary actions in existing toolbar/filter-row patterns occupy a separate action row rather than an unused filter column.
- Shared form/action rows place two actions apart: secondary left, primary right. Single primary actions stay right; single secondary/navigation actions stay left. Button text remains centered. Actions can stack full-width on mobile. Table action groups remain centered rather than inheriting the form layout.
- Existing centered table headers, cells, quantities, status, locations, dates, references, barcodes and action columns are preserved. Existing table scrolling/mobile record patterns are not replaced with clipping.
- Finished Goods metrics consistently place **Available → Reserved → Temporary Storage → Ready for Ship Out → On Hand** in balanced equal-width desktop columns. Each metric retains a label/value unit; long labels can wrap naturally without moving values to arbitrary heights. Additional awaiting/quality/rejected/shipped information is retained separately.
- `MetricCards` is a presentation-only renderer: callers still own all values and eligibility calculations. Owner, Management, Marketing, Plant Manager, Production and shared reporting views reuse the same metric structure/style where applicable.
- Automatic Material Usage on Production Dashboard now has exactly four equal-height detail cards: Virgin Pellets, Recycled Pellets, Base Colorant and Stripe Colorant. The aggregate Summary is outside that grid, full-width and compact, with three equal internal columns for pellet, colorant and material totals. The original prototype-rate informational note remains directly below it.
- Production turnover and the Plant Manager's turnover detail use the same full-width three-total Summary pattern. Their original values, fallbacks, No Stripe handling and arithmetic are retained.
- Current Operation has a dedicated left status/reference block and a separate right selector area with a 20px gap. The operation name is block-level rather than concatenated to the label. At narrower widths the status/control stack and the selector fills the row.
- Owner plant-stat labels no longer use a clipped maximum-height box. Shared natural grid rows align each label with its value. Peer cards retain balanced layouts; ordinary fifth cards are not automatically turned into aggregate summaries.
- Existing light/dark theme tokens, focus styles, pagination and responsive behavior remain in use. The shared CSS changes cover comparable controls/cards across all six roles; role-specific workflows were not rebuilt.

## Business and data preservation

No business logic, inventory calculations, automatic material usage calculations or RBAC were changed. No database changes were made.

The store, types, Product Master, PE80/PE100 rules, product filtering/matching, barcode generator/migration/parser, location master/business rules, storage purposes, inventory buckets, pipe relationships, reprint workflow, printable records, official document generation and role navigation are byte-for-byte unchanged from `30ba566`.

SearchableSelect, SearchableDropdown, ProductFilters, RecordSearch, PeriodSelector, Pagination, Modal and PrintAction implementations are also unchanged. All non-JSX calculations/state/callbacks/guards and all existing event-handler expressions in the twelve edited UI components/pages are checked against the baseline.

CO/SO/MO/PO, Groups, Batch, WIP, production quantities, pellet/colorant formulas, shipment, notifications, attendance, shifts, localStorage business state and existing physical records are preserved. No data wipe, reseeding, SQL, database migration or permission change was introduced. Existing image stashes and logo assets are untouched.

## Verification

All commands pass:

| Check | Count/result |
| --- | --- |
| `pnpm.cmd check:search` | 165 |
| `pnpm.cmd check:reprint` | 124 |
| `pnpm.cmd check:pipes` | 90 |
| `pnpm.cmd check:groups` | 70 |
| `pnpm.cmd check:grades` | 59 |
| `pnpm.cmd check:storage` | 76 |
| `pnpm.cmd check:barcodes` | 112 |
| `pnpm.cmd check:ui` | 105 |
| Total automated checks | **801** |
| `pnpm.cmd exec tsc --noEmit` | Pass |
| `pnpm.cmd build` | Pass; existing non-blocking large-chunk/plugin-time warnings |
| Existing development server | `http://localhost:8443` returns HTTP 200 |
| `git diff --check` | Pass |

The new UI suite checks desktop count-based grid models, responsive CSS rules for 360/375/390/412/430px, the no-active-PO Current Operation markup, four material detail cards followed by three Summary totals, six-role control/metric rendering, seventeen actual role pages, and unchanged source/handlers. A separate seven-pipe fixture verifies nonzero metric-to-label values **2 Available / 1 Reserved / 3 Temporary / 1 Ready / 7 On Hand**.

The existing running dev server was reused according to AGENTS.md; no duplicate `pnpm.cmd dev` process was started. Tests use isolated in-memory state and do not write fixtures into the live browser.

## Visual QA limitation — not certified

The computer-use skill was used to check available UI access. The native helper reported that its pipe was unavailable, browser inventory was empty, and creating an in-app browser reported unavailable.

Consequently, screenshots and interactive desktop/tablet/mobile/light/dark checks could not be performed. Reflow, wrapping, min-width guards, natural heights and explicit spacing are implemented and code/SSR-tested, but **absence of overlap, clipped text, page-level horizontal overflow, orphaned elements and large blank areas is not visually certified**. Those requested visual confirmations remain pending a connected browser; CSS models/SSR are not presented as screenshot evidence.

The branch is intentionally left unmerged for review. This task does not update or push main.

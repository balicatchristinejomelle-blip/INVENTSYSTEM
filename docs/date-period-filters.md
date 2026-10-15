# Calendar period filters

Record browsing now uses one shared Date control with **All, Day, Week, Month, Year**. All remains the initial view. Standalone filter calendars were removed, including the duplicate attendance calendar and inventory movement calendar.

Calendar boundaries use the application's business timezone, **Asia/Manila**. Day is a calendar day, Week is Monday–Sunday, Month uses actual month boundaries (including leap years), and Year is January 1–December 31. Zoned timestamps are converted to Manila before comparison; saved date-only values retain their existing calendar date.

The existing page Search accepts complete dates such as `10/08/2026`, `2026-10-08`, `Oct 8, 2026`, and `October 8, 2026`, without case sensitivity. An exact date takes precedence over the selected broad period. Clearing that search returns to the prior period. Invalid, incomplete, or reference-shaped queries remain normal text searches; `PO-2026-0072` and `BATCH-2026-0031` are never dates.

The active date scope is visible and can be cleared. Periods combine with existing product, grade, color, size, SDR, location, storage-purpose, status, and shift conditions. Pagination and memoized lists update when the scope changes. Date preferences remain scoped to the existing employee/role/page UI session; old standalone calendar preferences cannot leave an invisible filter active.

The six-role audit covers 31 comparable record and report pages: Owner/Super Admin, Accounting, Marketing, Management, Plant Manager, and Production. Pages with a local period control suppress the wrapper's control, so each page displays one date-period group. Plant Manager reports use one shared search above their report tabs. Operational clock-in, scanner, and data-entry workflows retain their existing controls.

No stored record dates, inventory formulas, store actions, business workflows, RBAC, backend, or database code changed. Product master and existing filter/dropdown implementations are unchanged; creation forms retain their master options. The three required business-entry date inputs remain intact. Stock/replenishment actions still use the full operational store rather than a date-filtered store.

Validation:

- Production build.
- All 11 repository validation suites, including 86 dedicated date checks for boundaries, leap years, complete-date formats, reference safety, precedence/reset, combined filters, original business files, and six-role page rendering.
- Headless Chrome checks of the actual shared component: period selection, exact-date precedence, clearing, Tab/Enter keyboard use, light/dark themes, and widths 360, 375, 390, 412, 430, 768, and 1280 pixels.
- Screenshot and overflow checks apply to the shared filter component; the 31 complete role pages are covered by server rendering rather than a full interactive page audit.

The older source-preservation suites retain their original comparisons through the repository's existing exact-reviewed-change guard pattern. Only the pinned date-filter deltas are accepted; arbitrary edits still fail. Runtime tests load the current app implementation, and the dedicated date suite independently checks that protected business files remain byte-for-byte unchanged.


Section 37 �w^~)�t horizontal period layout
-------------------------------------
The shared period toolbar now occupies the available parent width even when it contains no Search input. This overrides the legacy fit-content rule under inline-size containment, preventing a collapsed toolbar. Desktop/tablet period buttons stay in a compact horizontal row; mobile buttons retain balanced wrapping. Period summaries and full dates stay on one line, with local horizontal scrolling when needed. The summary stays directly below its buttons and before the warning, KPIs and tables.

Only scoped date-filter CSS changed. Day/calendar logic, Monday�w^~)�wSunday weeks, exact-date precedence, clear state, original dates, totals, warning thresholds, inventory formulas, database behavior, workflows and RBAC remain unchanged. Browser QA now mounts the actual Plant Manager Rejected & Recycling page at 360, 375, 390, 412, 430, 768 and 1280px, selects all five periods, checks summary lines and compact warning spacing, and confirms records/totals remain unchanged. Existing shared-component keyboard, search, theme and viewport tests remain in place; date regression checks cover all six roles.

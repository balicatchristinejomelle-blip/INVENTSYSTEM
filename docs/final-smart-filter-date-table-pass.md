# Final smart inventory filters, date navigation, and table pass

Frontend-only work based on `4f251f6` on `frontend-ui-layout-consistency`. Delivery requested: commit, push the feature branch, and merge it into `main`, retaining the earlier feature-branch history.

## Implementation

Inventory browsing now uses one deterministic, read-only facet helper and one shared field renderer. Product, Material Grade, Color, Size / Diameter, SDR / Thickness, Location, Storage Purpose, and Status occupy four equal desktop columns over two rows where applicable. Active Filters is outside that grid: a compact full-width strip with individual removal and Clear All. Narrow containers reflow without reserved blank rows; mobile controls use full-width fields so selected values remain readable. Dropdown labels/closed values/options are centered, while their internal searches and the main Search remain left aligned.

Each caller supplies its existing visible records, narrowed by the relevant search/date/category scope. Options are not taken from a global inventory or Product Master. Positive material location balances retain every actual matching location. Any facet can be selected first. Explicit selections are retained in deterministic newest-choice priority; incompatible older selections reset. A single fully known remaining value auto-selects; several values remain unselected with an explicit All Matching choice. Unknown historical metadata does not silently exclude otherwise matching records. Auto-selected values do not become permanent constraints on subsequent choices. Explicit chip removal/Clear All is respected until the next choice rather than immediately reselecting the cleared value.

Physical Finished Goods views, material inventories, Owner records, Management operations, comparable order/report browsing, and employee-scoped Production history share this implementation. Production personal-history options use the same existing employee/name constraints as its result lists. The optional master-based selector body remains exactly the same as before this pass; new-order, replenishment, specification, and receiving forms retain their complete valid Product Master options and their existing validation/actions.

The existing All/Day/Week/Month/Year control now has Previous/Next navigation and one visible active range. All remains available to preserve the unfiltered initial view. The initial anchor is the current Asia/Manila business date, not a demo constant. Day moves one calendar day, Week seven days with Monday–Sunday boundaries, Month one calendar month, and Year one calendar year. Month-end and leap-day moves clamp to the target month's last valid day. Switching period type preserves the anchor. Complete specific-date searches still override the broad period; reference IDs remain text searches. Navigation is disabled with an explanatory title while an exact-date search overrides it; clearing that search restores the existing period/anchor. Pages with a local period control publish that range to their wrapper's option source without introducing another navigator or changing operational store collections.

Plant Manager and Marketing By Batch tables no longer put Temporary Storage underneath Reserved. Available, Reserved, Temporary Storage, Ready for Ship Out, and On Hand have distinct headers/cells. The existing summary functions supply all values. Location-specific Stock Levels uses the same full labels and separate numeric cells. Production's individual pipe table also exposes the five separate bucket values. Mobile batch cards label each bucket individually. By Batch and location-stock browsing use the matching pipe subset rather than expanding a matching batch back to unrelated pipes. This changes the displayed filter scope, not the underlying inventory formulas, records, or quantities. Generic empty table bodies derive their span from the actual header when mounted.

Wide operational tables keep a native table layout and scroll inside their existing containers. The scoped rules override an older mobile rule that turned the table itself into a block scroller. No negative margins, empty spacers, overflow hiding, or global input centering were added.

## Verification

All 12 regression suites passed: Search 165; Reprint 124; Finished Pipe Relations 90; Product Groups 70; Grades 59; Storage 76; Barcodes/Locations 112; UI Layout 105; Complete UI 259; UX 365; Date Periods 86; Smart Inventory 203. Total: **1,714 checks**. TypeScript (`pnpm.cmd exec tsc --noEmit`) and `pnpm.cmd build` passed.

The new independent smart suite checks all existing source against the pre-pass baseline or an exact reviewed filter/presentation delta, verifies unchanged business-action arguments, compares the original master-selector body, exercises facet combinations/invalid selections/unique and multiple options, checks calendar navigation and specific/reference searches, and renders inventory/report/history variants across all six roles. Older source-preservation suites retain their pinned comparisons through the repository's existing reviewed-delta guard pattern. Arbitrary edits still fail; protected business files are not normalized away.

`pnpm.cmd qa:smart:browser` passed using installed Edge with a unique temporary browser profile and isolated localhost fixtures. It exercised SDR-first and Location-first interaction, unique auto-selection, actual A/C/F options with All Matching Locations, Clear All, calendar navigation, December/January transitions, visible labels, and native Enter-key activation. It measured the shared panel and actual inventory page content for Owner/Super Admin, Accounting, Marketing, Management, Plant Manager, and Production in both themes at **360, 375, 390, 412, 430, 768, and 1280 pixels**. Checks covered desktop 4 + 4, full-width chips, left-aligned search, numeric alignment, internal table scrolling, one navigator per page, populated header/body cell counts, and no measured page-level horizontal overflow. Representative light-mobile and dark-desktop screenshots were inspected; all four shared-panel screenshots remain in the temporary directory.

Browser QA found and corrected the initially over-tall mobile chip strip and the old mobile table-block rule. The connected browser/native desktop helper was unavailable, so this was isolated headless browser QA—not a live-user-profile, full-navigation-shell, every-modal, or physical-scanner certification. Source/SSR audits cover more page variants than the interactive browser run; no claim is made that every possible record, dialog, or viewport was manually inspected. The existing development server at `http://localhost:8443` returned HTTP 200 and was reused; no duplicate long-running dev server was started.

## Required confirmations

- ACTIVE FILTERS IS A COMPACT FULL-WIDTH STRIP.
- ACTIVE FILTERS DOES NOT OCCUPY A FILTER-GRID COLUMN.
- THE EIGHT MAIN FILTERS USE 4 + 4 ON DESKTOP WHEN WIDTH ALLOWS.
- ALL APPLICABLE INVENTORY DROPDOWNS CROSS-FILTER EACH OTHER through the shared, caller-scoped facet implementation.
- FILTERS MAY BE SELECTED IN ANY ORDER.
- A UNIQUE REMAINING FILTER OPTION AUTO-SELECTS, except an explicit user clear is respected and missing historical metadata is not guessed.
- MULTIPLE REMAINING OPTIONS ARE NOT GUESSED.
- INVALID FILTER SELECTIONS RESET WHEN THEY BECOME IMPOSSIBLE.
- LOCATION IS DERIVED FROM ACTUAL MATCHING INVENTORY.
- MULTI-LOCATION PRODUCT STOCK REMAINS SUPPORTED.
- FILTERING NEVER MOVES INVENTORY.
- NEW RECEIVING STILL REQUIRES THE NORMAL LOCATION SELECTION.
- CREATION FORMS STILL USE PRODUCT MASTER OPTIONS.
- ZERO-STOCK PRODUCT MASTER OPTIONS REMAIN AVAILABLE WHERE VALID.
- DAY / WEEK / MONTH / YEAR HAVE PREVIOUS AND NEXT NAVIGATION.
- DAY NAVIGATES ONE CALENDAR DAY AT A TIME.
- WEEK NAVIGATES ONE MONDAY–SUNDAY WEEK AT A TIME.
- MONTH NAVIGATES ONE CALENDAR MONTH AT A TIME.
- YEAR NAVIGATES ONE CALENDAR YEAR AT A TIME.
- THE CURRENT DATE/RANGE IS CLEARLY DISPLAYED, including All dates when no date restriction is selected.
- SWITCHING PERIOD TYPE PRESERVES THE CURRENT ANCHOR DATE.
- A SPECIFIC DATE CAN STILL BE SEARCHED THROUGH THE MAIN SEARCH.
- REFERENCE IDS ARE NOT MISINTERPRETED AS DATES.
- REQUIRED BUSINESS-ENTRY DATE FIELDS WERE NOT REMOVED.
- AVAILABLE, RESERVED, TEMPORARY STORAGE, READY FOR SHIP OUT, AND ON HAND EACH USE THEIR CORRECT DISTINCT COLUMN WHERE APPLICABLE.
- TEMPORARY STORAGE IS NOT REPEATED AS ROW CONTENT WHEN IT IS A BUCKET HEADER; an intentional separate Status/purpose field can still show that text.
- THE RESERVED COLUMN CONTAINS ONLY ITS CORRECT DATA.
- HEADER AND BODY CELL COUNTS/ORDER MATCH in the audited populated table variants; generic empty bodies attach their span to the mounted header.
- UNRELATED INVENTORY VALUES NO LONGER STACK IN ONE CELL in the corrected bucket tables.
- NUMERIC VALUES REMAIN CENTERED AND READABLE.
- WIDE TABLES USE INTERNAL HORIZONTAL SCROLL WHEN NECESSARY.
- THE ENTIRE PAGE DOES NOT HORIZONTALLY OVERFLOW in the browser-tested role-page content and widths described above.
- ALL SIX ROLES WERE CHECKED FOR THE SAME FILTER, DATE, AND TABLE ISSUES.
- LIGHT MODE REMAINS CORRECT in the browser-tested changed components/views.
- DARK MODE REMAINS CORRECT in the browser-tested changed components/views.
- NO INVENTORY CALCULATIONS WERE CHANGED.
- NO PRODUCT MASTER DATA WAS CHANGED.
- NO BARCODE LOGIC WAS CHANGED.
- NO LOCATION MOVEMENT LOGIC WAS CHANGED.
- NO STORAGE LOGIC WAS CHANGED.
- NO MO / PO / SO LOGIC WAS CHANGED.
- NO RBAC WAS CHANGED.
- NO LOCALHOST DATA WAS WIPED.
- NO DATABASE CHANGES WERE MADE.

The store, business types, product/grade masters, product matching utilities, pipe/source relationships, production grouping, barcode/migration/reprint logic, location/movement/storage/inventory functions, role routing, universal-search authorization, Sidebar, and backend/database files are unchanged from this pass's starting commit. Existing logo stashes remain untouched. No new operational data, stock movements, duplicate inventory, schema changes, or API writes were introduced.

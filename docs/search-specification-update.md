# HPAI search and pipe specification update

The latest supplied brief defines SDR as the pipe thickness specification and defines four active Material Grade choices: HDPE Standard, PE100, Commercial Grade (CGPE), and CTS Grade. This replaces the earlier PE80/PE100 selector requirement. Existing PE80 records retain their historical grade text.

## SDR and pipe selectors

The audit found no separate editable thickness field duplicating SDR. `wallThicknessM` in the production mass calculation is a derived physical measurement and remains unchanged. “Incorrect Thickness” remains a quality rejection reason.

User-facing SDR labels now read `SDR / Thickness` in Customer Orders, both Production Order modules, Product Specification Settings, Finished Pipes, Finished Goods details, Production Dashboard, ManufacturingOrderDetails, and the SO/MO/PO document printers. Combined specifications use one SDR value.

`src/components/SearchableSelect.tsx` renders the Size dropdown and all new specification selectors. `src/components/SearchableDropdown.tsx` adapts the remaining existing dropdowns to the same component while retaining their option values, disabled choices, and change handlers. There are no native select or datalist elements left in page components.

The shared master is `src/productMaster.ts`. Standard Size choices are:

13mm, 20mm, 25mm, 32mm, 40mm, 50mm, 63mm, 75mm, 90mm, 110mm, 160mm, 225mm, 280mm, 315mm, 355mm, 400mm, 450mm, 500mm.

CTS choices are 1/2", 3/4", 1". Spiral choices are 12", 16". Polytube operational choices come from configured specifications.

Straight Length choices are 5m, 5.5m, 5.86m, 6m, 8.873m, 10m. Coil choices are 25m, 30m, 50m, 60m, 90m, 100m, 150m, 200m, 250m, 300m, 350m.

SDR choices are SDR9, SDR11, SDR13.5, SDR13.6, SDR17, SDR21, SDR24, SDR26, SDR33.

New Customer Order, Product Specification, and direct Stock Replenishment PO Size fields use the master rather than stock records. HDPE/Commercial expose all 18 Standard Sizes. The direct replenishment Size field becomes available immediately after Product Type selection. There is no active Standard 100mm choice or first-item size default.

Opening a combobox renders the full applicable list. Search supports partial, case-insensitive, space-insensitive matching; clearing restores the list. Keyboard controls support arrows, Enter, Escape and Tab. Option menus scroll internally, render outside clipped panels, and account for the mobile visual viewport and keyboard. Theme colors use the existing Light/Dark variables.

Converted selectors include Product Type, Material Grade, Size, SDR/Thickness, Form, Straight/Coil Length, Color, Stripe, Construction, Customer, PO, Material Request, Storage Location, Employee/Role, production line, priority, date/time preferences, and all existing record/status/location/report/scanner filters. Inventory Class, Stock Type and Barcode Type remain shared master constants; the existing app has no independent editing dropdowns for them to convert.

## Record search coverage

Each record module uses one main search field. Search runs against the page's authorized source before pagination, matches relevant public record fields, and excludes credentials. Search changes reset pagination while retaining tabs, dates and filters.

Pages receiving new or broader search:

- Owner: Dashboard, Plants & Departments, Records, Reports, Users & Access, Settings.
- Accounting: Dashboard, Branch Requests, Transfers, RR Records, Raw Materials, Transactions, Reports.
- Marketing: Dashboard, Customers, Customer Orders, MO Tracking, Finished Goods (batch and individual views), Reports.
- Management: Dashboard, Operations, Employees/Attendance, Audit Logs, Reports.
- Plant Manager: Dashboard, Production Orders, Material Inventory, Materials & Requests, Incoming Transfers, Material Usage, Finished Goods (batch and individual views), Attendance, Shift Turnover, Rejected/Recycling, Reports.
- Production: Dashboard, Production Orders, Pellet/Colorant Inventory, Finished Pipes, Recycling, History. Barcode lookup is available through inventory search and Universal Search, separate from hardware scanning.
- Shared: Notification history and Universal Search.

Single-record forms such as Clock Out, Profile, Shift Attendance and the current shift handover do not receive redundant page search fields.

Tables and record cards are limited to ten matches per page. Pagination displays counts and Previous/Page/Next controls even when only one page matches. Search in report collections also updates the associated summaries/charts.

Universal Search groups authorized records by type, paginates matches, and opens the exact selected record in a read-only detail dialog. It uses an explicit role/collection allowlist, preserves Management's protected audit exclusions, restricts Production history to the current employee, and excludes administrative and raw-material records from Marketing. The detail dialog offers navigation to the authorized module.

## Verification

Run `pnpm exec tsc --noEmit`, `pnpm run check:search`, and `pnpm run build`.

Final results on 2026-10-13: TypeScript passed, the production Vite build passed, and 165 regression checks passed. There is no configured lint command. The bundled oxfmt 0.2 formatter removed required separators from inline TypeScript types; the invalid output was repaired and revalidated. Do not count its initial formatting run as a successful validation check.

The regression check verifies official master lists, partial searches (315, 13, 3/4, 16, 5.86, 250), clearing, numeric sorting, credential exclusion, six-role search access, 10/10/3 pagination for 23 matches, page search coverage, absence of native selects, and server rendering of the updated pages.

Interactive browser screenshots at 360/375/390/412/430px and Light/Dark mode could not be captured: Computer Use returned `Computer Use was not approved to use Microsoft Edge`. These device-specific visual checks remain unverified; code, data, role and render checks are automated.

NO DATABASE CHANGES. NO SQL. NO SUPABASE MIGRATIONS. NO RLS. No backend implementation.

## Publication

The first push was rejected because the GitHub repository exceeded its Git LFS budget. The two 23,633-byte PNG logos retain their exact contents and now have file-specific regular-Git exceptions in `.gitattributes`. Publication uses a fresh branch from `main` containing the completed changes, so the unpublished LFS-pointer commits are retained locally rather than included in the remote history. Existing LFS rules for all other files are unchanged.

# Finished Pipe barcode and A–I location update

Frontend/localhost only. Verification date: 2026-10-14. Baseline: `cd18191`.

## Required 36-item report

1. **Previous barcode:** Finished Pipes used `PIPE-{year}-{batch/sequence}-{piece}` as both the physical barcode and the displayed Pipe Record ID. Pellet generation was separate.
2. **Generator:** `finishedPipeBarcodes.ts` generates a specification prefix plus a deterministic global `SN###`. `makePermanentFinishedPipes` keeps the existing internal ID scheme and uses this separate physical value for new production output.
3. **Parser:** `parseFinishedPipeBarcode` reconstructs diameter, length, SDR, pipe color, stripe, and serial. Ambiguous or malformed values do not resolve as a new-format barcode.
4. **Size:** Millimetres retain the numeric size. Inch sizes use `I1D2`, `I3D4`, `I1`, `I12`, or `I16`. Other configured size text has a reversible ASCII-safe UTF-8 hex encoding. Displayed specifications are unchanged.
5. **Length:** The second numeric component is length in metres. `5.5m` becomes `5P5`; it is not truncated or interpreted as another diameter.
6. **SDR:** Decimal SDR values use `P`: `13P5` and `13P6` decode distinctly. Explicit `X` field boundaries are used for decimal, inch, custom, or ambiguous/non-master combinations. Unambiguous integer master combinations retain the requested compact form.
7. **Pipe color mapping:** One shared mapping: Black → B, Blue → BE, Orange → O, Red Orange → RO, Green → G.
8. **Stripe mapping:** One shared mapping: No Stripe → N, Blue Stripe → B, Orange Stripe → O, Green Stripe → G, Black Stripe → BK.
9. **Serials:** Sequence allocation checks registered/current physical values and a persisted high-water mark. Production and the fresh replenishment sample honor that mark. Migration orders records by stable record ID. No random serials.
10. **Duplicates:** Complete barcode and serial collisions are prevented/repaired during migration; duplicate lookup results are blocked as ambiguous. Empty lookup is not a legacy alias. Stale Finished Pipe registry aliases are removed even when pipe barcodes are already modern.
11. **Files:** See the grouped file inventory below. No Product Master, recipe, role navigation, reprint approval engine, official document content, or Code 128 encoder changes.
12. **Location master:** `locationMaster.ts` defines the nine active sample locations A–I with stable IDs, codes, names, status, plant, and compatible storage types. Existing Settings uses the same normalized master. Custom user-configured master records are retained; old built-in destinations are retained as inactive historical entries.
13. **Finished Goods:** Plant Manager and Marketing receive shared specification/color/location filters and location-specific stock tables. Their batch views retain only the selected location's physical pipes. Owner, Management, and Production retain directly visible current-location results where applicable.
14. **Raw receiving:** Accounting RR, Plant Manager incoming-transfer acceptance, and Production individual bag receiving select physical locations. Raw-material inventory pages display current locations; colorant balances can span multiple locations without duplicating the aggregate record.
15. **Required location:** Missing final receiving location blocks mutation. Receiving forms show exactly `Storage Location is required.` RR and completed transfer receipts record the selected location; stock enters at that location.
16. **Search:** Existing case-insensitive/partial record search also sees the new barcode, internal Pipe Record ID, full specification, physical location, source relationships, and migration audit history. An old scan is read-only traceability, not an active barcode or a stock action.
17. **Product:** Existing shared Product Master remains the filter source, including zero-stock choices. Filtering is read-only and precedes pagination.
18. **Color:** Shared canonical colors drive Finished Pipe and raw-material filters. Historical plain color labels and master labels with code suffixes match consistently.
19. **Size:** Existing complete product-specific size domains remain unchanged and searchable; no record-derived size master was introduced.
20. **SDR:** Existing shared SDR/Thickness choices remain unchanged, including both decimal SDR values.
21. **Location filter:** All Locations and active A–I options come from the master, not from result rows. The explicit Location dropdown is authoritative: C does not match C occurring inside a word, barcode, or origin reference.
22. **Multi-location quantities:** Isolated physical fixtures A10/C15/F8 sum to 33. Selecting C returns 15, paginated 10/5. Shared summaries deduplicate physical barcode identities. Colorant A10/C5 returns 15 for All and 5 for C. Company-wide low-stock/replenishment target calculations remain company-wide; the added physical-location stock table is separate.
23. **Internal movement:** Existing compatible Finished Pipe movement remains PM-only. The PM pellet detail view exposes the existing logged-in movement callback with a required reason. B → E changes location and adds movement history/audit, with unchanged bag quantity/barcode and no additional Stock In/Out. Production recipe arithmetic is unchanged; colorant location balances follow the existing consumed quantity using deterministic alphabetical bookkeeping.
24. **Desktop:** Shared filter controls use three equal columns. Six Finished Pipe controls are Product/Material Grade/Color, then Size/SDR/Location. Existing optional Length remains an additional control. A final pair is centered at equal one-third widths; a single final control is centered. Search retains its own full-width row.
25. **Tablet:** At 900px and below, shared controls use two columns; normal desktop above that breakpoint does not default to two columns.
26. **Mobile:** At 600px and below, shared controls use one column, including the requested 360/375/390/412/430 widths. Existing compact/centered, min-width, theme, and table-scroll behavior is retained. These are CSS/markup assertions, not a completed visual or interactive overflow test.
27. **Owner:** Records/search enrichment, current location columns, raw/Finished Pipe filtering, and shared controls were checked with the Owner context. No new editing/approval authority.
28. **Accounting:** RR required-location behavior and Stock In were executed; raw-material and transaction pages rendered with Accounting context. Existing Accounting permissions are unchanged.
29. **Marketing:** Availability, location breakdown, individual/batch filtering, and existing source/availability rules were checked. Temporary, rejected, awaiting-storage, reserved, and shipped stock do not become allocatable because of location selection.
30. **Management:** Operations and Reports rendered with Management context. Shared inventory filters and current locations do not change Management's approval permissions.
31. **Plant Manager:** Finished Goods, Stock Levels, batches, raw materials, incoming transfers, Reports, required receiving location, and existing compatible pipe/bag movement were checked.
32. **Production:** Finished Pipes/Pellets rendered with Production context. Actual obsolete-barcode scan handling was executed and stopped before registry/action access. Individual receiving, production output, storage read-only restrictions, loading, and shipment boundaries were checked. Production cannot edit the location master.
33. **Migration:** Full migration includes printed, pending/approved/rejected/used reprint references, unprinted, demo, and operational Finished Pipe records. Each pipe retains its ID, Item Code, specification, CO/MO/PO, batch, origin, storage purpose/location, statuses, quantities, and history. Audit entries contain oldBarcode/newBarcode/migratedAt/migrationReason. Reprint reference values become the new barcode without changing approval states, actors, reasons, timestamps, or print counts. Deterministic sample-only raw location assignment never assigns a fake location to pending or actual user-entered records. Existing historical physical locations remain readable. Migration runs safely during hydration and is idempotent; no localStorage wipe or wholesale state regeneration.
34. **Build:** `pnpm.cmd exec tsc --noEmit` and `pnpm.cmd build` pass. Vite retains its existing non-blocking large-chunk/plugin-time warnings.
35. **Dev server:** The already-running server at `http://localhost:8443` returns HTTP 200. Per AGENTS.md it was reused; no duplicate `pnpm.cmd dev` process was started.
36. **Regression:** 696 automated checks: search 165, reprint 124, pipe relationships 90, groups 70, grades 59, storage 76, and barcode/location 112. Full master round-trip loops and focused callback tests also run inside these checks. Exact reviewed-delta baselines continue guarding unrelated source. Browser inventory was empty and opening the in-app browser reported unavailable; interactive desktop/mobile/light/dark visual QA and a physical Honeywell/printer test remain unverified.

## Explicit confirmations

Finished Pipe physical barcode format **was changed**. `2015011BG-SN001` means **20mm size, 150m length, SDR11, Black Pipe, Green Stripe, serial SN001**. Every migrated/generated valid physical Finished Pipe has a unique complete new barcode; its Pipe Record ID remains separate. CODE 128 and the existing USB HID/no-camera scanner flow are preserved. Pellet bag barcodes were not changed.

Old physical Finished Pipe labels are **obsolete**, including already-printed labels. They must be replaced using the existing authorized reprint workflow, printing the **new** active barcode. An old scan shows `Legacy barcode. This Pipe has been migrated to: [NEW BARCODE]` and the current read-only pipe details. It cannot release, load, receive, or create a pipe. No barcode migration adds stock, inventory movements, quantities, or physical records. Migration audits are traceability only; old values are not active aliases.

The active sample locations are **A, B, C, D, E, F, G, H, I**. To preserve existing source-compatible storage rules, A–F are general Finished Goods zones, G/H are Temporary Finished Goods zones, and I is Ready for Ship Out; raw receiving can use all nine. Storage Purpose remains separate from location. Previously confirmed historical destinations remain on records, rather than being silently relocated. Custom user master entries are not discarded.

New material receiving requires a storage location. Inventory retains current location and displays it directly in relevant results. Product, Color, Size, SDR, and Location are searchable/filterable where applicable. Identical products may exist in multiple locations without false quantity aggregation. Internal location movement creates neither duplicate stock nor Stock Out. Only existing shipment/release logic removes Finished Goods stock; reservation, temporary storage, readiness, and loading do not.

Shared desktop filter grids use three controls per row, full-width search above, and existing compact centered controls; tablet may use two columns and mobile uses one. All six roles share the location master within existing permissions. Visual overflow/theme certification is explicitly not claimed without a connected browser.

Active Material Grades remain **PE80/PE100**. Material Grade, Product Master/specification validity, PEP codes, Origin Group, source-derived Storage Purpose, CO/MO/PO, recipe/unit-weight/consumption arithmetic, inventory eligibility/low-stock calculations, reprint approval rules, attendance/shifts/recycling/notifications, and RBAC were not changed by this task. Location bookkeeping was added alongside, not substituted for, existing consumption quantities. Localhost data was not wiped. **No database changes, SQL, Supabase migrations, or RLS.**

## File inventory

- Shared logic/types: `src/finishedPipeBarcodes.ts`, `src/locationMaster.ts`, `src/finishedGoodsInventory.ts`, `src/productFilters.ts`, `src/store.tsx`, `src/types.ts`.
- Shared UI/styles: `src/components/FinishedPipeDetails.tsx`, `ProductFilters.tsx`, `RecordSearch.tsx`, `LegacyBarcodeNotice.tsx`, `LocationSelect.tsx`, `LocationStockBreakdown.tsx`, `MaterialLocationFilters.tsx`, and `src/index.css`.
- Accounting: `src/pages/accounting/RRRecords.tsx`, `RawMaterials.tsx`, `Transactions.tsx`.
- Management: `src/pages/management/Operations.tsx`, `Settings.tsx`.
- Marketing/Owner: `src/pages/marketing/FinishedGoods.tsx`, `src/pages/owner/Records.tsx`.
- Plant Manager: `src/pages/plantmanager/FinishedGoods.tsx`, `IncomingTransfers.tsx`, `PelletInventory.tsx`, `Reports.tsx`.
- Production: `src/pages/production/BarcodeScanner.tsx`, `FinishedPipes.tsx`, `Pellets.tsx`.
- Verification: `package.json`, `scripts/barcode-location-baseline.mjs`, `check-barcodes-locations.mjs`, `storage-inventory-baseline.mjs`, `check-storage-inventory.mjs`, `check-material-grades.mjs`, `check-pipe-relations.mjs`, `check-product-groups.mjs`, and this report.

The existing local image stashes and unrelated logo assets are preserved. No fixtures from verification are written into the live browser's storage.

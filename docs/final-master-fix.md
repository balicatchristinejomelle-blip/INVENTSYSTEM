# Final Master Fix — 2026-10-15

## Cause and resolution

The Size / Diameter values had not been deleted from Product Master. The old `resolveInventoryFacets()` calculated every dropdown's options from matching inventory rows and inferred other specification selections. Selecting SDR, Grade, Color or Location could therefore hide valid zero-stock Sizes.

The fix restores access to the existing Size / Diameter master options. `InventoryFacetFields` now receives explicit master-backed options. Only `resolveInventoryLocations()` derives choices from the caller's already-authorized current inventory. No duplicate per-role Size arrays or transactional restoration were added.

The previously verified recovery changes already implement this brief. They were reviewed against the Final Master Fix requirements and are included in the requested local commit; this task does not restart the larger demo restoration effort.

## Shared sources

- `src/productMaster.ts`: `STANDARD_DIAMETERS_MM` / `STANDARD_DIAMETER_OPTIONS`, `CTS_SIZES`, `SPIRAL_PIPE_SIZES`, shared Products, PE80/PE100, Colors and all nine SDR ratings. This file is unchanged from the pre-recovery repository version.
- `src/productFilters.ts`: `productFilterSizes()` applies master Product compatibility and reads configured active Polytube sizes. Its option logic does not use inventory, date, Location or search results.
- `src/components/ProductFilters.tsx` and `MaterialLocationFilters.tsx`: use these shared masters across applicable screens for all six roles.
- `src/inventoryFacets.ts`: `resolveInventoryLocations()` computes only physical Location options; one matching Location auto-selects, multiple show All Matching Locations, zero show No Matching Locations while retaining the chosen Size and other specifications. With no specification constraints, the shared A–I/custom Location configuration remains available.
- `src/components/PeriodSelector.tsx`: period-type buttons select All/Day/Week/Month/Year; a separate row underneath places arrows around the actual displayed range. `src/datePeriods.ts` retains the existing calendar arithmetic and exact-date parsing.

## Files included

Application source:

- `src/App.tsx`
- `src/components/InventoryFacetFields.tsx`
- `src/components/MaterialLocationFilters.tsx`
- `src/components/PeriodSelector.tsx`
- `src/components/ProductFilters.tsx`
- `src/inventoryFacets.ts`
- `src/locationMaster.ts`
- `src/pages/marketing/FinishedGoods.tsx`
- `src/pages/owner/Records.tsx`
- `src/pages/plantmanager/FinishedGoods.tsx`
- `src/pages/plantmanager/Reports.tsx`
- `src/pages/production/FinishedPipes.tsx`
- `src/smartInventory.css`
- `src/store.tsx`

Verification/documentation:

- `package.json`
- `scripts/barcode-location-baseline.mjs`
- `scripts/check-date-periods.mjs`
- `scripts/check-smart-inventory-browser.mjs`
- `scripts/check-smart-inventory.mjs`
- `scripts/smart-inventory-baseline.mjs`
- `scripts/check-recovery.mjs`
- `scripts/recovery-baseline.mjs`
- `docs/interrupted-task-recovery.md`
- `docs/final-master-fix.md`

The recovery report documents the individual interrupted edits and startup-safety corrections. All operational callbacks, transactional seed definitions, PEP mapping behavior, inventory calculations, barcode/reprint engines and manual transaction destination components remain protected by the regression checks.

## Required confirmations

THE RESTORED DATA IN THIS TASK WAS SIZE / DIAMETER MASTER DATA: access to existing master options was restored, not transactional/demo records.

- STANDARD SIZE OPTIONS WERE RESTORED: 13, 20, 25, 32, 40, 50, 63, 75, 90, 110, 160, 225, 280, 315, 355, 400, 450 and 500mm.
- CTS SIZE OPTIONS WERE PRESERVED / RESTORED: 1/2", 3/4", 1".
- SPIRAL SIZE OPTIONS WERE PRESERVED / RESTORED: 12", 16".
- 110MM IS ACTIVE. 100MM WAS NOT ADDED AS A NEW ACTIVE STANDARD SIZE. Historical records are not deleted.
- ZERO-STOCK SIZES REMAIN SELECTABLE. SIZE OPTIONS COME FROM PRODUCT MASTER, NOT CURRENT INVENTORY.
- PRODUCT, MATERIAL GRADE, COLOR, SIZE / DIAMETER AND SDR / THICKNESS ARE NOT INVENTORY-NARROWED. Active grades remain exactly PE80 and PE100; all nine SDR ratings remain available in one SDR / Thickness field.
- ONLY LOCATION IS INVENTORY-AWARE. ONE MATCHING LOCATION AUTO-SELECTS. MULTIPLE MATCHING LOCATIONS SHOW ALL MATCHING LOCATIONS. ZERO MATCHING LOCATIONS DOES NOT REMOVE THE SELECTED SIZE.
- LOCATION FILTERING DOES NOT MOVE INVENTORY or change its totals, Batch, Group or Storage Purpose. TRANSACTION DESTINATION LOCATIONS REMAIN MANUAL.
- Storage Purpose and Status remain independent. Search/date filters do not rewrite specification master options.
- DAY / WEEK / MONTH / YEAR ONLY SELECT PERIOD TYPE. PREVIOUS / NEXT ARROWS NAVIGATE THE ACTUAL DISPLAYED DATE/RANGE underneath those controls.
- DAY MOVES ONE CALENDAR DAY. WEEK MOVES ONE MONDAY-SUNDAY WEEK. MONTH MOVES ONE CALENDAR MONTH, including year transitions. YEAR MOVES ONE CALENDAR YEAR. Switching modes preserves the anchor date where practical.
- ALL HIDES DATE NAVIGATION. SPECIFIC DATE SEARCH STILL WORKS. PO/MO/Batch references are not parsed as dates. DATE AND LOCATION FILTERING WORK TOGETHER on authorized records.
- The full-width search and compact full-width Active Filters strip remain outside the balanced desktop 4+4 specification grid. Separate inventory-bucket table columns remain intact.
- NO CUSTOMER DATA WAS RESEEDED. NO SO, MO, PO, BATCH OR FINISHED PIPE DATA WAS RECREATED. NO INVENTORY QUANTITY WAS RESET.
- NO PEP MAPPING WAS CHANGED OR INVENTED. NO IDs OR EXISTING ACTIVE BARCODES WERE REGENERATED. Existing barcode migration logic was not modified.
- LOCALSTORAGE WAS NOT CLEARED. NO DATABASE CHANGES. NO SQL. NO SUPABASE MIGRATIONS.

## Verification and Git scope

Verification covers TypeScript, production build, 1,846 regression checks, isolated real-browser interactions, all six roles, desktop/tablet and 360/375/390/412/430px widths, both themes, date keyboard/navigation behavior, and two real reloads preserving modified test inventory. The only build advisory is the existing non-fatal large-bundle warning.

The existing development server is already running at `http://127.0.0.1:8443`; its HTTP response is checked without restarting it or starting a duplicate server, following the repository instructions. Browser QA uses a temporary isolated profile, not the user's live saved state.

User-authorized Git operation: **commit locally only** on `fix/safe-restoration-location-only`. **No push. No merge. Main is not changed.**

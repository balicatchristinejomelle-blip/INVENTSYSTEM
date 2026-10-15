# Interrupted-task recovery — 2026-10-15

Scope: frontend/localStorage safety and shared filter UI only. The larger canonical/demo restoration task was not resumed. No canonical files are needed to complete this recovery.

## 1. Interrupted files inspected

The working tree initially contained 13 modified source files. Every diff was inspected before further editing.

| Interrupted file | Recovery disposition |
| --- | --- |
| `src/App.tsx` | Retained and completed the saved-data error boundary; unreadable state shows a recovery message instead of being replaced. |
| `src/components/InventoryFacetFields.tsx` | Completed master-supplied options and Location-only inference; explicit Location chip removal stays clear until its specification/location context changes. |
| `src/components/MaterialLocationFilters.tsx` | Completed shared grade/color/location option sources and independent lifecycle status choices. |
| `src/components/ProductFilters.tsx` | Completed shared Product/Grade/Color/Size/SDR/Length sources, Product compatibility, and independent Purpose/Status callbacks. |
| `src/inventoryFacets.ts` | Replaced all-dropdown cross-filtering with a read-only Location resolver. Added current-stock, color-code, historical Product-alias and configured sublocation compatibility. |
| `src/locationMaster.ts` | Kept additive/idempotent A–I configuration hydration, preserved existing location records/statuses, and exposed configured names/codes for read-only filters. |
| `src/pages/marketing/FinishedGoods.tsx` | Retained explicit existing status vocabulary as independent options. |
| `src/pages/owner/Records.tsx` | Retained status choices from the complete authorized section, not matching specification/search rows. |
| `src/pages/plantmanager/FinishedGoods.tsx` | Retained the existing destination/status vocabulary independently of matching inventory. |
| `src/pages/plantmanager/Reports.tsx` | Completed independent finished-goods status options. |
| `src/pages/production/FinishedPipes.tsx` | Retained the existing status-tab vocabulary independently of matching inventory. |
| `src/productMaster.ts` | Surgically restored the interrupted specification-normalizer edit to its pre-task repository value. The entire file is unchanged from `9f6d47b`. No PEP/specification remapping. |
| `src/store.tsx` | Completed startup preservation and fixed the leftover reset-version reference. Operational callbacks and transactional seed definitions remain byte-identical. |

Additional corrected source files: `src/components/PeriodSelector.tsx` and `src/smartInventory.css`. Visual QA found the old peer-button date layout still present. Period types are now above the actual `[←] range [→]` row; “All” has no navigation arrows. Calendar calculations, explicit-date precedence and Monday–Sunday week rules are unchanged. Existing separate inventory-bucket table columns and desktop 4+4 filters remain intact.

Regression support: added `scripts/check-recovery.mjs`, `scripts/recovery-baseline.mjs`, and `check:recovery` in `package.json`; updated the smart/date tests and exact-source baseline adapters. The older preservation suites accept only pinned recovery deltas, while the new suite independently executes the current hydration/filter behavior and compares every operational callback and seed definition.

## 2. Unsafe startup behavior removed

- Removed the version-marker effect that overwrote saved inventory/orders/reports/materials and erased transaction/audit history.
- Removed automatic reinsertion of a particular pellet bag into existing saved data.
- Removed forced completion of the `att1` attendance record on startup. Normal attendance/clock-in/clock-out callbacks are unchanged.
- Removed hydration that discarded unknown-grade pellet records or guessed PE80 for historical transactional records.
- Existing saved collections, including empty collections, win. Missing transactional collections become empty rather than receiving demo transactions.
- Existing-state startup no longer runs sample-location assignment or adds a replenishment sample. Pre-existing fresh-demo initialization remains available only when the application state key is absent.
- Malformed/unreadable/schema-invalid saved state fails closed before persistence. The raw browser value is not replaced by fresh defaults; the application displays recovery guidance.

No new transactional restoration function was added. No SO/MO/PO/Batch/Group/Pipe scenario was reconstructed. The existing barcode migration engine was not edited; valid current active barcodes and their history remain stable.

## 3. Filter option sources and behavior

- Products: `HPAI_PRODUCT_MASTER.products` in `src/productMaster.ts` — all five Products, regardless of stock.
- Material Grade: the shared active master, exactly PE80 and PE100.
- Colors: the shared five-color master, retaining existing internal codes.
- Size / Diameter: `productFilterSizes()` in `src/productFilters.ts`, using shared standard/CTS/Spiral lists and configured active Polytube sizes from the existing specification reader. No inventory-derived Size list.
- SDR / Thickness: `HPAI_PRODUCT_MASTER.sdrRatings`, all nine SDRs, in one field.
- Length: shared straight/coil length masters.
- Locations: shared A–I/custom physical configuration. With selected specifications, only actual matching current inventory from the caller's authorized records contributes Location choices. Positive location balances and configured physical sublocations are supported; shipped/consumed/pending-receipt records do not fabricate current locations.

Only Location is inventory-aware: one matching location auto-selects; multiple show All Matching Locations; zero show No Matching Locations without clearing valid specifications. Invalid old Location alone resets. No specification constraint restores All Locations. Storage Purpose and Status remain independent; search does not rewrite master choices.

All 18 standard sizes remain present, including 110mm. 100mm was not added as a new active standard size. All three CTS and both Spiral sizes remain available. Zero-stock master choices remain selectable. Product compatibility may clear an incompatible Size, but stock availability never does.

Filtering performs no inventory write or movement. Receiving, incoming destination, transfer destination, internal movement and storage-confirmation workflows were not modified.

## 4. Verification

- `pnpm.cmd exec tsc --noEmit` passed.
- `pnpm.cmd build` passed; the existing large-bundle advisory remains non-fatal.
- The 12 existing regression suites pass: search 165, reprint 124, pipe relationships 90, product groups 70, material grades 59, storage 76, barcodes/locations 112, UI layout 105, complete UI 259, UX 365, dates 86, smart filters 203 — 1,714 checks.
- `pnpm.cmd check:recovery` passes 132 additional checks, including exact source/callback/seed preservation, full masters, Location behavior, repeated hydration, empty/missing collections and malformed-state preservation.
- Total: 1,846 regression checks.
- `pnpm.cmd qa:smart:browser` passes with real ProductFilters interactions, zero-stock/special sizes, all three Location cases, chip clearing, independent Status/Purpose, date navigation and keyboard operation.
- Browser QA covers all six roles, seven viewport widths (360/375/390/412/430/768/1280), and both themes, including measured page overflow and table alignment.
- Two real reloads in the isolated temporary browser profile preserve modified test quantities/locations, physical IDs, active barcodes, transaction chains and collection counts without duplication. No live user browser profile or saved localhost records were used for these tests.
- The existing localhost development server at `http://127.0.0.1:8443` returned HTTP 200. It was not restarted or duplicated, in accordance with the repository's running-server instructions.

## 5. Explicit safety confirmations and remaining scope

NO LOCALSTORAGE WIPE. NO INVENTORY RESET. NO DUPLICATE SAMPLE RECORDS. NO PEP MAPPING INVENTION OR REPLACEMENT. NO FABRICATED SO/MO/PO SCENARIOS. NO DATABASE CHANGES. NO SQL. NO SUPABASE CHANGES.

No canonical-file blocker remains for this recovery. Restoring the original larger task's absent PEP mappings and conflicting SO/MO/PO examples is deliberately outside this recovery and would require reliable canonical data in a separate task.

At the recovery handoff these changes were left uncommitted. The subsequent Final Master Fix request authorizes a **local commit only**, with **no push and no merge**. Working branch: `fix/safe-restoration-location-only`. Main and the locally recorded origin/main remain at `9f6d47b82ae9dcf4d22d69259ff29b21c32688ac`.

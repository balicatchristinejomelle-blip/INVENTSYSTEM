# Finished pipe completeness and source relationships

14 October 2026 — frontend-only follow-up to reprint commit `0a783f9995b51ed7145212e6c7cfb307f96342cf`.

The user explicitly authorized commit, push and merge of this follow-up, including its reprint ancestor, and explicitly chose to add one live replenishment sample pipe. This supersedes the earlier reprint brief's instruction to leave that feature unmerged. Development took place on `frontend-finished-pipe-relationships`, not directly on main. Publication hashes and merge verification are provided in the final handoff.

## 1. Why fields were blank

The old detail card read only local FinishedGood fields: `moRef`, `reservedForOrderRef`, `buyer`, and `unitWeightKg`. The five original good sample pipes already referenced PO-2026-0012, which referenced MO-2026-0045, which referenced SO-2026-0058 / Metro Water Corp.; their locally missing fields did not mean those relationships were absent. The seed factory also combined Quality Pass with `status: Quality Pending` and `inventoryPurpose: Unassigned`. Product Specification configuration lives under a separate, existing localStorage key and was not being resolved by the card.

## 2. Files added and modified

Added:

- `src/finishedPipeRelations.ts`: shared pure relationship/source/specification resolution, search enrichment, idempotent hydration.
- `src/components/FinishedPipeDetails.tsx`: the existing card/grid/button styles applied to one source-aware details view.
- `scripts/check-pipe-relations.mjs`: relationship, metadata, identity, sample, persistence, search and actual existing storage-action tests.
- `docs/finished-pipe-relationships.md`: this report.

Modified:

- `src/store.tsx`: additive sample/hydration, source/group metadata on new POs, hydration of newly produced good pipes, and a narrow MO-origin storage guard.
- `src/types.ts`: compatible optional trace/item metadata and explicit Awaiting Storage/Stored statuses.
- `src/productMaster.ts`: preserve provided `itemCode`/`seasonal` metadata during normalization; master options/rules remain unchanged.
- `src/printableRecords.ts`, `src/components/UniversalSearch.tsx`: read-only connected finished-pipe search fields without changing print behavior or authorization.
- `src/pages/plantmanager/FinishedGoods.tsx`, `src/pages/marketing/FinishedGoods.tsx`, `src/pages/production/FinishedPipes.tsx`: reuse the shared details card and connected search data.
- `src/pages/production/BarcodeScanner.tsx`: show connected trace fields, select the originating buyer for MO storage, disable General Inventory for MO production, and limit the buyer selector accordingly.
- `scripts/check-reprint.mjs`: retain exact baseline comparisons after stripping only the specifically reviewed source/group/hydration/guard additions; all original reprint behavioral checks remain.
- `package.json`: add `check:pipes`; no dependency changes.

No images, Git LFS configuration, sidebar, global CSS, role model, route structure, backend or database files were changed by this follow-up.

## 3–6. Source, MO, Customer Order and Buyer resolution

The existing ProductionOrder `source` vocabulary is reused: Manufacturing Order or Stock Replenishment. No competing Source model is introduced. Old POs without a Source are marked Manufacturing Order only when their actual `moRef` resolves to a shared MO. Unknown/orphan sources show a diagnostic rather than a guessed buyer or replenishment relationship.

The lookup uses real IDs/references:

`Finished Pipe.productionOrderId / poRef → ProductionOrder.id / poNo → moRef → ManufacturingOrder.moNo → orderRef → CustomerOrder.orderNo → customerName / Customer.name`.

A supplied PO ID and reference must agree. Explicit stock Source is authoritative; a stale MO text field does not manufacture a stock-to-MO relationship. Later real customer allocations of general stock can still show their actual buyer/order without pretending that a replenishment PO originated from an MO.

Source-aware fields include PO/MO/customer IDs, MO/order references, buyer and origin group. Missing real upstream records are clearly reported, not fabricated. Product snapshot fields remain intact; missing product values may inherit from the actual linked PO. Existing permanent identity, barcode, batch, quantity, reservations, physical location/history, production date/shift, release status and print state are preserved.

## 7. Unit Weight and Product Specification

Specification lookup uses the complete current specification tuple, including construction, with an explicit specification ID when available. An ambiguous match is a Configuration Conflict, not an arbitrary recipe. Valid configured exact weight is used without a 4 kg/universal fallback. Intentionally recorded historical production or configured PO snapshots are retained and labeled as snapshots; theoretical material formulas are unchanged.

When configuration is genuinely absent, the card shows Not Configured. The original seed has no configured weight or PEP item code, so those values are not fabricated. The tests use a clearly isolated 3.625 kg/PEP-1031 fixture to prove exact configuration resolution; that fixture is not injected into live master data.

Provided PEP codes and seasonal flags survive master normalization. Product Barcode is displayed separately from Pipe Record ID and physical barcode. When an actual item code is configured, its display value uses `ITEM CODE|PRODUCT|SIZExLENGTH|SDR`; otherwise it says Not Configured. The existing physical PIPE-… identifiers, generation and printer values were not rewritten. No new PEP numbering generator or replacement Product Barcode workflow was introduced. Seasonal appears only for a boolean true; false/unset gets no REGULAR/NON-SEASONAL classification.

## 8–9. Storage purpose and origin groups

Persisted legacy purpose values remain Customer Order / General Inventory; the shared view labels them Temporary Storage / Inventory Storage. Purpose is distinct from the observed physical location. Before storage confirmation a good pipe remains in its existing Production Area / Awaiting Storage location; no fictional movement is recorded just to fill fields.

MO-origin pipes are buyer-specific and have zero general availability. They cannot be stored as General Inventory or assigned to another buyer. The existing storage action remains in its current authorized Production scanner workflow; this follow-up does not silently transfer that permission to another role. The originating customer order is selected without re-entry. Existing reservation/shipment formulas are unchanged.

MO Group is the actual MO reference; multiple POs serving it retain the same group. Replenishment Group is existing PO origin metadata when present, otherwise a stable `REPLENISH-<PO year/sequence>` reference. New POs capture the appropriate group. There is no parallel group array or duplicate batch/detail page. Existing authorized document viewers and the existing batch modal are reused for clickable references; inaccessible roles get read-only text, not extra permission.

## 10–11. Quality consistency and hydration

Quality Pass transitions stale Quality Pending status to Awaiting Storage, or Stored/Available/Reserved as supported by actual storage/source evidence. Confirmed `storedAt` plus Stored storage metadata can repair a stale Quality Pending location status without changing its physical location. Pending/Reject never becomes good available stock merely because another flag is stale. Good-output arithmetic and rejected/recycling weight formulas remain unchanged.

Hydration runs on restored shared state and after the existing bootstrap, and applies to new good output. It is idempotent, reuses `hpai:shared-app-state-v1`, never calls localStorage.clear, and never resets/replaces the user's dataset. The prior bootstrap/version marker is not changed or retriggered. Print metadata and reprint history are left untouched.

The sample addition is also idempotent: it adds nothing if an existing valid replenishment pipe or its sample identity/PO is present. It allocates unused PO/batch/barcode references against existing state, including rejected batch references, and does not recreate or overwrite a user-removed sample identity. Only the explicitly approved one-pipe addition changes physical totals: a fresh seed becomes six pipes (five original buyer pipes plus one general-stock sample). It is marked localhost sample/test data, not a real production transaction. No MO, customer or buyer is created for it.

## 12–13. Sample records verified

Customer/MO:

`PIPE-2026-0021-001 → BATCH-2026-0021 → PO-2026-0012 → MO-2026-0045 → SO-2026-0058 → Metro Water Corp.`

It resolves its MO group and Temporary Storage purpose, retains Production Area / Awaiting Storage, and contributes zero to general Available inventory. The same lookup covers all five original pipes without changing their identities/quantities.

Fresh replenishment sample:

`PIPE-2026-0022-001 → PO-2026-0014 → REPLENISH-2026-0014 → BATCH-2026-0146 → Section A`.

It is one good, stored, available sample pipe with Inventory Storage purpose, a real shared PO and barcode registry record, and no MO/SO/buyer. In existing saved datasets the actual next unused references may differ. Before storage confirmation the same source produces zero available inventory.

## 14–16. Verification and remaining limits

- `pnpm.cmd exec tsc --noEmit`: passed.
- `pnpm.cmd build`: passed; existing non-blocking bundle-size warning remains. No startup dependency/server/database/internet requirement was added.
- `pnpm.cmd run check:search`: 165 checks passed.
- `pnpm.cmd run check:reprint`: 124 checks passed, including persisted barcode/PO reprint cycles, self-approval prevention, exact requester/record matching, one-use approval and unchanged print-controlled inventory collections.
- `pnpm.cmd run check:pipes`: 90 checks passed. They cover the connected MO sample and live replenishment sample, no fake relationships, configured/snapshot/missing weights, PEP/seasonal metadata, source-specific storage, identity and print preservation, sample collision/idempotence, refresh hydration, six-role search, pagination, static card rendering and the actual existing storage callback in an isolated synchronous state harness.
- Baseline checks compare operational formulas and transaction code to main, except explicitly reviewed metadata/hydration/validation additions. Permanent barcode generators/rendering, reprint control components, notifications and workflow transitions remain unchanged.
- Existing dev server returns HTTP 200 for localhost:8443 and the two new transformed modules. `pnpm.cmd dev` configuration is unchanged; no second server was launched.
- No configured lint script exists; no lint result is claimed. `git diff --check` passes.

The computer-use skill was used to check visual QA availability. No enabled browser sessions were returned. The Windows helper reported `Computer Use native pipe is unavailable: failed to connect native pipe: The system cannot find the file specified. (os error 2)`. Therefore browser click-through, actual printer behavior, light/dark screenshots and the requested mobile widths remain unverified. Responsive layout and theme use are implemented with existing tokens/classes, but static rendering is not visual QA. No user authentication or real inventory movement was automated.

The baseline still lacks a configured live PEP catalog and separate group entities; this follow-up respects that current implementation instead of inventing codes or replacing group/barcode systems. Those unconfigured live values remain explicit. The user-authorized merge includes the earlier reprint feature, whose standalone initial report described its originally unmerged status.

CURRENT HPAI BUILD PRESERVED.

FINISHED PIPE DETAILS NOW USE CONNECTED RECORD DATA.

CUSTOMER-ORDER PRODUCTION INHERITS: SO → MO → MO GROUP → PO → BATCH → PIPE.

BUYER INFORMATION IS INHERITED FROM CUSTOMER ORDER.

MO-PRODUCED FINISHED GOODS USE TEMPORARY STORAGE.

REPLENISHMENT-PRODUCED FINISHED GOODS USE INVENTORY STORAGE.

NO FAKE MO OR CUSTOMER WAS ADDED TO REPLENISHMENT.

UNIT WEIGHT USES PRODUCT SPECIFICATION CONFIGURATION (OR A LABELED HISTORICAL SNAPSHOT); MISSING CONFIGURATION IS NOT FABRICATED.

QUALITY PASS NO LONGER DISPLAYS QUALITY PENDING.

PEP ITEM CODE RULES PRESERVED; EXISTING UNCONFIGURED LIVE CODES ARE NOT INVENTED.

PRODUCT BARCODE FORMAT PRESERVED.

PIPE RECORD IDENTITY PRESERVED.

SEARCHABLE SIZE / SDR PRESERVED.

REPLENISHMENT LOGIC PRESERVED.

REPRINT APPROVAL PRESERVED.

LOCALHOST DATA WAS NOT WIPED.

NO DATABASE CHANGES. NO SQL. NO SUPABASE MIGRATIONS. NO RLS.

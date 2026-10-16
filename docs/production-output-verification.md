# Production output audit and minimal fix

## Findings

- Creating a PO already starts with zero completion and does not create output transactions or physical pipes. This creation logic and all existing seeds remain unchanged.
- Ready/Scheduled orders lacked a visible Start action. Partially Completed orders also lacked a usable Continue action.
- Existing output saving already consumed materials from WIP, calculated `Good = Output - Rejected`, appended persisted output history and created one physical pipe per good unit. Those algorithms remain in use.
- Existing zero-valued Good totals could be mistaken for missing totals. A restored output draft also needed a persistent submission identity to prevent duplicate replay.

## Changes

- Added Start Production / Continue / Record Output to the existing Production PO list and details dialog. These open the existing output/material review form.
- Start requires a Production user with active attendance. It respects assigned shifts, pending turnover and unfinished work already performed on a different PO in that session.
- Starting changes only the selected PO's workflow status/shift and adds its ID to the current attendance record. It creates no output, pipe, material transaction, stock movement or fake history.
- The existing scanner follows that explicitly selected PO. Its compatible-material validation, loading, FIFO/WIP consumption and BOM/recipe calculations are unchanged.
- Output saving requires a started PO in the active session/shift. New UI submissions carry an optional idempotency key on the existing output transaction. Replaying a saved key returns without writing, including after completion or reload. Legacy transactions are not backfilled or replaced.
- Synchronous state flushing makes the existing synchronous save-result API reliable when React batches state updates. A local submit lock also blocks rapid duplicate clicks. The saved draft is removed immediately after success; unrelated session/local storage is untouched.
- Cumulative totals preserve explicit saved values, including zero. Only when totals are absent, read-only fallbacks use existing completion/rejection records. A new confirmed entry adds to those totals without rewriting earlier entries. No startup hydration or output reconstruction was added.
- Reaching the required total marks that PO Completed. Partial output stays in production and can be continued.
- Added per-PO read-only output history using existing transactions, showing date/time, batch, Output, Good and Rejected. Unrecorded legacy Good/Rejected snapshots are labeled “Not recorded,” not fabricated. The new table alone has a compact desktop width and mobile scrolling.

## Verification

- `check:production-output`: 95 checks of current callbacks, static safety guards, legacy totals, shift safeguards, output/pipe counts, rejection-only output, atomic validation failures, persistence and idempotency.
- Existing 16 suites: 2,331 checks covering search, reprints, pipe references, product groups, grades, storage, barcode migration, UI, UX, dates, inventory filters, recovery, layout and pellet masters.
- TypeScript and production build pass.
- `qa:production-output:browser` exercises the actual Production Orders page and scanner inside React StrictMode, using a unique temporary browser profile and isolated Vite cache. No live user browser/localStorage is read or altered.
- Browser sequence: Scheduled PO → Start → select compatible physical bag → existing automatic scan/load → return to draft → record 50 with 2 rejects → continue → record 100 with 3 rejects.
- Verified totals: **150 Output / 145 Good / 5 Rejected / 550 Required**, with progress advancing from `50/550` to `150/550`, exactly 145 new individual pipes and exactly two output entries.
- Verified live Good calculation before submission, rapid double clicks, saved-entry replay, reload persistence and readable history.
- Details/history measured at 360, 375, 390, 412, 430, 768 and 1280 pixels in light/dark themes; desktop and mobile screenshots inspected.

## Preservation

No resets, reseeding, localStorage clearing, record deletion, ID regeneration, barcode migration, PEP/item mapping changes, account/permission changes, Date changes or Location-engine changes were introduced. Existing PO/SO/MO identities, references and required quantities are retained. Existing valid output history and pipe records remain unchanged. Normal material consumption, reject allocation and customer-order updates happen only through the pre-existing successful-output workflow.

Source changes are limited to `src/pages/production/ProductionOrders.tsx`, `src/store.tsx`, optional fields in `src/types.ts` and the small read-only `src/productionOutput.ts` helper. Test scripts and exact-reviewed historical guards were extended separately. The pre-existing user edit to `docs/final-pellet-material-filters.md` was not modified by this task.

# Plant Manager active receiving and Scanner completion

Verified 2026-10-20. Continued the interrupted changes from `d8c2e7f`; no restart or data reset.

## Already implemented and preserved

- Atomic counted acceptance, cumulative/partial receipts, approved-request validation, discrepancy validation and received-only bag creation were already working. Their store handlers were not rewritten.
- Existing physical bag IDs/barcodes, legacy expected records, inventory arithmetic, Management-approved same-barcode reprints, Production pellet loading/WIP and storage-purpose rules remain unchanged.
- `src/store.tsx` is byte-identical to `d8c2e7f`. No data, types, master mappings, persistence implementation, RBAC configuration or database changes are included.

## Completed active UI wiring

- Put counted acceptance before label history. Plant Manager enters Received Bags and Location A–I without scanning pellets. Show discrepancy fields only for a short receipt, clear stale feedback on edits, and visibly report handler errors.
- Show accepted/remaining quantities immediately, with View Barcodes and direct Print Barcodes for accepted, never-printed labels. Existing Print All/Selected and individual Management-approved reprint workflows remain in place.
- Corrected the interrupted standalone Store Pipes navigation: the sidebar has **Scanner**, whose **Store Pipes** operation renders the existing Pipe Storage session. There is no standalone Store Pipes menu/route.
- Scanner displays Load Pellets, Store Pipes and Release Finished Pipes; role authorization is retained. Production's existing recycled-output operation is also preserved. Only the existing Plant Manager storage permission enables the storage session.
- Removed `Inspect Finished Pipe Storage` from active source. Reused the existing storage component; no duplicate storage component or business handler was added.

## Verification

- `pnpm.cmd build`: passed, 134 modules. Existing large-bundle warning only.
- TypeScript no-emit check: passed.
- All 20 repository regression suites passed across the full run and targeted storage rerun. The storage suite's historical assertion expecting the retired wording was updated; its 76 checks then passed. Incoming printing/count acceptance suite: 61 checks; process-flow suite: 79 checks.
- `pnpm.cmd qa:process-flow:browser`: passed using actual callbacks and the actual App/sidebar routes, plus isolated fixtures. Existing six-role, production output, WIP loading, duplicate-scan, shipment and reprint scenarios also passed.
- Actual App full receipt: 20 sent / 20 accepted creates exactly 20 unique labels and 500 kg once. View Barcodes and direct Print Barcodes produce exactly 20 matching label sections. Refresh preserves exact bags, transfers and transactions.
- Actual App partial receipt: 20 sent / 18 accepted requires a reason, creates exactly 18 unique labels and 450 kg, and retains a 2-bag discrepancy. View/Print and refresh pass. No unreceived quantity becomes stock.
- Actual App Scanner: one Location A selection stores multiple existing Awaiting Storage pipe barcodes, retains location and scan focus, and derives storage purpose automatically. Duplicate scans change no records; storage adds zero inventory quantity. Refresh preserves stored records.
- Desktop/mobile screenshots inspected; width checks passed at 360, 768 and 1280 px. Browser artifacts are under the isolated temporary profile `hpai-process-flow-kdlW2V`, not the user's browser profile.
- `pnpm.cmd dev` was run. It reported that the existing port 8443 server was already running; that server was preserved and returned HTTP 200.

No user localStorage was cleared or modified by testing, no inventory was reset/reseeded, and no existing operational data was overwritten. Physical printer/scanner hardware was not connected; browser label output and keyboard-wedge scan events were tested.

The unrelated pre-existing edit to `docs/final-pellet-material-filters.md` is intentionally excluded from this change.

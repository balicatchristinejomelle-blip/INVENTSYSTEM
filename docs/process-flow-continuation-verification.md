# Frontend process-flow continuation

## Continuation boundary

The interrupted run had already implemented the derived raw/WIP balances,
zero-balance WIP completion, Accounting transfer Dispatch, consumed-bag receipt
guard and read-only operational ledger. Earlier production-output and seven-filter
layout changes were also present. This continuation made only one source fix:
the derived barcode registry now adds missing entries without replacing existing
registered metadata. No reset, seed changes or ID/barcode regeneration occurred.
The unrelated existing edit to `docs/final-pellet-material-filters.md` was retained.

## Work completed now

- Finished the browser persistence assertion: compare structured records rather
  than serialized property order. A real difference was identified, not ignored:
  existing `hydrateFinishedPipe` adds an absent `customerOrderId` from the existing
  reservation when a replenishment pipe reloads. The test permits only that
  specific missing reference, verifies the referenced order exists and checks
  every other field strictly. A second reload must be completely identical.
- Expanded persistence/role checks to rejection, recycling, receiving, material
  request, colorant, barcode registry, audit and attendance records too.
- Added positive-balance WIP completion rejection coverage.
- The expanded refresh check exposed an existing registry merge that replaced
  registered entries with freshly generated metadata, changing `createdAt`.
  Changed only the fallback insertion condition to preserve existing entries.
  Barcode strings, IDs, generators, physical records and quantities are unchanged.
- Registered process-flow test commands and connected exact-hash reviewed source
  deltas to the existing historical regression guards. Any additional source edit
  still fails those guards. The earlier uncommitted production-output store is
  preserved beneath this test-only normalization layer; no working file is
  restored or rewritten by it. New workflow tests execute the actual callbacks.

## Verified behavior

`check:process-flow` passes 38 checks, including actual callback execution in
isolated memory fixtures. The browser test uses an independent temporary Chrome
profile, never the user's working localStorage.

- Receive one 25 kg White virgin bag using the existing PEL-V barcode format.
- Create a zero-output replenishment PO for 550; no fake MO, customer or pipes.
- Start and load the same physical bag: raw decreases and WIP increases by 25 kg;
  no company Stock Out. Existing material/recipe calculations remain unchanged.
- At the isolated specification's configured 0.5 kg per pipe, record output 20
  with one rejected pipe, then output 30 with one rejected pipe. These consume
  10 kg and 15 kg WIP respectively. Cumulative output/good/rejected = 50/48/2;
  exactly 48 physical good pipes; remaining requirement 500. No duplicate replay.
- Consumed bag retains ID, barcode, RR, batch and usage history, has no active
  storage location and cannot be resurrected by receiving it again. Actual
  Mark Finished UI retires a separate zero-balance legacy WIP fixture; positive
  WIP and unauthorized roles cannot use that action.
- Replenishment storage confirmation becomes Available once, without another
  Stock In. Reserve, stage at I and load internally; release adds one Stock Out.
- Customer-MO output retains its source chain and enters Temporary Storage, not
  Available inventory (callback fixture verification).
- Material Request -> approval -> Preparing transfer -> actual Accounting
  Dispatch button/confirmation -> In Transit -> receipt of the same pending bag.
- Rejected output -> existing 50 kg recycling allocation -> cutting/weighing ->
  Plant Manager approval -> crushing/pelletizing -> one Green 25 kg recycled bag
  -> storage -> WIP -> production (callback fixture verification). No bypass of
  approval, repeat completion or second raw deduction.
- All six authorized roles share the same operational records. New actions retain
  their role checks. Navigation and two browser reloads preserve quantities,
  barcodes, IDs, locations and histories without recreating output or stock.
- Ledger rows satisfy beginning + in - out = ending; internal moves contribute
  zero external movement. Material kg and pipe units are separate ledgers, never
  added together. Material ledger ending is external net movement, not the live
  raw/WIP balance. Existing historical sample mismatches are not repaired or
  overwritten; the existing reconciliation warning remains.
- Browser ledger checked at 360, 768 and 1280 px, with desktop/mobile screenshots
  visually inspected. No document-width overflow or runtime exceptions; wide
  table and category tabs use their existing contained scrolling behavior.

## Continuation-only files

- `package.json`
- `src/store.tsx` (one missing-only registry merge condition)
- `scripts/check-process-flow.mjs`
- `scripts/check-process-flow-browser.mjs`
- `scripts/process-flow-baseline.mjs`
- `scripts/filter-layout-baseline.mjs`
- `scripts/check-production-output.mjs`
- `scripts/check-pellet-master.mjs`
- `scripts/check-complete-ui.mjs`
- `scripts/check-ux.mjs`
- This verification document.

## Build and development

- All 19 regression suites passed against the final source: search, reprint, pipe
  relations, product groups, material grades, storage, barcodes/locations, UI
  layout, complete UI, UX, dates, smart inventory, recovery, layout lock, summary
  colors, pellet masters, production output, filter layout and process flow.
- Final browser test passed with all 16 operational datasets checked across all
  six roles and two completed new-document reloads. Screenshots from the final
  isolated profile `hpai-process-flow-ONN4Od` were visually inspected.
- `git diff --check`: passed.
- `pnpm.cmd build`: passed; non-blocking existing large-chunk and Tailwind plugin
  timing warnings occurred during verification; the final build reported only
  the large-chunk warning.
- `pnpm.cmd exec tsc --noEmit`: passed.
- `pnpm.cmd dev`: attempted; refused a duplicate listener because port 8443 was
  already occupied. Existing development server preserved and verified HTTP 200
  at `http://localhost:8443`.

No commit, push or merge was performed during this continuation.

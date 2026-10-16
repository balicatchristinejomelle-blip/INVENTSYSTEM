# Approval, barcode and physical scan flow

Frontend/localStorage only. No database work, reset, reseed, migration or historical
record rewrite was added. The earlier verified output/layout/process work is
preserved in checkpoint commit `7b0c39c`. The pre-existing unrelated edit to
`docs/final-pellet-material-filters.md` is excluded from these commits.

## Approval and printing

- Material Requests in New/Pending/Rejected remain readable but cannot print.
  Approved requests retain their existing printing roles. The shared printable
  descriptor carries the current approval restriction; both print entry points
  and the print-session validation enforce it, including completion/reprints.
  Blocked documents are also hidden from browser print-media output.
- Linked Material Transfer documents and expected bag labels require their
  approved Material Request. Existing received/historical pellet labels are not
  regenerated or removed. Existing per-record reprint approval remains required
  for subsequent physical prints.
- Accounting remains the material-request reviewer and transfer creator. Review
  actions only apply to New/Pending requests, so an already Approved/Rejected
  decision cannot be overwritten by a stale action. Approval adds no stock.
- The repository has no separate replenishment-request/PO approval status. The
  existing authorized Plant Manager replenishment PO creation is retained; no
  invented approval stage or historical PO status conversion was introduced.

## Requested pellet delivery

1. Plant Manager submits a Material Request.
2. Accounting approves it, then uses existing Create Transfer. This generates one
   zero-balance Pending Receipt record per expected 25 kg bag, with the existing
   unique PEL-V (virgin) or PEL-R (recycled) format. Approval alone does not receive
   anything. Non-whole-bag requests cannot be silently rounded into labels.
3. Plant Manager opens Incoming Transfers -> View to print the individual labels.
   Labels can be printed while the approved delivery is Preparing; Dispatch moves
   the existing transfer to In Transit without receiving stock.
4. Incoming Transfers -> View -> Expected Pellet Bags / Physical Receiving:
   scan one physical bag, validate it, select Location A-I, then confirm that bag.
   Production's existing Receive Pellets scanner supports the same per-bag path.
5. The action revalidates the exact unique active barcode, approved request,
   correct transfer/batch/type/grade/color, 25 kg weight, In Transit status, zero
   pending balance and valid location. It activates only that bag, appends one
   +25 kg receipt and retains its ID/barcode/source references. Remaining expected
   bags stay zero balance. The last individual receipt completes the same transfer.
6. Bulk pellet receipt cannot activate unscanned bags. Existing colorant receipt
   and short-receipt discrepancy handling remain; discrepancy reports cannot
   lower the count below bags already physically scanned/received.

Plant Manager already had transfer receiving permission. Moving that permission
from bulk receipt to the individually validated bag action adds no new role.
Owner, Accounting, Marketing and Management cannot use that receiving action.
Production's existing recycled-pellet storage/25 kg bagging rules remain in use.

New physical receiving transactions retain the physical bag barcode/batch and
use the approved Material Request reference, while the bag retains its transfer
reference. This makes the new confirmed receipt a Stock In, rather than mistaking
it for an unreceived inter-plant movement. Existing transactions are unchanged.

## Finished pipes

- Existing actual Good output generation is unchanged: one physical record and
  one unique active barcode per good unit, not the PO target. New pipes begin
  Awaiting Storage and are not yet Available/Temporary stored inventory.
- Plant Manager's existing Finished Pipe details -> storage card now requires
  scanning the exact selected pipe before Confirm Storage is enabled. The state
  action independently rejects absent/wrong/ambiguous barcodes, wrong lifecycle,
  incompatible storage and unauthorized roles. It records storage internally
  without duplicate Stock In. Existing stored/shipped pipes are not backfilled.
- Internal relocation, reservation, source-derived purposes and ready staging
  remain unchanged. Production's storage-inspection mode stays read-only.
- Production scanner -> Release Finished Pipes: select the expected shipment
  Customer Order, scan the SAME physical barcode again, review the exact pipe,
  and explicitly Confirm Release. Opening the page or merely identifying a code
  no longer automatically releases it. The action validates the exact active
  barcode, Ready bucket, correct order/reservation and not previously shipped.
- Release records one Stock Out, preserves the same pipe ID/barcode/history, and
  rejects duplicate release. Existing serial high-water and barcode generators
  remain untouched, so shipped codes cannot be reused by new output.
- HID keyboard + Enter and typed fallback remain supported. No camera was added.

## Verification

- All 19 regression suites passed on the final source; `git diff --check` passed.
- `check:process-flow`: 79 isolated current-callback/preservation checks, including
  the required 125 kg request -> five expected labels -> five individual receipts
  -> exactly 125 kg Stock In, and actual Good output 10 -> ten unique Awaiting
  Storage pipes -> ten exact storage scans -> same-barcode shipment once.
- Negative cases cover Pending/Rejected printing, unauthorized approval,
  immutable rejected decisions, unapproved/wrong-material/wrong-weight delivery,
  missing/wrong barcode/location, bulk receiving, duplicate receiving/storage/
  shipment, wrong shipment order and shipment before Ready.
- The browser test drives the actual request viewer/print-session API, browser
  print-media restriction, per-bag inputs/confirmation, ten per-pipe storage
  controls, and native debugger keyboard/HID-style burst plus explicit shipment
  confirmation. This simulates keyboard input; a physical Honeywell device was
  not connected to the test environment.
- All six roles share the same 16 operational datasets. Two real new-document
  reloads preserve quantities, IDs, barcodes, locations, registry timestamps and
  histories. The sole expected existing hydration is an absent customer-order
  reference resolved from an existing reservation; no values are overwritten.
- Receiving/storage/shipment surfaces measured at 360/768/1280 px in light/dark
  themes. Wide tables use contained scrolling, with no document-width overflow.
  Desktop/mobile screenshots inspected from temporary profile
  `hpai-process-flow-TxNEqN` and final rerun `hpai-process-flow-oyKnKe`; browser
  runtime exceptions checked separately, with none reported.
- Historical source guards accept only pinned reviewed deltas against the
  previous verified checkpoint. Legacy positive movement fixtures now supply
  explicit simulated scans; the process tests exercise raw callbacks without
  that adapter for all bypass/negative cases.

Production build and TypeScript checks pass. The build's large-chunk advisory is
non-blocking. `pnpm.cmd dev` was attempted; port 8443 is already occupied by the
existing development server, which was preserved and verified HTTP 200.

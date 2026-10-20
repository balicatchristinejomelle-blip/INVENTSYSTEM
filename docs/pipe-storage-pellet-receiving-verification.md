# Pipe Storage and scanned transfer acceptance

Verified 2026-10-20 against preceding main `9ba6955`. Frontend only.

## Pipe Storage

The existing awaiting-pipe storage entry now opens **Pipe Storage** as a scan
session. Select A-I once, then scan multiple existing active barcodes with Enter.
Each successful scan uses the existing storage action, clears only the input and
focuses it for the next scan; the selected location survives. The session stays
open after the first displayed pipe becomes Stored. Storage purpose remains
automatic from MO/customer versus replenishment origin; existing compatible
location rules are still enforced. Unknown, duplicate, non-awaiting and
incompatible-location scans cannot change a record.

Internal moves and Ready for Ship Out retain their existing controls. Shipment
still scans the same barcode against the selected customer order, explicitly
confirms release and creates one Stock Out. Storage adds no duplicate Stock In;
reservation, staging and loading do not create Stock Out.

## Pellet acceptance

Incoming Materials now exposes **Accept Transfer** for approved pellet deliveries
that are In Transit or have a Receiving Discrepancy. It opens the transfer's
existing expected-bag list. Scan bags individually, select A-I, then confirm
**Accept Transfer**. Scanning only stages a list; acceptance validates the entire
list against the current shared records before committing any receipt. No manual
bag count can activate unscanned inventory through this view.

The same physical receipt transition is shared with the existing Production
scanner, retaining role checks, material checks, per-bag history and Stock In.
New receipt/audit IDs include the bag ID to avoid same-millisecond batch receipt
collisions; existing record and history IDs are never rewritten.

- Zero scans, duplicates, unknown/legacy aliases or record IDs, wrong transfer,
  wrong material, unapproved requests, already-received bags and invalid locations
  are blocked. A mixed valid/invalid list changes nothing.
- Five accepted bags produce 125 kg and Received status. Three accepted bags
  produce 75 kg, two bags / 50 kg missing and Receiving Discrepancy status. The
  remaining two can later be scanned and accepted without rewriting the first
  three receipts. Sent Quantity is not changed.
- Original bag IDs, physical PEL-V / PEL-R barcodes, batch, RR and request links
  survive. Printing/reprint approvals and expected-label preparation are unchanged.
  Pending/Rejected requests remain non-printable/non-receivable.
- Completed transfers, pre-existing scans/locations, unscanned bags and unrelated
  collections are unchanged. No mount migration, localStorage wipe, reseed,
  inventory reset, database change or role-specific data copy was introduced.
  Conflicting existing received totals stop acceptance instead of being replaced.
- Colorant receiving retains its existing kg-based workflow.

## Verification evidence

All 20 regression suites passed, including targeted reruns after adapting the
historical test harness to the shared receipt helper. The incoming-label suite
now has 48 checks, including exact source guards, atomic
acceptance failures, all-role boundaries, 3+2 completion, full receipt, unique stock
movements and preservation of existing received objects/history. Historical source
guards recognize only the pinned reviewed delta; unrelated edits remain rejected.

The final isolated real-browser flow passed using profile `hpai-process-flow-uGUOFG`:
ten produced pipes stored in one session with one location selection and retained
scanner focus; duplicate storage rejected; same-barcode shipment confirmed once;
five individually scanned bags accepted as 125 kg; and the actual Incoming
Materials Accept Transfer action received three of five bags as exactly 75 kg.
The print/reprint workflow, six-role shared datasets and two document reloads also
passed. Surface checks covered 360/768/1280 px, light/dark; desktop/mobile
screenshots were inspected. Tests use isolated fixtures/profiles, never the user's
working localStorage. Physical scanner/printer hardware is not claimed tested.

Production build, TypeScript and whitespace checks passed. The existing large
bundle advisory remains. `pnpm.cmd dev` correctly reported port 8443 in use; the
existing server was preserved and returned HTTP 200.

The unrelated pre-existing local edit to
`docs/final-pellet-material-filters.md` is excluded from this commit.

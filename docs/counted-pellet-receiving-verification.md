# Pellet receiving role correction

2026-10-20; frontend only, following main revision `90f0114`.

This supersedes the incoming-delivery scan/preprint requirements in the earlier
incoming-printing and pipe-storage/pellet-receiving verification notes. Pipe
Storage and shipment behavior from those changes remain unchanged.

## Current flow

Plant Manager opens Incoming Materials -> approved In Transit transfer ->
Accept Transfer, counts unloaded bags, enters **Received Bags (Cumulative Total)**,
chooses A-I and supplies a discrepancy reason when short. No receiving scan,
Validate Bag Scan or Confirm Scanned Bag Receipt control is mounted.

Acceptance validates the current request, transfer, material and historical bag
counts atomically. Only newly accepted bags enter Available/Stored inventory and
receive labels. New transfer creation, approval, dispatch and View Barcodes do
not generate expected physical bags or barcodes. View Barcodes and Print
All/Selected use accepted received bags only; reprints retain the same barcode
and existing Management approval. The existing PEL-V / PEL-R formats remain.

For a new 20-bag delivery:

- Full 20/20: 20 unique labels, 500 kg received, Received status.
- Partial 18/20: 18 unique labels, 450 kg received, 2 bags / 50 kg missing,
  Receiving Discrepancy status and required reason. Sent Quantity remains 20.
- Later cumulative 20: only two additional bags/labels and 50 kg are added;
  the original 18 objects, labels, locations and history remain unchanged.
- Repeating the same count, reducing an accepted count or accepting a completed
  delivery changes nothing. A zero-bag short delivery can record a discrepancy
  with a reason, but creates no bags, labels or Stock In.

Production continues to scan stored labeled bags against the active order for
loading: Raw -25 kg, WIP +25 kg. Its duplicate/material validation and load
callback are unchanged. Incoming pending bags cannot be received by scanning;
the separate existing recycled-output storage operation remains available.

## Existing-data protection

No migration runs on mount. Nothing clears localStorage, resets/reseeds inventory,
replaces saved arrays with samples, deletes records or regenerates existing
barcodes/IDs. No database or permission configuration changes were made.

If an older delivery already has pre-generated expected barcodes, those records
are preserved and reused deterministically as quantities are accepted. Unreceived
legacy records retain their original IDs/barcodes but stay zero-stock and cannot
print. New missing barcodes are generated only for an accepted received quantity.
Existing receipt/RR/batch/request references, prior receipt objects, scans,
locations, transactions and print/reprint history are retained. Conflicting
historical quantities/references block acceptance instead of being overwritten.

The obsolete scanned acceptance API is non-mutating; the old pellet bulk API
cannot bypass the new count validation. Colorant kg-based receiving, RR creation,
recycling, production calculations, location compatibility, pipe storage,
shipment and role access remain otherwise unchanged. Exact source guards verify
all seeds and unrelated callbacks against preceding main and pin the reviewed
role-flow changes.

## Verification

52 isolated receiving/label/role-preservation checks and 79 end-to-end process
checks pass. All 20 regression suites pass, including targeted reruns after the
obsolete scan-based receipt expectations were updated. TypeScript, production
build and `git diff --check` pass; only the existing nonblocking large-bundle
advisory remains. The existing localhost:8443 server returns HTTP 200.

Browser verification exercises actual count inputs, location/reason validation,
20/20 and 18/20 acceptance, received-only Print Selected/Print All, approved
same-barcode reprint, Production loading/duplicate scan, six-role shared records
and two reloads. It also retains pipe storage and shipment regression coverage.
Responsive surfaces cover 360/768/1280 px and light/dark; desktop/mobile
screenshots are inspected. All tests use isolated fixtures and temporary browser
profiles, never working user localStorage. Print HTML/HID events are simulated;
no physical printer/scanner hardware test is claimed.

Final browser run: `hpai-process-flow-PYvJg6`; no runtime exceptions.

The pre-existing unrelated edit to `docs/final-pellet-material-filters.md` remains
local and is excluded from this change.

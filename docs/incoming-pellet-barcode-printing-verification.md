# Incoming pellet barcode printing

Verified on 2026-10-20. Frontend/localStorage only; no backend, dependencies,
inventory reset, seed replacement, barcode migration or unrelated layout changes.

## Plant Manager workflow

- Approved pellet requests expose **View Barcodes** in Materials & Requests and
  their linked Incoming Materials transfer, both in rows and detail views.
- Opening this view explicitly prepares only missing expected 25 kg bags and
  missing barcode-registry entries. Pending/Rejected requests cannot prepare or
  print these labels. Colorants retain their existing kg-based workflow.
- The view shows request reference, material, approved quantity, bag count,
  received count, remaining count, and each existing physical barcode.
- **Print All** prints never-printed labels; **Print Selected** prints selected
  never-printed labels. Printed rows retain the existing individual Management
  approval/reprint controls and print the SAME barcode. Existing print-result
  confirmation and audit metadata are reused, not bypassed.
- Label preparation and printing do not receive inventory. Accounting still
  creates/dispatches the transfer; Plant Manager still scans and confirms each
  expected bag individually with a valid A-I storage location.

## Preservation and idempotency

Expected bags have zero available kg and Pending Receipt status. A new optional
request reference links them before a transfer exists. Later transfer creation
reuses their IDs, batch and barcodes, adding only their missing transfer reference
rather than making duplicate bags. Existing PEL-V / PEL-R barcode formats remain
unchanged, including the user's prior instruction to retain PEL-V.

Existing valid bag objects are preserved during label preparation; repeated
preparation returns unchanged state when nothing is missing. Missing labels can
also be added after a partial delivery without changing received bags, stock,
transactions, requests, transfer totals, print history or existing registry data.
Conflicting identities, batches, material or quantities fail with an explanation,
not an overwrite. A completed transfer with missing historical bags requires its
canonical history to be restored instead of inventing receiving history.

All seed arrays and pre-existing business callbacks except the narrowly adapted
transfer-creation callback are byte-identical to the preceding main revision
`e938306`. Receiving, stock arithmetic, production, WIP, dates, location automation,
master data and role permissions remain unchanged. No mount-time reseeding or
localStorage clearing was introduced.

## Verification

- All 20 regression suites passed, including 30 focused incoming-label checks and
  the existing 79 isolated end-to-end process checks. Source guards pin the exact
  reviewed additions and reject unreviewed deltas.
- Isolated real-browser testing exercised Approved 125 kg -> five labels before
  a transfer; Print Selected (2); Print All (3); Management-approved same-barcode
  reprint; transfer reuse; dispatch; and three individual scan/receipt actions.
  Final state: three received bags, 75 kg Stock In, two pending bags. Unknown and
  duplicate receipts are rejected in the isolated action tests.
- Browser checks compared 18 persisted datasets across six roles and two actual
  document reloads without duplicate labels, inventory or transactions.
- Actual page/modal screenshots were checked at desktop and 360 px mobile widths;
  automated surface measurements also covered 768 px and light/dark themes. A
  table-cell nowrap inheritance issue was fixed within the new barcode component.
  Final browser run: `hpai-process-flow-B5lT0b`; no runtime exceptions.
- Production build, TypeScript and `git diff --check` passed. The existing large
  bundle advisory remains nonblocking. The already-running localhost server on
  port 8443 returns HTTP 200; attempting another dev server correctly reported the
  port in use and did not stop or replace the running server.

Tests used isolated fixtures and a temporary browser profile, never the user's
working localStorage. Print-popup HTML and print-result workflows were verified;
no physical printer/hardware delivery is claimed. The pre-existing unrelated
local edit to `docs/final-pellet-material-filters.md` is excluded from this change.

# Management-approved reprint workflow

Implementation date: 14 October 2026 (Asia/Singapore).

Status: frontend implementation prepared for isolated user testing. Automated checks pass; browser interaction, physical printing, and visual/mobile QA remain unverified. This is not a production authorization boundary or a claim that all 41 interactive regression items were manually tested.

## Git isolation and publication

- Base branch: `main`.
- Base commit: `cbded7456c91dffb784e18527c60faae83964b04`.
- Feature branch: `frontend-reprint-approval`.
- Required preflight ran: status, current branch, five-commit log, remotes, and fetch. The tree was clean. Fetch initially required filesystem approval, then succeeded.
- Clean main was pulled with `--ff-only`, which reported already up to date; the new branch was created before any file edits.
- Commit message: `Add management reprint approval workflow`. This report is part of that commit; its exact hash is provided in the final handoff and can be resolved with `git log -1 --format=%H frontend-reprint-approval`.
- Publication is limited to `origin/frontend-reprint-approval`. No main/tin/existing-feature push, force push, merge, rebase, stash, reset, cleanup, or destructive checkout is part of this feature.
- Protected branch heads retained: main `cbded7456c91dffb784e18527c60faae83964b04`; tin `084c56db64d8915a2d8d124b5ad02af52f237c85`; frontend-search-specification `986e6979edf19b28517ee8577a4649ee3a819c5e`.
- Both logo images and `.gitattributes` are untouched. No Git LFS configuration was changed.

## Added files

- `src/reprintWorkflow.ts`: typed, side-effect-free state transitions and role/request validation.
- `src/printableRecords.ts`: descriptors for supported live records, hydration, document resolution, read-only search enrichment.
- `src/reprintSamples.ts`: four administrative demonstration states referencing existing records/accounts, only for fresh sample state.
- `src/components/PrintAction.tsx`: shared original/reprint request controls, confirmation, locked print sessions, explicit successful-print acknowledgement; batch originals use the same guard.
- `src/components/DocumentPrintButton.tsx`: status-aware entry buttons for existing official document lists and details.
- `src/components/ReprintApprovals.tsx`: searchable/paginated approvals, owner monitoring, exact-request review dialog, audit timeline and approved-print entry.
- `scripts/check-reprint.mjs`: isolated state/store/render/authorization/persistence/inventory-safety regressions; compares operational source against the base commit.
- `docs/reprint-approval-workflow.md`: this handoff and testing report.

## Existing files modified

Shared wiring: `package.json`, `src/App.tsx`, `src/store.tsx`, `src/types.ts`, `src/documentPrint.ts`, `src/index.css`.

Components: `BarcodeLabel.tsx`, `DocumentViewer.tsx`, `ManufacturingOrderDetails.tsx`, `NotificationPanel.tsx`, `RecordSearch.tsx`, `UniversalSearch.tsx`, `SearchableSelect.tsx`, all under `src/components/`. The searchable selector gains an optional menu class so the reason menu stays above the reprint modal without changing other menus.

Pages: `src/pages/NotificationsPage.tsx`; Accounting `BranchRequests.tsx`, `RRRecords.tsx`, `Transfers.tsx`; Marketing `Orders.tsx`; Management `Operations.tsx`; Owner `Records.tsx`; Plant Manager `FinishedGoods.tsx`, `IncomingTransfers.tsx`, `MainPlantRequests.tsx`, `PelletInventory.tsx`, `ProductionOrders.tsx`, `RejectedRecycling.tsx`; Production `ProductionOrders.tsx`, `Recycling.tsx`.

These changes connect print actions or their searchable metadata. No operational creation, receipt, production, reservation, release, storage or recycling calculation was replaced. No dependencies were added or replaced. No unrelated formatting was run.

## Reused architecture and components

The existing `AppProvider`, shared state key `hpai:shared-app-state-v1`, localStorage persistence, existing users and roles, notifications, audit records, `RecordHistory`, `Modal`, `ConfirmModal`, `AccessRestricted`, `SearchableSelect`, existing button/table styles, `Pagination`, record search, universal search, document builders, and barcode SVG/print layouts are reused. The sidebar and routes remain unchanged.

Management location: Operations → **Reprint Approvals**, an internal tab alongside Inventory, Production, Orders and Attendance. Existing page search is reused; Status and Type are the only additional filters. Search/filtering precedes pagination, with at most ten rows per page.

Owner location: Operations & Records → **Reprint Requests & History**, a read-only section, not an approval role.

## Print model and lifecycle

The shared store adds `printMetadata` keyed by `kind:recordType:recordId` and `reprintRequests`. Operational records remain unchanged. Metadata preserves count, first/last actor and timestamps. Request records preserve exact record ID/reference/barcode, kind/type, requester employee ID/name/role/time, required reason, previous count, approval/rejection actors/times, rejection reason and use actor/time/count.

Derived states: NEVER_PRINTED, PRINTED, REPRINT_PENDING, REPRINT_APPROVED. Request lifecycle: PENDING → APPROVED → USED, or PENDING → REJECTED. There is no delete, cancellation-of-history or unrestricted reprint action.

1. Authorized originals offer Print. Preview alone changes no count.
2. The user acknowledges physical success. The store records count 1 plus first/last metadata and Initial Print audit event.
3. Later copies require Request Reprint, including Owner and Management. A reason is mandatory, and Other requires a non-whitespace explanation.
4. Pending/unused Approved requests block duplicate requests for the same record.
5. Only active Management users can review; self-review is rejected by employee ID. The same rule is checked in UI and store, not just hidden buttons. With only one Management account, its own request remains blocked with the required explanatory message.
6. Approve and Reject both require confirmation. Reject also requires a reason. Approval does not open a printer or change a count.
7. Only the original requester, still authorized for the live printable type, can use the exact approved request. A confirmation precedes the approved print.
8. Successful acknowledgement increments count and atomically changes the request to USED. Another copy requires a new request. Reused, mismatched or stale approvals fail validation.
9. Preview cancellation, blocked popups, failure or component close release the session without consuming authorization. Rapid clicks are guarded. Browser-native origin locks also prevent overlapping print sessions across supported localhost browser tabs; other tabs receive an explanatory message. Without Web Locks, per-instance duplicate guards and fresh persisted-state validation remain, but cross-tab exclusion is not guaranteed.

Browser events do not prove physical printer success: [`afterprint`](https://developer.mozilla.org/en-US/docs/Web/API/Window/afterprint_event) may follow closing preview. Consequently no approval is consumed by `afterprint`; success is explicitly acknowledged. Origin lock lifetime follows the callback promise, as documented for [`LockManager.request`](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request).

## Compatibility and supported print coverage

Existing saved state is not cleared, replaced or demo-reseeded. Missing metadata defaults to zero; legacy physical records already marked Printed hydrate to count 1 without fabricated actor/date values. Existing request/metadata maps are retained. Fresh sample initialization adds one Pending PO request, one Approved existing finished-pipe label request, one Used RR history request and one Rejected Customer Order request. No parallel operational records or Management accounts are created. Users with existing saved state can create their own requests normally, without resetting storage.

Administrative transitions synchronously persist using the existing shared storage key; normal store persistence also remains. Storage events synchronize administrative metadata/history between tabs without replacing another tab's operational collections or current user. As in the existing prototype, unavailable/full localStorage leaves in-memory operation usable but cannot guarantee refresh persistence.

Supported barcodes: existing Virgin and Recycled physical pellet bags and existing individual finished-pipe labels, including original-label batch printing. Loose recycled pellets and colorants do not gain invented barcodes. No new coil/bundle/product-batch workflows are invented.

Supported documents: Customer Order, Manufacturing Order, Production Order, Receiving Report, Material Request, Material Transfer/Incoming Transfer (same underlying transfer), and Recycling Record. Existing builders retain contents/references and gain only stable record ID metadata. No new official shipment/PR type is invented.

**Baseline discrepancy:** the inspected main uses physical `PIPE-2026-0021-001` identifiers, not the brief's `PEP-1031|HDPE Pipe|110mmx6m|SDR11` product-format example. PEP item-code, seasonal badge and By Group/MO Group/Replenishment Group features were not present in the inspected source. The brief makes the current build authoritative and prohibits changing these systems, so this feature preserves the actual existing barcode strings/generation, product master, batch logic and workflows. It does not silently implement the missing product/group systems or change barcode format. This distinction needs user review before any later merge.

## Notifications and search

Management receives Action Required notifications with exact request ID, reference, requester and reason. Approval/rejection alerts are scoped to the requesting employee (Owner can monitor). Header/history actions show Review Request, Reprint Now or View Request and open that exact authorized request. Approval notification opens the approved record flow but never bypasses print confirmation or the store guard.

Reprint Requests participate in universal search: Management/Owner see authorized monitoring records, other roles see their own. Unauthorized users cannot inspect the approval list or open another employee's request. Document and barcode searches include print/reprint metadata through read-only views; no inventory array is rewritten for search. Relevant memoized filters refresh when administrative metadata changes. Request history uses existing audit records/timeline, not a second history store.

## Automated verification

- `pnpm.cmd exec tsc --noEmit`: passed.
- `pnpm.cmd run check:search`: 165 existing master/search/pagination/role/page-render checks passed.
- `pnpm.cmd run check:reprint`: 124 checks passed, covering six-role original/reprint restrictions, required reasons, duplicate requests/clicks, self-review, exact-record/requester matching, rejection, one-use approval, browser-lock contract, store-level barcode and PO cycles, refresh hydration/persistence, original batch guards, authorized notifications/search, ten-row pagination, UI static rendering and source regression invariants.
- Barcode and document store cycles compare every operational collection before/after: pellets, finished goods, PO/MO/SO/RR, material requests/transfers, recycling/rejections/colorants, consumption and inventory transactions, attendance/turnovers, customers/employees. They remain identical.
- 37 existing operational actions/sample declarations are compared against base source, including login/role routing, material plans/consumption, order/MO/PO/replenishment, requests/transfers, storage/reservations/shipment/recycling and attendance/turnover. Four permanent barcode generation helpers, five barcode encoding/rendering functions, product master, document contents and sidebar are also verified unchanged.
- `pnpm.cmd build`: passed; no new startup service, database, API or internet requirement. Vite retains a non-blocking bundle-size warning; unrelated code splitting was not introduced.
- Existing Vite server: HTTP 200 for `http://localhost:8443/` and transformed `ReprintApprovals.tsx`/`PrintAction.tsx`. No second server was started; `dev` configuration is unchanged.
- `git diff --check`: passed. No configured lint/typecheck script exists; TypeScript was invoked directly. No lint result is claimed.

## Manual QA still required

Computer-use skill was consulted for visual QA. Browser inventory returned no enabled sessions; the Windows helper reported: `Computer Use native pipe is unavailable: failed to connect native pipe: The system cannot find the file specified. (os error 2)`. No browser, authentication dialog or real printer was operated.

Consequently login/role-switch interactions, physical print result acknowledgement, preview/popups, light/dark screenshots, actual overflow at 360/375/390/412/430px, and the full 41-item interactive regression checklist are **not claimed as passed**. Scoped responsive styles reuse current tokens and constrain request fields/modals/table scrolling, but inspection is not visual verification. The isolated branch is intended for this testing before any merge decision.

Suggested test: print an original label/PO and confirm success; request a reasoned reprint; switch to Management → Operations → Reprint Approvals; confirm approval without automatic printing; return as requester; confirm one reprint and physical success; verify USED/count 2 and a new request required. Repeat with rejection, Management self-request, refresh at every state, and two tabs. Check all existing production/storage/inventory workflows and the five requested mobile widths in both themes. Do not reset browser storage to run the test.

Frontend controls and localStorage are not tamper-proof. Browser-native printing, copies selected in the operating-system printer dialog, and developer-tool/localStorage manipulation cannot be securely governed without a later backend/controlled printing integration. No such backend was added here.

CURRENT MAIN BUILD PRESERVED.

MAIN WAS NOT MODIFIED BY FEATURE IMPLEMENTATION.

TIN WAS NOT MODIFIED.

FRONTEND-SEARCH-SPECIFICATION WAS NOT MODIFIED.

FEATURE IMPLEMENTED ONLY ON FRONTEND-REPRINT-APPROVAL.

NO AUTOMATIC MERGE TO MAIN.

NO PRODUCT BARCODE FORMAT CHANGES.

NO INVENTORY LOGIC CHANGES.

NO STORAGE LOGIC CHANGES.

NO REPLENISHMENT LOGIC CHANGES.

NO DATABASE CHANGES.

NO SQL.

NO SUPABASE MIGRATIONS.

NO RLS.

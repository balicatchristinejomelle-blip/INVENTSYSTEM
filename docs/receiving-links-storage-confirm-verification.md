# Approved receiving links and scan-first pipe storage

Continuation from local main `6a0a293`, 2026-10-20. The existing counted-receipt and label-printing implementation was preserved, not restarted.

## Scoped corrections

- Added a read-only Material Request relationship resolver. An explicit request reference can identify the existing request by its unique reference number or record ID, ignoring only case and surrounding whitespace. Stored IDs, references, statuses and approval history are not rewritten.
- Receiving actions, receipt planning, accepted-bag lookup and print approval use the same resolver. Pending/New/Rejected, unknown, missing and ambiguous links remain blocked. Delivery status and matching material alone never grant approval.
- Existing ID-linked transfers are reused rather than duplicated. The duplicate-request guard and inventory indicator now recognize a fully received linked transfer; a partially received delivery still counts as in progress.
- Kept Plant Manager receiving count-based: Received Bags, physical location, partial-discrepancy reason, Accept Transfer, then accepted-only labels/inventory and View/Print. No receiving scanner was added.
- Changed the existing Pipe Storage session to Scan Pipe Barcode / Validate Pipe, then Location A–I, then explicit Confirm Storage. Validation itself makes no persistent change. Confirmation revalidates the same barcode **and** pipe ID, lifecycle, production source and compatible location before calling the unchanged storage handler.
- Storage purpose remains automatic. The last physical location is retained for the next validated pipe. Duplicate/already-stored scans are blocked. Store Pipes remains inside Scanner; no sidebar, route or RBAC configuration was changed in this continuation.

## Preservation

The actual `acceptCountedPelletTransfer` and `updateFinishedGoodStorage` callbacks are unchanged. Store changes are limited to relationship lookups in label viewing, existing-transfer reuse and the duplicate-request guard. Seeds, quantity calculations, Production/WIP loading, print/reprint workflow, Date logic, location master, pipe relationship engine, master mappings, types and database configuration remain unchanged.

No production/sample records were edited, deleted, regenerated or reseeded by this patch. No localStorage wipe or inventory reset was added. Browser tests use a separate temporary profile and isolated legacy-link fixtures, never the user's browser storage. The pre-existing edit to `docs/final-pellet-material-filters.md` remains excluded.

## Verification

- Focused isolated checks cover full 20/20 (20 labels, 500 kg), partial 18/20 (18 labels, 450 kg, 2 missing), later cumulative acceptance, original Sent Quantity, ID/reference preservation, same-barcode reprints, legacy pending records, reload and six-role restrictions.
- ID, padded/case-varied ID and padded/case-varied reference fixtures exercise the real receipt and print validation functions. Missing/ambiguous references and Pending/Rejected requests are explicitly tested without mutation or guessed approval.
- `pnpm.cmd build` and TypeScript no-emit check passed (135 modules). No source compilation errors.
- `pnpm.cmd check:incoming-printing`: 77 isolated checks passed, including exact source-scope guards, approval lookup and original-record preservation.
- Clean final run: all 20 repository regression suites passed, zero failures (including 76 storage checks and 79 end-to-end process checks).
- `pnpm.cmd qa:process-flow:browser`: passed in isolated profile `hpai-process-flow-BG4QS2`. The actual App/sidebar routes accepted 20/20 through an ID link and 18/20 through a case/spacing-varied reference. Both generated exactly the accepted label count, printed the same values, and retained exact bags/transfers/transactions and the original request link after refresh.
- The actual Scanner route showed no physical-location control before validation. A valid scan made no persistent changes; missing location blocked confirmation; explicit confirmation stored the exact scanned pipe. Multiple confirmations reused Location A, duplicate scans changed nothing, refresh preserved stored records and storage movements added zero stock quantity.
- Desktop and mobile screenshots of the validated pipe and counted receiving were inspected. Width assertions passed at 360, 768 and 1280 px; no standalone Store Pipes menu or retired wording is present.
- Existing Production/WIP, 10-good-pipe output/storage, shipment, six-role, Print Selected/All and Management-approved reprint browser scenarios also passed. The test harness dispatches each simulated HID burst in one browser task; real scanner/printer hardware was not connected. Application scanner timing rules are unchanged.
- `pnpm.cmd dev` was run and reported existing port 8443 in use. The running server was left untouched and returned HTTP 200.

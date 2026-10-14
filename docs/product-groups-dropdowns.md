# Product grouping and complete product filters

## Scope and architecture

1. Current build preserved. This is an additive frontend update to the existing React/Vite application; no database, SQL, backend, dependencies, routes, roles, or image changes.
2. Existing architecture: shared `productMaster.ts`, `SearchableSelect`, relationship hydration, localStorage app state, role-scoped page/universal search, and ten-row pagination were reused.
3. Root cause: Plant Manager Finished Goods and Reports used `sortSizes(currentPipes.map(...diameter))`; the seed's 110mm records therefore defined the entire size menu. Both record-derived option sources were removed.
4. New files: `src/productFilters.ts`, `src/productionGroups.ts`, `src/components/ProductFilters.tsx`, `src/components/FinishedGoodGroups.tsx`, `scripts/check-product-groups.mjs`, and this report.
5. Modified shared files: `src/finishedPipeRelations.ts`, `src/printableRecords.ts`, `src/components/FinishedPipeDetails.tsx`, `src/components/RecordSearch.tsx`, `src/components/UniversalSearch.tsx`, `src/components/SearchableSelect.tsx`, `src/index.css`, and `package.json`.
6. Modified role pages: Owner Records/Reports; Accounting Transactions; Marketing Orders/Finished Goods/MO Tracking/Reports; Management Operations/Reports/Settings; Plant Manager Production Orders/Finished Goods/Reports; Production Production Orders/Finished Pipes/History.
7. One shared master remains the source of truth. New filter helpers select compatible domain options from it; they do not define competing page-specific size or SDR arrays.
8. Existing searchable combobox reused. Selection placeholder is `Select SDR / Thickness`; open search placeholder is `Search SDR / Thickness...`. The optional open-search placeholder does not change other consumers' default behavior.

## Production groups

9. Assignment: existing new MO POs inherit `mo.moNo`; existing replenishment creation assigns the stable `REPLENISH-year-POsequence` reference. These creation actions and their sequence logic are unchanged.
10. Multiple POs: all POs with the same MO origin aggregate into one MO group. Multiple replenishment POs with the same existing event origin aggregate into one replenishment group. Existing one-PO/active-replenishment duplicate-prevention rules were deliberately not relaxed; independent new events are not guessed to be continuations.
11. Group → PO(s) → batch(es) → physical pipes is a read-only aggregation. No group entity, new batch, reference, or pipe is generated during rendering.
12. Permanent history: relationship resolution prefers a valid assigned pipe origin. PO hydration also preserves valid assigned origins. Missing legacy origins resolve deterministically from actual source relationships.
13. Reservation, relocation, readiness, shipment, and JSON refresh retain the original replenishment origin. Isolated tests exercise the actual existing store actions for this sequence.
14. Plant Manager Finished Goods retains By Batch and Individual Pipes, adds By Group, and makes the existing target panel accessible through Stock Levels. Marketing Finished Goods also adds the shared read-only By Group view.
15. Group cards/detail show source, type, reference, configured item codes, exact product snapshots, conditional seasonal badge, POs, batches, produced/good/rejected, available/reserved/temporary/ready/shipped, and status. Replenishment details include aggregate target quantity. MO details resolve actual MO/SO/buyer; replenishment details never fabricate these relationships.
16. Related physical pipes are capped at ten per page and open the existing details flow. Aggregation never changes membership because a filter or reservation changes; filters select groups, not rewrite their children.
17. Selected PO determines output origin. Production and Plant Manager PO details display read-only group context; Production receives no group assignment or master editing action.
18. Group Type and Origin Group are explicit in the shared pipe card, separate from Item Code, Product Barcode, physical ID, Batch, PO, MO, and SO. Product Barcode format/generation and existing printed values are unchanged; origin is never encoded into it.

## Product controls and role coverage

19. Standard master is exactly: 13, 20, 25, 32, 40, 50, 63, 75, 90, 110, 160, 225, 280, 315, 355, 400, 450, 500mm. 110mm, 315mm, and 500mm remain selectable without stock. 100mm is not an active new option; historical records remain readable/searchable.
20. CTS uses 1/2", 3/4", 1"; Spiral uses 12", 16". All-product filters expose their combined valid domains. Polytube uses genuine active configured sizes only, with no invented default master.
21. One combined SDR / Thickness field exposes SDR9, SDR11, SDR13.5, SDR13.6, SDR17, SDR21, SDR24, SDR26, SDR33. Search `11`, `13`, and `33` returns the required values; there is no separate Thickness field.
22. Existing Product, four active Material Grades, straight/coil lengths, colors, stripes, construction, and form masters remain unchanged. PE80 remains historical only.
23. Owner: product record views, analytics, specification list/create controls, and finished-pipe stock target filters use the shared master. Existing configuration actions retain their authorization.
24. Accounting: Finished Pipe inventory movements use the same product/grade/size/SDR filters. Raw-material-only receiving, requests, transfers, and reports were not given irrelevant pipe controls or new finished-goods permissions.
25. Marketing: customer order selection/filtering, MO tracking, Finished Goods By Group/By Batch/Individual Pipes and reservation/readiness/shipped status views, and analytics share complete options.
26. Management: production monitoring, finished goods monitoring, reports and quality use shared values. Quality's old record-derived product list now uses the master. Reprint Approvals and workforce/raw-material behavior remain separate.
27. Plant Manager: PO/MO filters, replenishment selection, Finished Goods Stock Levels/By Group/By Batch/Individual Pipes and related barcode management, and applicable reports use complete shared values.
28. Production: PO/output specification context, finished pipe product/status views, and own product history use shared filters. Existing employee scoping remains intact; no configuration permission was added.
29. Existing size controls were replaced, not duplicated. Missing SDR controls were added once. Existing correct master-backed selectors were retained. Product changes clear only an incompatible size and update its construction; grade/size/SDR/color changes retain unrelated valid form data. Form changes clear only an incompatible straight/coil length.
30. Zero-stock options do not disappear. 315mm/SDR33 fixtures return no matching records or groups; clearing filters restores all six existing physical pipes. No new live sample was added.

## Search, persistence, verification

31. Main/group search retains partial, case-insensitive behavior. Relationship/specification enrichment adds existing configured Item Code/Product Barcode and origin metadata to applicable PO/order/pipe records. Universal search enriches existing authorized results without adding collections or permissions. No PEP code is invented or reassigned. Search/filter/sort remains before ten-row pagination, with page resets on filter changes.
32. Persistence and calculations: no dataset reset, localStorage clear, regenerated references, new schema, or group writes. `store.tsx`, `types.ts`, `productMaster.ts`, barcode rendering, official document contents, reprint workflow, and Sidebar are byte-for-byte identical to the pre-task main baseline (line-ending normalization only in assertions). Available/reserved/temporary/ready/on-hand/raw/WIP/in/out formulas, stock thresholds, replenishment creation, material requests, and storage actions are unchanged.
33. Automated verification: 165 search + 124 reprint + 90 pipe relationships + 57 focused group/filter checks = 436 passing checks. TypeScript `--noEmit`, `pnpm.cmd build`, and `git diff --check` pass. Actual reservation/relocation/release action tests use isolated in-memory fixtures, never the user's localStorage. Existing Vite preview on port 8443 responds HTTP 200; no second dev server was started. Build retains the existing >500kB chunk warning.
34. Interactive verification limitation: Computer Use skill was followed, but `sky.list_apps()` failed with native pipe unavailable (OS error 2). Desktop/mobile 360/375/390/412/430px, actual keyboard interactions, dropdown scrolling/portal clipping, and light/dark visual checks are NOT claimed as passed. Existing combobox behavior and scoped responsive/theme-token CSS are reused; SSR and pure-function tests are not a substitute for browser QA.

## Explicit preservation confirmations

- Grouping is additive: one MO group supports multiple existing POs; replenishment groups have no fake MO; assigned pipe origins survive reservation and shipment.
- Complete product menus are master-driven, not limited by displayed inventory. Standard 18, CTS, Spiral, zero-stock sizes, and all nine SDR values remain available according to product compatibility across all six roles.
- Group, batch, Item Code, canonical Product Barcode, and physical pipe identity remain separate. Existing PEP metadata, seasonality, batch logic, storage purpose/location, inventory math, replenishment rules, and reprint authorization are preserved.
- No backend/database/SQL changes, localStorage reset, extra live sample, broad stylesheet rewrite, image/LFS changes, or unrelated commits are included.
- The latest typed user request explicitly authorizes commit, push, and merge, overriding the pasted brief's default instruction not to merge automatically. Verification precedes the authorized merge.

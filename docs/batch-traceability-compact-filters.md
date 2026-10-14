# Final batch traceability and compact product filters

This report supersedes the earlier By Group navigation design; it does not revert its underlying origin metadata or master fixes. The latest typed request explicitly authorizes commit, push, and merge after verification.

## Requested implementation report

1. Existing groups: `ProductionOrder.originGroup`, `FinishedGood.originGroup`, automatic source assignment, idempotent relationship hydration, and read-only aggregation in `productionGroups.ts` were already present.
2. Existing master: `productMaster.ts` contains the official product, grade, diameter, SDR, length, color, stripe, construction, and form values; normalized specification records remain in existing localStorage.
3. Existing searchable control: `SearchableSelect` and its native-option adapter `SearchableDropdown` are reused, with existing portal, search, keyboard, clear, scrolling, and viewport behavior.
4. Original 110mm bug: record-derived size options reflected only the seed's current pipes, not the complete master. That bug was fixed in the preceding merged update and remains fixed here.
5. Former affected components: Plant Manager Finished Goods and Reports used `sortSizes(currentPipeDiameters)`. Neither source has been reintroduced.
6. Missing SDR audit: the preceding update already added actual searchable SDR filters to applicable finished-goods, order, monitoring, history, and report views. They are retained. No second SDR field was needed or added in this task.
7. Modified files: `src/productionGroups.ts`; shared `ProductFilters`, `PeriodSelector`, `RecordSearch`, and scoped `index.css`; Accounting Transactions; Management Operations/Settings; Marketing Finished Goods; Owner Records; Plant Manager Finished Goods/Reports; Production Finished Pipes/History/Production Orders; and `scripts/check-product-groups.mjs`. Only task-related files were staged.
8. New files: `src/components/BatchTraceability.tsx` and this report. Removed: `src/components/FinishedGoodGroups.tsx`, the now-unused standalone listing/view action. It is recoverable from the preceding Git history; no data or origin utility was deleted.
9. Shared master source remains `HPAI_PRODUCT_MASTER` / `productFilterSizes`; existing specification compatibility and genuine configured Polytube sizes are retained.
10. Shared selectors remain `SearchableSelect` / `ProductFilters`. External product/grade state can now bind into the same four-field row without duplicating controls or replacing page filtering state.
11. MO assignment remains in the existing `createProductionOrder` action: the actual MO number is the logical origin.
12. Replenishment assignment remains in the existing `createStockReplenishmentPO` action: the stable existing PO sequence supplies its origin. No render-time group generation or manual group name was added.
13. Multiple POs under one MO retain one origin; existing duplicate-PO/active-replenishment creation rules were not relaxed.
14. Multiple batches may share one stored origin; batch identity was not collapsed into group identity. Mixed-origin legacy batch metadata lists every actual origin rather than silently choosing the first pipe.
15. Pipes retain their valid assigned origin through the existing resolver/hydrator; those implementations are unchanged by this task.
16. Actual isolated reservation → relocation → readiness → release actions still retain the original replenishment group through JSON refresh. Customer allocation is not displayed as replenishment production origin.
17. Both finished-goods pages now expose exactly Stock Levels, By Batch, and Individual Pipes. By Group and standalone View Group navigation are removed.
18. Origin Group fields, grouping utilities, source resolution, persistence, search metadata, and PO/pipe traceability remain intact.
19. By Batch now exposes origin/type next to batch identity, configured item code and conditional seasonality, PO/MO, specification, shift where available, and temporary-storage context without adding a wide column for every field. Mobile cards show origin/type too.
20. Both batch detail modals reuse `BatchTraceability`: Origin Group, Group Type, Item Code, canonical Product Barcode metadata, PO, actual MO/SO/buyer, production storage purpose, shift, and temporary count. Replenishment origin details show MO/SO/buyer as N/A, even after later customer reservation. Existing per-batch child lists remain capped at ten.
21. Individual pipe details retain their existing Group Type/Origin Group fields and all identity, allocation, location, shipment, and barcode information; the shared details module was not rebuilt.
22. Owner: Records now places shared product filters between Search and Date, with operational filters separate. Duplicate pipe-grade controls were removed; raw material grade filtering remains. Reports and specification/stock-target settings retain the shared master and owner-only actions.
23. Accounting: Finished Pipe transaction filters use Search → four product fields → transaction/date controls. Raw receiving/request/transfer screens remain unchanged and gain no pipe configuration permissions.
24. Marketing: Finished Goods has the simplified three-view navigation, coherent product row and separate status filter, read-only Stock Levels using existing availability cards, and batch origin details. Customer Orders, MO tracking, and reports benefit from the same shared grid without altering their actions.
25. Management: product monitoring uses one Search/product/date hierarchy, with product switching bound into the shared row. Quality/report masters remain complete. Reprint Approval, attendance, and raw-material views are not forced into the product layout.
26. Plant Manager: Finished Goods controls precede results/stock targets; view switches and guarded printing occupy separate rows. PO/replenishment selectors remain master-backed. Reports consolidate existing product/grade controls into the shared grid, retaining status/location filters and exact stock formulas.
27. Production: PO, finished-pipe, and own product-history filters use the shared Search/product/date hierarchy. Master editing remains unavailable; output specifications and origin remain inherited/read-only.
28. Size menus remain independent of current records. The original full master source was retained, not replaced with hard-coded page arrays.
29. SDR / Thickness is one actual searchable combined selector, with the complete nine-value master. Missing controls added previously remain present; correct existing controls were left in place.
30. Desktop: balanced four-column grid, full-width single-line 36px Search, matching 36px product controls, and explicit start alignment. The old two-column parent could stretch Search beside a tall narrow filter stack; the product row now spans the parent grid.
31. Tablet: product/operational grids use two columns at widths up to 1100px, with full-width Search.
32. Mobile: grids use one column up to 600px, covering all requested 360/375/390/412/430px widths. Existing theme/portal behavior and overflow-safe grid cells are reused. These breakpoint rules are source-tested, not visually certified.
33. Standard sizes verified: 13, 20, 25, 32, 40, 50, 63, 75, 90, 110, 160, 225, 280, 315, 355, 400, 450, 500mm. No new active 100mm; historical 100mm stays readable.
34. CTS verified: 1/2", 3/4", 1".
35. Spiral verified: 12", 16". Polytube still uses genuine configured sizes only.
36. SDR verified: SDR9, SDR11, SDR13.5, SDR13.6, SDR17, SDR21, SDR24, SDR26, SDR33. Search 11/13/33 returns the requested matches.
37. Zero-stock master options remain selectable. 315mm/SDR33 produce empty results instead of disappearing. Clearing filters restores the six existing physical pipes; no new live sample was added.
38. Search/filter/sort remains before ten-row pagination; filter handlers retain page resets. Group queries remain searchable through batches, PO/pipe metadata and authorized universal search.
39. Six-role consistency: shared controls render exactly four product fields without duplicate selectors under all six role contexts; existing role-scoped page/universal search checks pass. RBAC still controls actions, not arbitrary master differences.
40. localStorage: no schema change, reset, clearing, regenerated identifiers, or data migration. Valid assigned origins and the existing realistic dataset remain untouched. Test fixtures are in-memory only.
41. `pnpm.cmd build` and TypeScript `--noEmit` pass. The existing >500kB bundle warning remains; no unrelated splitting/refactor was attempted.
42. The already-running Vite application and changed modules respond HTTP 200 on port 8443. Per repository instructions, a second dev server was not started.
43. Regression: 165 search + 124 reprint + 90 pipe + 66 focused master/group/batch/layout checks = 445 passing checks, plus build, TypeScript and `git diff --check`. Actual browser screenshots/keyboard/scrolling/mobile/light/dark QA is blocked: no connected browser surfaces, and Computer Use native pipe unavailable (OS error 2). SSR and CSS-source assertions are explicitly not visual browser tests.

## Explicit final confirmations

- CURRENT HPAI BUILD WAS PRESERVED; no working module was rebuilt. Finished Goods now uses STOCK LEVELS / BY BATCH / INDIVIDUAL PIPES; separate BY GROUP navigation is removed.
- Origin Group data, MO grouping and replenishment grouping are preserved. Multiple POs under one MO and multiple batches may share one origin. No fake replenishment MO. Reservation does not change origin; By Batch and individual details retain searchable traceability.
- Applicable product dropdowns remain shared-master-driven, never limited by current records. Complete Standard 18 include 110mm, zero-stock 315mm/500mm; no new active Standard 100mm. CTS and Spiral options are preserved.
- Previously missing SDR controls remain added and searchable. All nine SDR options are retained in one combined SDR / Thickness field, with no duplicate Thickness/SDR field.
- The oversized/stretched Search layout has been replaced in source with normal single-line sizing and a responsive four/two/one-column product grid across comparable six-role product views. Actual visual/mobile/theme verification remains blocked as described above.
- PEP Item Codes, canonical Product Barcode, physical Pipe Record ID and batch identities were not changed. Group information never enters the Product Barcode.
- MO production still uses Temporary Storage; replenishment origin still uses Inventory Storage. Inventory/replenishment calculations, duplicate prevention, material requests, guarded printing and reprint approval are unchanged.
- Localhost data was not wiped. No database, SQL, Supabase migration, RLS, backend, dependency, image or unrelated LFS changes.

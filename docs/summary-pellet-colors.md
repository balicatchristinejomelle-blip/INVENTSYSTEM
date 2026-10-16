# Inventory summary and pellet color correction

## Scope and visual correction

The shared `MetricCards` inventory cards had in-flow expanding help that could
stretch a single card and displace its value. Labels now have a shared alignment
area, values line up, and all five help buttons use the same 24 px control and
bounded, keyboard-dismissable native popover. Unrelated dashboard cards and the
existing finished-pipe detail help retain their layouts.

Affected summary views: Marketing Finished Goods, Production Finished Pipes,
Plant Manager Finished Goods and Finished Goods report, Owner Reports, and
Management Reports (Inventory). Their five primary cards keep the same values
and responsive five-column / three-plus-two / two-plus-two-plus-one layout.

## On Hand reconciliation

The inventory engine and stock movement calculations are unchanged. Every
summary now explicitly reconciles:

`On Hand = Available + Reserved + Temporary Storage + Ready for Ship Out + Awaiting Storage + Quality Pending + Held Rejected`

These are mutually exclusive physical-pipe buckets, not kg. Shipped pipes are
excluded; duplicate physical identities are counted once by the existing engine.
Held/awaiting pipes are not sellable Available stock. The fresh sample therefore
correctly shows On Hand 6 = Available 1 + Awaiting Storage 5.

## Pellet colors and safe sample repairs

- `src/pelletColors.ts` defines type-specific pellet body colors. Virgin is White;
  Recycled retains the recorded color, including custom colors or actual White.
  An unknown historical recycled color is explicitly **Not specified**, not an
  invented White or Mixed value.
- Bag creation and saved-state hydration enforce Virgin White. Related pellet
  receiving reports, requests and transfers use the same metadata rule;
  Colorant documents retain their own colors.
- Receiving and Material Request forms lock Virgin to White and accept actual
  Recycled colors. Their store actions also normalize Virgin and reject a blank
  Recycled color. Pipe specifications/colorant recipes remain independent.
- Material color pickers include White, multiple non-White master choices and
  actual custom recorded colors. Owner's combined inventory picker explicitly
  opts into material colors; pipe-only specification selectors remain unchanged.
- Accounting and Plant Manager bag tables now visibly show Type and Color;
  Plant Manager bag details and Material Inventory report show Color too. The
  report's searchable material metadata includes color.
- Fresh initialization changes only color metadata of existing demo bags
  `TEST-bag-001` (Black), `TEST-bag-002` (Blue), `TEST-bag-003` (Green); the remaining
  recycled demo bags stay Mixed. There are still forty recycled bags / 1000 kg.
  Existing saved actual colors are not recolored for variety. Only blank colors
  in the exact `TEST` / `TEST-SEED-RECYCLED` fixture are repaired deterministically.
- IDs, pellet barcodes, weights, balances, locations, lifecycle and histories are
  preserved. Empty saved collections remain empty. Reload is idempotent.

Relevant views: Accounting raw materials/receiving; Plant Manager inventory,
details, requests and reports; Production materials; Management inventory and
reports; Owner pellet and combined inventory records/reports. Marketing retains
its existing finished-goods-only authorization and uses the same summary fix.

## Verification

Final result (2026-10-16): **2,126 automated checks passed**, TypeScript passed,
production build passed, and **126 responsive browser surfaces plus actual
receipt/request workflows passed**. The existing large-bundle warning is
non-fatal. The running Vite dev server returned **HTTP 200** on port 8443 and
served its development client; no duplicate server was started.

Commands: all fifteen `check:*` suites (including `check:summary-colors`),
`pnpm.cmd exec tsc --noEmit`, `pnpm.cmd build`, and
`pnpm.cmd qa:summary-colors:browser`.

The new suite independently checks exact reviewed edits, every existing business
callback except the explicit color-only additions, unchanged inventory/identity/
authorization engines, saved-state preservation, empty collections, idempotence,
color search/filter agreement, seed quantities and all six role contexts.
Historical suite guards retain their exact baselines and separately reviewed
new modules; their current runtime assertions remain active.

Browser QA uses an isolated temporary profile, never a user's live browser or
saved localhost state. It covers all five help controls, unchanged card geometry,
Escape dismissal and viewport bounds on 84 summary surfaces (seven widths, two
themes, six views), plus color display/filter/search on seven material/combined
inventory/report variants at desktop, tablet and mobile in both themes. Actual
receipt/request actions verify Virgin White, custom Recycled retention, blank
Recycled rejection and unchanged normal bag quantities.

The Vite development server was already running on port 8443; it is reused, not
reset or duplicated. HTTP health is checked separately from the production build.

## Explicit safety confirmations

- Summary cards visually consistent; help/icons aligned, no card-specific help box.
- On Hand logically reconciled with all visible named buckets; formulas unchanged.
- Virgin White; Recycled supports different actual colors, not a White-only default.
- Corrections shared across relevant authorized users.
- No unrelated business logic, stock movement, barcode, quantity or RBAC changes.
- No localStorage wipe, reset, transaction reseed or database changes.

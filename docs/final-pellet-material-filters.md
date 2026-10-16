# Final pellet / material filters and layout

Supersedes the color-option rules in `summary-pellet-colors.md`. Frontend/local
state only; no database or Supabase changes.

## Results

1. **Files:** shared `pelletColors.ts`, `PelletColorField`, `MaterialLocationFilters`,
   `ProductFilters`, `InventoryFacetFields`, `SearchableSelect`, `locationMaster`,
   `productFilters`, scoped filter/popup CSS; relevant Accounting, Owner,
   Management, Plant Manager and Production views/documents; store color
   validation/output metadata; frontend types; regression/browser tests.
2. **Virgin:** new/current choices are White only, read-only in creation forms.
   Switching from Recycled clears the prior color and derives White. New writes
   cannot store another Virgin color.
3. **Recycled:** the full fixed master is Black/BK, Blue/BE, Orange/OR,
   Red Orange/RO, Green/GRN. It reuses the shared HPAI product color configuration,
   not inventory, Location, search, pagination or current stock. Zero-stock colors
   remain selectable. Combined inventories show the union of the two legitimate
   type-specific masters; Virgin-only contexts never offer recycled colors.
4. **Mixed:** not an active option in creation, processing, filters or current
   demo defaults. Unknown/custom/Mixed new recycled colors are rejected by receipt,
   request, transfer and recycling boundaries. Saved historical Mixed remains
   unchanged and displays `(legacy)`, including the explicit historical exception
   for an unusual Virgin Mixed record. No historical color is guessed. Existing
   IDs, barcodes, weights, balances, locations and histories are preserved.
5. **Location:** active choices are canonical A–I only. Section/custom names stay
   historically readable but are not active choices. Settings enforces canonical,
   nonduplicated new codes and displays legacy rows read-only. The master adds
   missing defaults idempotently without rewriting stored historical rows. The
   existing unique/multiple/zero-stock Location resolver is unchanged; the shared
   field only validates its result against the active master.
6. **Sizes:** all 18 requested Standard sizes remain available, including 110mm
   and 500mm, not 100mm. CTS 1/2, 3/4, 1 inch and Spiral 12/16 inch remain intact.
   Existing master definitions were already complete and were preserved.
7. **Length:** one Length / Coil Length field uses all six Straight and eleven
   Coil master values, independent of stock. Where Product Form context is
   supplied, only its compatible master lengths are shown. All Lengths is only
   the reset scope, never the sole available choice.
8. **Layout:** only previously unbalanced shared inventory grids are adjusted:
   5 = 3+2, 6 = 3+3, 7 = 4+3 with three full-width equal peers in row two,
   9 = 3+3+3. The good 8-filter 4+4 layout is retained. Nine-field order is
   Product, Grade, Color / Size, SDR, Location / Length, Purpose, Status.
9. **Already-good pages:** no redesign of dashboards, Login, attendance, shift,
   customer/order, SO/MO/PO/Batch/Group or finished-pipe views. Relevant tables and
   details only gain honest legacy color labels. The same existing searchable
   widget is reused, with a search field inside its portal popup and unchanged
   Arrow/Enter/Escape selection behavior. Reset labels remain fully readable.
10. **QA:** actual six-role pages and isolated master-only fixtures are tested at
    360/375/390/412/430/768/1280px in both themes. Checks include 5–9-filter row
    balance/order, full text/control geometry, table alignment, card heights,
    page overflow, popup bounds/search/keyboard, all color choices with Black-only
    inventory, Virgin/Recycled switching, valid zero-stock lengths/sizes and
    historical reload preservation. Browser profiles and test state are isolated
    from the user's live localhost data.
11. **Build/run:** TypeScript and `pnpm.cmd build` pass. The already-running Vite
    dev server on port 8443 is reused and returns HTTP 200; it is not restarted or
    duplicated.

## Inventory and workflow safety

All existing business callbacks other than the four explicitly color-related
creation/processing boundaries are byte-identical. Weight/quantity/loss/sequence
bindings and the original carry-over/bagging expressions are unchanged. To avoid
mislabeling incompatible or unclassified carry-over, recycling completion is
blocked with a review message; it does **not** silently regroup stock or alter
the pooling calculation. Finished-pipe inventory, barcodes/reprint rules, RBAC,
Date calculation/navigation and the Location-resolution engine are unchanged.
Stock-target and specification creation formulas remain unchanged.

Fresh initialization uses the existing forty recycled demo bag IDs/quantities
with valid master colors; it never resets, reinserts or recolors existing saved
inventory. Empty saved collections remain empty. No localStorage wipe, PEP
remapping, existing barcode change, stock movement or unrelated replenishment
change is introduced.

## Explicit confirmations

Final verification: **2,331 automated checks passed** across sixteen suites;
TypeScript and production build passed. The six-role full-shell audit measured
**644 page/viewport/theme surfaces with zero issues**, plus **84 unsaved form
variants** and real report/details/scanner probes. The **213 targeted surfaces
passed twice**, with the second pass additionally confirming A–I-only choices,
all 18 Standard sizes, zero-stock selection and inside-popup search/Enter.
Desktop and mobile screenshots were inspected. No known visible inconsistency
remains on the audited pages. The existing dev server returned HTTP 200.

- Virgin active choices = White only; Recycled active choices = Black, Blue,
  Orange, Red Orange, Green, with existing codes and zero-stock validity.
- Recycled choices come from master data, never current records. Mixed is not an
  active option; historical Mixed stays readable and is not silently recolored.
- Active Location choices = A–I; Section A/B/C are not active options.
- Full compatible Size and Straight/Coil Length masters remain selectable.
- Shared searchable-dropdown styling is consistent; 7/8/9 layouts are balanced
  4+3 / 4+4 / 3+3+3 where applicable. Good layouts are not redesigned.
- Date and Location automation logic is not rewritten. Inventory calculations,
  replenishment, barcodes, SO/MO/PO/Batch/Group and RBAC are preserved.
- No inventory reset, localStorage wipe or database changes.

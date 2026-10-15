# One-line PO references

PO references in applicable tables now use shared `po-column` and `po-reference` presentation styles across Owner/Super Admin, Accounting, Marketing, Management, Plant Manager, and Production.

- Complete PO references, including `PO-2026-0012` and longer values, use `white-space: nowrap`, `word-break: keep-all`, and `overflow-wrap: normal`.
- PO columns have a 150px minimum width and 12px side padding. Native automatic table layout allows longer references to enlarge the column without clipping or overlapping the Customer Order column.
- Wide tables scroll horizontally inside their table container on desktop, tablet, and mobile. Existing mobile card views remain available.
- The shared reference component marks both existing clickable PO links and plain-text PO references. Lookup logic, link handlers, destination records, and role visibility are unchanged; this adds no new link permissions.
- PO values, relationships, inventory calculations, business workflows, stored dates, backend/database behavior, and RBAC are unchanged.

All prior date/period-filter confirmations in [date-period-filters.md](date-period-filters.md) remain in effect: All/Day/Week/Month/Year, Manila calendar boundaries, Monda{�u���SSunday weeks, complete specific-date search and precedence/reset, preserved reference searches, combined filters and creation-master options, intact business-entry date fields, and shared six-role behavior.

Validation commands:

- `npm run build`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm run check:dates` and `npm run check:ux`
- `npm run qa:po:browser`: real browser checks for normal and long PO values, line counts, clipping/overlap, horizontal scrolling, existing authorized links, all six roles, both themes, and widths 360/375/390/412/430/768/1280. It also renders the actual Plant Manager Individual Pipes page with PO-2026-0012 and the Marketing Individual Pipes page with the available PO-2026-0014 sample.

The existing exact-reviewed-change regression manifest was extended for these presentation-only deltas; arbitrary changes remain rejected by the source-preservation guards.

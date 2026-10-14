# Replenishment action spacing

Both supplied attachments describe the same spacing-only fix.

The Plant Manager Production Orders page now keeps Search, Product, Material Grade, Size / Diameter, SDR / Thickness, and **Create Stock Replenishment PO** inside the existing padded filter/action panel. The button has its own existing right-aligned `product-view-actions` row, rather than occupying a product-grid cell. The panel's existing `mb-4` spacing separates it from the manufacturing-order notice and next section.

No new CSS, absolute positioning, negative margins, fixed panel heights, renamed actions, data resets, or business-rule changes were introduced. The existing action-row rules provide content-width desktop buttons and full-width buttons below 600px, covering the requested mobile widths. Existing light/dark theme tokens and the manufacturing-order notice's border/accent remain unchanged. Comparable Finished Goods action rows use this same shared pattern.

## Verification

- 449 checks passed: 165 search, 124 reprint, 90 pipe, and 70 product/group/batch/layout checks, including four new spacing checks.
- Server-rendered markup verifies all four product selectors and the button are inside one panel, with the manufacturing-order notice and pending-action section outside and after it.
- An exact source comparison against prior main verifies that reversing only the wrapper changes restores the entire original page, including the button's click handler, form validation, replenishment submission, filters, calculations, and record actions.
- The global stylesheet is byte-for-byte unchanged. Tests verify reuse of the existing panel padding and desktop/mobile action-row rules.
- TypeScript, production build, `git diff --check`, and the existing localhost preview/module on port 8443 pass. No second dev server was started. The existing large-bundle warning remains.
- Actual desktop/mobile 360/375/390/412/430px, no-overflow, and light/dark visual checks remain **unverified**: no connected browser surface, and the Computer Use skill's native connection failed with OS error 2. DOM/CSS-source checks are not screenshots or interactive browser tests.

## Requested confirmations

- CREATE STOCK REPLENISHMENT PO BUTTON SPACING FIXED in the implementation.
- The filter/action panel and the manufacturing-order section are now structurally separated with normal positive padding/margin, removing the touching-section layout cause; actual screen geometry remains subject to the visual-QA limitation above.
- NO STOCK REPLENISHMENT BUSINESS LOGIC WAS CHANGED. Button text/functionality, dropdowns, inventory state, and saved data remain unchanged.

Only the page wrapper, focused regression checks, and this report are included. Commit, push, and merge are explicitly authorized by the latest user request.

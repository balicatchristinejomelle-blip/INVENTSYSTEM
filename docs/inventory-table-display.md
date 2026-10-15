Finished-pipe inventory tables
=============================

Individual pipe tables retain complete values on one line: barcode, product, specifications, purpose, status badge, location path, PO/customer reference, print state and action labels. Columns grow with their content and cards scroll horizontally on mobile, tablet and desktop. Individual table mode stays visible on narrow screens without duplicate cards. Batch summaries retain intentional lines; unrelated tables and modal layouts are unchanged.

Applies to Plant Manager and Marketing individual/batch-detail pipe tables, Production finished pipes, Management finished goods operations/reports, Owner Finished Pipes records and Accounting Finished Pipe transactions, within existing authorization. No record values, handlers, permissions, print logic, inventory calculations or stored data changed. Previous date filters and PO links remain in place.

Validation: qa:po:browser covers six role reference permissions, long values, seven widths, two themes, actual Individual Pipes cells and View Details. Also run check:dates, check:ux, TypeScript and production build. Exact reviewed presentation hashes are registered for older source snapshot suites; browser tests load current source.

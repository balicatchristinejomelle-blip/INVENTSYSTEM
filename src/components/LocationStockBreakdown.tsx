import React, { useState } from 'react';
import type { FinishedGood } from '../types';
import { useApp } from '../store';
import { finishedGoodsSummary } from '../finishedGoodsInventory';
import { specificationKeyFromRecord } from '../productMaster';
import Pagination, { pageRecords } from './Pagination';
export default function LocationStockBreakdown({ pipes }: { pipes: readonly FinishedGood[] }) {
  const app = useApp(), [page, setPage] = useState(1);
  const groups = new Map<string, FinishedGood[]>(), seen = new Set<string>();
  pipes.forEach(pipe => { if (seen.has(pipe.barcode)) return; seen.add(pipe.barcode); const key = `${specificationKeyFromRecord(pipe)}|${pipe.currentLocation || 'Not Yet Assigned'}`; groups.set(key, [...(groups.get(key) || []), pipe]); });
  const rows = [...groups.entries()].map(([key, pipes]) => ({ key, pipe: pipes[0], ...finishedGoodsSummary(pipes, app) }));
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  return <div className="app-card table-scroll"><div className="table-title">Location-specific Physical Stock</div><table className="app-table inventory-bucket-table"><thead><tr><th>Product / Specification</th><th>Color / Stripe</th><th>Location</th><th>Available</th><th>Reserved</th><th>Temporary Storage</th><th>Ready for Ship Out</th><th>On Hand</th></tr></thead><tbody>{pageRecords(rows, safePage).map(row => <tr key={row.key}><td>{row.pipe.product} · {row.pipe.grade} · {row.pipe.diameter} × {row.pipe.length} · {row.pipe.sdr}</td><td>{row.pipe.color} · {row.pipe.stripe}</td><td>{row.pipe.currentLocation || 'Not Yet Assigned'}</td><td className="inventory-number">{row.available}</td><td className="inventory-number">{row.reserved}</td><td className="inventory-number">{row.temporary}</td><td className="inventory-number">{row.ready}</td><td className="inventory-number">{row.onHand}</td></tr>)}</tbody></table>{!rows.length && <div className="empty-state">No matching physical stock at these locations.</div>}<Pagination page={safePage} totalRecords={rows.length} onPageChange={setPage} /></div>;
}

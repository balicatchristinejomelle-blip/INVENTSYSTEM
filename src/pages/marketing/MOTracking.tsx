import React, { useState } from 'react';
import { useApp } from '../../store';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ManufacturingOrderDetails from '../../components/ManufacturingOrderDetails';

export default function MOTracking() {
  const { manufacturingOrders, productionOrders, orders, pellets, materialRequests } = useApp();
  const [viewId, setViewId] = useState<string | null>(null);
  const viewMO = manufacturingOrders.find(m => m.id === viewId);
  const relatedPO = viewMO ? productionOrders.find(p => p.moRef === viewMO.moNo) : null;
  const relatedOrder = viewMO ? orders.find(order => order.orderNo === viewMO.orderRef) : undefined;
  const relatedRequest = viewMO ? materialRequests.find(request => request.moRef === viewMO.moNo) : undefined;

  return (
    <div>
      <div className="alert-info mb-4">Manufacturing Orders are created only for unresolved Customer Order shortages after matching physical Finished Pipe Inventory is reserved.</div>
      <div className="app-card" style={{ overflow: 'hidden' }}>
        <table className="app-table">
          <thead>
            <tr><th>MO No.</th><th>Order Ref</th><th>Product</th><th>Size</th><th>Qty to Mfr.</th><th>Required Date</th><th>Created By</th><th>Status</th><th>PO Ref</th><th data-actions>Actions</th></tr>
          </thead>
          <tbody>
            {manufacturingOrders.map(mo => (
              <tr key={mo.id} className="table-row-hover" onClick={() => setViewId(mo.id)}>
                <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>{mo.moNo}</td>
                <td style={{ fontSize: 11, color: 'var(--accent-blue)' }}>{mo.orderRef}</td>
                <td style={{ fontSize: 12 }}>{mo.product}</td>
                <td style={{ fontSize: 12 }}>{mo.diameter} × {mo.length} {mo.sdr}</td>
                <td className="font-mono" style={{ fontWeight: 600 }}>{mo.toManufactureQty}</td>
                <td style={{ fontSize: 12 }}>{mo.requiredDate}</td>
                <td style={{ fontSize: 12 }}>{mo.createdBy}</td>
                <td><StatusBadge status={mo.status} size="sm" /></td>
                <td style={{ fontSize: 11, color: mo.poRef ? 'var(--accent-blue)' : 'var(--text-muted)' }}>{mo.poRef || '—'}</td>
                <td onClick={e => e.stopPropagation()}>
                  <button className="btn-secondary btn-compact" onClick={() => setViewId(mo.id)}>View MO</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewId && viewMO && (
        <Modal open title="" onClose={() => setViewId(null)} width="900px">
          <ManufacturingOrderDetails
            mo={viewMO}
            customerOrder={relatedOrder}
            productionOrder={relatedPO || undefined}
            pellets={pellets}
            materialRequest={relatedRequest}
            role="marketing"
            onBack={() => setViewId(null)}
          />
        </Modal>
      )}
    </div>
  );
}

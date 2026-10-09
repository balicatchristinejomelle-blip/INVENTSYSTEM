import React, { useState } from 'react';
import { useApp } from '../../store';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ManufacturingOrderDetails from '../../components/ManufacturingOrderDetails';

export default function PMProductionOrders() {
  const { productionOrders, manufacturingOrders, pellets, orders, materialRequests, createProductionOrder, navigate } = useApp();
  const [viewId, setViewId] = useState<string | null>(null);
  const [showMO, setShowMO] = useState<string | null>(null);
  const viewPO = productionOrders.find(p => p.id === viewId);
  const viewMO = manufacturingOrders.find(m => m.id === showMO);
  const relatedPO = viewMO ? productionOrders.find(order => order.moRef === viewMO.moNo) : undefined;
  const relatedOrder = viewMO ? orders.find(order => order.orderNo === viewMO.orderRef) : undefined;
  const relatedRequest = viewMO ? materialRequests.find(request => request.moRef === viewMO.moNo) : undefined;
  const virgin = pellets.filter(p => p.type === 'Virgin' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  return (
    <div>
      {/* MO Review */}
      {manufacturingOrders.filter(m => m.status === 'New').length > 0 && (
        <div className="alert-info mb-4" style={{ fontSize: 12 }}>
          <strong>New Manufacturing Orders pending review:</strong> {manufacturingOrders.filter(m => m.status === 'New').map(m => m.moNo).join(', ')}
        </div>
      )}

      {/* New MOs to act on */}
      <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Manufacturing Orders — Pending Action</h3>
        <div className="app-card" style={{ overflow: 'hidden' }}>
          <table className="app-table">
            <thead>
              <tr><th>MO No.</th><th>Product</th><th>Size</th><th>To Mfr.</th><th>Expected Usage</th><th>Avail. Pellets</th><th>Status</th><th data-actions>Actions</th></tr>
            </thead>
            <tbody>
              {manufacturingOrders.map(mo => {
                const existingPO = productionOrders.find(order => order.moRef === mo.moNo);
                return (
                  <tr key={mo.id} className="table-row-hover">
                    <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>{mo.moNo}</td>
                    <td style={{ fontSize: 12 }}>{mo.product} {mo.diameter}</td>
                    <td style={{ fontSize: 11 }}>{mo.length} {mo.sdr}</td>
                    <td className="font-mono" style={{ fontWeight: 600 }}>{mo.toManufactureQty}</td>
                    <td style={{ fontSize: 12 }}>No BOM defined</td>
                    <td className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>{virgin.toFixed(0)} kg</td>
                    <td><StatusBadge status={mo.status} size="sm" /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="button-group">
                        {mo.status === 'New' && !existingPO && <button className="btn-primary btn-compact" onClick={() => createProductionOrder(mo.id)}>Create Production Order</button>}
                        <button className="btn-secondary btn-compact" onClick={() => setShowMO(mo.id)}>View MO</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Production Orders */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Production Orders</h3>
        <div className="app-card" style={{ overflow: 'hidden' }}>
          <table className="app-table">
            <thead>
              <tr><th>PO No.</th><th>MO Ref</th><th>Product</th><th>Progress</th><th>Pellet</th><th>Priority</th><th>Req. Date</th><th>Status</th><th data-actions>Actions</th></tr>
            </thead>
            <tbody>
              {productionOrders.map(po => {
                const pct = po.targetQty > 0 ? Math.round(po.completedQty / po.targetQty * 100) : 0;
                return (
                  <tr key={po.id} className="table-row-hover" onClick={() => setViewId(po.id)}>
                    <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>{po.poNo}</td>
                    <td style={{ fontSize: 11, color: 'var(--accent-blue)' }}>{po.moRef}</td>
                    <td style={{ fontSize: 12 }}>{po.product} {po.diameter}</td>
                    <td style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{po.completedQty} / {po.targetQty} ({pct}%)</div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#2563eb' }} />
                      </div>
                    </td>
                    <td style={{ fontSize: 11 }}>{po.pelletType}</td>
                    <td><span className={`badge-${po.priority === 'Urgent' ? 'red' : po.priority === 'High' ? 'amber' : 'gray'} px-2 py-0.5 text-[11px] rounded font-medium`}>{po.priority}</span></td>
                    <td style={{ fontSize: 12 }}>{po.requiredDate}</td>
                    <td><StatusBadge status={po.status} size="sm" /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn-secondary btn-compact" onClick={() => setViewId(po.id)}>View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* PO Detail Modal */}
      {showMO && viewMO && (
        <Modal open title="" onClose={() => setShowMO(null)} width="900px">
          <ManufacturingOrderDetails
            mo={viewMO}
            customerOrder={relatedOrder}
            productionOrder={relatedPO}
            pellets={pellets}
            materialRequest={relatedRequest}
            role="plantmanager"
            onBack={() => setShowMO(null)}
            onViewProductionOrder={relatedPO ? () => {
              setViewId(relatedPO.id);
              setShowMO(null);
            } : undefined}
            onCreateProductionOrder={() => createProductionOrder(viewMO.id)}
            onRequestPellets={() => {
              setShowMO(null);
              navigate('pm-requests');
            }}
          />
        </Modal>
      )}

      {viewId && viewPO && (
        <Modal open title={`Production Order — ${viewPO.poNo}`} onClose={() => setViewId(null)} width="620px">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[['PO No.', viewPO.poNo], ['MO Reference', viewPO.moRef], ['Product', viewPO.product], ['Diameter', viewPO.diameter], ['Length', viewPO.length], ['SDR', viewPO.sdr], ['Grade', viewPO.grade], ['Color', viewPO.color], ['Stripe', viewPO.stripe], ['Target Qty', viewPO.targetQty], ['Completed Qty', viewPO.completedQty], ['Expected Material', 'No BOM defined'], ['Actual Pellet Loaded', `${viewPO.loadedKg} kg`], ['Production Line', viewPO.productionLine], ['Priority', viewPO.priority], ['Required Date', viewPO.requiredDate]].map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{l}</div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{String(v)}</div></div>
            ))}
            <div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Status</div><StatusBadge status={viewPO.status} /></div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Progress</div>
            <div className="progress-bar" style={{ height: 10 }}>
              <div className="progress-fill" style={{ width: `${viewPO.targetQty > 0 ? Math.round(viewPO.completedQty/viewPO.targetQty*100) : 0}%`, background: '#2563eb' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{viewPO.completedQty} / {viewPO.targetQty} units ({viewPO.targetQty > 0 ? Math.round(viewPO.completedQty/viewPO.targetQty*100) : 0}%)</div>
          </div>
          <button className="btn-secondary" onClick={() => setViewId(null)}>Close</button>
        </Modal>
      )}
    </div>
  );
}

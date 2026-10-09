import React from 'react';
import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';
import { BarChart, DonutChart, LineChart } from '../../components/MiniChart';
import { useApp } from '../../store';

export default function OwnerReports() {
  const app = useApp();
  const period = usePeriod('month');
  const usage = app.materialUsageTransactions.filter(item => dateInPeriod(item.dateTime, period.range));
  const rejected = app.rejectedMaterials.filter(item => dateInPeriod(item.date, period.range));
  const attendance = app.attendance.filter(item => dateInPeriod(item.date, period.range));
  const transactions = app.transactions.filter(item => dateInPeriod(item.date, period.range));
  const production = app.productionOrders.map(item => ({
    label: item.poNo,
    value: item.targetQty ? Math.round((item.completedQty / item.targetQty) * 100) : 0,
  }));
  const movement = [
    { label: 'Pellet consumed', value: Math.round(usage.filter(item => item.materialType !== 'COLORANT').reduce((sum, item) => sum + item.quantity, 0)) },
    { label: 'Colorant used', value: Math.round(usage.filter(item => item.materialType === 'COLORANT').reduce((sum, item) => sum + item.quantity, 0)) },
    { label: 'Finished output', value: transactions.filter(item => item.transactionType === 'Production Output').reduce((sum, item) => sum + Math.abs(item.qtyChanged), 0) },
    { label: 'Shipped', value: transactions.filter(item => /release/i.test(item.transactionType)).reduce((sum, item) => sum + Math.abs(item.qtyChanged), 0) },
  ];

  return <div className="page-stack">
    <div className="page-intro"><div><span className="eyebrow">Historical performance</span><h2>Reports &amp; Analytics</h2><p>Analyze how material use, production, quality, fulfillment, and workforce performance changed over time.</p></div><span className="badge-blue">All plants</span></div>
    <PeriodSelector period={period} />
    <div className="report-grid">
      <div className="app-card detail-card"><div className="section-title">Production completion by PO</div><BarChart data={production} /></div>
      <div className="app-card detail-card"><div className="section-title">Material usage vs output</div><BarChart data={movement} /></div>
      <div className="app-card detail-card"><div className="section-title">Good vs rejected trend</div><DonutChart segments={[
        { label: 'Completed pipes', value: app.productionOrders.reduce((sum, item) => sum + item.completedQty, 0), color: 'var(--status-success)' },
        { label: 'Rejected pipes', value: rejected.reduce((sum, item) => sum + item.quantity, 0), color: 'var(--status-error)' },
      ]} /></div>
      <div className="app-card detail-card"><div className="section-title">Attendance trend by shift</div><LineChart points={[
        { label: 'Day', value: attendance.filter(item => item.shift === 'Day').length },
        { label: 'Night', value: attendance.filter(item => item.shift === 'Night').length },
      ]} /></div>
    </div>
  </div>;
}

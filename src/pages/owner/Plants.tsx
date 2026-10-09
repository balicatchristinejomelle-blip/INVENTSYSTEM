import React, { useState } from 'react';
import { useApp } from '../../store';
import CategoryTabs from '../../components/CategoryTabs';

export default function OwnerPlants() {
  const app = useApp();
  const [scope, setScope] = useState<'All Departments' | 'Main Plant' | 'Branch Plant'>('All Departments');
  const plants = scope === 'All Departments' ? ['Main Plant', 'Branch Plant'] : [scope];
  return <div className="page-stack">
    <div className="page-intro"><div><span className="eyebrow">Organization directory</span><h2>Plants &amp; Departments</h2><p>Company structure and current personnel coverage by operating location.</p></div><span className="badge-blue">Company-wide</span></div>
    <CategoryTabs items={['All Departments', 'Main Plant', 'Branch Plant'] as const} value={scope} onChange={setScope} label="Plant scope" />
    <div className="plant-cards-grid">
      {plants.map(plant => {
        const employees = app.employees.filter(item => item.plant === plant);
        const stats = [
          ['Employees', employees.length],
          ['Active Accounts', employees.filter(item => item.status === 'Active').length],
          ['Departments', new Set(employees.map(item => item.role)).size],
          ['Current Attendance', app.attendance.filter(item => item.status === 'Active' && employees.some(employee => employee.employeeId === item.employeeId)).length],
        ];
        return <section className="app-card detail-card plant-summary-card" key={plant}>
          <div className="section-title">{plant}</div>
          <div className="plant-stat-grid">
            {stats.map(([label, value]) => <div className="plant-stat-cell" key={label}>
              <div className="plant-stat-label">{label}</div>
              <div className="plant-stat-value">{value}</div>
            </div>)}
          </div>
        </section>;
      })}
    </div>
  </div>;
}

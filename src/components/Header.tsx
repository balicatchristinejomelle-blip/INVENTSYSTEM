import React, { useState } from 'react';
import { useApp } from '../store';
import NotificationPanel, { NotifBellButton } from './NotificationPanel';

const PAGE_TITLES: Record<string, string> = {
  'owner-dashboard': 'Company Dashboard',
  'owner-plants': 'Plants & Departments',
  'owner-records': 'Operations & Records',
  'owner-reports': 'Reports & Analytics',
  'owner-audit': 'Complete Audit Log',
  'owner-users': 'Employees / Users & Access',
  'owner-settings': 'Settings',
  'accounting-dashboard': 'Dashboard',
  'acc-raw-materials': 'Raw Materials',
  'acc-rr-records': 'RR Records',
  'acc-branch-requests': 'Branch Requests',
  'acc-transfers': 'Transfers',
  'acc-transactions': 'Transactions',
  'acc-reports': 'Reports',
  'marketing-dashboard': 'Dashboard',
  'mkt-customers': 'Customers',
  'mkt-orders': 'Orders',
  'mkt-finished-goods': 'Finished Goods',
  'mkt-mo-tracking': 'MO & Tracking',
  'mkt-reports': 'Reports',
  'management-dashboard': 'Dashboard',
  'mgmt-operations': 'Operations',
  'mgmt-employees': 'Employees & Access',
  'mgmt-reports': 'Reports',
  'mgmt-audit': 'Audit Logs',
  'mgmt-settings': 'Settings',
  'pm-dashboard': 'Dashboard',
  'pm-production-orders': 'Production Orders',
  'pm-pellets': 'Pellet Inventory',
  'pm-material-usage': 'Material Usage',
  'pm-transfers': 'Incoming Transfers',
  'pm-requests': 'Main Plant Requests',
  'pm-finished-goods': 'Finished Goods',
  'pm-recycling': 'Rejected & Recycling',
  'pm-attendance': 'Attendance',
  'pm-turnover': 'Shift Turnover',
  'pm-reports': 'Reports',
  'production-dashboard': 'Dashboard',
  'prod-orders': 'Production Orders',
  'prod-pellets': 'Pellets',
  'prod-barcode': 'Barcode Scanner',
  'prod-finished-pipes': 'Finished Pipes',
  'prod-recycling': 'Rejected & Recycling',
  'prod-turnover': 'Shift Turnover',
  'prod-history': 'History',
  'prod-clockout': 'Clock Out',
  'notifications': 'Notifications',
  'profile': 'Profile',
  'edit-profile': 'Edit Profile',
  'change-password': 'Change Password',
};

const BREADCRUMBS: Record<string, string[]> = {
  'acc-raw-materials': ['Materials', 'Raw Materials'],
  'acc-rr-records': ['Materials', 'RR Records'],
  'pm-pellets': ['Materials & Requests', 'Pellet Inventory'],
  'pm-material-usage': ['Materials & Requests', 'Material Usage'],
  'pm-transfers': ['Materials & Requests', 'Incoming Transfers'],
  'pm-requests': ['Materials & Requests', 'Main Plant Requests'],
  'pm-attendance': ['Shifts', 'Attendance'],
  'pm-turnover': ['Shifts', 'Shift Turnover'],
  'edit-profile': ['Profile', 'Edit Profile'],
  'change-password': ['Profile', 'Change Password'],
};

export default function Header({ onMenu }: { onMenu: () => void }) {
  const { currentPage, currentUser, navigate } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);

  const roleLabel: Record<string, string> = {
    OWNER_SUPER_ADMIN: 'Owner / Super Admin',
    accounting: 'Accounting',
    marketing: 'Marketing',
    management: 'Management',
    plantmanager: 'Plant Manager',
    production: 'Production',
  };

  const breadcrumb = BREADCRUMBS[currentPage];

  return (
    <header className="app-header" style={{
      height: 52,
      background: 'var(--header-bg)',
      borderBottom: '1px solid var(--card-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      flexShrink: 0,
      position: 'relative',
      zIndex: 100,
    }}>
      {/* Left: Page title + breadcrumb */}
      <button className="mobile-menu-button" onClick={onMenu} aria-label="Open navigation menu">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>
      <div className="header-title">
        {breadcrumb ? (
          <div className="flex items-center gap-1.5">
            {breadcrumb.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/</span>}
                <span style={{ fontSize: 12, color: i === breadcrumb.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === breadcrumb.length - 1 ? 600 : 400 }}>{crumb}</span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {PAGE_TITLES[currentPage] || 'HPAI System'}
          </h1>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3" style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <NotifBellButton onClick={() => setNotifOpen(p => !p)} />
          <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} onViewAll={() => setNotifOpen(false)} />
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--card-border)' }} />
        <div className="header-user-copy" style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{currentUser ? roleLabel[currentUser.role] : ''} · {currentUser?.plant}</div>
        </div>
        <button className="header-avatar" aria-label="Open profile" onClick={() => navigate('profile')} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a3a6b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd', fontSize: 12, fontWeight: 700, border: 0, cursor: 'pointer' }}>
          {currentUser?.name.split(' ').map(w => w[0]).slice(0,2).join('')}
        </button>
      </div>
    </header>
  );
}

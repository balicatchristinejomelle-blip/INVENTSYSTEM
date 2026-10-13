import React, { useState } from 'react';
import { useApp } from '../store';
import { ConfirmModal } from './Modal';
import hpaiLogo from '../assets/hpai-logo.png';
import type { Role } from '../types';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  page?: string;
  children?: { id: string; label: string; page: string }[];
  action?: 'logout' | 'clockout' | 'theme';
  isDivider?: boolean;
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
const I = (d: string, w = 16) => (
  <svg width={w} height={w} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  dashboard: I('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10'),
  materials: I('M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z M12 12h.01'),
  requests: I('M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2'),
  transfers: I('M5 12h14 M12 5l7 7-7 7'),
  transactions: I('M2 20h.01 M7 20v-4 M12 20v-8 M17 20V8 M22 4v16'),
  reports: I('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8'),
  notifications: I('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0'),
  profile: I('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8'),
  theme: I('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'),
  logout: I('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9'),
  clockout: I('M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z M12 6v6l4 2'),
  customers: I('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75'),
  orders: I('M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0'),
  fg: I('M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'),
  mo: I('M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6'),
  operations: I('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'),
  employees: I('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0 M23 21v-2a4 4 0 0 0-3-3.87'),
  audit: I('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'),
  settings: I('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'),
  po: I('M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 M9 12l2 2 4-4'),
  pellets: I('M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z M12 8v8 M8 12h8'),
  barcode: I('M3 5v2 M3 10v2 M3 15v2 M7 5v4 M7 13v4 M11 5v2 M11 10v2 M11 15v2 M15 5v4 M15 13v4 M19 5v2 M19 10v2 M19 15v2'),
  recycling: I('M1 2l4 4-4 4 M23 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9 9 9 0 0 1 5.23 1.66 M1 6H6V1'),
  shifts: I('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M12 6v6l4 2'),
  history: I('M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'),
  collapse: I('M18 6L6 18 M6 6l12 12'),
};

function getNavItems(role: Role, clockedIn: boolean): NavItem[] {
  switch (role) {
    case 'OWNER_SUPER_ADMIN': return [
      { id: 'dash', label: 'Company Dashboard', icon: icons.dashboard, page: 'owner-dashboard' },
      { id: 'plants', label: 'Plants & Departments', icon: icons.operations, page: 'owner-plants' },
      { id: 'records', label: 'Operations & Records', icon: icons.transactions, page: 'owner-records' },
      { id: 'reports', label: 'Reports & Analytics', icon: icons.reports, page: 'owner-reports' },
      { id: 'audit', label: 'Complete Audit Log', icon: icons.audit, page: 'owner-audit' },
      { id: 'users', label: 'Employees / Users & Access', icon: icons.employees, page: 'owner-users' },
      { id: 'settings', label: 'Settings', icon: icons.settings, page: 'owner-settings' },
      { id: 'div1', label: '', icon: null, isDivider: true },
      { id: 'notifs', label: 'Notifications', icon: icons.notifications, page: 'notifications' },
      { id: 'profile', label: 'Profile', icon: icons.profile, page: 'profile' },
      { id: 'theme', label: 'Theme', icon: icons.theme, action: 'theme' },
      { id: 'logout', label: 'Logout', icon: icons.logout, action: 'logout' },
    ];
    case 'accounting': return [
      { id: 'dash', label: 'Dashboard', icon: icons.dashboard, page: 'accounting-dashboard' },
      { id: 'materials', label: 'Receiving & Material Inventory', icon: icons.materials, children: [
        { id: 'rr', label: 'Receiving / RR', page: 'acc-rr-records' },
        { id: 'raw', label: 'Material Inventory', page: 'acc-raw-materials' },
      ]},
      { id: 'brequests', label: 'Material Requests', icon: icons.requests, page: 'acc-branch-requests' },
      { id: 'transfers', label: 'Transfers', icon: icons.transfers, page: 'acc-transfers' },
      { id: 'transactions', label: 'Inventory Transactions', icon: icons.transactions, page: 'acc-transactions' },
      { id: 'reports', label: 'Reports', icon: icons.reports, page: 'acc-reports' },
      { id: 'div1', label: '', icon: null, isDivider: true },
      { id: 'notifs', label: 'Notifications', icon: icons.notifications, page: 'notifications' },
      { id: 'profile', label: 'Profile', icon: icons.profile, page: 'profile' },
      { id: 'theme', label: 'Theme', icon: icons.theme, action: 'theme' },
      { id: 'logout', label: 'Logout', icon: icons.logout, action: 'logout' },
    ];
    case 'marketing': return [
      { id: 'dash', label: 'Dashboard', icon: icons.dashboard, page: 'marketing-dashboard' },
      { id: 'customers', label: 'Customers', icon: icons.customers, page: 'mkt-customers' },
      { id: 'orders', label: 'Customer Orders', icon: icons.orders, page: 'mkt-orders' },
      { id: 'fg', label: 'Finished Goods & Fulfillment', icon: icons.fg, page: 'mkt-finished-goods' },
      { id: 'mo', label: 'Manufacturing Tracking', icon: icons.mo, page: 'mkt-mo-tracking' },
      { id: 'reports', label: 'Reports', icon: icons.reports, page: 'mkt-reports' },
      { id: 'div1', label: '', icon: null, isDivider: true },
      { id: 'notifs', label: 'Notifications', icon: icons.notifications, page: 'notifications' },
      { id: 'profile', label: 'Profile', icon: icons.profile, page: 'profile' },
      { id: 'theme', label: 'Theme', icon: icons.theme, action: 'theme' },
      { id: 'logout', label: 'Logout', icon: icons.logout, action: 'logout' },
    ];
    case 'management': return [
      { id: 'dash', label: 'Dashboard', icon: icons.dashboard, page: 'management-dashboard' },
      { id: 'ops', label: 'Operations', icon: icons.operations, page: 'mgmt-operations' },
      { id: 'employees', label: 'Attendance & Shift Assignment', icon: icons.employees, page: 'mgmt-employees' },
      { id: 'reports', label: 'Reports & Analytics', icon: icons.reports, page: 'mgmt-reports' },
      { id: 'audit', label: 'Audit Logs', icon: icons.audit, page: 'mgmt-audit' },
      { id: 'div1', label: '', icon: null, isDivider: true },
      { id: 'notifs', label: 'Notifications', icon: icons.notifications, page: 'notifications' },
      { id: 'profile', label: 'Profile', icon: icons.profile, page: 'profile' },
      { id: 'theme', label: 'Theme', icon: icons.theme, action: 'theme' },
      { id: 'logout', label: 'Logout', icon: icons.logout, action: 'logout' },
    ];
    case 'plantmanager': return [
      { id: 'dash', label: 'Dashboard', icon: icons.dashboard, page: 'pm-dashboard' },
      { id: 'po', label: 'Production Orders', icon: icons.po, page: 'pm-production-orders' },
      { id: 'materials', label: 'Materials & Requests', icon: icons.materials, children: [
        { id: 'pellets', label: 'Pellet Inventory', page: 'pm-pellets' },
        { id: 'usage', label: 'Material Usage', page: 'pm-material-usage' },
        { id: 'transfers', label: 'Incoming Transfers', page: 'pm-transfers' },
        { id: 'requests', label: 'Main Plant Requests', page: 'pm-requests' },
      ]},
      { id: 'fg', label: 'Finished Goods', icon: icons.fg, page: 'pm-finished-goods' },
      { id: 'recycling', label: 'Rejected & Recycling', icon: icons.recycling, page: 'pm-recycling' },
      { id: 'shifts', label: 'Shifts', icon: icons.shifts, children: [
        { id: 'attendance', label: 'Attendance', page: 'pm-attendance' },
        { id: 'turnover', label: 'Shift Turnover', page: 'pm-turnover' },
      ]},
      { id: 'reports', label: 'Reports', icon: icons.reports, page: 'pm-reports' },
      { id: 'div1', label: '', icon: null, isDivider: true },
      { id: 'notifs', label: 'Notifications', icon: icons.notifications, page: 'notifications' },
      { id: 'profile', label: 'Profile', icon: icons.profile, page: 'profile' },
      { id: 'theme', label: 'Theme', icon: icons.theme, action: 'theme' },
      { id: 'logout', label: 'Logout', icon: icons.logout, action: 'logout' },
    ];
    case 'production': return [
      { id: 'dash', label: 'Dashboard', icon: icons.dashboard, page: 'production-dashboard' },
      { id: 'po', label: 'Production Orders', icon: icons.po, page: 'prod-orders' },
      { id: 'pellets', label: 'Pellets', icon: icons.pellets, page: 'prod-pellets' },
      { id: 'barcode', label: 'Barcode Scanner', icon: icons.barcode, page: 'prod-barcode' },
      { id: 'fp', label: 'Finished Pipes', icon: icons.fg, page: 'prod-finished-pipes' },
      { id: 'recycling', label: 'Rejected & Recycling', icon: icons.recycling, page: 'prod-recycling' },
      { id: 'turnover', label: 'Shift Turnover', icon: icons.shifts, page: 'prod-turnover' },
      { id: 'history', label: 'History', icon: icons.history, page: 'prod-history' },
      { id: 'div1', label: '', icon: null, isDivider: true },
      { id: 'notifs', label: 'Notifications', icon: icons.notifications, page: 'notifications' },
      { id: 'profile', label: 'Profile', icon: icons.profile, page: 'profile' },
      { id: 'theme', label: 'Theme', icon: icons.theme, action: 'theme' },
      { id: 'clockout', label: 'Clock Out', icon: icons.clockout, action: 'clockout' },
      { id: 'logout', label: 'Logout', icon: icons.logout, action: 'logout' },
    ];
    default: return [];
  }
}

export default function Sidebar({ mobileOpen = false, onMobileClose = () => {} }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const { currentUser, currentPage, navigate, theme, setTheme, logout, clockedIn } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showClockedInWarning, setShowClockedInWarning] = useState(false);

  if (!currentUser) return null;

  const navItems = getNavItems(currentUser.role, clockedIn);

  const handleItemClick = (item: NavItem) => {
    if (item.isDivider) return;
    if (item.action === 'theme') {
      setTheme(theme === 'light' ? 'dark' : 'light');
      return;
    }
    if (item.action === 'logout') {
      const showLogoutPrompt = () => {
        if (currentUser.role === 'production' && clockedIn) {
          setShowClockedInWarning(true);
        } else {
          setShowLogoutConfirm(true);
        }
      };

      if (mobileOpen) {
        onMobileClose();
        window.setTimeout(showLogoutPrompt, 220);
      } else {
        showLogoutPrompt();
      }
      return;
    }
    if (item.action === 'clockout') {
      navigate('prod-clockout');
      onMobileClose();
      return;
    }
    if (item.children) {
      setExpandedMenus(p => ({ ...p, [item.id]: !p[item.id] }));
      return;
    }
    if (item.page) {
      navigate(item.page);
      onMobileClose();
    }
  };

  const isActive = (item: NavItem) => {
    if (item.page === currentPage) return true;
    if (item.children) return item.children.some(c => c.page === currentPage);
    return false;
  };

  const roleLabel: Record<Role, string> = {
    OWNER_SUPER_ADMIN: 'Owner / Super Admin',
    accounting: 'Accounting',
    marketing: 'Marketing',
    management: 'Management',
    plantmanager: 'Plant Manager',
    production: 'Production',
  };

  const dividerIndex = navItems.findIndex(item => item.isDivider);
  const primaryNavItems = dividerIndex >= 0 ? navItems.slice(0, dividerIndex) : navItems;
  const bottomNavItems = dividerIndex >= 0 ? navItems.slice(dividerIndex + 1) : [];

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item);
    const expanded = expandedMenus[item.id];
    const isTheme = item.action === 'theme';
    const isLogout = item.action === 'logout';
    const isClockout = item.action === 'clockout';

    return (
      <div key={item.id}>
        <div
          className={`tooltip-wrapper${isLogout ? ' sidebar-danger-action' : isClockout ? ' sidebar-warning-action' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={isTheme ? `Theme: ${theme === 'light' ? 'Light' : 'Dark'}` : item.label}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemClick(item); } }}
          onClick={() => handleItemClick(item)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: collapsed ? '9px 0' : '8px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 6,
            cursor: 'pointer',
            marginBottom: 1,
            background: active ? 'var(--sidebar-active)' : 'transparent',
            color: active ? '#ffffff' : isLogout ? 'var(--sidebar-danger-text)' : isClockout ? 'var(--sidebar-warning-text)' : 'var(--sidebar-text)',
            fontSize: 12.5,
            fontWeight: active ? 600 : 400,
          }}
          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'; }}
          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span style={{ flexShrink: 0, opacity: active ? 1 : 0.8 }}>{item.icon}</span>
          {!collapsed && (
            <span style={{ flex: 1 }}>{isTheme ? `Theme: ${theme === 'light' ? 'Light' : 'Dark'}` : item.label}</span>
          )}
          {!collapsed && item.children && (
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {collapsed && <span className="tooltip-label">{isTheme ? `Theme: ${theme === 'light' ? 'Light' : 'Dark'}` : item.label}</span>}
        </div>
        {!collapsed && item.children && expanded && (
          <div style={{ marginLeft: 26, marginBottom: 2 }}>
            {item.children.map(child => (
              <div
                key={child.id}
                onClick={() => { navigate(child.page); onMobileClose(); }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 5,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: currentPage === child.page ? '#ffffff' : 'rgba(203,213,225,0.75)',
                  background: currentPage === child.page ? 'rgba(37,99,235,0.4)' : 'transparent',
                  fontWeight: currentPage === child.page ? 600 : 400,
                  marginBottom: 1,
                }}
                onMouseEnter={e => { if (currentPage !== child.page) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (currentPage !== child.page) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {child.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={`mobile-nav-backdrop ${mobileOpen ? 'is-open' : ''}`} onClick={onMobileClose} />
      <aside className={`app-sidebar ${mobileOpen ? 'is-open' : ''}`} style={{
        width: collapsed ? 66 : 228,
        minHeight: '100vh',
        background: 'var(--sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        flexShrink: 0,
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ padding: collapsed ? '14px 0' : '14px 12px', textAlign: collapsed ? 'center' : 'left', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <img src={hpaiLogo} alt="HPAI" style={{ height: 38, width: 'auto', maxWidth: collapsed ? 40 : 100, objectFit: 'contain', display: 'block', margin: collapsed ? '0 auto' : '0' }} />
          {!collapsed && (
            <>
              <div style={{ color: '#e2e8f0', fontSize: 11.5, fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>Hydro Phil Asia Inc.</div>
              <div style={{ color: 'var(--accent-gold)', fontSize: 10.5, fontWeight: 500, marginTop: 2 }}>{roleLabel[currentUser.role]}</div>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          <div className="sidebar-nav-scroll">
            {primaryNavItems.map(renderNavItem)}
          </div>
          <div className="sidebar-bottom-actions">
            <div className="divider" style={{ margin: '6px 0', borderColor: 'rgba(255,255,255,0.08)' }} />
            {bottomNavItems.map(renderNavItem)}
          </div>
        </nav>

        {/* Collapse toggle */}
        <div className="sidebar-collapse"
          onClick={() => setCollapsed(p => !p)}
          style={{ padding: '10px 0', textAlign: 'center', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(148,163,184,0.6)', flexShrink: 0 }}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', display: 'inline' }}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </aside>

      {/* Logout confirmation */}
      <ConfirmModal
        open={showLogoutConfirm}
        title="Log Out?"
        message="Are you sure you want to log out?"
        confirmLabel="Logout"
        cancelLabel="Cancel"
        confirmClass="btn-danger"
        onConfirm={() => { setShowLogoutConfirm(false); logout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* Clocked-in warning */}
      {showClockedInWarning && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: 380 }}>
            <h3 style={{ color: '#dc2626', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>YOU ARE STILL CLOCKED IN</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              Complete Clock Out before ending your session.
            </p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setShowClockedInWarning(false)}>Cancel</button>
              <button className="btn-warning" onClick={() => { setShowClockedInWarning(false); navigate('prod-clockout'); onMobileClose(); }}>Go to Clock Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

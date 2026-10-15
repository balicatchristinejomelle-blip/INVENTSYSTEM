import React, { useState } from 'react';
import { AppProvider, useApp } from './store';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AccessRestricted from './components/AccessRestricted';
import type { Role } from './types';
import { ReprintRequestDialog } from './components/ReprintApprovals';
import { ViewStateScope } from './uiViewState';
import { RecordReferenceProvider } from './components/RecordReference';

// Pages
import Login from './pages/Login';
import Profile from './pages/Profile';
import NotificationsPage from './pages/NotificationsPage';
import GenericPage from './pages/GenericPage';
import OwnerDashboard from './pages/owner/Dashboard';
import OwnerRecords from './pages/owner/Records';
import OwnerReports from './pages/owner/Reports';
import OwnerPlants from './pages/owner/Plants';
import OwnerUsersAccess from './pages/owner/UsersAccess';

// Accounting
import AccountingDashboard from './pages/accounting/Dashboard';
import RawMaterials from './pages/accounting/RawMaterials';
import RRRecords from './pages/accounting/RRRecords';
import BranchRequests from './pages/accounting/BranchRequests';
import Transfers from './pages/accounting/Transfers';
import Transactions from './pages/accounting/Transactions';
import AccountingReports from './pages/accounting/Reports';

// Marketing
import MarketingDashboard from './pages/marketing/Dashboard';
import Customers from './pages/marketing/Customers';
import Orders from './pages/marketing/Orders';
import MarketingFG from './pages/marketing/FinishedGoods';
import MOTracking from './pages/marketing/MOTracking';
import MarketingReports from './pages/marketing/Reports';

// Management
import ManagementDashboard from './pages/management/Dashboard';
import Operations from './pages/management/Operations';
import Employees from './pages/management/Employees';
import AuditLogs from './pages/management/AuditLogs';
import ManagementReports from './pages/management/Reports';
import ManagementSettings from './pages/management/Settings';

// Plant Manager
import PMDashboard from './pages/plantmanager/Dashboard';
import PMProductionOrders from './pages/plantmanager/ProductionOrders';
import PMPelletInventory from './pages/plantmanager/PelletInventory';
import PMMaterialUsage from './pages/plantmanager/MaterialUsage';
import PMIncomingTransfers from './pages/plantmanager/IncomingTransfers';
import PMMainPlantRequests from './pages/plantmanager/MainPlantRequests';
import PMAttendance from './pages/plantmanager/Attendance';
import PMShiftTurnover from './pages/plantmanager/ShiftTurnover';
import PMFinishedGoods from './pages/plantmanager/FinishedGoods';
import PMRejectedRecycling from './pages/plantmanager/RejectedRecycling';
import PMReports from './pages/plantmanager/Reports';

// Production
import ShiftAttendance from './pages/production/ShiftAttendance';
import ProductionDashboard from './pages/production/Dashboard';
import ProdOrders from './pages/production/ProductionOrders';
import ProdPellets from './pages/production/Pellets';
import ProdFinishedPipes from './pages/production/FinishedPipes';
import BarcodeScanner from './pages/production/BarcodeScanner';
import ProductionRecycling from './pages/production/Recycling';
import ClockOut from './pages/production/ClockOut';
import ProductionShiftTurnover from './pages/production/ShiftTurnover';
import ProductionHistory from './pages/production/History';

function PageRenderer() {
  const { currentPage, currentUser } = useApp();

  const pageMap: Record<string, React.ReactNode> = {
    // Owner / Super Admin — monitoring and administration, not operations
    'owner-dashboard': <OwnerDashboard />,
    'owner-plants': <OwnerPlants />,
    'owner-records': <OwnerRecords />,
    'owner-reports': <OwnerReports />,
    'owner-audit': <AuditLogs />,
    'owner-users': <OwnerUsersAccess />,
    'owner-settings': <ManagementSettings />,

    // Accounting
    'accounting-dashboard': <AccountingDashboard />,
    'acc-raw-materials': <RawMaterials />,
    'acc-rr-records': <RRRecords />,
    'acc-branch-requests': <BranchRequests />,
    'acc-transfers': <Transfers />,
    'acc-transactions': <Transactions />,
    'acc-reports': <AccountingReports />,

    // Marketing
    'marketing-dashboard': <MarketingDashboard />,
    'mkt-customers': <Customers />,
    'mkt-orders': <Orders />,
    'mkt-finished-goods': <MarketingFG />,
    'mkt-mo-tracking': <MOTracking />,
    'mkt-reports': <MarketingReports />,

    // Management
    'management-dashboard': <ManagementDashboard />,
    'mgmt-operations': <Operations />,
    'mgmt-employees': <Employees />,
    'mgmt-reports': <ManagementReports />,
    'mgmt-audit': <AuditLogs />,

    // Plant Manager
    'pm-dashboard': <PMDashboard />,
    'pm-production-orders': <PMProductionOrders />,
    'pm-pellets': <PMPelletInventory />,
    'pm-material-usage': <PMMaterialUsage />,
    'pm-transfers': <PMIncomingTransfers />,
    'pm-requests': <PMMainPlantRequests />,
    'pm-finished-goods': <PMFinishedGoods />,
    'pm-recycling': <PMRejectedRecycling />,
    'pm-attendance': <PMAttendance />,
    'pm-turnover': <PMShiftTurnover />,
    'pm-reports': <PMReports />,

    // Production
    'prod-orders': <ProdOrders />,
    'prod-pellets': <ProdPellets />,
    'prod-barcode': <BarcodeScanner />,
    'prod-finished-pipes': <ProdFinishedPipes />,
    'prod-recycling': <ProductionRecycling />,
    'prod-turnover': <ProductionShiftTurnover />,
    'prod-history': <ProductionHistory />,
    'prod-clockout': <ClockOut />,

    // Shared
    'notifications': <NotificationsPage />,
    'profile': <Profile />,
  };

  const allowedPrefixes: Record<Role, string[]> = {
    OWNER_SUPER_ADMIN: ['owner-'],
    accounting: ['accounting-', 'acc-'],
    marketing: ['marketing-', 'mkt-'],
    management: ['management-', 'mgmt-'],
    plantmanager: ['pm-'],
    production: ['production-', 'prod-'],
  };
  const sharedPages = ['notifications', 'profile', 'edit-profile', 'change-password'];
  const knownPage = Object.prototype.hasOwnProperty.call(pageMap, currentPage);
  const authorized = !!currentUser && (sharedPages.includes(currentPage) || allowedPrefixes[currentUser.role].some(prefix => currentPage.startsWith(prefix)));
  if (knownPage && !authorized) return <AccessRestricted />;
  return <>{pageMap[currentPage] || <GenericPage title="Page Not Found" description="The requested page could not be found." />}</>;
}

function AppShell() {
  const { currentUser, currentPage } = useApp();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!currentUser) return <Login />;

  if (currentPage === 'shift-attendance') return <ShiftAttendance />;

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--app-bg)' }}>
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="app-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header onMenu={() => setMobileNavOpen(true)} />
        <main className={`app-main${/^(owner-|acc-|accounting-|mkt-|marketing-|mgmt-|management-|pm-|prod-|production-)/.test(currentPage) ? ' operational-content' : ''}`} style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {currentPage === 'production-dashboard' ? <ProductionDashboard /> : <PageRenderer />}
          <ReprintRequestDialog />
        </main>
      </div>
    </div>
  );
}

class SavedDataBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      if (!this.state.error.message.startsWith('Saved HPAI data could not be read safely.')) throw this.state.error;
      return <main role="alert" style={{ padding: 24, maxWidth: 680, margin: 'auto' }}>
        <h1>Saved data needs attention</h1><p>{this.state.error.message}</p>
        <p>Do not clear browser storage. Keep the existing <code>hpai:shared-app-state-v1</code> data for recovery.</p>
      </main>;
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <SavedDataBoundary>
      <AppProvider>
        <ViewStateScope><RecordReferenceProvider><AppShell /></RecordReferenceProvider></ViewStateScope>
      </AppProvider>
    </SavedDataBoundary>
  );
}

import React from 'react';
import { useApp } from '../store';

const dashboardForRole = {
  OWNER_SUPER_ADMIN: 'owner-dashboard',
  accounting: 'accounting-dashboard',
  marketing: 'marketing-dashboard',
  management: 'management-dashboard',
  plantmanager: 'pm-dashboard',
  production: 'production-dashboard',
} as const;

export default function AccessRestricted() {
  const { currentUser, navigate } = useApp();
  return <div className="access-restricted app-card" role="alert">
    <div className="access-restricted-icon" aria-hidden="true">!</div>
    <h2>ACCESS RESTRICTED</h2>
    <p>Your account does not have permission to access this module.</p>
    {currentUser && <button className="btn-primary" onClick={() => navigate(dashboardForRole[currentUser.role])}>Return to Dashboard</button>}
  </div>;
}

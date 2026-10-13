import React from 'react';

const BADGE_MAP: Record<string, string> = {
  // Generic statuses
  'Active': 'badge-blue',
  'Available': 'badge-green',
  'LOW STOCK': 'badge-red',
  'OUT OF STOCK': 'badge-red',
  'NORMAL': 'badge-green',
  'REQUEST PENDING': 'badge-amber',
  'REPLENISHMENT IN PROGRESS': 'badge-blue',
  'Clocked In': 'badge-blue',
  'Clocked Out': 'badge-gray',
  'Day Shift': 'badge-blue',
  'Night Shift': 'badge-gray',
  'Not Assigned': 'badge-amber',
  'Inactive': 'badge-gray',
  'Completed': 'badge-green',
  'Cancelled': 'badge-red',
  'Pending': 'badge-amber',
  'Approved': 'badge-green',
  'Rejected': 'badge-red',
  'New': 'badge-blue',
  // Transfer/RR
  'Preparing': 'badge-amber',
  'In Transit': 'badge-blue',
  'Received': 'badge-green',
  'Verified': 'badge-green',
  'Ready for Transfer': 'badge-blue',
  'In Transit ': 'badge-blue',
  // PO statuses
  'Scheduled': 'badge-gray',
  'Ready': 'badge-blue',
  'In Production': 'badge-blue',
  'Partially Completed': 'badge-amber',
  'Awaiting Shift Turnover': 'badge-amber',
  // Orders
  'Ready for Release': 'badge-green',
  'Released': 'badge-purple',
  // Recycling
  'Collecting': 'badge-gray',
  'Ready for Cutting': 'badge-amber',
  'Cutting': 'badge-amber',
  'Weighing': 'badge-amber',
  'Awaiting Crushing Confirmation': 'badge-amber',
  'Ready for Crushing': 'badge-blue',
  'Crushing': 'badge-blue',
  'Ready for Pelletizing': 'badge-blue',
  'Pelletizing': 'badge-blue',
  // Rejected limits
  'COLLECTING': 'badge-gray',
  'NEARING LIMIT': 'badge-amber',
  'RECYCLING REQUIRED': 'badge-red',
  // Material request
  'action required': 'badge-amber',
  'Action Required': 'badge-amber',
  'Information': 'badge-blue',
  'Urgent': 'badge-red',
  // Account
  'account-active': 'badge-green',
  'account-inactive': 'badge-red',
};

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const cls = BADGE_MAP[status] || 'badge-gray';
  const px = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span className={`${cls} ${px} rounded font-medium inline-block`}>
      {status}
    </span>
  );
}

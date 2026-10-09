import React, { useRef, useEffect } from 'react';
import { useApp } from '../store';
import type { Role } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onViewAll: () => void;
}

const priorityColor: Record<string, string> = {
  'Urgent': '#dc2626',
  'Action Required': '#d97706',
  'Information': '#2563eb',
};

export default function NotificationPanel({ open, onClose, onViewAll }: Props) {
  const { notifications, currentUser, markNotificationsRead } = useApp();
  const ref = useRef<HTMLDivElement>(null);

  const role = currentUser?.role as Role | undefined;
  const myNotifs = role ? notifications.filter(n => role === 'OWNER_SUPER_ADMIN' || n.roles.includes(role)) : [];
  const unread = myNotifs.filter(n => !n.read);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} className="notification-panel" style={{
      position: 'absolute', right: 0, top: 'calc(100% + 8px)',
      width: 340, background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 500,
      maxHeight: 420, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Notifications</span>
        <div className="flex gap-2 items-center">
          {unread.length > 0 && (
            <button className="btn-secondary btn-compact" onClick={markNotificationsRead}>
              Mark All as Read
            </button>
          )}
          <span style={{ fontSize: 11, background: unread.length > 0 ? '#dc2626' : 'var(--card-border)', color: unread.length > 0 ? '#fff' : 'var(--text-muted)', borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>{unread.length}</span>
        </div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {myNotifs.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No notifications</div>
        )}
        {myNotifs.map(n => (
          <div key={n.id} style={{
            padding: '10px 14px', borderBottom: '1px solid var(--card-border)',
            background: n.read ? 'transparent' : 'rgba(37,99,235,0.04)',
            cursor: 'pointer',
          }}>
            <div className="flex items-start gap-2">
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: priorityColor[n.priority] || '#64748b', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex justify-between items-start gap-1">
                  <span style={{ fontWeight: n.read ? 500 : 600, fontSize: 12, color: 'var(--text-primary)' }}>{n.title}</span>
                  {!n.read && <span className="notif-dot" />}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 3px', lineHeight: 1.4 }}>{n.description}</p>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{n.datetime}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--card-border)', textAlign: 'center' }}>
        <button className="btn-secondary" onClick={onViewAll}>
          View All Notifications
        </button>
      </div>
    </div>
  );
}

export function NotifBellButton({ onClick }: { onClick: () => void }) {
  const { notifications, currentUser } = useApp();
  const role = currentUser?.role as Role | undefined;
  const count = role ? notifications.filter(n => (role === 'OWNER_SUPER_ADMIN' || n.roles.includes(role)) && !n.read).length : 0;

  return (
    <button onClick={onClick} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 6 }}>
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {count > 0 && (
        <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

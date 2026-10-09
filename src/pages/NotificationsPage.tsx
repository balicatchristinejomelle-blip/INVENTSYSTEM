import React from 'react';
import { useApp } from '../store';
import type { Role } from '../types';

const priorityColor: Record<string, string> = {
  'Urgent': '#dc2626',
  'Action Required': '#d97706',
  'Information': '#2563eb',
};

export default function NotificationsPage() {
  const { notifications, currentUser, markNotificationsRead } = useApp();
  const role = currentUser?.role as Role | undefined;
  const myNotifs = role ? notifications.filter(n => role === 'OWNER_SUPER_ADMIN' || n.roles.includes(role)) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{myNotifs.filter(n => !n.read).length} unread</span>
        <button className="btn-secondary" onClick={markNotificationsRead}>Mark All as Read</button>
      </div>
      <div className="app-card" style={{ overflow: 'hidden' }}>
        {myNotifs.map(n => (
          <div key={n.id} style={{
            padding: '14px 16px', borderBottom: '1px solid var(--card-border)',
            background: n.read ? 'transparent' : 'rgba(37,99,235,0.03)',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColor[n.priority] || '#94a3b8', marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span style={{ fontWeight: n.read ? 500 : 700, fontSize: 13, color: 'var(--text-primary)' }}>{n.title}</span>
                  <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 3, background: priorityColor[n.priority] + '22', color: priorityColor[n.priority], fontWeight: 600 }}>{n.priority}</span>
                </div>
                {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', marginTop: 3, flexShrink: 0 }} />}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 6px', lineHeight: 1.5 }}>{n.description}</p>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.datetime}</span>
            </div>
          </div>
        ))}
        {myNotifs.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No notifications.</div>
        )}
      </div>
    </div>
  );
}

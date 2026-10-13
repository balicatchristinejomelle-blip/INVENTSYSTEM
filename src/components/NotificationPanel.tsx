import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import type { Notification, Role } from '../types';
import type { ProductSpecification, StockTarget } from '../types';
import { normalizeProductSpecification, specificationKey, specificationKeyFromRecord } from '../productMaster';

interface Props {
  open: boolean;
  onClose: () => void;
  onViewAll: () => void;
}

const priorityRank: Record<Notification['priority'], number> = { Urgent: 0, 'Action Required': 1, Information: 2 };

const targetByNotification: Record<string, Partial<Record<Role, string>>> = {
  n1: { accounting: 'acc-branch-requests' },
  n2: { accounting: 'acc-raw-materials', management: 'mgmt-operations', OWNER_SUPER_ADMIN: 'owner-records' },
  n3: { accounting: 'acc-transfers' },
  n4: { marketing: 'mkt-mo-tracking' },
  n5: { marketing: 'mkt-mo-tracking' },
  n6: { marketing: 'mkt-finished-goods' },
  n7: { management: 'mgmt-operations', plantmanager: 'pm-recycling', production: 'prod-recycling', OWNER_SUPER_ADMIN: 'owner-records' },
  n8: { management: 'mgmt-operations', OWNER_SUPER_ADMIN: 'owner-records' },
  n9: { plantmanager: 'pm-production-orders' },
  n10: { plantmanager: 'pm-requests' },
  n11: { plantmanager: 'pm-turnover' },
  n12: { production: 'prod-orders' },
  n13: { production: 'prod-turnover' },
};

const priorityClass: Record<Notification['priority'], string> = {
  Urgent: 'notification-priority-urgent',
  'Action Required': 'notification-priority-action',
  Information: 'notification-priority-info',
};

export const notificationsForRole = (notifications: Notification[], role?: Role) => {
  if (!role) return [];
  return notifications
    .filter(notification => role === 'OWNER_SUPER_ADMIN' || notification.roles.includes(role))
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.datetime.localeCompare(a.datetime));
};

export const notificationTarget = (notification: Notification, role?: Role) =>
  role === 'OWNER_SUPER_ADMIN'
    ? targetByNotification[notification.id]?.[role] || 'owner-records'
    : role
      ? targetByNotification[notification.id]?.[role] || notification.link
      : undefined;

export const notificationReference = (notification: Notification) =>
  notification.reference || `${notification.title} ${notification.description}`.match(/(?:PO|MO|SO|MR|MT|RR|RB)-\d{4}-\d+/)?.[0];

export const formatNotificationTime = (value: string) => {
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
};

const STOCK_NOTIFICATION_READ_KEY = 'hpai:stock-notification-read-v1';

export function useInventoryStockNotifications() {
  const { pellets, colorants, finishedGoods, materialRequests, productionOrders, transfers } = useApp();
  const [, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion(value => value + 1);
    window.addEventListener('storage', refresh);
    window.addEventListener('hpai:stock-targets-changed', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('hpai:stock-targets-changed', refresh); };
  }, []);
  let targets: StockTarget[] = [];
  let specifications: ProductSpecification[] = [];
  let readIds = new Set<string>();
  try {
    targets = JSON.parse(window.localStorage.getItem('hpai:stock-targets-v1') || '[]') as StockTarget[];
    specifications = (JSON.parse(window.localStorage.getItem('hpai:product-specifications-v1') || '[]') as unknown[]).map(normalizeProductSpecification).filter((spec): spec is ProductSpecification => spec !== null);
    readIds = new Set(JSON.parse(window.localStorage.getItem(STOCK_NOTIFICATION_READ_KEY) || '[]') as string[]);
  } catch { /* Use an empty derived alert set if prototype storage is malformed. */ }
  const datetime = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const notifications = targets.flatMap<Notification>(target => {
    if (target.status !== 'Active' || target.plant !== 'Branch Plant') return [];
    const id = `stock-${target.id}`;
    if (target.inventoryType === 'Finished Pipe') {
      const spec = specifications.find(item => item.id === target.productSpecificationId && item.active);
      if (!spec) return [];
      const current = finishedGoods.filter(item => item.status === 'Available' && item.releaseStatus !== 'Released' && item.qualityStatus !== 'Reject' && specificationKeyFromRecord(item) === specificationKey(spec)).reduce((sum, item) => sum + item.quantity, 0);
      if (current > target.minimumStock) return [];
      const po = productionOrders.find(item => item.source === 'Stock Replenishment' && !['Completed', 'Cancelled'].includes(item.status) && specificationKeyFromRecord(item) === specificationKey(spec));
      return [{ id, title: current === 0 ? 'Finished Pipe Out of Stock' : 'Finished Pipe Low Stock', description: `${spec.productType} · ${spec.materialGrade} · ${spec.size} · current ${current}, minimum ${target.minimumStock}, target ${target.targetStock}${po ? ` · ${po.poNo} in progress` : ''}`, datetime, priority: current === 0 ? 'Urgent' : 'Action Required', read: readIds.has(id), roles: ['plantmanager', 'management', 'OWNER_SUPER_ADMIN'], link: 'pm-finished-goods', reference: po?.poNo }];
    }
    const current = target.inventoryType === 'Colorant'
      ? colorants.filter(item => item.color === target.color && item.usageType === target.colorantUsageType).reduce((sum, item) => sum + item.availableKg, 0)
      : pellets.filter(item => item.type === (target.inventoryType === 'Virgin Pellet' ? 'Virgin' : 'Recycled') && item.grade === target.materialGrade && item.availableKg > 0).reduce((sum, item) => sum + item.availableKg, 0);
    if (current > target.minimumStock) return [];
    const request = materialRequests.find(item => !transfers.some(transfer => transfer.requestRef === item.refNo && transfer.status === 'Received') && ['New', 'Pending', 'Approved'].includes(item.status) && (item.destination || 'Branch Plant') === 'Branch Plant' && (target.inventoryType === 'Colorant' ? item.materialCategory === 'Colorant' && item.color === target.color && item.colorantUsageType === target.colorantUsageType : item.materialCategory === target.inventoryType && item.grade === target.materialGrade));
    const label = target.inventoryType === 'Colorant' ? `${target.color} ${target.colorantUsageType === 'STRIPE_COLORANT' ? 'stripe' : 'base'} colorant` : `${target.inventoryType} ${target.materialGrade}`;
    return [{ id, title: current === 0 ? 'Material Out of Stock' : 'Material Low Stock', description: `${label} · current ${current.toFixed(3)} kg, minimum ${target.minimumStock} kg, target ${target.targetStock} kg${request ? ` · ${request.refNo} pending` : ''}`, datetime, priority: current === 0 ? 'Urgent' : 'Action Required', read: readIds.has(id), roles: ['plantmanager', 'management', 'OWNER_SUPER_ADMIN'], link: 'pm-pellets', reference: request?.refNo }];
  });
  const saveRead = (ids: string[]) => { window.localStorage.setItem(STOCK_NOTIFICATION_READ_KEY, JSON.stringify(Array.from(new Set([...readIds, ...ids])))); setVersion(value => value + 1); };
  return { notifications, markOne: (id: string) => saveRead([id]), markAll: () => saveRead(notifications.map(item => item.id)) };
}

export default function NotificationPanel({ open, onClose, onViewAll }: Props) {
  const { notifications, currentUser, markNotificationsRead, markNotificationRead, navigate } = useApp();
  const stockNotifications = useInventoryStockNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const ref = useRef<HTMLDivElement>(null);
  const role = currentUser?.role;
  const myNotifications = useMemo(() => notificationsForRole([...stockNotifications.notifications, ...notifications], role), [notifications, role, stockNotifications.notifications]);
  const unreadCount = myNotifications.filter(notification => !notification.read).length;
  const visibleNotifications = filter === 'unread' ? myNotifications.filter(notification => !notification.read) : myNotifications;

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const openNotification = (notification: Notification) => {
    if (notification.id.startsWith('stock-')) stockNotifications.markOne(notification.id);
    else markNotificationRead(notification.id);
    const target = notificationTarget(notification, role);
    if (target) navigate(target);
    onClose();
  };

  return (
    <div ref={ref} className="notification-panel" role="dialog" aria-label="Notifications" aria-modal="false">
      <div className="notification-panel-header">
        <div><strong>Notifications</strong><span>{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</span></div>
        <button className="modal-close" aria-label="Close notifications" onClick={onClose}>×</button>
      </div>
      <div className="notification-toolbar">
        <div className="notification-tabs" role="tablist" aria-label="Notification filter">
          <button className={filter === 'all' ? 'is-active' : ''} role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>All <span>{myNotifications.length}</span></button>
          <button className={filter === 'unread' ? 'is-active' : ''} role="tab" aria-selected={filter === 'unread'} onClick={() => setFilter('unread')}>Unread <span>{unreadCount}</span></button>
        </div>
        {unreadCount > 0 && <button className="notification-mark-all" onClick={() => { markNotificationsRead(); stockNotifications.markAll(); }}>Mark all as read</button>}
      </div>
      <div className="notification-list">
        {visibleNotifications.map(notification => {
          const reference = notificationReference(notification);
          return (
            <button key={notification.id} className={`notification-row${notification.read ? '' : ' is-unread'}`} onClick={() => openNotification(notification)}>
              <span className={`notification-priority ${priorityClass[notification.priority]}`}>{notification.priority}</span>
              <span className="notification-row-title">{notification.title}{!notification.read && <span className="notif-dot" aria-label="Unread" />}</span>
              {reference && <span className="notification-reference">{reference}</span>}
              <span className="notification-description">{notification.description}</span>
              <span className="notification-meta"><time>{formatNotificationTime(notification.datetime)}</time><span>Open record →</span></span>
            </button>
          );
        })}
        {!visibleNotifications.length && <div className="notification-empty"><strong>{filter === 'unread' ? 'NO UNREAD NOTIFICATIONS' : 'NO NOTIFICATIONS'}</strong><span>{filter === 'unread' ? 'You are all caught up.' : 'No notifications are available for your role.'}</span></div>}
      </div>
      <div className="notification-footer"><button className="btn-secondary" onClick={onViewAll}>Open notification history</button></div>
    </div>
  );
}

export function NotifBellButton({ onClick, expanded }: { onClick: () => void; expanded?: boolean }) {
  const { notifications, currentUser } = useApp();
  const stockNotifications = useInventoryStockNotifications();
  const count = notificationsForRole([...stockNotifications.notifications, ...notifications], currentUser?.role).filter(notification => !notification.read).length;
  return (
    <button className="notification-bell" onClick={onClick} aria-label={count ? `Notifications, ${count} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={expanded}>
      <svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {count > 0 && <span className="notification-count">{count > 9 ? '9+' : count}</span>}
    </button>
  );
}

import React, { useMemo, useState } from "react"

import { useApp } from "../store"

import { formatNotificationTime, notificationReference, notificationsForRole, notificationTarget, useInventoryStockNotifications, reprintNotificationAction } from '../components/NotificationPanel';

import StatusBadge from "../components/StatusBadge"

import { matchesRecord } from "../components/RecordSearch"

import Pagination, { pageRecords } from "../components/Pagination"

export default function NotificationsPage() {
  const { notifications, currentUser, markNotificationsRead, markNotificationRead, navigate, openReprintRequest, reprintRequests } = useApp();

  const stockNotifications = useInventoryStockNotifications()

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const [search, setSearch] = useState("")

  const [page, setPage] = useState(1)

  const myNotifications = useMemo(() => notificationsForRole([...stockNotifications.notifications, ...notifications], currentUser?.role, currentUser?.employeeId), [notifications, currentUser?.role, currentUser?.employeeId, stockNotifications.notifications]);

  const unreadCount = myNotifications.filter(notification => !notification.read).length;

  const visible = myNotifications.filter(
    (notification) =>
      (filter !== "unread" || !notification.read) &&
      matchesRecord(notification, search),
  )

  const openNotification = (id: string) => {
    const notification = myNotifications.find(item => item.id === id);
    if (!notification) return;
    if (id.startsWith('stock-')) stockNotifications.markOne(id);
    else markNotificationRead(id);
    if (notification.reprintRequestId) { openReprintRequest(notification.reprintRequestId); return; }
    const target = notificationTarget(notification, currentUser?.role);
    if (target) navigate(target);
  };

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <h2>Notification history</h2>
          <p>Authorized alerts for {currentUser?.name}. Notification access is role-specific.</p>
        </div>
        {unreadCount > 0 && <button className="btn-secondary" onClick={() => { markNotificationsRead(); stockNotifications.markAll(); }}>Mark all as read</button>}
      </div>
      <div className="category-tabs" role="tablist" aria-label="Notification history filter">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => {
            setFilter("all")
            setPage(1)
          }}
        >
          All ({myNotifications.length})
        </button>
        <button
          className={filter === "unread" ? "active" : ""}
          onClick={() => {
            setFilter("unread")
            setPage(1)
          }}
        >
          Unread ({unreadCount})
        </button>
      </div>
      <div className="record-filter-bar">
        <input
          className="app-input record-search"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          aria-label="Search notifications"
          placeholder="Search notification, reference, priority, or date..."
        />
      </div>
      <div className="app-card notification-history">
        {pageRecords(visible, page).map((notification) => (
          <button key={notification.id} className={`notification-history-row${notification.read ? '' : ' is-unread'}`} onClick={() => openNotification(notification.id)}>
            <div className="notification-history-heading">
              <strong>{notification.title}</strong>
              <StatusBadge status={notification.priority} size="sm" />
            </div>
            {notificationReference(notification) && (
              <span className="notification-reference">
                {notificationReference(notification)}
              </span>
            )}
            <p>{notification.description}</p>
            <div className="notification-meta">
              <time>{formatNotificationTime(notification.datetime)}</time>
              <span>{reprintNotificationAction(notification, currentUser?.role, currentUser?.employeeId, reprintRequests)}</span>
            </div>
          </button>
        ))}
        {!visible.length && (
          <div className="empty-state empty-state-action">
            <strong>
              {filter === 'unread' ? 'NO UNREAD NOTIFICATIONS' : 'NO NOTIFICATIONS'}
            </strong>
            <span>
              {filter === 'unread' ? 'You are all caught up.' : 'No notifications are available for your role.'}
            </span>
          </div>
        )}
      </div>
      <Pagination
        page={page}
        totalRecords={visible.length}
        onPageChange={setPage}
        noun="notifications"
      />
    </div>
  )
}

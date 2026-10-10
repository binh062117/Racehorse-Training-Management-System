import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { ErrorText } from '../components/ErrorText';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { useCachedResource } from '../lib/useCachedResource';
import type { Notification, Paginated } from '../lib/types';

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const {
    data,
    loading,
    error,
    reload,
  } = useCachedResource(
    `notifications:${user?.id ?? 'anonymous'}:${page}`,
    () =>
      api
        .get<Paginated<Notification>>('/notifications', {
          params: { page, limit: PAGE_SIZE },
        })
        .then((response) => response.data),
  );
  const notifications = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  const markRead = async (notification: Notification) => {
    if (notification.read || updatingId) return;
    setUpdatingId(notification.id);
    setActionError(null);
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      window.dispatchEvent(new Event('notifications:changed'));
      await reload();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setUpdatingId(null);
    }
  };

  const remove = async (notification: Notification, event: MouseEvent) => {
    event.stopPropagation();
    if (updatingId) return;
    setUpdatingId(notification.id);
    setActionError(null);
    try {
      await api.delete(`/notifications/${notification.id}`);
      window.dispatchEvent(new Event('notifications:changed'));
      await reload();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setUpdatingId(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="stack">
      <header>
        <h1>{t('notificationsPage.title')}</h1>
        <p className="muted">{t('notificationsPage.description')}</p>
      </header>

      <ErrorText err={error} />
      <ErrorText err={actionError} />

      {loading ? (
        <p className="muted" role="status">{t('notificationsPage.loading')}</p>
      ) : notifications.length === 0 ? (
        <div className="card empty-state">
          <p>{t('notificationsPage.empty')}</p>
        </div>
      ) : (
        <div className="stack">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => void markRead(notification)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') void markRead(notification);
                }}
                aria-label={notification.read
                  ? t('notificationsPage.read')
                  : t('notificationsPage.markRead')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '14px 18px',
                  border: 0,
                  borderBottom: '1px solid var(--border-default)',
                  background: notification.read ? 'transparent' : 'var(--surface-subtle)',
                  color: 'inherit',
                  textAlign: 'left',
                  cursor: notification.read ? 'default' : 'pointer',
                }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{notification.message}</strong>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {!notification.read && (
                      <span className="badge badge-warning">{t('notificationsPage.unread')}</span>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: 'var(--status-danger)' }}
                      disabled={updatingId !== null}
                      onClick={(e) => void remove(notification, e)}
                    >
                      Xoá
                    </button>
                  </span>
                </span>
                <span className="muted small" style={{ display: 'block', marginTop: 5 }}>
                  {formatDateTime(notification.createdAt)}
                </span>
              </div>
            ))}
          </div>

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
              }}
              disabled={page <= 1 || loading}
            >
              {t('notificationsPage.previous')}
            </button>
            <span className="muted small">
              {t('notificationsPage.page', { page, pageCount })}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setPage((current) => Math.min(pageCount, current + 1));
              }}
              disabled={page >= pageCount || loading}
            >
              {t('notificationsPage.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

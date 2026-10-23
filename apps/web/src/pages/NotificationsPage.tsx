import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { ErrorText } from '../components/ErrorText';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { useCachedResource } from '../lib/useCachedResource';
import type { Notification, Paginated } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, Icon, notificationIcon, notificationTone, tones } from '../ds/ui';

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  usePageChrome({ crumbs: [t('notificationsPage.title')] });

  const { data, loading, error, reload } = useCachedResource(
    `notifications:${user?.id ?? 'anonymous'}:${page}`,
    () =>
      api.get<Paginated<Notification>>('/notifications', { params: { page, limit: PAGE_SIZE } })
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
    <>
      <section className="hero px-8 py-7 flex flex-col gap-2">
        <div className="lbl">Thông báo</div>
        <h1 className="disp text-[48px] mt-1">{t('notificationsPage.title')}</h1>
        <p className="text-hero-muted">{t('notificationsPage.description')}</p>
      </section>

      <ErrorText err={error} />
      <ErrorText err={actionError} />

      {loading ? (
        <p className="cap" role="status">{t('notificationsPage.loading')}</p>
      ) : notifications.length === 0 ? (
        <Card className="px-5 py-10 text-center"><p className="cap">{t('notificationsPage.empty')}</p></Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => void markRead(notification)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') void markRead(notification); }}
                aria-label={notification.read ? t('notificationsPage.read') : t('notificationsPage.markRead')}
                className={`flex gap-3 w-full px-5 py-3.5 border-b border-line-soft last:border-0 text-left ${notification.read ? 'bg-white cursor-default' : 'bg-subtle cursor-pointer'}`}
              >
                <span className={`w-8 h-8 rounded-btn flex items-center justify-center flex-none ${tones[notificationTone[notification.type] ?? 'neu']}`}>
                  <Icon name={notificationIcon[notification.type] ?? 'bell'} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex justify-between gap-3">
                    <strong>{notification.message}</strong>
                    <span className="flex items-center gap-2 flex-none">
                      {!notification.read && <Badge tone="warn">{t('notificationsPage.unread')}</Badge>}
                      <Btn sm v="d" disabled={updatingId !== null} onClick={(e) => void remove(notification, e)}>Xoá</Btn>
                    </span>
                  </span>
                  <span className="cap block mt-1">{formatDateTime(notification.createdAt)}</span>
                </span>
              </div>
            ))}
          </Card>

          <div className="flex justify-between items-center">
            <Btn sm onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>{t('notificationsPage.previous')}</Btn>
            <span className="cap">{t('notificationsPage.page', { page, pageCount })}</span>
            <Btn sm onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || loading}>{t('notificationsPage.next')}</Btn>
          </div>
        </>
      )}
    </>
  );
}

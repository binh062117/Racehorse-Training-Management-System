import i18n from "../i18n";
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { ErrorText } from '../components/ErrorText';
import { formatDateTime, formatNotificationMessage } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { useCachedResource } from '../lib/useCachedResource';
import type { Notification, Paginated } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Btn, Card, EmptyState, Icon, PageHeader, notificationIcon, notificationTone } from '../ds/ui';

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
  const unreadHere = notifications.filter((n) => !n.read).length;
  const toneText: Record<string, string> = { bad: 'text-bad', ok: 'text-ok', warn: 'text-warn', info: 'text-info', neu: 'text-muted', lock: 'text-bad' };

  return (
    <>
      <PageHeader
        title={t('notificationsPage.title')}
        sub={loading ? t('notificationsPage.loading') : total === 0 ? t('notificationsPage.description') : unreadHere > 0
          ? t('mergeUi.unreadSummary', { count: unreadHere, latest: notifications.length, total })
          : t('mergeUi.readSummary', { total })}
      />

      <ErrorText err={error} />
      <ErrorText err={actionError} />

      {loading ? (
        <p className="text-muted" role="status">{t('notificationsPage.loading')}</p>
      ) : notifications.length === 0 ? (
        <EmptyState>{t('notificationsPage.empty')}</EmptyState>
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="list-none m-0 p-0">
              {notifications.map((notification) => {
                const tone = notificationTone[notification.type] ?? 'neu';
                return (
                  <li key={notification.id} className="group flex items-start gap-3 px-5 py-3.5 border-b border-line-soft last:border-0 hover:bg-subtle">
                    <span className={`mt-0.5 flex-none ${toneText[tone]}`} aria-hidden>
                      <Icon name={notificationIcon[notification.type] ?? 'bell'} />
                    </span>
                    <button
                      type="button"
                      onClick={() => void markRead(notification)}
                      disabled={notification.read}
                      title={notification.read ? t('notificationsPage.read') : t('notificationsPage.markRead')}
                      className="flex-1 min-w-0 text-left disabled:cursor-default"
                    >
                      <span className={`block ${notification.read ? 'text-muted' : 'text-ink font-medium'}`}>{formatNotificationMessage(notification.message).replace(/^⚠️?\s*/u, '')}</span>
                      <span className="num block text-[12.5px] text-muted mt-0.5">{formatDateTime(notification.createdAt)}</span>
                    </button>
                    {!notification.read && <span className="mt-2 w-2 h-2 rounded-full bg-info flex-none" aria-label={t('notificationsPage.unread')} />}
                    <button
                      type="button"
                      aria-label={i18n.t("mergeUi.deleteNotification")}
                      title={i18n.t("mergeUi.deleteNotification")}
                      disabled={updatingId !== null}
                      onClick={(e) => void remove(notification, e)}
                      className="flex-none -my-1 w-8 h-8 inline-flex items-center justify-center rounded-btn text-muted hover:text-bad hover:bg-bad-bg disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {pageCount > 1 && (
            <div className="flex justify-between items-center">
              <Btn sm onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>{t('notificationsPage.previous')}</Btn>
              <span className="num text-[13px] text-muted">{t('notificationsPage.page', { page, pageCount })}</span>
              <Btn sm onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || loading}>{t('notificationsPage.next')}</Btn>
            </div>
          )}
        </>
      )}
    </>
  );
}

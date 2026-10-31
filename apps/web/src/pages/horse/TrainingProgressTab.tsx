import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import type { Paginated, TrainingSession } from '../../lib/types';
import { Badge, Card, EmptyState, KpiStrip } from '../../ds/ui';

const SESSION_TONE = { PLANNED: 'info', DONE: 'ok', CANCELLED: 'neu' } as const;

export function TrainingProgressTab({ horseId }: { horseId: string }) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const all: TrainingSession[] = [];
        for (let page = 1; !controller.signal.aborted; page += 1) {
          const response = await api.get<Paginated<TrainingSession>>(
            `/horses/${horseId}/sessions`,
            { params: { page, limit: 100 }, signal: controller.signal },
          );
          all.push(...response.data.data);
          if (page * response.data.meta.limit >= response.data.meta.total || response.data.data.length === 0) break;
        }
        if (!controller.signal.aborted) {
          setSessions(all.sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt)));
          setError(null);
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [horseId]);

  const completed = sessions.filter((session) => session.status === 'DONE');
  const planned = sessions.filter((session) => session.status === 'PLANNED');
  const metrics = completed.filter((session) => session.resultValue != null);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold">{t('session.heading')}</h2>
      <KpiStrip items={[
        { label: t('session.heading'), value: sessions.length },
        { label: t('session.displayStatus.DONE'), value: completed.length },
        { label: t('session.displayStatus.PLANNED'), value: planned.length },
        { label: t('session.result', 'Results recorded'), value: metrics.length },
      ]} />
      <ErrorText err={error} />
      {loading ? (
        <p className="text-muted" role="status">{t('session.loading')}</p>
      ) : sessions.length === 0 ? (
        <EmptyState>{t('session.empty')}</EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((session) => (
            <Card key={session.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{session.type}</h3>
                  <p className="mt-1 text-[12px] text-muted">{formatDateTime(session.scheduledAt)} · {session.trainer.name}</p>
                </div>
                <Badge tone={SESSION_TONE[session.status]}>{t(`session.displayStatus.${session.status}`)}</Badge>
              </div>
              {(session.resultMetric || session.resultValue != null) && (
                <p className="mt-3 border-t border-line-soft pt-3 text-[13px]">
                  {t('session.result')}: {session.resultMetric ?? '—'}{session.resultValue != null && <> · <strong className="num">{session.resultValue}</strong></>}
                </p>
              )}
              {session.notes && <p className="mt-2 text-[13px] text-muted">{session.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { AuditLog, AuditStats, Paginated } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, EmptyState, Field, Icon, Input, KpiStrip, NativeSelect, PageHeader, Pager, thCls, type Tone } from '../ds/ui';
import { formatDate, formatTime } from '../lib/format';
import { ErrorText } from '../components/ErrorText';

/* Audit trail (Tân). Shared labels for the list and the detail page. */
export const AUDIT_ACTION_TONE: Record<string, Tone> = {
  AUTH_LOGIN: 'ok', AUTH_LOGIN_FAILED: 'bad',
  USER_APPROVE: 'info', USER_DISABLE: 'warn', USER_REJECT: 'bad', USER_DELETE: 'bad', USER_ROLE_ASSIGN: 'info', USER_UPDATE: 'neu',
  HORSE_CREATE: 'ok', HORSE_UPDATE: 'info', HORSE_DELETE: 'bad', HORSE_LOCK: 'lock', HORSE_UNLOCK: 'ok',
  DAILY_CARE_GENERATE: 'info', DAILY_CARE_COMPLETE: 'ok', DAILY_CARE_UNCOMPLETE: 'neu',
};
export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_TONE);
export const AUDIT_ENTITIES = ['AUTH', 'USER', 'HORSE', 'TRAINING_SESSION', 'TRAINING_PLAN', 'HEALTH_RECORD', 'INCIDENT_REPORT', 'DAILY_CARE'];

export function AuditActionBadge({ action }: { action: string }) {
  const { t, i18n } = useTranslation();
  const key = `audit.actions.${action}`;
  return <Badge tone={AUDIT_ACTION_TONE[action] ?? 'neu'}>{i18n.exists(key) ? t(key) : action}</Badge>;
}

const LIMIT = 20;

export function AuditLogPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  usePageChrome({ crumbs: [t('nav.adminSection', 'Quản trị'), t('audit.title')] });

  const [stats, setStats] = useState<AuditStats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setErr(null);
    try {
      const params: Record<string, string | number> = { page: p, limit: LIMIT };
      if (query) params.search = query;
      if (entity) params.entity = entity;
      if (action) params.action = action;
      if (start) params.startDate = start;
      if (end) params.endDate = end;
      const [logsRes, statsRes] = await Promise.all([
        api.get<Paginated<AuditLog>>('/audit-logs', { params }),
        p === 1 ? api.get<AuditStats>('/audit-logs/stats') : Promise.resolve(null),
      ]);
      setLogs(logsRes.data.data);
      setTotal(logsRes.data.meta.total);
      setPage(p);
      if (statsRes) setStats(statsRes.data);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [query, entity, action, start, end]);

  useEffect(() => { void load(1); }, [load]);

  const filtered = !!(query || entity || action || start || end);
  const clear = () => { setSearch(''); setQuery(''); setEntity(''); setAction(''); setStart(''); setEnd(''); };
  const entityLabel = (e: string) => (i18n.exists(`audit.entities.${e}`) ? t(`audit.entities.${e}`) : e);

  return (
    <>
      <PageHeader
        title={t('audit.title')}
        sub={stats ? t('audit.sub', { today: stats.todayLogs, actors: stats.uniqueActorsCount, failed: stats.authEventsToday }) : t('audit.loading')}
        search={{ placeholder: t('audit.search'), value: search, onChange: setSearch }}
      />

      {stats && (
        <KpiStrip items={[
          { label: t('audit.kpiTotal'), value: stats.totalLogs },
          { label: t('audit.kpiToday'), value: stats.todayLogs, lead: true },
          { label: t('audit.kpiAuth'), value: stats.authEventsToday },
          { label: t('audit.kpiActors'), value: stats.uniqueActorsCount },
        ]} />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('audit.entity')} className="w-[200px]">
          <NativeSelect value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">{t('audit.all')}</option>
            {AUDIT_ENTITIES.map((e) => <option key={e} value={e}>{entityLabel(e)}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t('audit.action')} className="w-[220px]">
          <NativeSelect value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">{t('audit.all')}</option>
            {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{t(`audit.actions.${a}`)}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t('audit.from')} className="w-[160px]"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label={t('audit.to')} className="w-[160px]"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        {filtered && <Btn v="g" onClick={clear}><Icon name="x" className="w-3.5 h-3.5" />{t('audit.clear')}</Btn>}
      </div>

      <ErrorText err={err} />

      {loading && logs.length === 0 ? (
        <p className="text-muted">{t('audit.loading')}</p>
      ) : logs.length === 0 ? (
        <EmptyState>{filtered ? t('audit.noMatch') : t('audit.empty')}</EmptyState>
      ) : (
        <>
          <Card className={loading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${thCls} pl-5`}>{t('audit.time')}</th>
                    <th className={thCls}>{t('audit.actor')}</th>
                    <th className={thCls}>{t('audit.action')}</th>
                    <th className={thCls}>{t('audit.description')}</th>
                    <th className={`${thCls} pr-5`}>{t('audit.ip')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} onClick={() => navigate(`/admin/audit-logs/${l.id}`)} className="border-b border-line-soft last:border-0 hover:bg-subtle cursor-pointer align-top">
                      <td className="pl-5 pr-4 py-3 whitespace-nowrap num">
                        <div>{formatDate(l.createdAt)}</div>
                        <div className="text-[12.5px] text-muted">{formatTime(l.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {l.actor ? (
                          <>
                            <div className="font-medium">{l.actor.name}</div>
                            <div className="text-[12.5px] text-muted">{l.actor.role ? t(`role.${l.actor.role}`) : l.actor.email}</div>
                          </>
                        ) : <span className="text-muted">{t('audit.system')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <AuditActionBadge action={l.action} />
                        <div className="text-[12px] text-muted mt-1">{entityLabel(l.entity)}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[420px]">
                        <Link to={`/admin/audit-logs/${l.id}`} onClick={(e) => e.stopPropagation()} className="text-ink no-underline hover:text-info line-clamp-2">{l.description}</Link>
                      </td>
                      <td className="pl-4 pr-5 py-3 num text-[12.5px] text-muted whitespace-nowrap">{l.ipAddress ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager page={page} total={total} limit={LIMIT} onPage={(p) => void load(p)}
            label={t('audit.pageLabel', { from: (page - 1) * LIMIT + 1, to: Math.min(page * LIMIT, total), total })} />
        </>
      )}
    </>
  );
}

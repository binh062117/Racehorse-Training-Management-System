import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { AuditLog } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Btn, Card, CardHeader, Icon, PageHeader, Seg } from '../ds/ui';
import { formatDateTime } from '../lib/format';
import { ErrorText } from '../components/ErrorText';
import { AuditActionBadge } from './AuditLogPage';

const show = (v: unknown) => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** One audit entry: who did what, when, from where, and what changed. */
export function AuditLogDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  usePageChrome({ crumbs: [t('nav.adminSection', 'Quản trị'), t('audit.title'), t('audit.detail')] });

  const [log, setLog] = useState<AuditLog | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [view, setView] = useState<'table' | 'raw'>('table');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<AuditLog>(`/audit-logs/${id}`).then((r) => setLog(r.data)).catch(setErr);
  }, [id]);

  if (err) return <ErrorText err={err} />;
  if (!log) return <p className="text-muted">{t('audit.loading')}</p>;

  const diff = log.diff && typeof log.diff === 'object' ? (log.diff as Record<string, unknown>) : null;
  const before = diff && 'before' in diff ? ((diff.before as Record<string, unknown>) ?? {}) : null;
  const after = diff && 'after' in diff ? ((diff.after as Record<string, unknown>) ?? {}) : null;
  const keys = before && after ? [...new Set([...Object.keys(before), ...Object.keys(after)])] : [];
  const entityLabel = i18n.exists(`audit.entities.${log.entity}`) ? t(`audit.entities.${log.entity}`) : log.entity;

  const copy = () => {
    void navigator.clipboard.writeText(JSON.stringify(log.diff, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const facts: [string, React.ReactNode][] = [
    [t('audit.time'), <span className="num">{formatDateTime(log.createdAt)}</span>],
    [t('audit.actor'), log.actor ? <>{log.actor.name} <span className="text-muted">· {log.actor.email}{log.actor.role ? ` · ${t(`role.${log.actor.role}`)}` : ''}</span></> : <span className="text-muted">{t('audit.system')}</span>],
    [t('audit.action'), <AuditActionBadge action={log.action} />],
    [t('audit.entity'), <>{entityLabel}{log.entityId && <span className="num text-muted"> · {log.entityId.slice(0, 8)}…</span>}</>],
    [t('audit.ip'), <span className="num">{log.ipAddress ?? '—'}</span>],
    [t('audit.device'), <span className="text-[13px] text-muted break-all">{log.userAgent ?? '—'}</span>],
  ];

  return (
    <>
      <PageHeader
        crumbs={[[t('audit.title'), '/admin/audit-logs']]}
        title={log.description}
        actions={<Btn to="/admin/audit-logs"><Icon name="chevLeft" className="w-4 h-4" />{t('audit.back')}</Btn>}
      />

      <Card>
        <dl className="m-0">
          {facts.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[160px_minmax(0,1fr)] gap-4 px-5 py-3 border-b border-line-soft last:border-0">
              <dt className="text-muted">{k}</dt>
              <dd className="m-0">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader title={t('audit.changes')}>
          {diff && <Seg value={view} onChange={(k) => setView(k as 'table' | 'raw')} options={[['table', t('audit.viewTable')], ['raw', 'JSON']]} />}
        </CardHeader>
        {!diff || Object.keys(diff).length === 0 ? (
          <p className="px-5 py-4 text-muted">{t('audit.noChanges')}</p>
        ) : view === 'raw' ? (
          <div className="p-4">
            <div className="flex justify-end mb-2">
              <Btn sm v="g" onClick={copy}><Icon name={copied ? 'check' : 'file'} className="w-3.5 h-3.5" />{copied ? t('audit.copied') : t('audit.copy')}</Btn>
            </div>
            <pre className="m-0 rounded-btn bg-subtle border border-line p-4 text-[12.5px] leading-5 overflow-x-auto">{JSON.stringify(diff, null, 2)}</pre>
          </div>
        ) : before && after ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>
                <th className="h-10 pl-5 pr-4 text-left text-[12px] font-medium text-muted border-b border-line">{t('audit.field')}</th>
                <th className="h-10 px-4 text-left text-[12px] font-medium text-muted border-b border-line">{t('audit.before')}</th>
                <th className="h-10 pl-4 pr-5 text-left text-[12px] font-medium text-muted border-b border-line">{t('audit.after')}</th>
              </tr></thead>
              <tbody>
                {keys.map((k) => {
                  const changed = show(before[k]) !== show(after[k]);
                  return (
                    <tr key={k} className="border-b border-line-soft last:border-0">
                      <td className="pl-5 pr-4 py-2.5 font-medium">{k}</td>
                      <td className={`px-4 py-2.5 num ${changed ? 'text-bad line-through decoration-bad/40' : 'text-muted'}`}>{show(before[k])}</td>
                      <td className={`pl-4 pr-5 py-2.5 num ${changed ? 'text-ok font-medium' : 'text-muted'}`}>{show(after[k])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <dl className="m-0">
            {Object.entries(diff).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[160px_minmax(0,1fr)] gap-4 px-5 py-2.5 border-b border-line-soft last:border-0">
                <dt className="font-medium">{k}</dt>
                <dd className="m-0 num text-[13px] break-all">{show(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <p className="text-[13px] text-muted"><Link to="/admin/audit-logs" className="text-info no-underline">{t('audit.back')}</Link></p>
    </>
  );
}

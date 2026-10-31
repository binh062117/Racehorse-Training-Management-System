import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import type { CountedPage, Role, User } from '../lib/types';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import { Alert, Badge, Btn, Card, Chip, ChipCount, EmptyState, Icon, KpiStrip, NativeSelect, PageHeader, Pager, type Tone } from '../ds/ui';

const ROLES: Role[] = ['MANAGER', 'TRAINER', 'VET', 'GROOM', 'OWNER'];
const STATUS_TONE: Record<User['status'], Tone> = { ACTIVE: 'ok', PENDING: 'warn', DISABLED: 'bad' };
type StatusFilter = 'ALL' | User['status'];
const FILTERS: StatusFilter[] = ['ALL', 'PENDING', 'ACTIVE', 'DISABLED'];
const PAGE_SIZE = 20;

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [result, setResult] = useState<CountedPage<User> | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  // Role picked for each pending account, and the pending accounts ticked for bulk approval.
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkErr, setBulkErr] = useState<unknown>(null);
  const [bulkDone, setBulkDone] = useState<number | null>(null);
  const requestId = useRef(0);

  usePageChrome({ crumbs: [t('nav.adminSection', 'Quản trị'), t('nav.users', 'Phân quyền tài khoản')] });

  useEffect(() => {
    const id = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    const mine = ++requestId.current;
    setLoading(true);
    try {
      const res = await api.get<CountedPage<User>>('/users', {
        params: { page, limit: PAGE_SIZE, ...(status !== 'ALL' ? { status } : {}), ...(query ? { q: query } : {}) },
      });
      if (mine !== requestId.current) return; // a newer filter already asked
      setResult(res.data);
      setErr(null);
    } catch (e) {
      if (mine === requestId.current) setErr(e);
    } finally {
      if (mine === requestId.current) setLoading(false);
    }
  }, [page, status, query]);

  useEffect(() => { void load(); }, [load]);

  const counts = result?.counts ?? {};
  const pending = counts.PENDING ?? 0;
  const active = counts.ACTIVE ?? 0;
  const disabled = counts.DISABLED ?? 0;
  const countFor = (s: StatusFilter) => (s === 'ALL' ? pending + active + disabled : counts[s] ?? 0);
  const users = result?.data ?? [];
  const pendingHere = users.filter((u) => u.status === 'PENDING');
  const roleOf = (u: User): Role => roles[u.id] ?? u.role ?? 'OWNER';
  const allTicked = pendingHere.length > 0 && pendingHere.every((u) => selected.has(u.id));

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected(allTicked ? new Set() : new Set(pendingHere.map((u) => u.id)));
  const setRoleForSelected = (r: Role) => setRoles((m) => { const n = { ...m }; for (const id of selected) n[id] = r; return n; });
  const pickFilter = (s: StatusFilter) => { setStatus(s); setPage(1); setSelected(new Set()); };

  const approveSelected = async () => {
    const chosen = pendingHere.filter((u) => selected.has(u.id));
    if (chosen.length === 0) return;
    setBulkBusy(true);
    setBulkErr(null);
    try {
      const res = await api.post<{ approved: User[]; skipped: string[] }>('/users/approve', {
        users: chosen.map((u) => ({ id: u.id, role: roleOf(u) })),
      });
      setBulkDone(res.data.approved.length);
      setSelected(new Set());
      await load();
    } catch (e) {
      setBulkErr(e);
    } finally {
      setBulkBusy(false);
    }
  };

  const sub = !result
    ? t('user.loading')
    : pending > 0
      ? t('user.subPending', { count: pending })
      : t('user.subActive', { count: active });
  const th = 'h-10 px-4 text-[12px] font-medium text-muted border-b border-line';

  return (
    <>
      <PageHeader title={t('nav.users')} sub={sub} search={{ placeholder: t('user.searchPlaceholder'), value: search, onChange: setSearch }} />

      <KpiStrip items={[
        { label: t('user.kpiTotal', 'Tổng tài khoản'), value: pending + active + disabled },
        { label: t('user.kpiPending', 'Chờ duyệt'), value: pending, tone: pending > 0 ? 'warn' : undefined, lead: pending > 0 },
        { label: t('user.kpiActive', 'Đang hoạt động'), value: active },
        { label: t('user.kpiDisabled', 'Đã khóa'), value: disabled },
      ]} />

      <div className="flex flex-wrap gap-2 items-center" role="group" aria-label={t('user.status')}>
        {FILTERS.map((s) => (
          <Chip key={s} on={status === s} onClick={() => pickFilter(s)}>
            {s === 'ALL' ? t('user.filterAll') : t(`user.statusLabel.${s}`)} <ChipCount n={countFor(s)} />
          </Chip>
        ))}
      </div>

      {bulkDone != null && (
        <Alert tone="ok" icon="check" action={<Btn sm v="g" onClick={() => setBulkDone(null)}><Icon name="x" className="w-3.5 h-3.5" /></Btn>}>
          {t('user.bulkDone', { count: bulkDone })}
        </Alert>
      )}

      {selected.size > 0 && (
        <div className="sticky top-[60px] md:top-3 z-20 flex flex-wrap items-center gap-3 rounded-card border border-info-bd bg-info-bg px-4 py-2.5 shadow-lift">
          <span className="font-medium text-info-ink">{t('user.selectedCount', { count: selected.size })}</span>
          <span className="flex items-center gap-2 text-[13px] text-info-ink">
            {t('user.sameRole')}
            <NativeSelect aria-label={t('user.sameRole')} className="w-[170px]" value="" onChange={(e) => e.target.value && setRoleForSelected(e.target.value as Role)}>
              <option value="">{t('user.keepEach')}</option>
              {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
            </NativeSelect>
          </span>
          <span className="flex-1" />
          <Btn sm v="g" onClick={() => setSelected(new Set())} disabled={bulkBusy}>{t('user.clearSelection')}</Btn>
          <Btn sm v="p" onClick={() => void approveSelected()} disabled={bulkBusy}>
            <Icon name="check" className="w-3.5 h-3.5" />{bulkBusy ? t('user.approving') : t('user.approveSelected', { count: selected.size })}
          </Btn>
          <div className="w-full"><ErrorText err={bulkErr} /></div>
        </div>
      )}

      {!result && loading ? (
        <p className="text-muted">{t('user.loading')}</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : users.length === 0 ? (
        <EmptyState>{query || status !== 'ALL' ? t('user.noMatch') : t('user.empty')}</EmptyState>
      ) : (
        <>
          <Card className={loading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className={`${th} pl-5 w-10`}>
                      {pendingHere.length > 0 && (
                        <input type="checkbox" className="w-4 h-4 accent-[#1a4b8a] align-middle" checked={allTicked} onChange={toggleAll} aria-label={t('user.selectAllPending')} />
                      )}
                    </th>
                    <th className={th}>{t('auth.name')}</th>
                    <th className={th}>{t('auth.email')}</th>
                    <th className={th}>{t('user.role')}</th>
                    <th className={th}>{t('user.status')}</th>
                    <th className={th}>{t('user.created')}</th>
                    <th className={`${th} pr-5`} aria-label={t('horsesPage.thActions', 'Thao tác')} />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow key={u.id} user={u} isSelf={u.id === currentUser?.id} onChanged={load}
                      role={roleOf(u)} onRole={(r) => setRoles((m) => ({ ...m, [u.id]: r }))}
                      ticked={selected.has(u.id)} onTick={() => toggle(u.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pager page={page} total={result?.meta.total ?? 0} limit={PAGE_SIZE} onPage={(p) => { setPage(p); setSelected(new Set()); }}
            label={t('user.pageLabel', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, result?.meta.total ?? 0), total: result?.meta.total ?? 0 })} />
        </>
      )}
    </>
  );
}

function UserRow({ user, isSelf, onChanged, role, onRole, ticked, onTick }: {
  user: User;
  isSelf: boolean;
  onChanged: () => void;
  role: Role;
  onRole: (r: Role) => void;
  ticked: boolean;
  onTick: () => void;
}) {
  const { t } = useTranslation();
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setErr(null);
    setBusy(true);
    try {
      await api.patch(`/users/${user.id}`, body);
      onChanged();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!window.confirm(t('user.rejectConfirm'))) return;
    setErr(null);
    setBusy(true);
    try {
      await api.post(`/users/${user.id}/reject`);
      onChanged();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('user.deleteConfirm', { name: user.name }))) return;
    setErr(null);
    setBusy(true);
    try {
      await api.delete(`/users/${user.id}`);
      onChanged();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className={`border-b border-line-soft last:border-0 hover:bg-subtle align-middle ${ticked ? 'bg-info-bg/60' : ''} ${user.status === 'DISABLED' ? 'text-muted' : ''}`}>
      <td className="pl-5 pr-2 py-3 w-10">{user.status === 'PENDING' && <input type="checkbox" className="w-4 h-4 accent-[#1a4b8a] align-middle" checked={ticked} onChange={onTick} aria-label={t('user.selectOne', { name: user.name })} />}</td>
      <td className="px-4 py-3 font-medium">{user.name}{isSelf && <span className="ml-1.5 text-[12px] font-normal text-muted">{t('user.you', '(bạn)')}</span>}</td>
      <td className="px-4 py-3 text-muted">{user.email}</td>
      <td className="px-4 py-3">
        {user.status === 'PENDING' ? (
          <NativeSelect aria-label={t('user.role')} className="w-[160px]" value={role} onChange={(e) => onRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
          </NativeSelect>
        ) : user.role ? t(`role.${user.role}`) : <span className="text-muted">{t('user.unassigned', 'Chưa gán')}</span>}
      </td>
      <td className="px-4 py-3"><Badge tone={STATUS_TONE[user.status]}>{t(`user.statusLabel.${user.status}`)}</Badge></td>
      <td className="px-4 py-3 num text-muted whitespace-nowrap">{formatDate(user.createdAt)}</td>
      <td className="pl-4 pr-5 py-3">
        <div className="flex flex-wrap justify-end gap-1.5">
          {user.status === 'PENDING' && (
            <>
              <Btn sm v="p" disabled={busy} onClick={() => patch({ role, status: 'ACTIVE' })}><Icon name="check" className="w-3.5 h-3.5" />{t('user.approve')}</Btn>
              <Btn sm v="d" disabled={busy} onClick={() => void reject()}><Icon name="x" className="w-3.5 h-3.5" />{t('user.reject')}</Btn>
            </>
          )}
          {user.status === 'ACTIVE' && (
            <Btn sm disabled={busy} onClick={() => patch({ status: 'DISABLED' })}><Icon name="lock" className="w-3.5 h-3.5" />{t('user.disable')}</Btn>
          )}
          {user.status === 'DISABLED' && (
            <Btn sm disabled={busy} onClick={() => patch({ status: 'ACTIVE' })}><Icon name="unlock" className="w-3.5 h-3.5" />{t('user.enable')}</Btn>
          )}
          {(user.status === 'ACTIVE' || user.status === 'DISABLED') && !isSelf && (
            <Btn sm v="d" disabled={busy} onClick={() => void remove()}><Icon name="trash" className="w-3.5 h-3.5" />{t('user.delete')}</Btn>
          )}
        </div>
        <ErrorText err={err} />
      </td>
    </tr>
  );
}

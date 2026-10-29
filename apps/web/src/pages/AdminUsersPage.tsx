import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import type { Paginated, Role, User } from '../lib/types';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, EmptyState, Icon, KpiStrip, NativeSelect, PageHeader, type Tone } from '../ds/ui';

const ROLES: Role[] = ['MANAGER', 'TRAINER', 'VET', 'GROOM', 'OWNER'];
const STATUS_TONE: Record<User['status'], Tone> = { ACTIVE: 'ok', PENDING: 'warn', DISABLED: 'bad' };

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  usePageChrome({ crumbs: [t('nav.adminSection', 'Quản trị'), t('nav.users', 'Phân quyền tài khoản')] });

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<User>>('/users', { params: { limit: 100 } });
      setUsers(res.data.data);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = users.filter((u) => u.status === 'PENDING').length;
  const active = users.filter((u) => u.status === 'ACTIVE').length;
  const disabled = users.filter((u) => u.status === 'DISABLED').length;
  // Accounts waiting for a decision are the reason to open this screen — list them first.
  const order: Record<User['status'], number> = { PENDING: 0, ACTIVE: 1, DISABLED: 2 };
  const sorted = [...users].sort((a, b) => order[a.status] - order[b.status]);

  const sub = loading
    ? t('user.loading')
    : pending > 0
      ? t('user.subPending', { count: pending })
      : t('user.subActive', { count: active });
  const th = 'h-10 px-4 text-[12px] font-medium text-muted border-b border-line';

  return (
    <>
      <PageHeader title={t('nav.users')} sub={sub} />

      <KpiStrip items={[
        { label: t('user.kpiTotal', 'Tổng tài khoản'), value: users.length },
        { label: t('user.kpiPending', 'Chờ duyệt'), value: pending, tone: pending > 0 ? 'warn' : undefined, lead: pending > 0 },
        { label: t('user.kpiActive', 'Đang hoạt động'), value: active },
        { label: t('user.kpiDisabled', 'Đã khóa'), value: disabled },
      ]} />

      {loading ? (
        <p className="text-muted">{t('user.loading')}</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : users.length === 0 ? (
        <EmptyState>{t('user.empty')}</EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="text-left">
                  <th className={`${th} pl-5`}>{t('auth.name')}</th>
                  <th className={th}>{t('auth.email')}</th>
                  <th className={th}>{t('user.role')}</th>
                  <th className={th}>{t('user.status')}</th>
                  <th className={th}>{t('user.created')}</th>
                  <th className={`${th} pr-5`} aria-label={t('horsesPage.thActions', 'Thao tác')} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((u) => (
                  <UserRow key={u.id} user={u} isSelf={u.id === currentUser?.id} onChanged={load} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function UserRow({ user, isSelf, onChanged }: { user: User; isSelf: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const [role, setRole] = useState<Role>(user.role ?? 'OWNER');
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
    <tr className={`border-b border-line-soft last:border-0 hover:bg-subtle align-middle ${user.status === 'DISABLED' ? 'text-muted' : ''}`}>
      <td className="pl-5 pr-4 py-3 font-medium">{user.name}{isSelf && <span className="ml-1.5 text-[12px] font-normal text-muted">{t('user.you', '(bạn)')}</span>}</td>
      <td className="px-4 py-3 text-muted">{user.email}</td>
      <td className="px-4 py-3">
        {user.status === 'PENDING' ? (
          <NativeSelect aria-label={t('user.role')} className="w-[160px]" value={role} onChange={(e) => setRole(e.target.value as Role)}>
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

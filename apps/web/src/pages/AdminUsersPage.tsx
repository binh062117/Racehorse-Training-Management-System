import i18n from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import type { Paginated, Role, User } from '../lib/types';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, HeroStats, Icon, type Tone } from '../ds/ui';

const ROLES: Role[] = ['MANAGER', 'TRAINER', 'VET', 'GROOM', 'OWNER'];
const STATUS_TONE: Record<User['status'], Tone> = { ACTIVE: 'ok', PENDING: 'warn', DISABLED: 'bad' };

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  usePageChrome({ crumbs: [i18n.t("ui.administration"), t('nav.users')] });

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

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div>
          <div className="lbl">{i18n.t("nav.admin")}</div>
          <h1 className="disp text-[56px] mt-2">{t('nav.users')}</h1>
        </div>
        <HeroStats items={[
          { label: i18n.t("ui.totalAccounts"), value: users.length },
          { label: i18n.t("user.statusLabel.PENDING"), value: pending, color: pending > 0 ? '#f3d29a' : undefined },
          { label: i18n.t("dashboard.activeHorses"), value: active, color: '#9fd9b1' },
          { label: i18n.t("ui.locked"), value: disabled },
        ]} />
      </section>

      {loading ? (
        <p className="cap">{t('user.loading')}</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : users.length === 0 ? (
        <Card className="px-5 py-10 text-center"><p className="cap">{t('user.empty')}</p></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="text-left">
                  {[t('auth.name'), t('auth.email'), t('user.role'), t('user.status'), t('user.created'), ''].map((th) => (
                    <th key={th} className="h-[42px] px-4 bg-cream lbl border-b border-line">{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
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
    <tr className="border-b border-line-soft hover:bg-subtle align-top">
      <td className="px-4 py-3 font-medium">{user.name}</td>
      <td className="px-4 py-3 cap">{user.email}</td>
      <td className="px-4 py-3">
        {user.status === 'PENDING' ? (
          <select
            className="h-9 rounded-btn border border-line bg-white px-2.5 text-[12.5px] outline-none focus:border-info focus:ring-1 focus:ring-info"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
          </select>
        ) : user.role ? t(`role.${user.role}`) : '—'}
      </td>
      <td className="px-4 py-3"><Badge tone={STATUS_TONE[user.status]}>{t(`user.statusLabel.${user.status}`)}</Badge></td>
      <td className="px-4 py-3 cap">{formatDate(user.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
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

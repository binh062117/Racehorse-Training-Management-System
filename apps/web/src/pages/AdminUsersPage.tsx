import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import type { Paginated, Role, User } from '../lib/types';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';

const ROLES: Role[] = ['MANAGER', 'TRAINER', 'VET', 'GROOM', 'OWNER'];

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<User>>('/users', {
        params: { limit: 100 },
      });
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

  return (
    <div className="stack">
      <h1>{t('nav.users')}</h1>
      {loading ? (
        <p className="muted">{t('user.loading')}</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : users.length === 0 ? (
        <div className="card empty-state">
          <p className="muted" style={{ margin: 0 }}>{t('user.empty')}</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('auth.name')}</th>
              <th>{t('auth.email')}</th>
              <th>{t('user.role')}</th>
              <th>{t('user.status')}</th>
              <th>{t('user.created')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={u.id === currentUser?.id}
                onChanged={load}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  onChanged,
}: {
  user: User;
  isSelf: boolean;
  onChanged: () => void;
}) {
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
    <tr>
      <td>{user.name}</td>
      <td>{user.email}</td>
      <td>
        {user.status === 'PENDING' ? (
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </select>
        ) : user.role ? (
          t(`role.${user.role}`)
        ) : (
          '—'
        )}
      </td>
      <td>
        <span
          className={`badge badge-${
            user.status === 'ACTIVE'
              ? 'success'
              : user.status === 'PENDING'
                ? 'warning'
                : 'danger'
          }`}
        >
          {t(`user.statusLabel.${user.status}`)}
        </span>
      </td>
      <td>{formatDate(user.createdAt)}</td>
      <td>
        {user.status === 'PENDING' && (
          <>
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={() => patch({ role, status: 'ACTIVE' })}
            >
              {t('user.approve')}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={reject}
            >
              {t('user.reject')}
            </button>
          </>
        )}
        {user.status === 'ACTIVE' && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={() => patch({ status: 'DISABLED' })}
          >
            {t('user.disable')}
          </button>
        )}
        {user.status === 'DISABLED' && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={() => patch({ status: 'ACTIVE' })}
          >
            {t('user.enable')}
          </button>
        )}
        {(user.status === 'ACTIVE' || user.status === 'DISABLED') &&
          !isSelf && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={remove}
            >
              {t('user.delete')}
            </button>
          )}
        <ErrorText err={err} />
      </td>
    </tr>
  );
}

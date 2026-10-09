import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Horse, Paginated, TrainingSession, User } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDateTime } from '../lib/format';

export function OverviewPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [pendingUsers, setPendingUsers] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const horseResponse = await api.get<Paginated<Horse>>('/horses', {
          params: { limit: 100 },
        });
        const horseData = horseResponse.data.data;
        const sessionResults = await Promise.allSettled(
          horseData.slice(0, 6).map((horse) =>
            api.get<Paginated<TrainingSession>>(`/horses/${horse.id}/sessions`, {
              params: { limit: 100 },
            }),
          ),
        );
        const upcoming = sessionResults.flatMap((result) =>
          result.status === 'fulfilled' ? result.value.data.data : [],
        );
        if (user?.role === 'MANAGER') {
          const userResponse = await api.get<Paginated<User>>('/users', {
            params: { limit: 100 },
          });
          if (!cancelled) {
            setPendingUsers(userResponse.data.data.filter((item) => item.status === 'PENDING').length);
          }
        }
        if (!cancelled) {
          setHorses(horseData);
          setSessions(
            upcoming
              .filter((session) => session.status === 'PLANNED' && new Date(session.scheduledAt) >= new Date())
              .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
              .slice(0, 4),
          );
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.role]);

  const activeCount = horses.filter((horse) => horse.status === 'ACTIVE').length;
  const restingCount = horses.filter((horse) => horse.status === 'RESTING').length;
  const attentionHorses = horses.filter((horse) => horse.healthStatus && horse.healthStatus !== 'FIT');
  const metrics = [
    { label: t('dashboard.totalHorses'), value: horses.length, tone: 'gold' },
    { label: t('dashboard.activeHorses'), value: activeCount, tone: 'green' },
    { label: t('dashboard.restingHorses'), value: restingCount, tone: 'amber' },
    { label: t('dashboard.upcomingSessions'), value: sessions.length, tone: 'blue' },
    ...(user?.role === 'MANAGER' ? [{ label: t('dashboard.pendingAccounts'), value: pendingUsers ?? '—', tone: 'coral' }] : []),
  ];

  return (
    <div className="dashboard-page">
      <div className="role-notice"><span aria-hidden="true">◉</span>{t('dashboard.roleNotice', { role: user?.role ? t(`role.${user.role}`) : '' })}</div>
      {error && <ErrorText err={error} />}
      <section className="metric-grid" aria-label={t('dashboard.summary')}>
        {metrics.map((metric) => (
          <article className={`metric-card metric-${metric.tone}`} key={metric.label}>
            <strong>{loading ? '—' : metric.value}</strong>
            <span>{metric.label}</span>
          </article>
        ))}
      </section>

      <div className="dashboard-columns">
        <section className="panel-card">
          <div className="panel-heading">
            <h2>{t('dashboard.clubHorses')}</h2>
            <Link to="/horses">{horses.length} {t('dashboard.horseCount')}</Link>
          </div>
          {loading ? <p className="panel-empty">{t('horseFlow.loading')}</p> : horses.length === 0 ? (
            <p className="panel-empty">{t('horse.empty')}</p>
          ) : (
            <ul className="dashboard-list">
              {horses.slice(0, 7).map((horse) => (
                <li key={horse.id}>
                  <span className="horse-initial">{horse.name.slice(0, 1).toUpperCase()}</span>
                  <span className="dashboard-row-main">
                    <Link to={`/horses/${horse.id}`}><strong>{horse.name}</strong></Link>
                    <small>{horse.breed ?? t('horseFlow.breedNotSet')} · {horse.owner.name}</small>
                  </span>
                  <span className={`status-pill status-${horse.status.toLowerCase()}`}>{t(`horseFlow.status.${horse.status}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="dashboard-side-column">
          <section className="panel-card">
            <div className="panel-heading"><h2>{t('dashboard.upcomingTitle')}</h2><span>{sessions.length}</span></div>
            {loading ? <p className="panel-empty">{t('horseFlow.loading')}</p> : sessions.length === 0 ? (
              <p className="panel-empty">{t('dashboard.noUpcoming')}</p>
            ) : (
              <ul className="dashboard-list compact-list">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <span className="horse-initial">{session.horse.name.slice(0, 1).toUpperCase()}</span>
                    <span className="dashboard-row-main">
                      <strong>{session.horse.name}</strong>
                      <small>{formatDateTime(session.scheduledAt)} · {session.type}</small>
                    </span>
                    <span className="status-pill status-planned">{t('dashboard.scheduled')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel-card attention-panel">
            <div className="panel-heading"><h2>{t('dashboard.healthTitle')}</h2><span>{attentionHorses.length}</span></div>
            {attentionHorses.length === 0 ? (
              <p className="panel-empty">{t('dashboard.noHealthAlerts')}</p>
            ) : (
              <ul className="attention-list">
                {attentionHorses.slice(0, 4).map((horse) => (
                  <li key={horse.id}><Link to={`/horses/${horse.id}`}>{horse.name}</Link><span>{t(`horseFlow.health.${horse.healthStatus}`)}</span></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
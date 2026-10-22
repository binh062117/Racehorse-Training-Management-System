import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { api, getFileUrl } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, Paginated, Notification, User, Role } from '../lib/types';
import { formatDate } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import {
  Badge, Btn, Card, CardHeader, HeroStats, Icon, Silk,
  careerTone, healthTone,
} from '../ds/ui';

interface QuickAction {
  icon: string;
  titleKey: string;
  descKey: string;
  to: string;
}

const QUICK_ACTIONS: Partial<Record<Role, QuickAction[]>> = {
  TRAINER: [
    { icon: 'plans', to: '/plans?action=create', titleKey: 'trainerPlan', descKey: 'trainerPlanDescription' },
    { icon: 'heart', to: '/plans', titleKey: 'trainerProgress', descKey: 'trainerProgressDescription' },
    { icon: 'flag', to: '/races', titleKey: 'trainerRaces', descKey: 'trainerRacesDescription' },
  ],
  VET: [
    { icon: 'heart', to: '/health-records', titleKey: 'vetRecords', descKey: 'vetRecordsDescription' },
    { icon: 'lock', to: '/horses', titleKey: 'vetLock', descKey: 'vetLockDescription' },
    { icon: 'check', to: '/vaccinations', titleKey: 'vetSchedule', descKey: 'vetScheduleDescription' },
  ],
  GROOM: [
    { icon: 'check', to: '/horses', titleKey: 'groomFeeding', descKey: 'groomFeedingDescription' },
    { icon: 'alert', to: '/incidents', titleKey: 'groomIncident', descKey: 'groomIncidentDescription' },
    { icon: 'horse', to: '/horses', titleKey: 'groomVaccinations', descKey: 'groomVaccinationsDescription' },
  ],
  OWNER: [
    { icon: 'horse', to: '/my-horses', titleKey: 'ownerPedigree', descKey: 'ownerPedigreeDescription' },
    { icon: 'heart', to: '/my-horses', titleKey: 'ownerHealth', descKey: 'ownerHealthDescription' },
    { icon: 'plans', to: '/plans', titleKey: 'ownerPlans', descKey: 'ownerPlansDescription' },
  ],
  MANAGER: [
    { icon: 'plus', to: '/horses', titleKey: 'managerHorse', descKey: 'managerHorseDescription' },
    { icon: 'user', to: '/admin/users', titleKey: 'managerAccess', descKey: 'managerAccessDescription' },
    { icon: 'flag', to: '/races', titleKey: 'managerRaces', descKey: 'managerRacesDescription' },
  ],
};

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const role: Role | null = user?.role ?? null;

  usePageChrome({ crumbs: [t('nav.dashboard')] });

  const { data: horsesData, loading: horsesLoading } = useCachedResource('dashboard:horses', async () => {
    const res = await api.get<Paginated<Horse>>('/horses', { params: { limit: 6 } });
    return { items: res.data.data ?? [], total: res.data.meta?.total ?? res.data.data.length };
  });
  const horses = horsesData?.items ?? [];
  const totalHorses = horsesData?.total ?? 0;

  const { data: notificationsData, loading: notificationsLoading } = useCachedResource('dashboard:notifications', () =>
    api.get<Paginated<Notification>>('/notifications', { params: { type: 'AI_RISK_ALERT', limit: 5 } })
      .then((r) => r.data.data ?? []).catch(() => []),
  );
  const notifications = notificationsData ?? [];

  const { data: pendingUsersData, loading: pendingUsersLoading } = useCachedResource(
    role === 'MANAGER' ? 'dashboard:pending-users' : 'dashboard:pending-users:skip',
    async () => {
      if (role !== 'MANAGER') return 0;
      const res = await api.get<User[]>('/users');
      return res.data.filter((u) => u.status === 'PENDING').length;
    },
  );
  const pendingUsersCount = pendingUsersData ?? 0;
  const loading = horsesLoading || notificationsLoading || pendingUsersLoading;

  const lockedHorses = horses.filter((h) => h.locked);
  const activeHorses = horses.filter((h) => h.status === 'ACTIVE' && !h.locked);
  const fitHorses = horses.filter((h) => h.healthStatus === 'FIT');
  const monitoringHorses = horses.filter((h) => h.healthStatus === 'MONITORING');
  const injuredHorses = horses.filter((h) => h.healthStatus === 'INJURED');
  const quarantinedHorses = horses.filter((h) => h.healthStatus === 'QUARANTINED');

  const subtitle: Partial<Record<Role, string>> = {
    TRAINER: t('dashboard.roleSubtitle.TRAINER'),
    VET: t('dashboard.roleSubtitle.VET'),
    GROOM: t('dashboard.roleSubtitle.GROOM'),
    OWNER: t('dashboard.roleSubtitle.OWNER'),
    MANAGER: t('dashboard.roleSubtitle.MANAGER'),
  };

  const heroStats = role === 'VET'
    ? [
      { label: t('horseStatusBadge.FIT'), value: loading ? '…' : fitHorses.length, color: '#9fd9b1' },
      { label: t('horseStatusBadge.MONITORING'), value: loading ? '…' : monitoringHorses.length, color: monitoringHorses.length ? '#f3d29a' : undefined },
      { label: t('dashboard.injured'), value: loading ? '…' : injuredHorses.length, color: injuredHorses.length ? '#f3b4b4' : undefined },
      { label: t('dashboard.quarantined'), value: loading ? '…' : quarantinedHorses.length, color: quarantinedHorses.length ? '#f3b4b4' : undefined },
    ]
    : [
      { label: role === 'OWNER' ? t('dashboard.ownedHorses') : t('dashboard.totalHorses'), value: loading ? '…' : totalHorses },
      { label: t('dashboard.trainingLocked'), value: loading ? '…' : lockedHorses.length, color: lockedHorses.length ? '#f3b4b4' : '#9fd9b1' },
      { label: role === 'TRAINER' ? t('dashboard.readyToTrain') : t('dashboard.normalOperation'), value: loading ? '…' : activeHorses.length, color: '#9fd9b1' },
      ...(role === 'MANAGER' ? [{ label: t('dashboard.pendingRoleAccounts'), value: loading ? '…' : pendingUsersCount, color: pendingUsersCount ? '#f3d29a' : undefined }] : []),
    ];

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end justify-between">
          <div>
            <div className="lbl">{t('nav.brandName')}</div>
            <h1 className="disp text-[56px] mt-2">{t('dashboard.welcome')} {user?.name}</h1>
            <p className="text-hero-muted mt-2 max-w-[560px]">{(role && subtitle[role]) || t('dashboard.subtitle')}</p>
          </div>
          {role === 'MANAGER' && <Btn v="light" to="/horses"><Icon name="plus" />{t('dashboard.newHorse')}</Btn>}
          {role === 'TRAINER' && <Btn v="light" to="/plans?action=create"><Icon name="plus" />{t('dashboard.newPlan')}</Btn>}
        </div>
        <HeroStats items={heroStats} />
      </section>

      <div className="flex flex-wrap gap-5 items-start">
        <div className="flex-[1.6_1_480px] min-w-0">
          <Card>
            <CardHeader title={
              role === 'OWNER' ? t('dashboard.horseListOwned')
                : role === 'VET' ? t('dashboard.horseListHealth')
                  : role === 'GROOM' ? t('dashboard.horseListAssigned')
                    : t('dashboard.horseList')
            }>
              <Link to="/horses" className="font-semibold text-info text-[12.5px] no-underline flex items-center gap-1">{t('dashboard.viewAll')} <Icon name="chevRight" className="w-3.5 h-3.5" /></Link>
            </CardHeader>
            {horses.length === 0 ? (
              <div className="py-10 text-center"><p className="cap">{t('horse.empty')}</p></div>
            ) : (
              <ul className="list-none p-0 m-0">
                {horses.map((horse) => {
                  const photo = getFileUrl(horse.photoUrl);
                  return (
                    <li key={horse.id} onClick={() => navigate(`/horses/${horse.id}`)}
                      className="flex items-center gap-3 px-5 py-3 border-b border-line-soft last:border-0 cursor-pointer hover:bg-subtle">
                      {photo ? (
                        <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover flex-none border border-line" />
                      ) : (
                        <Silk owner={horse.owner.id} size={34} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{horse.name}</span>
                          {horse.locked && <Badge tone="bad"><Icon name="lock" className="w-3 h-3" />{t('horseStatusBadge.locked')}</Badge>}
                        </div>
                        <div className="cap truncate">{horse.breed || t('horsePage.breedUnknown')}{horse.gender ? ` · ${t(`horse.gender${horse.gender === 'MALE' ? 'Male' : 'Female'}`)}` : ''} · {t('horseDetail.ownerLabel')}: {horse.owner?.name || '—'}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        <Badge tone={careerTone[horse.status]}>{t(`horseStatusBadge.${horse.status}`)}</Badge>
                        <Badge tone={healthTone[horse.healthStatus]}>{t(`horseStatusBadge.${horse.healthStatus}`)}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-5">
          <Card>
            <CardHeader title={`${t('dashboard.quickActions')} (${role ? t(`role.${role}`) : t('dashboard.user')})`} />
            <div className="p-3 flex flex-col gap-1">
              {role && QUICK_ACTIONS[role]?.map((action) => (
                <Link key={action.titleKey} to={action.to} className="flex gap-3 items-start p-2.5 rounded-btn no-underline text-ink hover:bg-subtle">
                  <span className="w-9 h-9 rounded-btn bg-info-bg text-info flex items-center justify-center flex-none"><Icon name={action.icon} /></span>
                  <div>
                    <div className="font-semibold text-[13px]">{t(`dashboard.quickAction.${action.titleKey}`)}</div>
                    <div className="cap mt-0.5">{t(`dashboard.quickAction.${action.descKey}`)}</div>
                  </div>
                </Link>
              ))}
              {!role && <p className="cap p-2.5">{t('dashboard.awaitingRole')}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title={role === 'VET' ? t('dashboard.vetAlerts') : role === 'TRAINER' ? t('dashboard.trainerAlerts') : t('dashboard.operationAlerts')} />
            <div className="p-5">
              {lockedHorses.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {lockedHorses.map((h) => (
                    <div key={h.id} className="rounded-btn border border-bad-bd bg-bad-bg px-3 py-2.5 text-[12.5px]">
                      <div className="flex items-center gap-1.5"><Icon name="lock" className="w-4 h-4 text-bad" /><strong>{h.name}</strong> {t('dashboard.lockedAlert')}</div>
                      {h.lockReason && <div className="text-bad mt-0.5 pl-[22px]">{t('dashboard.reason')}: {h.lockReason}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-ok flex gap-2 items-center"><Icon name="check" />{t('dashboard.allSafe')}</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={t('dashboard.recentNotifs')}><Link to="/notifications" className="font-semibold text-info text-[12.5px] no-underline">{t('dashboard.viewAll')}</Link></CardHeader>
            {notifications.length === 0 ? (
              <div className="py-6 text-center"><p className="cap">{t('dashboard.noNotifs')}</p></div>
            ) : (
              <ul className="list-none p-0 m-0">
                {notifications.map((n) => (
                  <li key={n.id} className="border-b border-line-soft last:border-0">
                    <Link to="/notifications" className="block px-5 py-3 text-[12.5px] no-underline text-ink">
                      <div className="font-semibold">{n.message}</div>
                      <div className="cap mt-0.5">{formatDate(n.createdAt)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

import i18n from '../i18n';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { api, getFileUrl } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, Paginated, Notification, User, Role } from '../lib/types';
import { formatDate, formatNotificationMessage } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import {
  Badge, Btn, Card, CardHeader, HeroStats, Icon, Silk,
  careerTone, healthTone,
} from '../ds/ui';

interface QuickAction {
  icon: string;
  title: string;
  desc: string;
  to: string;
}

const QUICK_ACTIONS: () => Partial<Record<Role, QuickAction[]>> = () => ({
  TRAINER: [
    { icon: 'plans', to: '/plans?action=create', title: i18n.t("ui.createADetailedTrainingPlan"), desc: i18n.t("ui.distanceWorkloadAndSurfaceForEachPhase") },
    { icon: 'heart', to: '/plans', title: i18n.t("ui.trackProgressTrainingPlans"), desc: i18n.t("ui.manageAllHorseTrainingPlans") },
    { icon: 'flag', to: '/races', title: i18n.t("ui.selectHorsesForARace"), desc: i18n.t("ui.registerSuitableRaceEntries") },
  ],
  VET: [
    { icon: 'heart', to: '/health-records', title: i18n.t("ui.recordAMedicalExamination"), desc: i18n.t("ui.recordDiagnosesAndUpdateTreatmentPlans") },
    { icon: 'lock', to: '/horses', title: i18n.t("ui.issueAnEmergencyTrainingLock"), desc: i18n.t("ui.preventStrenuousSessionsForInjuredHorses") },
    { icon: 'check', to: '/vaccinations', title: i18n.t("ui.vaccinationDewormingSchedule"), desc: i18n.t("ui.trackUpcomingPreventiveCare") },
  ],
  GROOM: [
    { icon: 'check', to: '/horses', title: i18n.t("ui.recordDailyFeeding"), desc: i18n.t("ui.feedTypeAndQuantityForEachHorse") },
    { icon: 'alert', to: '/incidents', title: i18n.t("ui.reportAStableIncident"), desc: i18n.t("ui.lossOfAppetiteFeverOrHoofDamageWithPhotos") },
    { icon: 'horse', to: '/horses', title: i18n.t("ui.viewTheVaccinationSchedule"), desc: i18n.t("ui.planWorkAroundUpcomingAppointments") },
  ],
  OWNER: [
    { icon: 'horse', to: '/my-horses', title: i18n.t("ui.viewPedigreeHorseProfile"), desc: i18n.t("ui.threeGenerationPedigreeAndRaceHistory") },
    { icon: 'heart', to: '/my-horses', title: i18n.t("ui.monitorHealthFitness"), desc: i18n.t("ui.viewTheHealthOfYourHorses") },
    { icon: 'plans', to: '/plans', title: i18n.t("ui.trainingSchedule"), desc: i18n.t("ui.viewPlansPreparedByTheTrainer") },
  ],
  MANAGER: [
    { icon: 'plus', to: '/horses', title: i18n.t("ui.addAHorseProfile"), desc: i18n.t("ui.manageTheClubSHorseRegistry") },
    { icon: 'user', to: '/admin/users', title: i18n.t("ui.systemAccessControlRbac"), desc: i18n.t("ui.approveAccountsAndAssignRoles") },
    { icon: 'flag', to: '/races', title: i18n.t("ui.raceManagement"), desc: i18n.t("ui.createRacesRegisterHorsesAndRecordResults") },
  ],
});

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
    TRAINER: i18n.t("ui.trackTrainingProgressFitnessAlertsAndPlansForAllHorses"),
    VET: i18n.t("ui.reviewHerdHealthMedicalRecordsAndTrainingLocks"),
    GROOM: i18n.t("ui.manageDailyFeedingAndReportStableIncidents"),
    OWNER: i18n.t("ui.viewProfilesPedigreesAndHealthInformationForYourHorses"),
    MANAGER: i18n.t("ui.overseeClubOperationsTheHorseRegistryAndAccessControl"),
  };

  const heroStats = role === 'VET'
    ? [
      { label: i18n.t("ui.fit"), value: loading ? '…' : fitHorses.length, color: '#9fd9b1' },
      { label: i18n.t("horseStatusBadge.MONITORING"), value: loading ? '…' : monitoringHorses.length, color: monitoringHorses.length ? '#f3d29a' : undefined },
      { label: i18n.t("ui.injured"), value: loading ? '…' : injuredHorses.length, color: injuredHorses.length ? '#f3b4b4' : undefined },
      { label: i18n.t("ui.quarantined"), value: loading ? '…' : quarantinedHorses.length, color: quarantinedHorses.length ? '#f3b4b4' : undefined },
    ]
    : [
      { label: role === 'OWNER' ? i18n.t("ui.ownedHorses") : i18n.t("dashboard.kpi.totalHorses"), value: loading ? '…' : totalHorses },
      { label: i18n.t("ui.trainingLocked"), value: loading ? '…' : lockedHorses.length, color: lockedHorses.length ? '#f3b4b4' : '#9fd9b1' },
      { label: role === 'TRAINER' ? i18n.t("ui.readyForTraining") : i18n.t("ui.activeHorses"), value: loading ? '…' : activeHorses.length, color: '#9fd9b1' },
      ...(role === 'MANAGER' ? [{ label: i18n.t("ui.accountsPendingApproval"), value: loading ? '…' : pendingUsersCount, color: pendingUsersCount ? '#f3d29a' : undefined }] : []),
    ];

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end justify-between">
          <div>
            <div className="lbl">{i18n.t("ui.racehorseClub")}</div>
            <h1 className="disp text-[56px] mt-2">{t('dashboard.welcome')} {user?.name}</h1>
            <p className="text-hero-muted mt-2 max-w-[560px]">{(role && subtitle[role]) || t('dashboard.subtitle')}</p>
          </div>
          {role === 'MANAGER' && <Btn v="light" to="/horses"><Icon name="plus" />{t('dashboard.newHorse')}</Btn>}
          {role === 'TRAINER' && <Btn v="light" to="/plans?action=create"><Icon name="plus" />{i18n.t("ui.newTrainingPlan")}</Btn>}
        </div>
        <HeroStats items={heroStats} />
      </section>

      <div className="flex flex-wrap gap-5 items-start">
        <div className="flex-[1.6_1_480px] min-w-0">
          <Card>
            <CardHeader title={
              role === 'OWNER' ? i18n.t("ui.yourHorses")
                : role === 'VET' ? i18n.t("ui.herdHealthOverview")
                  : role === 'GROOM' ? i18n.t("ui.horsesInYourCare")
                    : i18n.t("ui.horseList")
            }>
              <Link to="/horses" className="font-semibold text-info text-[12.5px] no-underline flex items-center gap-1">{i18n.t("dashboard.viewAll")}{' '}<Icon name="chevRight" className="w-3.5 h-3.5" /></Link>
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
                          {horse.locked && <Badge tone="bad"><Icon name="lock" className="w-3 h-3" />{i18n.t("ui.trainingLocked2")}</Badge>}
                        </div>
                        <div className="cap truncate">{horse.breed || i18n.t("ui.unknownBreed")}{horse.gender ? ` · ${horse.gender === 'MALE' ? i18n.t("horse.genderMale") : i18n.t("horse.genderFemale")}` : ''} {' '}{i18n.t("ui.owner")}{' '}{horse.owner?.name || i18n.t("horseFlow.unknown")}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        <Badge tone={careerTone[horse.status]}>{i18n.t(`horseStatusBadge.${horse.status}`)}</Badge>
                        <Badge tone={healthTone[horse.healthStatus]}>{i18n.t(`horseStatusBadge.${horse.healthStatus}`)}</Badge>
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
            <CardHeader title={i18n.t('ui.quickActionsRole', { role: role ? t(`role.${role}`) : i18n.t('nav.users') })} />
            <div className="p-3 flex flex-col gap-1">
              {role && QUICK_ACTIONS()[role]?.map((action) => (
                <Link key={action.title} to={action.to} className="flex gap-3 items-start p-2.5 rounded-btn no-underline text-ink hover:bg-subtle">
                  <span className="w-9 h-9 rounded-btn bg-info-bg text-info flex items-center justify-center flex-none"><Icon name={action.icon} /></span>
                  <div>
                    <div className="font-semibold text-[13px]">{action.title}</div>
                    <div className="cap mt-0.5">{action.desc}</div>
                  </div>
                </Link>
              ))}
              {!role && <p className="cap p-2.5">{i18n.t("ui.yourAccountIsAwaitingRoleApprovalByAClubManagerBeforeOperationalFeatur")}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title={role === 'VET' ? i18n.t("ui.healthInjuryAlerts") : role === 'TRAINER' ? i18n.t("ui.fitnessTrainingLockAlerts") : i18n.t("ui.alertsOperationalStatus")} />
            <div className="p-5">
              {lockedHorses.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {lockedHorses.map((h) => (
                    <div key={h.id} className="rounded-btn border border-bad-bd bg-bad-bg px-3 py-2.5 text-[12.5px]">
                      <div className="flex items-center gap-1.5"><Icon name="lock" className="w-4 h-4 text-bad" /><strong>{h.name}</strong> {' '}{i18n.t("ui.isUnderAnEmergencyTrainingLock")}</div>
                      {h.lockReason && <div className="text-bad mt-0.5 pl-[22px]">{i18n.t("ui.reason")}{' '}{h.lockReason}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-ok flex gap-2 items-center"><Icon name="check" />{i18n.t("ui.thereAreNoTrainingLockAlertsInTheDisplayedHorses")}</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={i18n.t("ui.recentNotifications")}><Link to="/notifications" className="font-semibold text-info text-[12.5px] no-underline">{t('dashboard.viewAll')}</Link></CardHeader>
            {notifications.length === 0 ? (
              <div className="py-6 text-center"><p className="cap">{t('dashboard.noNotifs')}</p></div>
            ) : (
              <ul className="list-none p-0 m-0">
                {notifications.map((n) => (
                  <li key={n.id} className="border-b border-line-soft last:border-0">
                    <Link to="/notifications" className="block px-5 py-3 text-[12.5px] no-underline text-ink">
                      <div className="font-semibold">{formatNotificationMessage(n.message)}</div>
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

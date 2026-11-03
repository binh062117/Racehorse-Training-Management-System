import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAuth } from '../auth/useAuth';
import { api, getFileUrl } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, Paginated, Notification, User, Role } from '../lib/types';
import { formatDate } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import {
  Badge, Btn, Card, CardHeader, Cloth, EmptyState, HorseAvatar, Icon, KpiStrip, PageHeader,
  fitColor, healthLabel, lockReasonText, notificationIcon, type Tone,
} from '../ds/ui';

interface Job { title: string; desc: string; to: string }

function getJobs(role: Role, isVi: boolean): Job[] {
  if (role === 'MANAGER') {
    return [
      { to: '/horses', title: isVi ? 'Thêm hồ sơ ngựa' : 'Add horse profile', desc: isVi ? 'Đăng ký ngựa mới và gán chủ sở hữu' : 'Register a new horse and assign an owner' },
      { to: '/admin/users', title: isVi ? 'Duyệt tài khoản' : 'Approve accounts', desc: isVi ? 'Gán vai trò cho tài khoản mới đăng ký' : 'Assign roles to newly registered users' },
      { to: '/races', title: isVi ? 'Quản lý giải đua' : 'Manage races', desc: isVi ? 'Tạo giải, đăng ký ngựa, nhập kết quả' : 'Create races, enter horses, record results' },
    ];
  }
  if (role === 'TRAINER') {
    return [
      { to: '/plans?action=create', title: isVi ? 'Lập giáo án mới' : 'New training plan', desc: isVi ? 'Mục tiêu, cự ly và thời gian cho từng ngựa' : 'Goals, distance, and timeline for each horse' },
      { to: '/plans', title: isVi ? 'Theo dõi giáo án' : 'Active plans', desc: isVi ? 'Giáo án đang áp dụng của cả chuồng' : 'Review ongoing plans across the club' },
      { to: '/races', title: isVi ? 'Chọn ngựa dự giải' : 'Enter races', desc: isVi ? 'Đăng ký ngựa vào các giải sắp diễn ra' : 'Register horses for upcoming competitions' },
    ];
  }
  if (role === 'VET') {
    return [
      { to: '/health-records', title: isVi ? 'Ghi hồ sơ khám bệnh' : 'New health record', desc: isVi ? 'Chẩn đoán, điều trị và cập nhật tình trạng' : 'Diagnosis, treatment, and condition updates' },
      { to: '/incidents', title: isVi ? 'Xử lý sự cố' : 'Handle incidents', desc: isVi ? 'Các sự cố Groom báo đang chờ thú y' : 'Review Groom incident reports' },
      { to: '/vaccinations', title: isVi ? 'Lịch tiêm phòng' : 'Vaccination schedule', desc: isVi ? 'Mũi tiêm và tẩy giun sắp đến hạn' : 'Upcoming vaccines and deworming due dates' },
    ];
  }
  if (role === 'GROOM') {
    return [
      { to: '/incidents', title: isVi ? 'Báo sự cố tại chuồng' : 'Report incident', desc: isVi ? 'Bỏ ăn, sốt, xước móng — kèm ảnh' : 'Loss of appetite, fever, injuries with photos' },
      { to: '/horses', title: isVi ? 'Ghi khẩu phần ăn' : 'Feeding & diet', desc: isVi ? 'Loại thức ăn và khối lượng mỗi bữa' : 'Feed types and portions for each meal' },
      { to: '/vaccinations', title: isVi ? 'Lịch tiêm phòng' : 'Care schedule', desc: isVi ? 'Việc chăm sóc sắp đến hạn' : 'Preventive care items due soon' },
    ];
  }
  if (role === 'OWNER') {
    return [
      { to: '/my-horses', title: isVi ? 'Ngựa của tôi' : 'My horses', desc: isVi ? 'Hồ sơ, phả hệ và thành tích thi đấu' : 'Profiles, pedigree, and race track record' },
      { to: '/plans', title: isVi ? 'Giáo án huấn luyện' : 'Training plans', desc: isVi ? 'Huấn luyện viên đang cho ngựa tập gì' : 'Current workouts assigned by head trainer' },
      { to: '/races', title: isVi ? 'Giải đua' : 'Races', desc: isVi ? 'Lịch thi đấu và kết quả' : 'Upcoming competitions and finish results' },
    ];
  }
  return [];
}

type Readiness = { label: string; tone: Tone; rank: number; reason?: string };

function readiness(h: Horse, t: TFunction): Readiness {
  if (h.locked) return { label: t('readiness.locked', 'Khóa tập'), tone: 'bad', rank: 0, reason: lockReasonText(h.lockReason) };
  if (h.healthStatus === 'INJURED' || h.healthStatus === 'QUARANTINED') {
    return { label: t('readiness.blocked', 'Không tập được'), tone: 'bad', rank: 1, reason: t(`horseStatusBadge.${h.healthStatus}`, healthLabel[h.healthStatus]) };
  }
  if (h.status === 'RETIRED') return { label: t('readiness.retired', 'Giải nghệ'), tone: 'neu', rank: 4 };
  if (h.status === 'RESTING') return { label: t('readiness.resting', 'Nghỉ dưỡng'), tone: 'neu', rank: 3 };
  if (h.healthStatus === 'MONITORING') return { label: t('readiness.light', 'Tập nhẹ'), tone: 'warn', rank: 2, reason: t('readiness.monitoringReason', 'Đang được thú y theo dõi') };
  return { label: t('readiness.ready', 'Sẵn sàng'), tone: 'ok', rank: 5 };
}

const BOARD_ROWS = 8;

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const role: Role | null = user?.role ?? null;
  const isVi = (i18n.resolvedLanguage || i18n.language || 'vi').toLowerCase().startsWith('vi');

  usePageChrome({ crumbs: [t('nav.dashboard', 'Tổng quan')] });

  const { data: horsesData, loading: horsesLoading } = useCachedResource('dashboard:horses', async () => {
    const res = await api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } });
    return res.data.data ?? [];
  });
  const horses = horsesData ?? [];

  const { data: notificationsData } = useCachedResource('dashboard:notifications', () =>
    api.get<Paginated<Notification>>('/notifications', { params: { limit: 4 } })
      .then((r) => r.data.data ?? []).catch(() => []),
  );
  const notifications = notificationsData ?? [];

  const { data: pendingUsersData } = useCachedResource(
    role === 'MANAGER' ? 'dashboard:pending-users' : 'dashboard:pending-users:skip',
    async () => {
      if (role !== 'MANAGER') return 0;
      const res = await api.get<User[]>('/users');
      return res.data.filter((u) => u.status === 'PENDING').length;
    },
  );
  const pendingUsers = pendingUsersData ?? 0;

  const board = horses.map((h) => ({ horse: h, r: readiness(h, t) })).sort((a, b) => a.r.rank - b.r.rank || a.horse.name.localeCompare(b.horse.name));
  const ready = board.filter((x) => x.r.rank === 5).length;
  const locked = horses.filter((h) => h.locked).length;
  const watch = horses.filter((h) => !h.locked && h.healthStatus !== 'FIT').length;
  const blocked = board.filter((x) => x.r.rank <= 1).length;

  const finding = horsesLoading && horses.length === 0
    ? (isVi ? 'Đang tải tình trạng chuồng…' : 'Loading stable status…')
    : horses.length === 0
      ? (isVi ? 'Chuồng chưa có ngựa nào.' : 'No horses in the stable yet.')
      : blocked > 0
        ? (isVi
            ? `${ready} trong ${horses.length} ngựa sẵn sàng tập hôm nay — ${blocked} ngựa đang bị chặn, cần xem lý do bên dưới.`
            : `${ready} of ${horses.length} horses ready to train today — ${blocked} blocked, check reasons below.`)
        : (isVi
            ? `${ready} trong ${horses.length} ngựa sẵn sàng tập hôm nay; không có ngựa nào bị khóa.`
            : `${ready} of ${horses.length} horses ready to train today; none are locked.`);

  const dash = horsesLoading && horses.length === 0 ? '…' : undefined;
  const kpis = [
    { label: role === 'OWNER' ? t('horsesPage.myHorses', 'Ngựa của tôi') : t('horsesPage.kpiTotal', 'Tổng số ngựa'), value: dash ?? horses.length },
    { label: t('dashboard.readyToday', 'Sẵn sàng tập hôm nay'), value: dash ?? ready, lead: true },
    { label: t('horsesPage.kpiLocked', 'Đang khóa tập'), value: dash ?? locked, tone: locked > 0 ? ('bad' as const) : undefined },
    { label: t('dashboard.vetMonitoring', 'Cần thú y theo dõi'), value: dash ?? watch, tone: watch > 0 ? ('warn' as const) : undefined },
    ...(role === 'MANAGER' ? [{ label: t('dashboard.pendingAccounts', 'Tài khoản chờ duyệt'), value: pendingUsers, sub: pendingUsers > 0 ? <Link to="/admin/users" className="text-info no-underline">{t('dashboard.reviewNow', 'Duyệt ngay')}</Link> : undefined }] : []),
  ];

  const jobs = role ? getJobs(role, isVi) : [];

  return (
    <>
      <PageHeader
        title={t('nav.dashboard', 'Tổng quan')}
        sub={finding}
        actions={
          role === 'MANAGER' ? <Btn v="p" to="/horses"><Icon name="plus" />{t('horsesPage.addHorse', 'Thêm ngựa')}</Btn>
            : role === 'TRAINER' ? <Btn v="p" to="/plans?action=create"><Icon name="plus" />{t('plansPage.newPlan', 'Lập giáo án')}</Btn>
              : role === 'GROOM' ? <Btn v="p" to="/incidents"><Icon name="plus" />{t('incidents.title', 'Báo sự cố')}</Btn>
                : undefined
        }
      />

      <KpiStrip items={kpis} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] items-start">
        <Card>
          <CardHeader title={role === 'OWNER' ? t('dashboard.boardTitleOwner', 'Ngựa của tôi') : t('dashboard.boardTitle', 'Bảng chuồng hôm nay')}>
            <Link to={role === 'OWNER' ? '/my-horses' : '/horses'} className="text-[13px] font-medium text-info no-underline flex items-center gap-1">
              {t('dashboard.viewAllHorses', 'Xem tất cả {{count}} ngựa', { count: horses.length })}
              <Icon name="chevRight" className="w-3.5 h-3.5 nudge" />
            </Link>
          </CardHeader>
          {horses.length === 0 && !horsesLoading ? (
            <div className="p-5">
              <EmptyState action={role === 'MANAGER' ? <Btn sm to="/horses">{t('horsesPage.addHorse', 'Thêm ngựa đầu tiên')}</Btn> : undefined}>
                {t('horse.empty', 'Chưa có hồ sơ ngựa nào.')}
              </EmptyState>
            </div>
          ) : (
            <ul className="list-none p-0 m-0">
              {board.slice(0, BOARD_ROWS).map(({ horse, r }) => (
                <li key={horse.id}>
                  <Link to={`/horses/${horse.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_64px] items-center gap-x-4 gap-y-1 px-5 py-3 border-b border-line-soft no-underline text-ink hover:bg-subtle">
                    <span className="flex items-center gap-2.5">
                      <span className="w-6 flex justify-center"><Cloth n={horse.saddleNumber} /></span>
                      <HorseAvatar src={getFileUrl(horse.photoUrl)} name={horse.name} size={32} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{horse.name}</span>
                      <span className="block text-[12.5px] text-muted truncate">
                        {horse.breed || (isVi ? 'Chưa rõ giống' : 'Unknown breed')} · {horse.owner?.name}
                      </span>
                    </span>
                    <span className="min-w-0 col-span-3 col-start-2 sm:col-span-1 sm:col-start-auto row-start-2 sm:row-start-auto flex items-center gap-2">
                      <Badge tone={r.tone}>{r.tone === 'bad' && <Icon name="lock" className="w-3 h-3" />}{r.label}</Badge>
                      {r.reason && <span className="text-[12.5px] text-muted truncate" title={r.reason}>{r.reason}</span>}
                    </span>
                    <span className="num text-right col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto">
                      {horse.fitnessScore != null
                        ? <><span className="font-semibold hop" style={{ color: fitColor(horse.fitnessScore) }}>{horse.fitnessScore}</span><span className="text-[12px] text-muted">/100</span></>
                        : <span className="text-muted">—</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {board.length > BOARD_ROWS && (
            <Link to="/horses" className="block px-5 py-3 text-[13px] text-muted no-underline hover:text-ink">
              {t('dashboard.moreHorses', 'Còn {{count}} ngựa khác', { count: board.length - BOARD_ROWS })}
            </Link>
          )}
        </Card>

        <div className="flex flex-col gap-5 min-w-0">
          <Card>
            <CardHeader title={t('dashboard.quickActions', 'Việc cần làm')} />
            {role && jobs.length > 0 ? (
              <ul className="list-none p-0 m-0">
                {jobs.map((job) => (
                  <li key={job.title}>
                    <Link to={job.to} className="flex items-center gap-3 px-5 py-3 border-b border-line-soft last:border-0 no-underline text-ink hover:bg-subtle">
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium">{job.title}</span>
                        <span className="block text-[12.5px] text-muted">{job.desc}</span>
                      </span>
                      <Icon name="chevRight" className="w-4 h-4 text-muted nudge" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-[13.5px] text-muted">
                {t('dashboard.waitingApproval', 'Tài khoản đang chờ quản lý câu lạc bộ duyệt vai trò.')}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title={t('dashboard.recentNotifs', 'Thông báo gần đây')}>
              <Link to="/notifications" className="text-[13px] font-medium text-info no-underline">{t('dashboard.viewAll', 'Xem tất cả')}</Link>
            </CardHeader>
            {notifications.length === 0 ? (
              <p className="px-5 py-4 text-[13.5px] text-muted">{t('dashboard.noNotifs', 'Không có thông báo mới')}</p>
            ) : (
              <ul className="list-none p-0 m-0">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link to="/notifications" className="flex gap-3 px-5 py-3 border-b border-line-soft last:border-0 no-underline text-ink hover:bg-subtle">
                      <Icon name={notificationIcon[n.type] ?? 'bell'} className="w-4 h-4 mt-0.5 text-muted" />
                      <span className="flex-1 min-w-0">
                        <span className={`block text-[13px] leading-[18px] line-clamp-2 ${n.read ? 'text-muted' : ''}`}>{n.message.replace(/^\s*⚠\s*/, '')}</span>
                        <span className="block text-[12px] text-muted mt-1">{formatDate(n.createdAt)}</span>
                      </span>
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

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

/** The jobs each role opens this screen to do, most frequent first. */
const JOBS: Partial<Record<Role, Job[]>> = {
  MANAGER: [
    { to: '/horses', title: 'Thêm hồ sơ ngựa', desc: 'Đăng ký ngựa mới và gán chủ sở hữu' },
    { to: '/admin/users', title: 'Duyệt tài khoản', desc: 'Gán vai trò cho tài khoản mới đăng ký' },
    { to: '/races', title: 'Quản lý giải đua', desc: 'Tạo giải, đăng ký ngựa, nhập kết quả' },
  ],
  TRAINER: [
    { to: '/plans?action=create', title: 'Lập giáo án mới', desc: 'Mục tiêu, cự ly và thời gian cho từng ngựa' },
    { to: '/plans', title: 'Theo dõi giáo án', desc: 'Giáo án đang áp dụng của cả chuồng' },
    { to: '/races', title: 'Chọn ngựa dự giải', desc: 'Đăng ký ngựa vào các giải sắp diễn ra' },
  ],
  VET: [
    { to: '/health-records', title: 'Ghi hồ sơ khám bệnh', desc: 'Chẩn đoán, điều trị và cập nhật tình trạng' },
    { to: '/incidents', title: 'Xử lý sự cố', desc: 'Các sự cố Groom báo đang chờ thú y' },
    { to: '/vaccinations', title: 'Lịch tiêm phòng', desc: 'Mũi tiêm và tẩy giun sắp đến hạn' },
  ],
  GROOM: [
    { to: '/incidents', title: 'Báo sự cố tại chuồng', desc: 'Bỏ ăn, sốt, xước móng — kèm ảnh' },
    { to: '/horses', title: 'Ghi khẩu phần ăn', desc: 'Loại thức ăn và khối lượng mỗi bữa' },
    { to: '/vaccinations', title: 'Lịch tiêm phòng', desc: 'Việc chăm sóc sắp đến hạn' },
  ],
  OWNER: [
    { to: '/my-horses', title: 'Ngựa của tôi', desc: 'Hồ sơ, phả hệ và thành tích thi đấu' },
    { to: '/plans', title: 'Giáo án huấn luyện', desc: 'Huấn luyện viên đang cho ngựa tập gì' },
    { to: '/races', title: 'Giải đua', desc: 'Lịch thi đấu và kết quả' },
  ],
};

type Readiness = { label: string; tone: Tone; rank: number; reason?: string };

/** Can this horse train today? Locked first — it is the one that needs someone. */
function readiness(h: Horse): Readiness {
  if (h.locked) return { label: 'Khóa tập', tone: 'bad', rank: 0, reason: lockReasonText(h.lockReason) };
  if (h.healthStatus === 'INJURED' || h.healthStatus === 'QUARANTINED') {
    return { label: 'Không tập được', tone: 'bad', rank: 1, reason: healthLabel[h.healthStatus] };
  }
  if (h.status === 'RETIRED') return { label: 'Giải nghệ', tone: 'neu', rank: 4 };
  if (h.status === 'RESTING') return { label: 'Nghỉ dưỡng', tone: 'neu', rank: 3 };
  if (h.healthStatus === 'MONITORING') return { label: 'Tập nhẹ', tone: 'warn', rank: 2, reason: 'Đang được thú y theo dõi' };
  return { label: 'Sẵn sàng', tone: 'ok', rank: 5 };
}

const BOARD_ROWS = 8;

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role: Role | null = user?.role ?? null;

  usePageChrome({ crumbs: [t('nav.dashboard')] });

  // Every count below is computed from all horses, never from a capped page.
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

  const board = horses.map((h) => ({ horse: h, r: readiness(h) })).sort((a, b) => a.r.rank - b.r.rank || a.horse.name.localeCompare(b.horse.name));
  const ready = board.filter((x) => x.r.rank === 5).length;
  const locked = horses.filter((h) => h.locked).length;
  const watch = horses.filter((h) => !h.locked && h.healthStatus !== 'FIT').length;
  const blocked = board.filter((x) => x.r.rank <= 1).length;

  const finding = horsesLoading && horses.length === 0
    ? 'Đang tải tình trạng chuồng…'
    : horses.length === 0
      ? 'Chuồng chưa có ngựa nào.'
      : blocked > 0
        ? `${ready} trong ${horses.length} ngựa sẵn sàng tập hôm nay — ${blocked} ngựa đang bị chặn, cần xem lý do bên dưới.`
        : `${ready} trong ${horses.length} ngựa sẵn sàng tập hôm nay; không có ngựa nào bị khóa.`;

  const dash = horsesLoading && horses.length === 0 ? '…' : undefined;
  const kpis = [
    { label: role === 'OWNER' ? 'Ngựa của tôi' : 'Tổng số ngựa', value: dash ?? horses.length },
    { label: 'Sẵn sàng tập hôm nay', value: dash ?? ready, lead: true },
    { label: 'Đang khóa tập', value: dash ?? locked, tone: locked > 0 ? ('bad' as const) : undefined },
    { label: 'Cần thú y theo dõi', value: dash ?? watch, tone: watch > 0 ? ('warn' as const) : undefined },
    ...(role === 'MANAGER' ? [{ label: 'Tài khoản chờ duyệt', value: pendingUsers, sub: pendingUsers > 0 ? <Link to="/admin/users" className="text-info no-underline">Duyệt ngay</Link> : undefined }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Tổng quan"
        sub={finding}
        actions={
          role === 'MANAGER' ? <Btn v="p" to="/horses"><Icon name="plus" />Thêm ngựa</Btn>
            : role === 'TRAINER' ? <Btn v="p" to="/plans?action=create"><Icon name="plus" />Lập giáo án</Btn>
              : role === 'GROOM' ? <Btn v="p" to="/incidents"><Icon name="plus" />Báo sự cố</Btn>
                : undefined
        }
      />

      <KpiStrip items={kpis} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] items-start">
        <Card>
          <CardHeader title="Bảng chuồng hôm nay">
            <Link to={role === 'OWNER' ? '/my-horses' : '/horses'} className="text-[13px] font-medium text-info no-underline flex items-center gap-1">
              Xem tất cả {horses.length > 0 ? horses.length : ''} ngựa<Icon name="chevRight" className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          {horses.length === 0 && !horsesLoading ? (
            <div className="p-5"><EmptyState action={role === 'MANAGER' ? <Btn sm to="/horses">Thêm ngựa đầu tiên</Btn> : undefined}>{t('horse.empty')}</EmptyState></div>
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
                      <span className="block text-[12.5px] text-muted truncate">{horse.breed || 'Chưa rõ giống'} · {horse.owner?.name}</span>
                    </span>
                    <span className="min-w-0 col-span-3 col-start-2 sm:col-span-1 sm:col-start-auto row-start-2 sm:row-start-auto flex items-center gap-2">
                      <Badge tone={r.tone}>{r.tone === 'bad' && <Icon name="lock" className="w-3 h-3" />}{r.label}</Badge>
                      {r.reason && <span className="text-[12.5px] text-muted truncate" title={r.reason}>{r.reason}</span>}
                    </span>
                    <span className="num text-right col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto">
                      {horse.fitnessScore != null
                        ? <><span className="font-semibold" style={{ color: fitColor(horse.fitnessScore) }}>{horse.fitnessScore}</span><span className="text-[12px] text-muted">/100</span></>
                        : <span className="text-muted">—</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {board.length > BOARD_ROWS && (
            <Link to="/horses" className="block px-5 py-3 text-[13px] text-muted no-underline hover:text-ink">Còn {board.length - BOARD_ROWS} ngựa khác</Link>
          )}
        </Card>

        <div className="flex flex-col gap-5 min-w-0">
          <Card>
            <CardHeader title="Việc cần làm" />
            {role && JOBS[role] ? (
              <ul className="list-none p-0 m-0">
                {JOBS[role]!.map((job) => (
                  <li key={job.title}>
                    <Link to={job.to} className="flex items-center gap-3 px-5 py-3 border-b border-line-soft last:border-0 no-underline text-ink hover:bg-subtle">
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium">{job.title}</span>
                        <span className="block text-[12.5px] text-muted">{job.desc}</span>
                      </span>
                      <Icon name="chevRight" className="w-4 h-4 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-[13.5px] text-muted">Tài khoản đang chờ quản lý câu lạc bộ duyệt vai trò.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Thông báo gần đây">
              <Link to="/notifications" className="text-[13px] font-medium text-info no-underline">{t('dashboard.viewAll')}</Link>
            </CardHeader>
            {notifications.length === 0 ? (
              <p className="px-5 py-4 text-[13.5px] text-muted">{t('dashboard.noNotifs')}</p>
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

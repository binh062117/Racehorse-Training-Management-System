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
  title: string;
  desc: string;
  to: string;
}

const QUICK_ACTIONS: Partial<Record<Role, QuickAction[]>> = {
  TRAINER: [
    { icon: 'plans', to: '/plans?action=create', title: 'Lập giáo án huấn luyện chi tiết', desc: 'Cự ly, khối lượng, mặt sân theo từng giai đoạn' },
    { icon: 'reports', to: '/training-progress', title: 'Theo dõi tiến độ huấn luyện', desc: 'Tỷ lệ hoàn thành, buổi quá hạn và lịch sắp tới của từng chiến mã' },
    { icon: 'flag', to: '/races', title: 'Lựa chọn chiến mã tham gia giải đua', desc: 'Đăng ký danh sách thi đấu phù hợp' },
  ],
  VET: [
    { icon: 'heart', to: '/health-records', title: 'Ghi nhận hồ sơ khám bệnh', desc: 'Chẩn đoán chi tiết và cập nhật phác đồ điều trị' },
    { icon: 'lock', to: '/horses', title: 'Đặt lệnh Khóa huấn luyện khẩn cấp', desc: 'Ngăn chặn xếp lịch bài tập nặng với ngựa chấn thương' },
    { icon: 'check', to: '/vaccinations', title: 'Lịch tiêm phòng & Tẩy giun định kỳ', desc: 'Theo dõi nhắc lịch tiêm chủng tự động' },
  ],
  GROOM: [
    { icon: 'check', to: '/horses', title: 'Ghi nhận khẩu phần ăn hàng ngày', desc: 'Loại thức ăn, khối lượng cho từng ngựa' },
    { icon: 'alert', to: '/incidents', title: 'Gửi báo cáo sự cố đột xuất tại chuồng', desc: 'Bỏ ăn, dấu hiệu sốt, móng xước kèm ảnh thực tế' },
    { icon: 'horse', to: '/horses', title: 'Theo dõi lịch tiêm phòng', desc: 'Sắp xếp công việc theo lịch sắp đến hạn' },
  ],
  OWNER: [
    { icon: 'horse', to: '/my-horses', title: 'Xem dòng dõi (Pedigree) & Lý lịch', desc: 'Hồ sơ 3 đời và lịch sử thành tích thi đấu' },
    { icon: 'heart', to: '/my-horses', title: 'Theo dõi sức khỏe & Thể trạng', desc: 'Trạng thái sẵn sàng thi đấu của ngựa sở hữu' },
    { icon: 'plans', to: '/plans', title: 'Lịch tập luyện', desc: 'Xem giáo án huấn luyện từ Huấn luyện viên' },
  ],
  MANAGER: [
    { icon: 'plus', to: '/horses', title: 'Thêm mới hồ sơ ngựa đua', desc: 'Quản lý danh mục tổng các cá thể ngựa' },
    { icon: 'user', to: '/admin/users', title: 'Phân quyền truy cập hệ thống (RBAC)', desc: 'Duyệt tài khoản và gán vai trò vận hành' },
    { icon: 'flag', to: '/races', title: 'Quản lý giải đua', desc: 'Tạo giải, đăng ký ngựa, cập nhật kết quả' },
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
    TRAINER: 'Theo dõi tiến độ huấn luyện, cảnh báo ngưỡng thể lực và lập giáo án cho toàn bộ chiến mã.',
    VET: 'Kiểm soát sơ đồ sức khỏe đàn ngựa, hồ sơ bệnh án và lệnh khóa huấn luyện an toàn.',
    GROOM: 'Quản lý khẩu phần dinh dưỡng hàng ngày và báo cáo sự cố chuồng.',
    OWNER: 'Tra cứu hồ sơ lý lịch, dòng dõi gia phả và tình trạng sẵn sàng thi đấu của ngựa sở hữu.',
    MANAGER: 'Giám sát vận hành câu lạc bộ, quản lý danh mục và phân quyền kiểm soát truy cập (RBAC).',
  };

  const heroStats = role === 'VET'
    ? [
      { label: 'Đủ điều kiện (FIT)', value: loading ? '…' : fitHorses.length, color: '#9fd9b1' },
      { label: 'Cần theo dõi', value: loading ? '…' : monitoringHorses.length, color: monitoringHorses.length ? '#f3d29a' : undefined },
      { label: 'Đang chấn thương', value: loading ? '…' : injuredHorses.length, color: injuredHorses.length ? '#f3b4b4' : undefined },
      { label: 'Cách ly kiểm dịch', value: loading ? '…' : quarantinedHorses.length, color: quarantinedHorses.length ? '#f3b4b4' : undefined },
    ]
    : [
      { label: role === 'OWNER' ? 'Ngựa thuộc sở hữu' : 'Tổng số ngựa', value: loading ? '…' : totalHorses },
      { label: 'Đang bị khóa huấn luyện', value: loading ? '…' : lockedHorses.length, color: lockedHorses.length ? '#f3b4b4' : '#9fd9b1' },
      { label: role === 'TRAINER' ? 'Sẵn sàng tập luyện' : 'Hoạt động bình thường', value: loading ? '…' : activeHorses.length, color: '#9fd9b1' },
      ...(role === 'MANAGER' ? [{ label: 'Tài khoản chờ duyệt (RBAC)', value: loading ? '…' : pendingUsersCount, color: pendingUsersCount ? '#f3d29a' : undefined }] : []),
    ];

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end justify-between">
          <div>
            <div className="lbl">Racehorse Club</div>
            <h1 className="disp text-[56px] mt-2">{t('dashboard.welcome')} {user?.name}</h1>
            <p className="text-hero-muted mt-2 max-w-[560px]">{(role && subtitle[role]) || t('dashboard.subtitle')}</p>
          </div>
          {role === 'MANAGER' && <Btn v="light" to="/horses"><Icon name="plus" />{t('dashboard.newHorse')}</Btn>}
          {role === 'TRAINER' && <Btn v="light" to="/plans?action=create"><Icon name="plus" />Lập giáo án mới</Btn>}
        </div>
        <HeroStats items={heroStats} />
      </section>

      <div className="flex flex-wrap gap-5 items-start">
        <div className="flex-[1.6_1_480px] min-w-0">
          <Card>
            <CardHeader title={
              role === 'OWNER' ? 'Danh sách ngựa thuộc sở hữu'
                : role === 'VET' ? 'Sơ đồ trạng thái sức khỏe đàn ngựa'
                  : role === 'GROOM' ? 'Danh sách ngựa tại khu vực phụ trách'
                    : 'Danh sách ngựa đua'
            }>
              <Link to="/horses" className="font-semibold text-info text-[12.5px] no-underline flex items-center gap-1">Xem tất cả <Icon name="chevRight" className="w-3.5 h-3.5" /></Link>
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
                          {horse.locked && <Badge tone="bad"><Icon name="lock" className="w-3 h-3" />Khóa tập</Badge>}
                        </div>
                        <div className="cap truncate">{horse.breed || 'Không rõ giống'}{horse.gender ? ` · ${horse.gender === 'MALE' ? 'Đực' : 'Cái'}` : ''} · Chủ sở hữu: {horse.owner?.name || 'N/A'}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        <Badge tone={careerTone[horse.status]}>{horse.status}</Badge>
                        <Badge tone={healthTone[horse.healthStatus]}>{horse.healthStatus}</Badge>
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
            <CardHeader title={`Các thao tác chính (${role ? t(`role.${role}`) : 'Người dùng'})`} />
            <div className="p-3 flex flex-col gap-1">
              {role && QUICK_ACTIONS[role]?.map((action) => (
                <Link key={action.title} to={action.to} className="flex gap-3 items-start p-2.5 rounded-btn no-underline text-ink hover:bg-subtle">
                  <span className="w-9 h-9 rounded-btn bg-info-bg text-info flex items-center justify-center flex-none"><Icon name={action.icon} /></span>
                  <div>
                    <div className="font-semibold text-[13px]">{action.title}</div>
                    <div className="cap mt-0.5">{action.desc}</div>
                  </div>
                </Link>
              ))}
              {!role && <p className="cap p-2.5">Tài khoản đang chờ Club Manager phê duyệt vai trò để kích hoạt chức năng nghiệp vụ.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title={role === 'VET' ? 'Cảnh báo dịch tễ & Chấn thương' : role === 'TRAINER' ? 'Cảnh báo ngưỡng thể lực & Khóa tập' : 'Cảnh báo & Tình trạng vận hành'} />
            <div className="p-5">
              {lockedHorses.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {lockedHorses.map((h) => (
                    <div key={h.id} className="rounded-btn border border-bad-bd bg-bad-bg px-3 py-2.5 text-[12.5px]">
                      <div className="flex items-center gap-1.5"><Icon name="lock" className="w-4 h-4 text-bad" /><strong>{h.name}</strong> đang bị khóa huấn luyện khẩn cấp.</div>
                      {h.lockReason && <div className="text-bad mt-0.5 pl-[22px]">Lý do: {h.lockReason}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-ok flex gap-2 items-center"><Icon name="check" />Tất cả các cá thể ngựa đều đang trong điều kiện an toàn và sẵn sàng hoạt động.</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Thông báo gần đây"><Link to="/notifications" className="font-semibold text-info text-[12.5px] no-underline">{t('dashboard.viewAll')}</Link></CardHeader>
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

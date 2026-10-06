import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';
import type { Horse, Paginated, Notification, User, Role } from '../lib/types';
import { HorseStatusBadge } from '../components/horse/HorseStatusBadge';
import { formatDate } from '../lib/format';
import {
  LockIcon,
  CheckIcon,
  AlertIcon,
  PlusIcon,
  PlanIcon,
  RaceIcon,
  HealthIcon,
  UserIcon,
  HorseIcon,
  ArrowRightIcon,
} from '../components/Icons';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [horses, setHorses] = useState<Horse[]>([]);
  const [totalHorses, setTotalHorses] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingUsersCount, setPendingUsersCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const role: Role | null = user?.role ?? null;

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      try {
        setLoading(true);

        // Fetch horses (top 6 recent)
        const horsesRes = await api.get<Paginated<Horse>>('/horses', {
          params: { limit: 6 },
        });

        if (mounted && horsesRes.data) {
          setHorses(horsesRes.data.data || []);
          setTotalHorses(horsesRes.data.meta?.total ?? horsesRes.data.data.length);
        }

        // Fetch notifications
        try {
          const notifsRes = await api.get<Paginated<Notification>>('/notifications', {
            params: { limit: 5 },
          });
          if (mounted && notifsRes.data) {
            setNotifications(notifsRes.data.data || []);
          }
        } catch {
          // ignore notification error
        }

        // Fetch pending users if MANAGER
        if (role === 'MANAGER') {
          try {
            const usersRes = await api.get<User[]>('/users');
            if (mounted && usersRes.data) {
              const pending = usersRes.data.filter((u) => u.status === 'PENDING').length;
              setPendingUsersCount(pending);
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // error handling
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      mounted = false;
    };
  }, [role]);

  const lockedHorses = horses.filter((h) => h.locked);
  const activeHorses = horses.filter((h) => h.status === 'ACTIVE' && !h.locked);
  const fitHorses = horses.filter((h) => h.healthStatus === 'FIT');
  const monitoringHorses = horses.filter((h) => h.healthStatus === 'MONITORING');
  const injuredHorses = horses.filter((h) => h.healthStatus === 'INJURED');
  const quarantinedHorses = horses.filter((h) => h.healthStatus === 'QUARANTINED');

  return (
    <div className="stack">
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>
            {t('dashboard.welcome')} {user?.name}
          </h1>
          <p className="muted">
            {role === 'TRAINER' && 'Theo dõi tiến độ huấn luyện, cảnh báo ngưỡng thể lực và lập giáo án cho toàn bộ chiến mã.'}
            {role === 'VET' && 'Kiểm soát sơ đồ sức khỏe đàn ngựa, hồ sơ bệnh án và lệnh khóa huấn luyện an toàn.'}
            {role === 'GROOM' && 'Quản lý phân bổ chuồng trại, khẩu phần dinh dưỡng hàng ngày và báo cáo sự cố chuồng.'}
            {role === 'OWNER' && 'Tra cứu hồ sơ lý lịch, dòng dõi gia phả và tình trạng sẵn sàng thi đấu của ngựa sở hữu.'}
            {role === 'MANAGER' && 'Giám sát vận hành câu lạc bộ, quản lý danh mục và phân quyền kiểm soát truy cập (RBAC).'}
            {!role && t('dashboard.subtitle')}
          </p>
        </div>

        {role === 'MANAGER' && (
          <div className="btn-row">
            <Link to="/horses" className="btn btn-primary">
              <PlusIcon /> {t('dashboard.newHorse')}
            </Link>
          </div>
        )}
        {role === 'TRAINER' && (
          <div className="btn-row">
            <Link to="/plans?action=create" className="btn btn-primary">
              <PlusIcon /> Lập giáo án mới
            </Link>
          </div>
        )}
      </div>

      {/* Role-Specific KPI Cards Grid */}
      <div className="kpi-grid">
        {/* VET Role: 4 health states */}
        {role === 'VET' ? (
          <>
            <div className="kpi-tile ok">
              <div className="k-num">{loading ? '…' : fitHorses.length}</div>
              <div className="k-label">Đủ điều kiện (FIT)</div>
            </div>
            <div className={`kpi-tile ${monitoringHorses.length > 0 ? 'warn' : 'ok'}`}>
              <div className="k-num">{loading ? '…' : monitoringHorses.length}</div>
              <div className="k-label">Cần theo dõi (MONITORING)</div>
            </div>
            <div className={`kpi-tile ${injuredHorses.length > 0 ? 'alert' : 'ok'}`}>
              <div className="k-num">{loading ? '…' : injuredHorses.length}</div>
              <div className="k-label">Đang chấn thương (INJURED)</div>
            </div>
            <div className={`kpi-tile ${quarantinedHorses.length > 0 ? 'alert' : 'ok'}`}>
              <div className="k-num">{loading ? '…' : quarantinedHorses.length}</div>
              <div className="k-label">Cách ly kiểm dịch (QUARANTINED)</div>
            </div>
          </>
        ) : (
          /* Other Roles: Standard KPIs */
          <>
            <div className="kpi-tile">
              <div className="k-num">{loading ? '…' : totalHorses}</div>
              <div className="k-label">
                {role === 'OWNER' ? 'Ngựa thuộc sở hữu' : 'Tổng số ngựa'}
              </div>
            </div>

            <div className={`kpi-tile ${lockedHorses.length > 0 ? 'alert' : 'ok'}`}>
              <div className="k-num">{loading ? '…' : lockedHorses.length}</div>
              <div className="k-label">Đang bị khoá huấn luyện</div>
            </div>

            <div className="kpi-tile ok">
              <div className="k-num">{loading ? '…' : activeHorses.length}</div>
              <div className="k-label">
                {role === 'TRAINER' ? 'Sẵn sàng tập luyện' : 'Hoạt động bình thường'}
              </div>
            </div>

            {role === 'MANAGER' && (
              <div className={`kpi-tile ${pendingUsersCount > 0 ? 'warn' : 'ok'}`}>
                <div className="k-num">{loading ? '…' : pendingUsersCount}</div>
                <div className="k-label">Tài khoản chờ duyệt (RBAC)</div>
              </div>
            )}

            {(role === 'TRAINER' || role === 'OWNER') && (
              <div className="kpi-tile">
                <div className="k-num">{loading ? '…' : '100%'}</div>
                <div className="k-label">Tuân thủ giáo án</div>
              </div>
            )}

            {role === 'GROOM' && (
              <div className="kpi-tile ok">
                <div className="k-num">{loading ? '…' : 'Đầy đủ'}</div>
                <div className="k-label">Khẩu phần dinh dưỡng</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="two-col">
        {/* Left Column: Recent Horses Table/List */}
        <div className="panel">
          <div className="panel-head">
            <h3>
              {role === 'OWNER'
                ? 'Danh sách ngựa thuộc sở hữu'
                : role === 'VET'
                ? 'Sơ đồ trạng thái sức khỏe đàn ngựa'
                : role === 'GROOM'
                ? 'Danh sách ngựa tại khu vực phụ trách'
                : 'Danh sách ngựa đua'}
            </h3>
            <Link to="/horses" className="small" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              Xem tất cả <ArrowRightIcon />
            </Link>
          </div>

          <div className="panel-body flush">
            {horses.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                {t('horse.empty')}
              </div>
            ) : (
              <div>
                {horses.map((horse) => (
                  <div
                    key={horse.id}
                    className="horse-mini-row"
                    onClick={() => navigate(`/horses/${horse.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="horse-mini-avatar">
                      {horse.photoUrl ? (
                        <img src={horse.photoUrl} alt={horse.name} />
                      ) : (
                        horse.name.slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="horse-mini-info">
                      <div className="horse-mini-title">
                        <span>{horse.name}</span>
                        {horse.locked && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--status-danger)',
                              fontWeight: 700,
                              background: 'var(--status-danger-bg)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <LockIcon /> Khoá tập
                          </span>
                        )}
                      </div>
                      <div className="horse-mini-sub">
                        {horse.breed || 'Không rõ giống'}
                        {horse.gender ? ` · ${horse.gender === 'MALE' ? 'Đực' : 'Cái'}` : ''}
                        {' '}· Chủ sở hữu: {horse.owner?.name || 'N/A'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <HorseStatusBadge status={horse.status} healthStatus={horse.healthStatus} />
                      <span className="small muted">›</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Role-Specific Quick Actions + Alerts + Notifications */}
        <div className="stack" style={{ gap: 16 }}>
          {/* Quick Actions Panel tailored to Role */}
          <div className="panel">
            <div className="panel-head">
              <h3>Các thao tác chính ({role ? t(`role.${role}`) : 'Người dùng'})</h3>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Head Trainer */}
              {role === 'TRAINER' && (
                <>
                  <Link to="/plans?action=create" className="quick-action-item">
                    <span className="quick-action-icon"><PlanIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Lập giáo án huấn luyện chi tiết</div>
                      <div className="muted small">Cự ly, khối lượng, mặt sân theo từng giai đoạn</div>
                    </div>
                  </Link>
                  <Link to="/plans" className="quick-action-item">
                    <span className="quick-action-icon"><HealthIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Theo dõi tiến độ &amp; Giáo án</div>
                      <div className="muted small">Quản lý toàn bộ danh sách giáo án của các chiến mã</div>
                    </div>
                  </Link>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><RaceIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Lựa chọn chiến mã tham gia giải đua</div>
                      <div className="muted small">Đăng ký danh sách thi đấu phù hợp</div>
                    </div>
                  </Link>
                </>
              )}

              {/* Veterinarian */}
              {role === 'VET' && (
                <>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><HealthIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Ghi nhận hồ sơ khám bệnh</div>
                      <div className="muted small">Chẩn đoán chi tiết và cập nhật phác đồ điều trị</div>
                    </div>
                  </Link>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><LockIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Đặt lệnh Khóa huấn luyện khẩn cấp</div>
                      <div className="muted small">Ngăn chặn xếp lịch bài tập nặng với ngựa chấn thương</div>
                    </div>
                  </Link>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><CheckIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Lịch tiêm phòng & Kiểm tra móng định kỳ</div>
                      <div className="muted small">Theo dõi nhắc lịch tiêm chủng và tẩy giun tự động</div>
                    </div>
                  </Link>
                </>
              )}

              {/* Groom */}
              {role === 'GROOM' && (
                <>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><CheckIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Xác nhận hoàn thành công việc</div>
                      <div className="muted small">Cho ăn, vệ sinh chuồng trại, ngâm chân nước đá</div>
                    </div>
                  </Link>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><AlertIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Gửi báo cáo sự cố đột xuất tại chuồng</div>
                      <div className="muted small">Bỏ ăn, dấu hiệu sốt, móng xước kèm ảnh thực tế</div>
                    </div>
                  </Link>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><HorseIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Theo dõi vật tư & Thức ăn</div>
                      <div className="muted small">Đề xuất bổ sung ngũ cốc, cỏ và dụng cụ chuồng</div>
                    </div>
                  </Link>
                </>
              )}

              {/* Horse Owner */}
              {role === 'OWNER' && (
                <>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><HorseIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Xem dòng dõi (Pedigree) & Lý lịch</div>
                      <div className="muted small">Hồ sơ 3 đời và lịch sử thành tích thi đấu</div>
                    </div>
                  </Link>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><HealthIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Theo dõi sức khỏe & Thể trạng</div>
                      <div className="muted small">Cân nặng và trạng thái sẵn sàng thi đấu realtime</div>
                    </div>
                  </Link>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><PlanIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Lịch tập luyện & Nhật ký nhận xét</div>
                      <div className="muted small">Xem đánh giá chuyên môn từ Huấn luyện viên trưởng</div>
                    </div>
                  </Link>
                </>
              )}

              {/* Club Manager */}
              {role === 'MANAGER' && (
                <>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><PlusIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Thêm mới hồ sơ ngựa đua</div>
                      <div className="muted small">Quản lý danh mục tổng các cá thể ngựa</div>
                    </div>
                  </Link>
                  <Link to="/admin/users" className="quick-action-item">
                    <span className="quick-action-icon"><UserIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Phân quyền truy cập hệ thống (RBAC)</div>
                      <div className="muted small">Duyệt tài khoản và gán vai trò vận hành</div>
                    </div>
                  </Link>
                  <Link to="/horses" className="quick-action-item">
                    <span className="quick-action-icon"><HealthIcon /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Báo cáo hiệu suất & Vận hành chuồng trại</div>
                      <div className="muted small">Kiểm tra nhật ký thao tác (Audit Log) minh bạch</div>
                    </div>
                  </Link>
                </>
              )}

              {/* Fallback for unassigned role */}
              {!role && (
                <div className="muted small" style={{ padding: '8px 0' }}>
                  Tài khoản đang chờ Club Manager phê duyệt vai trò để kích hoạt chức năng nghiệp vụ.
                </div>
              )}
            </div>
          </div>

          {/* System & Health Alerts Panel */}
          <div className="panel">
            <div className="panel-head">
              <h3>
                {role === 'VET'
                  ? 'Cảnh báo dịch tễ & Chấn thương'
                  : role === 'TRAINER'
                  ? 'Cảnh báo ngưỡng thể lực & Khóa tập'
                  : 'Cảnh báo & Tình trạng vận hành'}
              </h3>
            </div>
            <div className="panel-body">
              {lockedHorses.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lockedHorses.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--status-danger-bg)',
                        border: '1px solid #e8b8a4',
                        borderRadius: 6,
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <LockIcon />
                        <strong>{h.name}</strong> đang bị khóa huấn luyện khẩn cấp.
                      </div>
                      {h.lockReason && (
                        <div style={{ color: 'var(--status-danger)', marginTop: 2, paddingLeft: 18 }}>
                          Lý do: {h.lockReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--status-success)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckIcon />
                  <span>Tất cả các cá thể ngựa đều đang trong điều kiện an toàn và sẵn sàng hoạt động.</span>
                </div>
              )}
            </div>
          </div>

          {/* Notifications Panel */}
          <div className="panel">
            <div className="panel-head">
              <h3>Thông báo gần đây</h3>
            </div>
            <div className="panel-body flush">
              {notifications.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {t('dashboard.noNotifs')}
                </div>
              ) : (
                <div>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--border-default)',
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {n.message}
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                        {formatDate(n.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

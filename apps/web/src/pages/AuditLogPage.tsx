import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { AuditLog, AuditStats, Paginated } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Btn, Card, CardHeader, Icon } from '../ds/ui';
import { formatDateTime } from '../lib/format';
import { ErrorText } from '../components/ErrorText';

/* ─────────────── helpers ─────────────── */

const ACTION_TONE: Record<string, string> = {
  AUTH_LOGIN: 'text-ok bg-ok-bg',
  AUTH_LOGIN_FAILED: 'text-bad bg-bad-bg',
  USER_APPROVE: 'text-info bg-info-bg',
  USER_DISABLE: 'text-warn bg-warn-bg',
  USER_REJECT: 'text-bad bg-bad-bg',
  USER_DELETE: 'text-bad bg-bad-bg',
  USER_ROLE_ASSIGN: 'text-info bg-info-bg',
  USER_UPDATE: 'text-neu bg-neu-bg',
  HORSE_CREATE: 'text-ok bg-ok-bg',
  HORSE_UPDATE: 'text-info bg-info-bg',
  HORSE_DELETE: 'text-bad bg-bad-bg',
  HORSE_LOCK: 'text-warn bg-warn-bg',
  HORSE_UNLOCK: 'text-ok bg-ok-bg',
  DAILY_CARE_GENERATE: 'text-info bg-info-bg',
  DAILY_CARE_COMPLETE: 'text-ok bg-ok-bg',
  DAILY_CARE_UNCOMPLETE: 'text-neu bg-neu-bg',
};

const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN: 'Đăng nhập',
  AUTH_LOGIN_FAILED: 'Đăng nhập thất bại',
  USER_APPROVE: 'Phê duyệt TK',
  USER_DISABLE: 'Khóa TK',
  USER_REJECT: 'Từ chối TK',
  USER_DELETE: 'Xóa TK',
  USER_ROLE_ASSIGN: 'Gán vai trò',
  USER_UPDATE: 'Cập nhật TK',
  HORSE_CREATE: 'Thêm ngựa',
  HORSE_UPDATE: 'Sửa ngựa',
  HORSE_DELETE: 'Xóa ngựa',
  HORSE_LOCK: 'Khoá tập luyện',
  HORSE_UNLOCK: 'Mở khoá tập luyện',
  DAILY_CARE_GENERATE: 'Tạo checklist',
  DAILY_CARE_COMPLETE: 'Hoàn thành chăm sóc',
  DAILY_CARE_UNCOMPLETE: 'Hủy hoàn thành',
};

const ENTITY_LABELS: Record<string, string> = {
  AUTH: 'Xác thực',
  USER: 'Tài khoản',
  HORSE: 'Ngựa đua',
  TRAINING_SESSION: 'Buổi tập',
  TRAINING_PLAN: 'Kế hoạch',
  HEALTH_RECORD: 'Hồ sơ khám',
  INCIDENT_REPORT: 'Sự cố',
  DAILY_CARE: 'Chăm sóc',
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_TONE[action] ?? 'text-neu bg-neu-bg';
  return (
    <span
      className={`inline-flex items-center h-[22px] px-2 rounded-badge text-[10.5px] font-bold uppercase tracking-[.05em] whitespace-nowrap leading-none ${cls}`}
    >
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

const ENTITIES = [
  'AUTH',
  'USER',
  'HORSE',
  'TRAINING_SESSION',
  'TRAINING_PLAN',
  'HEALTH_RECORD',
  'INCIDENT_REPORT',
  'DAILY_CARE',
];
const ACTIONS = Object.keys(ACTION_LABELS);

export function AuditLogPage() {
  usePageChrome({ crumbs: ['Quản trị', 'Nhật ký hệ thống'] });

  const [stats, setStats] = useState<AuditStats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  const LIMIT = 20;

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      setErr(null);
      try {
        const params: Record<string, string | number> = { page: p, limit: LIMIT };
        if (search) params.search = search;
        if (filterEntity) params.entity = filterEntity;
        if (filterAction) params.action = filterAction;
        if (filterStart) params.startDate = filterStart;
        if (filterEnd) params.endDate = filterEnd;

        const [logsRes, statsRes] = await Promise.all([
          api.get<Paginated<AuditLog>>('/audit-logs', { params }),
          p === 1 ? api.get<AuditStats>('/audit-logs/stats') : Promise.resolve(null),
        ]);
        setLogs(logsRes.data.data);
        setTotal(logsRes.data.meta.total);
        setPage(p);
        if (statsRes) setStats(statsRes.data);
      } catch (e) {
        setErr(e);
      } finally {
        setLoading(false);
      }
    },
    [search, filterEntity, filterAction, filterStart, filterEnd],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      {/* ── Hero ── */}
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div>
          <div className="lbl">Quản trị hệ thống</div>
          <h1 className="disp text-[48px] mt-2">Nhật ký hệ thống</h1>
          <p className="cap mt-1">
            Theo dõi danh sách các thao tác và sự kiện quan trọng trong hệ thống để đảm bảo an toàn thông tin và tính minh bạch.
          </p>
        </div>

        {/* KPI stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-[.08em] text-hero-line font-semibold mb-1">
                Tổng nhật ký
              </div>
              <div className="text-[32px] font-display font-bold text-white num">
                {stats.totalLogs.toLocaleString()}
              </div>
            </div>
            <div className="bg-white/10 rounded-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-[.08em] text-hero-line font-semibold mb-1">
                Hôm nay
              </div>
              <div className="text-[32px] font-display font-bold text-white num">
                {stats.todayLogs}
              </div>
            </div>
            <div className="bg-white/10 rounded-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-[.08em] text-hero-line font-semibold mb-1">
                Sự kiện Auth hôm nay
              </div>
              <div className="text-[32px] font-display font-bold text-white num">
                {stats.authEventsToday}
              </div>
            </div>
            <div className="bg-white/10 rounded-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-[.08em] text-hero-line font-semibold mb-1">
                Thành viên thao tác
              </div>
              <div className="text-[32px] font-display font-bold text-white num">
                {stats.uniqueActorsCount}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Top Actions Summary ── */}
      {stats && stats.topActions.length > 0 && (
        <section className="px-8 py-4">
          <Card>
            <CardHeader title="Thao tác phổ biến nhất" />
            <div className="flex flex-wrap gap-3 px-5 py-4">
              {stats.topActions.map((a) => (
                <div key={a.action} className="flex items-center gap-2 bg-subtle rounded-btn px-3 py-2">
                  <ActionBadge action={a.action} />
                  <span className="font-semibold num text-[13px]">
                    {a.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* ── Filters ── */}
      <section className="px-8 py-2">
        <Card>
          <div className="px-5 py-4 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="lbl">Tìm kiếm</label>
              <div className="relative">
                <Icon
                  name="search"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
                />
                <input
                  type="text"
                  placeholder="Mô tả, người thực hiện, mã đối tượng..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void load(1)}
                  className="w-full h-9 pl-8 pr-3 rounded-btn border border-line bg-white text-[12.5px] outline-none focus:border-info focus:ring-1 focus:ring-info"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="lbl">Đối tượng</label>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="h-9 rounded-btn border border-line bg-white px-2.5 text-[12.5px] outline-none focus:border-info"
              >
                <option value="">Tất cả</option>
                {ENTITIES.map((e) => (
                  <option key={e} value={e}>
                    {ENTITY_LABELS[e] ?? e}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="lbl">Thao tác</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="h-9 rounded-btn border border-line bg-white px-2.5 text-[12.5px] outline-none focus:border-info"
              >
                <option value="">Tất cả</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="lbl">Từ ngày</label>
              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className="h-9 rounded-btn border border-line bg-white px-2.5 text-[12.5px] outline-none focus:border-info"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="lbl">Đến ngày</label>
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className="h-9 rounded-btn border border-line bg-white px-2.5 text-[12.5px] outline-none focus:border-info"
              />
            </div>

            <Btn v="p" sm onClick={() => void load(1)}>
              <Icon name="search" />
              Lọc
            </Btn>
            <Btn
              v="s"
              sm
              onClick={() => {
                setSearch('');
                setFilterEntity('');
                setFilterAction('');
                setFilterStart('');
                setFilterEnd('');
              }}
            >
              Xóa lọc
            </Btn>
          </div>
        </Card>
      </section>

      {/* ── Main Log Table (Giao diện bảng gọn gàng, cơ bản) ── */}
      <section className="px-8 pb-8">
        {loading ? (
          <p className="cap py-8 text-center">Đang tải nhật ký...</p>
        ) : err ? (
          <ErrorText err={err} />
        ) : logs.length === 0 ? (
          <Card className="py-12 text-center">
            <Icon name="eye" className="w-8 h-8 mx-auto text-faint mb-3" />
            <p className="cap">Không tìm thấy nhật ký nào phù hợp.</p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="h-[42px] px-4 bg-cream lbl border-b border-line text-[11px] font-semibold w-36">
                      Thời gian
                    </th>
                    <th className="h-[42px] px-4 bg-cream lbl border-b border-line text-[11px] font-semibold w-40">
                      Thao tác
                    </th>
                    <th className="h-[42px] px-4 bg-cream lbl border-b border-line text-[11px] font-semibold w-28">
                      Đối tượng
                    </th>
                    <th className="h-[42px] px-4 bg-cream lbl border-b border-line text-[11px] font-semibold">
                      Mô tả nội dung
                    </th>
                    <th className="h-[42px] px-4 bg-cream lbl border-b border-line text-[11px] font-semibold w-48">
                      Người thực hiện
                    </th>
                    <th className="h-[42px] px-4 bg-cream lbl border-b border-line text-[11px] font-semibold w-32 text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-line-soft hover:bg-subtle transition-colors align-middle"
                    >
                      {/* Thời gian */}
                      <td className="px-4 py-3 text-[12.5px] num font-medium text-ink whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>

                      {/* Thao tác */}
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>

                      {/* Đối tượng */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center h-[20px] px-2 rounded-badge text-[10px] font-semibold uppercase tracking-[.06em] bg-cream text-navy border border-line">
                          {ENTITY_LABELS[log.entity] ?? log.entity}
                        </span>
                      </td>

                      {/* Mô tả vắn tắt */}
                      <td className="px-4 py-3 text-[13px] max-w-[340px]">
                        <span className="line-clamp-2 leading-relaxed text-ink font-normal">
                          {log.description}
                        </span>
                      </td>

                      {/* Người thực hiện */}
                      <td className="px-4 py-3 text-[12.5px]">
                        {log.actor ? (
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-navy text-white flex items-center justify-center font-bold text-[10px] flex-none">
                              {log.actor.name.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <span className="font-semibold text-ink block truncate">
                                {log.actor.name}
                              </span>
                              {log.actor.role && (
                                <span className="text-[10.5px] text-muted block leading-none mt-0.5">
                                  {log.actor.role}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="cap text-muted italic">Hệ thống</span>
                        )}
                      </td>

                      {/* Nút Xem chi tiết chuyển sang trang con */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/audit-logs/${log.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-btn bg-white hover:bg-subtle border border-line text-info text-[12px] font-semibold no-underline transition-colors shadow-sm"
                        >
                          Xem chi tiết
                          <Icon name="chevRight" className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-line-soft">
                <p className="cap text-[12px]">
                  Trang {page}/{totalPages} · {total.toLocaleString()} bản ghi
                </p>
                <div className="flex gap-2">
                  <Btn v="s" sm disabled={page <= 1} onClick={() => void load(page - 1)}>
                    <Icon name="chevLeft" />
                    Trước
                  </Btn>
                  <Btn v="s" sm disabled={page >= totalPages} onClick={() => void load(page + 1)}>
                    Sau
                    <Icon name="chevRight" />
                  </Btn>
                </div>
              </div>
            )}
          </Card>
        )}
      </section>
    </>
  );
}

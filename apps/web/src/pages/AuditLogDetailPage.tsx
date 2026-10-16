import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { AuditLog } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, CardHeader, Icon } from '../ds/ui';
import { formatDateTime } from '../lib/format';
import { ErrorText } from '../components/ErrorText';

const ACTION_LABELS: Record<string, { label: string; tone: string; desc: string }> = {
  AUTH_LOGIN: { label: 'Đăng nhập hệ thống', tone: 'text-ok bg-ok-bg', desc: 'Xác thực thành công và khởi tạo phiên làm việc' },
  AUTH_LOGIN_FAILED: { label: 'Đăng nhập thất bại', tone: 'text-bad bg-bad-bg', desc: 'Cảnh báo an ninh: Nhập sai thông tin đăng nhập hoặc tài khoản bị khóa' },
  USER_APPROVE: { label: 'Phê duyệt tài khoản', tone: 'text-info bg-info-bg', desc: 'Quản lý phê duyệt thành viên mới vào hệ thống' },
  USER_DISABLE: { label: 'Khóa tài khoản', tone: 'text-bad bg-bad-bg', desc: 'Tạm dừng hoặc thu hồi quyền truy cập của người dùng' },
  USER_REJECT: { label: 'Từ chối đăng ký', tone: 'text-bad bg-bad-bg', desc: 'Từ chối yêu cầu đăng ký tài khoản thành viên' },
  USER_DELETE: { label: 'Xóa tài khoản', tone: 'text-bad bg-bad-bg', desc: 'Xóa hồ sơ người dùng khỏi hệ thống' },
  USER_ROLE_ASSIGN: { label: 'Thay đổi vai trò', tone: 'text-info bg-info-bg', desc: 'Cập nhật phân quyền RBAC cho người dùng' },
  USER_UPDATE: { label: 'Cập nhật tài khoản', tone: 'text-neu bg-neu-bg', desc: 'Thay đổi thông tin hồ sơ người dùng' },
  HORSE_CREATE: { label: 'Thêm mới chiến mã', tone: 'text-ok bg-ok-bg', desc: 'Đăng ký hồ sơ ngựa đua mới vào câu lạc bộ' },
  HORSE_UPDATE: { label: 'Cập nhật hồ sơ ngựa', tone: 'text-info bg-info-bg', desc: 'Thay đổi thông số thể trạng hoặc lý lịch ngựa' },
  HORSE_DELETE: { label: 'Xóa hồ sơ ngựa', tone: 'text-bad bg-bad-bg', desc: 'Lưu trữ hoặc xóa hồ sơ ngựa đua' },
  HORSE_LOCK: { label: 'Ban hành Khóa huấn luyện', tone: 'text-warn bg-warn-bg', desc: 'Bác sĩ thú y chỉ định tạm ngừng tập luyện do y tế' },
  HORSE_UNLOCK: { label: 'Dỡ bỏ Khóa huấn luyện', tone: 'text-ok bg-ok-bg', desc: 'Chiến mã đã hồi phục đủ điều kiện tập luyện lại' },
  DAILY_CARE_GENERATE: { label: 'Khởi tạo checklist chăm sóc', tone: 'text-info bg-info-bg', desc: 'Tự động tạo lịch sinh hoạt và chăm sóc trong ngày' },
  DAILY_CARE_COMPLETE: { label: 'Hoàn thành chăm sóc', tone: 'text-ok bg-ok-bg', desc: 'Ghi nhận hoàn thành công việc chuồng trại' },
  DAILY_CARE_UNCOMPLETE: { label: 'Hủy hoàn thành chăm sóc', tone: 'text-neu bg-neu-bg', desc: 'Cập nhật lại trạng thái công việc chăm sóc' },
};

const ENTITY_LABELS: Record<string, string> = {
  AUTH: 'Xác thực & Bảo mật (AUTH)',
  USER: 'Tài khoản người dùng (USER)',
  HORSE: 'Hồ sơ ngựa đua (HORSE)',
  TRAINING_SESSION: 'Lịch tập luyện (TRAINING_SESSION)',
  TRAINING_PLAN: 'Giáo án huấn luyện (TRAINING_PLAN)',
  HEALTH_RECORD: 'Hồ sơ y tế (HEALTH_RECORD)',
  INCIDENT_REPORT: 'Báo cáo sự cố (INCIDENT_REPORT)',
  DAILY_CARE: 'Chăm sóc chuồng trại (DAILY_CARE)',
};

export function AuditLogDetailPage() {
  const { id } = useParams<{ id: string }>();
  usePageChrome({ crumbs: ['Quản trị', 'Nhật ký hệ thống', 'Chi tiết'] });

  const [log, setLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const [viewRaw, setViewRaw] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    api
      .get<AuditLog>(`/audit-logs/${id}`)
      .then((res) => setLog(res.data))
      .catch((e) => setErr(e))
      .finally(() => setLoading(false));
  }, [id]);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="cap py-16">Đang tải thông tin chi tiết nhật ký...</p>
      </div>
    );
  }

  if (err || !log) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-4">
          <Link
            to="/admin/audit-logs"
            className="inline-flex items-center gap-1.5 text-[13px] text-info font-medium hover:underline no-underline"
          >
            <Icon name="chevLeft" className="w-4 h-4" />
            Quay lại danh sách nhật ký
          </Link>
        </div>
        <ErrorText err={err ?? new Error('Không tìm thấy bản ghi nhật ký')} />
      </div>
    );
  }

  const meta = ACTION_LABELS[log.action] ?? {
    label: log.action,
    tone: 'text-neu bg-neu-bg',
    desc: 'Thao tác nghiệp vụ hệ thống',
  };

  const diffObj = (log.diff && typeof log.diff === 'object') ? (log.diff as Record<string, unknown>) : null;
  const isComparison = diffObj && 'before' in diffObj && 'after' in diffObj;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Top back navigation */}
      <div>
        <Link
          to="/admin/audit-logs"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted hover:text-navy no-underline transition-colors py-1 px-2.5 -ml-2.5 rounded-btn hover:bg-subtle"
        >
          <Icon name="chevLeft" className="w-4 h-4" />
          Quay lại danh sách nhật ký
        </Link>
      </div>

      {/* Main Header Banner */}
      <Card className="overflow-hidden border-line">
        <div className="p-6 bg-gradient-to-r from-navy/[0.03] to-transparent border-b border-line-soft">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`inline-flex items-center h-[24px] px-2.5 rounded-badge text-[11px] font-bold uppercase tracking-[.05em] leading-none ${meta.tone}`}
              >
                {meta.label}
              </span>
              <span className="inline-flex items-center h-[24px] px-2.5 rounded-badge text-[11px] font-semibold uppercase tracking-[.05em] leading-none bg-cream text-navy border border-line">
                {ENTITY_LABELS[log.entity] ?? log.entity}
              </span>
            </div>
            <time className="text-[12.5px] num text-muted font-medium">
              {formatDateTime(log.createdAt)}
            </time>
          </div>

          <h1 className="text-[22px] font-bold text-ink leading-tight mt-3">
            {log.description}
          </h1>
          <p className="cap text-[12.5px] mt-1 text-muted">{meta.desc}</p>
        </div>

        {/* Quick summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line-soft bg-subtle/30 text-[12.5px]">
          <div className="px-5 py-3.5">
            <span className="lbl block mb-0.5">Người thực hiện</span>
            <span className="font-semibold text-ink">
              {log.actor ? log.actor.name : 'Hệ thống tự động'}
            </span>
            {log.actor?.role && (
              <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-white border border-line text-muted">
                {log.actor.role}
              </span>
            )}
          </div>
          <div className="px-5 py-3.5">
            <span className="lbl block mb-0.5">Địa chỉ IP truy cập</span>
            <span className="font-mono font-medium text-ink">
              {log.ipAddress ?? 'Nội bộ (Local)'}
            </span>
          </div>
          <div className="px-5 py-3.5">
            <span className="lbl block mb-0.5">Trạng thái an ninh</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-ok">
              <Icon name="check" className="w-3.5 h-3.5" />
              Đã ghi nhận bất biến (Audit Log)
            </span>
          </div>
        </div>
      </Card>

      {/* Two column detail layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: 2 Spans - Changes & Diff */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Dữ liệu thay đổi */}
          <Card>
            <CardHeader
              title={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Icon name="file" className="w-4 h-4 text-navy" />
                    <span className="font-semibold text-[15px]">
                      Dữ liệu &amp; Thay đổi thực tế
                    </span>
                  </div>
                  {diffObj && (
                    <button
                      type="button"
                      onClick={() => setViewRaw(!viewRaw)}
                      className="text-[12px] font-semibold text-info hover:underline"
                    >
                      {viewRaw ? 'Xem bảng thân thiện' : 'Xem JSON thô'}
                    </button>
                  )}
                </div>
              }
            />

            <div className="p-5">
              {!diffObj || Object.keys(diffObj).length === 0 ? (
                <p className="cap py-4 text-center text-muted">
                  Không có dữ liệu payload kèm theo cho thao tác này.
                </p>
              ) : viewRaw ? (
                <div>
                  <div className="flex justify-end mb-2">
                    <Btn
                      sm
                      v="s"
                      onClick={() => copyToClipboard(JSON.stringify(diffObj, null, 2))}
                    >
                      <Icon name="file" className="w-3.5 h-3.5" />
                      {copied ? 'Đã sao chép!' : 'Sao chép JSON'}
                    </Btn>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[12px] leading-relaxed overflow-x-auto max-h-96">
                    {JSON.stringify(diffObj, null, 2)}
                  </pre>
                </div>
              ) : isComparison ? (
                /* So sánh Before vs After trực quan */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Before Box */}
                    <div className="p-4 rounded-xl border border-bad/20 bg-bad-bg/40">
                      <div className="flex items-center gap-1.5 text-[12px] font-bold text-bad uppercase tracking-wider mb-2.5">
                        <Icon name="x" className="w-3.5 h-3.5" />
                        Trước khi thay đổi (Before)
                      </div>
                      <dl className="space-y-2 text-[12.5px]">
                        {Object.entries((diffObj.before as Record<string, unknown>) ?? {}).map(
                          ([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-bad/10 pb-1.5">
                              <dt className="text-muted font-medium">{k}:</dt>
                              <dd className="font-mono font-semibold text-ink">
                                {String(v ?? '—')}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </div>

                    {/* After Box */}
                    <div className="p-4 rounded-xl border border-ok/20 bg-ok-bg/40">
                      <div className="flex items-center gap-1.5 text-[12px] font-bold text-ok uppercase tracking-wider mb-2.5">
                        <Icon name="check" className="w-3.5 h-3.5" />
                        Sau khi thay đổi (After)
                      </div>
                      <dl className="space-y-2 text-[12.5px]">
                        {Object.entries((diffObj.after as Record<string, unknown>) ?? {}).map(
                          ([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-ok/10 pb-1.5">
                              <dt className="text-muted font-medium">{k}:</dt>
                              <dd className="font-mono font-semibold text-ok">
                                {String(v ?? '—')}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </div>
                  </div>
                </div>
              ) : (
                /* Bảng danh sách tham số thông thường */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead>
                      <tr className="border-b border-line bg-subtle">
                        <th className="py-2.5 px-3.5 lbl text-[11px]">Thông số</th>
                        <th className="py-2.5 px-3.5 lbl text-[11px]">Giá trị ghi nhận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {Object.entries(diffObj).map(([key, val]) => (
                        <tr key={key} className="hover:bg-subtle/50">
                          <td className="py-2.5 px-3.5 font-medium text-muted font-mono text-[12px]">
                            {key}
                          </td>
                          <td className="py-2.5 px-3.5 font-semibold text-ink font-mono text-[12px]">
                            {typeof val === 'object' && val !== null
                              ? JSON.stringify(val)
                              : String(val ?? '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          {/* Card: Mã định danh kỹ thuật */}
          <Card>
            <CardHeader title="Thông số kỹ thuật của bản ghi" />
            <div className="p-5 space-y-3.5 text-[12.5px]">
              <div className="flex items-center justify-between flex-wrap gap-2 py-2 border-b border-line-soft">
                <span className="lbl">Mã định danh nhật ký (Log ID)</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-muted">{log.id}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(log.id)}
                    className="p-1 rounded hover:bg-subtle text-muted hover:text-navy"
                    title="Sao chép ID"
                  >
                    <Icon name="file" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {log.entityId && (
                <div className="flex items-center justify-between flex-wrap gap-2 py-2 border-b border-line-soft">
                  <span className="lbl">Mã đối tượng tác động (Entity ID)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-muted">{log.entityId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(log.entityId!)}
                      className="p-1 rounded hover:bg-subtle text-muted hover:text-navy"
                      title="Sao chép Entity ID"
                    >
                      <Icon name="file" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-2 py-2">
                <span className="lbl">Thời điểm ghi nhận (UTC Timestamp)</span>
                <span className="font-mono text-[12px] text-muted">{log.createdAt}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: 1 Span - Actor Profile & Security Info */}
        <div className="space-y-6">
          {/* Card: Người thực hiện */}
          <Card>
            <CardHeader title="Người thực hiện" />
            <div className="p-5">
              {log.actor ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-full bg-navy text-white flex items-center justify-center font-bold text-sm">
                      {log.actor.name
                        .split(' ')
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                    <div>
                      <h3 className="font-semibold text-[15px] text-ink leading-tight">
                        {log.actor.name}
                      </h3>
                      <p className="cap text-[12px] text-muted">{log.actor.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-line-soft text-[12.5px]">
                    <div className="flex justify-between items-center">
                      <span className="lbl">Vai trò phân quyền</span>
                      <Badge tone={log.actor.role === 'MANAGER' ? 'ok' : 'info'}>
                        {log.actor.role ?? 'Chưa gán'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="lbl">Mã tài khoản</span>
                      <span className="font-mono text-[11px] text-muted truncate max-w-[140px]" title={log.actor.id}>
                        {log.actor.id.slice(0, 13)}...
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-cream text-navy flex items-center justify-center mx-auto mb-2">
                    <Icon name="sparkle" className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-[14px]">Hệ thống tự động</h3>
                  <p className="cap text-[12px] text-muted mt-0.5">
                    Thao tác được kích hoạt từ tiến trình nền hoặc người dùng chưa định danh
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Card: Thông tin mạng & Thiết bị */}
          <Card>
            <CardHeader title="Mạng &amp; Thiết bị (Audit Trace)" />
            <div className="p-5 space-y-3.5 text-[12.5px]">
              <div>
                <span className="lbl block mb-1">Địa chỉ IP nguồn</span>
                <div className="flex items-center gap-2 p-2.5 rounded-btn bg-subtle border border-line">
                  <Icon name="live" className="w-4 h-4 text-info flex-none" />
                  <span className="font-mono font-semibold text-[13px] text-ink">
                    {log.ipAddress ?? '127.0.0.1 (Localhost)'}
                  </span>
                </div>
              </div>

              <div>
                <span className="lbl block mb-1">Thông tin trình duyệt / Thiết bị</span>
                {log.userAgent ? (
                  <div className="p-3 rounded-btn bg-subtle border border-line text-[11.5px] font-mono leading-relaxed text-muted break-all">
                    {log.userAgent}
                  </div>
                ) : (
                  <span className="text-muted cap">Không có dữ liệu User-Agent</span>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

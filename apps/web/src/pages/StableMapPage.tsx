import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, getFileUrl } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import type { Horse, StallItem, StallStatus } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { ErrorText } from '../components/ErrorText';
import {
  Alert,
  Btn,
  Card,
  CareerBadge,
  Chip,
  ChipCount,
  Cloth,
  EmptyState,
  Field,
  HealthBadge,
  HorseAvatar,
  Icon,
  Input,
  KpiStrip,
  LockBadge,
  Modal,
  ModalBody,
  ModalFoot,
  ModalHead,
  PageHeader,
} from '../ds/ui';

const STATUS_CONFIG: Record<
  StallStatus,
  { labelVi: string; labelEn: string; color: string; badgeCls: string }
> = {
  AVAILABLE: {
    labelVi: 'Sẵn sàng / Trống',
    labelEn: 'Available / Vacant',
    color: '#10b981',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  OCCUPIED: {
    labelVi: 'Đang nuôi nhốt',
    labelEn: 'Occupied',
    color: '#2563eb',
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  CLEANING: {
    labelVi: 'Đang vệ sinh',
    labelEn: 'Cleaning',
    color: '#06b6d4',
    badgeCls: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  MAINTENANCE: {
    labelVi: 'Đang bảo trì',
    labelEn: 'Maintenance',
    color: '#f59e0b',
    badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  OUT_OF_SERVICE: {
    labelVi: 'Ngừng hoạt động',
    labelEn: 'Out of Service',
    color: '#6b7280',
    badgeCls: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  DISINFECTING: {
    labelVi: 'Đang khử trùng',
    labelEn: 'Disinfecting',
    color: '#8b5cf6',
    badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  QUARANTINED: {
    labelVi: 'Cách ly dịch bệnh',
    labelEn: 'Quarantined',
    color: '#ef4444',
    badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export function StableMapPage() {
  const { t, i18n } = useTranslation();
  const isVi = (i18n.resolvedLanguage || i18n.language || 'vi').toLowerCase().startsWith('vi');
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isVet = user?.role === 'VET';
  const isGroom = user?.role === 'GROOM';
  const isOwner = user?.role === 'OWNER';
  const canApprove = isVet || isGroom;

  usePageChrome({ crumbs: [t('stallsPage.title', 'Sơ đồ chuồng trại')] });

  const [stalls, setStalls] = useState<StallItem[]>([]);
  const [unassignedHorses, setUnassignedHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);

  // Filters
  const [sectionFilter, setSectionFilter] = useState<'ALL' | string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StallStatus>('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createBarn, setCreateBarn] = useState('A');
  const [createCode, setCreateCode] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<unknown>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStall, setEditingStall] = useState<StallItem | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState<unknown>(null);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTargetStall, setStatusTargetStall] = useState<StallItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<StallStatus>('AVAILABLE');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusErr, setStatusErr] = useState<unknown>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetStall, setAssignTargetStall] = useState<StallItem | null>(null);
  const [selectedHorseId, setSelectedHorseId] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignErr, setAssignErr] = useState<unknown>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stallRes, horseRes] = await Promise.all([
        api.get<StallItem[]>('/stalls'),
        api.get<{ data: Horse[] }>('/horses', { params: { limit: 200 } }),
      ]);
      setStalls(stallRes.data ?? []);

      // Filter unassigned horses (chưa có stallNumber hoặc rỗng)
      const unassigned = (horseRes.data?.data ?? []).filter(
        (h) => !h.stallNumber || !h.stallNumber.trim(),
      );
      setUnassignedHorses(unassigned);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Khi chọn dãy ở modal tạo chuồng -> gợi ý mã tự động A-11, B-11...
  const handleSelectBarnForCreate = async (barn: string) => {
    setCreateBarn(barn);
    try {
      const res = await api.get<string>('/stalls/next-code', { params: { barn } });
      setCreateCode(res.data);
    } catch {
      setCreateCode(`${barn}-01`);
    }
  };

  const handleOpenCreateModal = async () => {
    setCreateErr(null);
    setCreateNotes('');
    await handleSelectBarnForCreate('A');
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateBusy(true);
    setCreateErr(null);
    try {
      await api.post('/stalls', {
        code: createCode.trim().toUpperCase(),
        barn: createBarn.toUpperCase(),
        notes: createNotes.trim() || undefined,
      });
      await loadData();
      setCreateModalOpen(false);
    } catch (e2) {
      setCreateErr(e2);
    } finally {
      setCreateBusy(false);
    }
  };

  const handleOpenEdit = (stall: StallItem) => {
    setEditingStall(stall);
    setEditCode(stall.code);
    setEditNotes(stall.notes ?? '');
    setEditErr(null);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStall) return;
    setEditBusy(true);
    setEditErr(null);
    try {
      await api.patch(`/stalls/${editingStall.id}`, {
        code: editCode.trim().toUpperCase(),
        notes: editNotes.trim() || undefined,
      });
      await loadData();
      setEditModalOpen(false);
    } catch (e2) {
      setEditErr(e2);
    } finally {
      setEditBusy(false);
    }
  };

  const handleDeleteStall = async (stall: StallItem) => {
    if (stall.horse) {
      alert(
        isVi
          ? `CẢNH BÁO: Không thể xóa ô chuồng ${stall.code} vì chiến mã "${stall.horse.name}" đang được nuôi nhốt tại đây. Vui lòng chuyển ngựa hoặc dọn chuồng trước.`
          : `Cannot delete stall ${stall.code} because horse "${stall.horse.name}" is currently occupying it.`,
      );
      return;
    }
    if (
      !window.confirm(
        isVi
          ? `Bạn có chắc chắn muốn xóa vĩnh viễn ô chuồng ${stall.code}?`
          : `Are you sure you want to delete stall ${stall.code}?`,
      )
    ) {
      return;
    }
    try {
      await api.delete(`/stalls/${stall.id}`);
      await loadData();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleOpenStatusModal = (stall: StallItem) => {
    setStatusTargetStall(stall);
    setTargetStatus(stall.status === 'OCCUPIED' ? 'AVAILABLE' : stall.status);
    setStatusNotes('');
    setStatusErr(null);
    setStatusModalOpen(true);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusTargetStall) return;
    setStatusBusy(true);
    setStatusErr(null);
    try {
      await api.post(`/stalls/${statusTargetStall.id}/request-status`, {
        targetStatus,
        notes: statusNotes.trim() || undefined,
      });
      await loadData();
      setStatusModalOpen(false);
    } catch (e2) {
      setStatusErr(e2);
    } finally {
      setStatusBusy(false);
    }
  };

  const handleApproveStatus = async (stall: StallItem, approved: boolean) => {
    const actionLabel = approved ? (isVi ? 'PHÊ DUYỆT' : 'APPROVE') : (isVi ? 'TỪ CHỐI' : 'REJECT');
    if (
      !window.confirm(
        isVi
          ? `Xác nhận ${actionLabel} yêu cầu chuyển trạng thái ô chuồng ${stall.code}?`
          : `Confirm ${actionLabel} status change for stall ${stall.code}?`,
      )
    ) {
      return;
    }
    try {
      await api.post(`/stalls/${stall.id}/approve-status`, { approved });
      await loadData();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleOpenAssign = (stall: StallItem) => {
    setAssignTargetStall(stall);
    setSelectedHorseId(unassignedHorses[0]?.id ?? '');
    setAssignErr(null);
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetStall || !selectedHorseId) return;
    setAssignBusy(true);
    setAssignErr(null);
    try {
      await api.patch(`/stalls/horses/${selectedHorseId}/assign`, {
        stallCode: assignTargetStall.code,
      });
      await loadData();
      setAssignModalOpen(false);
    } catch (e2) {
      setAssignErr(e2);
    } finally {
      setAssignBusy(false);
    }
  };

  const handleVacateStall = async (horseId: string, horseName: string, stallCode: string) => {
    if (
      !window.confirm(
        isVi
          ? `Xác nhận dọn chuồng: chuyển chiến mã "${horseName}" ra khỏi ô chuồng ${stallCode}?`
          : `Confirm vacating: move horse "${horseName}" out of stall ${stallCode}?`,
      )
    ) {
      return;
    }
    try {
      await api.patch(`/stalls/horses/${horseId}/assign`, { stallCode: null });
      await loadData();
    } catch (e) {
      alert(String(e));
    }
  };

  // Unique Barns
  const availableBarns = Array.from(new Set(stalls.map((s) => s.barn))).sort();

  // Filtered list
  const q = search.trim().toLowerCase();
  const filteredStalls = stalls.filter((stall) => {
    if (sectionFilter !== 'ALL' && stall.barn !== sectionFilter) return false;
    if (statusFilter !== 'ALL' && stall.status !== statusFilter) return false;
    if (q) {
      const matchCode = stall.code.toLowerCase().includes(q);
      const matchHorse =
        stall.horse &&
        (stall.horse.name.toLowerCase().includes(q) ||
          (stall.horse.breed && stall.horse.breed.toLowerCase().includes(q)) ||
          (stall.horse.owner && stall.horse.owner.name.toLowerCase().includes(q)));
      if (!matchCode && !matchHorse) return false;
    }
    return true;
  });

  // KPIs
  const totalStalls = stalls.length;
  const occupiedCount = stalls.filter((s) => s.status === 'OCCUPIED' || s.horse != null).length;
  const availableCount = stalls.filter((s) => s.status === 'AVAILABLE' && !s.horse).length;
  const pendingApprovalCount = stalls.filter((s) => s.pendingStatus != null).length;
  const quarantineCount = stalls.filter(
    (s) => s.status === 'QUARANTINED' || s.status === 'DISINFECTING',
  ).length;

  return (
    <>
      <PageHeader
        title={t('stallsPage.title', 'Sơ đồ chuồng trại')}
        sub={
          isOwner
            ? isVi
              ? 'Xem vị trí các ô chuồng đang nuôi nhốt chiến mã thuộc quyền sở hữu của bạn.'
              : 'View stall locations and conditions for your owned horses.'
            : isVi
              ? 'Quản trị cơ sở vật chất, phân bổ ô chuồng, kiểm soát an toàn sinh học và cách ly dịch bệnh.'
              : 'Stable facility management, stall assignments, biosecurity controls and quarantine.'
        }
        search={{
          placeholder: isVi
            ? 'Tìm theo mã ô chuồng, tên ngựa, chủ sở hữu'
            : 'Search by stall code, horse name, owner',
          value: search,
          onChange: setSearch,
        }}
        actions={
          isManager && (
            <Btn v="p" onClick={handleOpenCreateModal}>
              <Icon name="plus" className="w-4 h-4" />
              {isVi ? 'Thêm ô chuồng' : 'Add Stall'}
            </Btn>
          )
        }
      />

      {/* KPI Strip */}
      <KpiStrip
        items={[
          { label: t('stallsPage.kpiTotalStalls', 'Tổng số ô chuồng'), value: totalStalls },
          {
            label: t('stallsPage.kpiOccupied', 'Đang nuôi nhốt'),
            value: occupiedCount,
            unit: `/ ${totalStalls}`,
          },
          {
            label: t('stallsPage.kpiAvailable', 'Ô chuồng trống'),
            value: availableCount,
            tone: availableCount > 0 ? 'ok' : undefined,
          },
          {
            label: isVi ? 'Cách ly / Khử trùng' : 'Quarantine / Disinfect',
            value: quarantineCount,
            tone: quarantineCount > 0 ? 'bad' : undefined,
          },
          {
            label: isVi ? 'Chờ Vet/Groom duyệt' : 'Pending Approvals',
            value: pendingApprovalCount,
            tone: pendingApprovalCount > 0 ? 'warn' : undefined,
          },
        ]}
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip on={sectionFilter === 'ALL'} onClick={() => setSectionFilter('ALL')}>
            {t('stallsPage.allSections', 'Tất cả các khu')}
          </Chip>
          {availableBarns.map((b) => (
            <Chip key={b} on={sectionFilter === b} onClick={() => setSectionFilter(b)}>
              {isVi ? `Khu ${b}` : `Barn ${b}`}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip on={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}>
            {isVi ? 'Tất cả trạng thái' : 'All status'}
          </Chip>
          {(
            [
              'AVAILABLE',
              'OCCUPIED',
              'CLEANING',
              'MAINTENANCE',
              'DISINFECTING',
              'QUARANTINED',
            ] as StallStatus[]
          ).map((st) => {
            const count = stalls.filter((s) => s.status === st).length;
            if (count === 0 && st !== 'AVAILABLE' && st !== 'OCCUPIED') return null;
            return (
              <Chip key={st} on={statusFilter === st} onClick={() => setStatusFilter(st)}>
                {isVi ? STATUS_CONFIG[st].labelVi : STATUS_CONFIG[st].labelEn}{' '}
                <ChipCount n={count} />
              </Chip>
            );
          })}
        </div>
      </div>

      <ErrorText err={err} />

      {/* Main Grid */}
      {loading && stalls.length === 0 ? (
        <p className="text-muted">{isVi ? 'Đang tải sơ đồ chuồng trại…' : 'Loading stable map…'}</p>
      ) : filteredStalls.length === 0 ? (
        <EmptyState>
          {isVi
            ? 'Không tìm thấy ô chuồng nào khớp với bộ lọc.'
            : 'No stalls match the current filter.'}
        </EmptyState>
      ) : (
        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(285px, 100%), 1fr))' }}
        >
          {filteredStalls.map((stall) => {
            const horse = stall.horse;
            const statusCfg = STATUS_CONFIG[stall.status] || STATUS_CONFIG.AVAILABLE;
            const isQuarantineOrDisinfect =
              stall.status === 'QUARANTINED' || stall.status === 'DISINFECTING';

            return (
              <div
                key={stall.id}
                className={`flex flex-col justify-between p-4 rounded-card border transition-all bg-white hover:shadow-md ${
                  stall.pendingStatus
                    ? 'border-amber-400 ring-2 ring-amber-400/20'
                    : isQuarantineOrDisinfect
                      ? 'border-rose-300 bg-rose-50/20'
                      : horse
                        ? 'border-line hover:border-line-strong'
                        : 'border-dashed border-line-strong bg-subtle/30'
                }`}
              >
                <div>
                  {/* Stall Header: Code, Badges & Actions */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-badge text-[13px] font-bold border bg-info-bg text-info-ink border-info/20">
                        {stall.code}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-badge text-[11px] font-medium border ${statusCfg.badgeCls}`}
                      >
                        {isVi ? statusCfg.labelVi : statusCfg.labelEn}
                      </span>
                    </div>

                    {isManager && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(stall)}
                          className="p-1 text-muted hover:text-ink rounded hover:bg-subtle"
                          title={isVi ? 'Sửa thông tin ô chuồng' : 'Edit stall'}
                        >
                          <Icon name="edit" className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteStall(stall)}
                          className="p-1 text-muted hover:text-bad rounded hover:bg-bad-bg"
                          title={isVi ? 'Xóa ô chuồng' : 'Delete stall'}
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Warning: Pending Approval for Disinfecting / Quarantined */}
                  {stall.pendingStatus && (
                    <div className="mb-3 p-2.5 rounded-btn bg-amber-50 border border-amber-200 text-[12px] text-amber-900">
                      <div className="font-semibold flex items-center gap-1">
                        <Icon name="alert" className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {isVi
                            ? `Yêu cầu chuyển sang: ${STATUS_CONFIG[stall.pendingStatus].labelVi}`
                            : `Requesting: ${STATUS_CONFIG[stall.pendingStatus].labelEn}`}
                        </span>
                      </div>
                      {stall.pendingNotes && (
                        <p className="mt-1 text-muted italic">"{stall.pendingNotes}"</p>
                      )}
                      {canApprove && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleApproveStatus(stall, true)}
                            className="px-2.5 py-1 text-[11.5px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                          >
                            {isVi ? 'Xác nhận duyệt' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleApproveStatus(stall, false)}
                            className="px-2.5 py-1 text-[11.5px] font-semibold bg-white border border-line text-ink rounded hover:bg-subtle cursor-pointer"
                          >
                            {isVi ? 'Từ chối' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stall Notes (if any) */}
                  {stall.notes && !stall.pendingStatus && (
                    <div className="text-[12px] text-muted italic mb-2 line-clamp-2">
                      Ghi chú: {stall.notes}
                    </div>
                  )}

                  {/* Stall Body: Horse Profile OR Empty State */}
                  {horse ? (
                    horse.isOtherOwner ? (
                      /* Che giấu thông tin ngựa của chủ khác đối với vai trò OWNER */
                      <div className="p-3 rounded-btn bg-subtle text-center text-muted">
                        <Icon name="lock" className="w-5 h-5 mx-auto mb-1 text-muted" />
                        <div className="text-[13px] font-medium text-ink">
                          {isVi ? 'Đã nuôi nhốt ngựa' : 'Occupied'}
                        </div>
                        <div className="text-[11px] text-muted">
                          {isVi
                            ? 'Thuộc quyền sở hữu của chủ ngựa khác'
                            : 'Owned by another owner'}
                        </div>
                      </div>
                    ) : (
                      <Link
                        to={`/horses/${horse.id}`}
                        className="flex items-start gap-3 text-ink no-underline group hover:text-info"
                      >
                        <HorseAvatar
                          src={getFileUrl(horse.photoUrl)}
                          name={horse.name}
                          size={46}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[15px] truncate group-hover:underline">
                              {horse.name}
                            </span>
                            <Cloth n={horse.saddleNumber} />
                          </div>
                          <div className="text-[12px] text-muted truncate mt-0.5">
                            {horse.breed ?? '—'} · Chủ: {horse.owner?.name ?? '—'}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <HealthBadge status={horse.healthStatus} />
                            {horse.locked && <LockBadge className="text-[11px] h-5" />}
                          </div>
                        </div>
                      </Link>
                    )
                  ) : (
                    <div className="py-4 text-center text-muted">
                      <p className="text-[13px]">
                        {isQuarantineOrDisinfect
                          ? isVi
                            ? 'Ô chuồng đang phong tỏa an toàn sinh học'
                            : 'Stall under biosecurity lockdown'
                          : isVi
                            ? 'Ô chuồng trống, sẵn sàng tiếp nhận'
                            : 'Empty stall ready for assignment'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 mt-3 border-t border-line-soft flex items-center justify-between text-[12px]">
                  {/* Đổi trạng thái chuồng */}
                  {(isManager || isVet || isGroom) && (
                    <button
                      type="button"
                      onClick={() => handleOpenStatusModal(stall)}
                      className="text-info hover:underline text-[12px] font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Icon name="clock" className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Đổi trạng thái' : 'Change Status'}</span>
                    </button>
                  )}

                  {/* Xếp hoặc dọn chuồng */}
                  {horse && !horse.isOtherOwner && (isManager || isGroom) ? (
                    <button
                      type="button"
                      onClick={() => void handleVacateStall(horse.id, horse.name, stall.code)}
                      className="text-bad hover:underline text-[12px] font-medium cursor-pointer"
                    >
                      {isVi ? 'Dọn chuồng' : 'Vacate'}
                    </button>
                  ) : !horse &&
                    !isQuarantineOrDisinfect &&
                    (isManager || isGroom) &&
                    unassignedHorses.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleOpenAssign(stall)}
                      className="text-emerald-600 hover:underline text-[12px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Xếp ngựa vào' : 'Assign Horse'}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned Horses Section */}
      {!isOwner && unassignedHorses.length > 0 && (
        <div className="mt-8 pt-6 border-t border-line">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[16px] font-semibold text-ink flex items-center gap-2">
                <span>{t('stallsPage.unassignedTitle', 'Ngựa chưa được phân ô chuồng')}</span>
                <span className="text-[12px] px-2 py-0.5 rounded-badge bg-warn-bg text-warn-ink font-bold">
                  {unassignedHorses.length}
                </span>
              </h3>
              <p className="text-[13px] text-muted mt-0.5">
                {t(
                  'stallsPage.unassignedDesc',
                  'Các ngựa trong câu lạc bộ chưa có thông tin vị trí chuồng cụ thể.',
                )}
              </p>
            </div>
          </div>

          <Card>
            <div className="divide-y divide-line-soft max-h-[300px] overflow-y-auto">
              {unassignedHorses.map((h) => (
                <div
                  key={h.id}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-subtle/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <HorseAvatar src={getFileUrl(h.photoUrl)} name={h.name} size={36} />
                    <div className="min-w-0">
                      <Link
                        to={`/horses/${h.id}`}
                        className="font-medium text-ink hover:underline truncate block"
                      >
                        {h.name}
                      </Link>
                      <div className="text-[12px] text-muted truncate">
                        {h.breed ?? '—'} · Chủ: {h.owner.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <CareerBadge status={h.status} />
                    <HealthBadge status={h.healthStatus} />
                    {(isManager || isGroom) && (
                      <Btn
                        sm
                        onClick={() => {
                          const firstAvailable = stalls.find(
                            (s) => s.status === 'AVAILABLE' && !s.horse,
                          );
                          if (!firstAvailable) {
                            alert(
                              isVi
                                ? 'Hiện không còn ô chuồng trống nào! Hãy tạo thêm chuồng mới hoặc dọn chuồng.'
                                : 'No vacant stalls available!',
                            );
                            return;
                          }
                          setAssignTargetStall(firstAvailable);
                          setSelectedHorseId(h.id);
                          setAssignErr(null);
                          setAssignModalOpen(true);
                        }}
                      >
                        <Icon name="pin" className="w-3.5 h-3.5" />
                        {isVi ? 'Xếp chuồng' : 'Assign'}
                      </Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Thêm ô chuồng mới (Tự động tăng mã +1) */}
      <Modal
        open={createModalOpen}
        onClose={() => !createBusy && setCreateModalOpen(false)}
        width={460}
      >
        <ModalHead
          icon="plus"
          title={isVi ? 'Thêm ô chuồng mới' : 'Add New Stall'}
          onClose={() => !createBusy && setCreateModalOpen(false)}
        />
        <form onSubmit={handleCreateSubmit}>
          <ModalBody>
            <ErrorText err={createErr} />

            <Field label={isVi ? 'Khu / Dãy chuồng' : 'Barn / Section'} req>
              <div className="flex gap-2">
                {['A', 'B', 'C', 'D'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => void handleSelectBarnForCreate(b)}
                    className={`flex-1 py-2 text-[14px] font-semibold rounded-btn border transition-colors ${
                      createBarn === b
                        ? 'bg-info text-white border-info'
                        : 'bg-white text-ink border-line hover:bg-subtle'
                    }`}
                  >
                    Khu {b}
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label={isVi ? 'Mã ô chuồng (Tự động cộng thêm 1)' : 'Stall Code (Auto +1)'}
              req
              hint={
                isVi
                  ? 'Hệ thống tự động tìm mã số cao nhất của dãy và cộng thêm 1.'
                  : 'Auto-incremented from latest stall in this barn.'
              }
            >
              <Input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                placeholder="vd: A-11, B-11"
                required
                maxLength={20}
              />
            </Field>

            <Field label={isVi ? 'Ghi chú thêm (Tùy chọn)' : 'Notes'}>
              <Input
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder={isVi ? 'vd: Chuồng gần cửa gió, máng ăn đôi...' : 'e.g., Near window...'}
                maxLength={200}
              />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Btn onClick={() => setCreateModalOpen(false)} disabled={createBusy}>
              {isVi ? 'Hủy' : 'Cancel'}
            </Btn>
            <Btn v="p" type="submit" disabled={createBusy || !createCode.trim()}>
              {createBusy ? (isVi ? 'Đang tạo…' : 'Creating…') : isVi ? 'Tạo ô chuồng' : 'Create'}
            </Btn>
          </ModalFoot>
        </form>
      </Modal>

      {/* Modal: Sửa ô chuồng */}
      <Modal open={editModalOpen} onClose={() => !editBusy && setEditModalOpen(false)} width={460}>
        <ModalHead
          icon="edit"
          title={isVi ? `Chỉnh sửa ô chuồng ${editingStall?.code}` : 'Edit Stall'}
          onClose={() => !editBusy && setEditModalOpen(false)}
        />
        <form onSubmit={handleEditSubmit}>
          <ModalBody>
            <ErrorText err={editErr} />
            <Field label={isVi ? 'Mã ô chuồng' : 'Stall Code'} req>
              <Input
                value={editCode}
                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                required
                maxLength={20}
              />
            </Field>
            <Field label={isVi ? 'Ghi chú cơ sở vật chất' : 'Facility Notes'}>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Ghi chú về cửa, máng uống nước..."
                maxLength={200}
              />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Btn onClick={() => setEditModalOpen(false)} disabled={editBusy}>
              {isVi ? 'Hủy' : 'Cancel'}
            </Btn>
            <Btn v="p" type="submit" disabled={editBusy || !editCode.trim()}>
              {editBusy ? (isVi ? 'Đang lưu…' : 'Saving…') : isVi ? 'Lưu thay đổi' : 'Save'}
            </Btn>
          </ModalFoot>
        </form>
      </Modal>

      {/* Modal: Chuyển đổi trạng thái ô chuồng (Kèm luồng phê duyệt an toàn sinh học) */}
      <Modal
        open={statusModalOpen}
        onClose={() => !statusBusy && setStatusModalOpen(false)}
        width={480}
      >
        <ModalHead
          icon="clock"
          title={isVi ? `Đổi trạng thái: Ô chuồng ${statusTargetStall?.code}` : 'Change Status'}
          onClose={() => !statusBusy && setStatusModalOpen(false)}
        />
        <form onSubmit={handleStatusSubmit}>
          <ModalBody>
            <ErrorText err={statusErr} />

            <Field label={isVi ? 'Chọn trạng thái mới' : 'Select Target Status'} req>
              <select
                className="h-10 w-full rounded-btn border border-line-strong bg-white px-3 text-[14px] outline-none transition-colors focus:border-info focus:ring-2 focus:ring-info/15"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as StallStatus)}
              >
                <option value="AVAILABLE">Sẵn sàng / Trống</option>
                <option value="CLEANING">Đang vệ sinh định kỳ</option>
                <option value="MAINTENANCE">Đang bảo trì / Sửa chữa</option>
                <option value="OUT_OF_SERVICE">Ngừng hoạt động</option>
                <option value="DISINFECTING">⚠️ Đang khử trùng (Cần Vet/Groom duyệt)</option>
                <option value="QUARANTINED">🚨 Cách ly dịch bệnh (Cần Vet/Groom duyệt)</option>
              </select>
            </Field>

            {(targetStatus === 'DISINFECTING' || targetStatus === 'QUARANTINED') && (
              <Alert tone="warn" icon="alert" title={isVi ? 'Yêu cầu phê duyệt an toàn' : 'Approval Required'}>
                {isVi
                  ? 'Khi chọn trạng thái Cách ly hoặc Khử trùng, hệ thống sẽ kích hoạt luồng cảnh báo khẩn và chờ Bác sĩ thú y (VET) hoặc Groom xác nhận kiểm tra thực tế trước khi áp dụng chính thức.'
                  : 'Switching to Quarantine or Disinfecting requires Vet or Groom confirmation before becoming effective.'}
              </Alert>
            )}

            <Field label={isVi ? 'Lý do / Ghi chú kiểm tra' : 'Reason / Inspection Notes'}>
              <Input
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder={
                  isVi
                    ? 'vd: Phát hiện triệu chứng hô hấp, cần khử trùng cloramin B...'
                    : 'Inspection notes...'
                }
                maxLength={300}
              />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Btn onClick={() => setStatusModalOpen(false)} disabled={statusBusy}>
              {isVi ? 'Hủy' : 'Cancel'}
            </Btn>
            <Btn v="p" type="submit" disabled={statusBusy}>
              {statusBusy
                ? isVi
                  ? 'Đang gửi…'
                  : 'Submitting…'
                : targetStatus === 'DISINFECTING' || targetStatus === 'QUARANTINED'
                  ? isVi
                    ? 'Gửi yêu cầu phê duyệt'
                    : 'Submit for Approval'
                  : isVi
                    ? 'Cập nhật ngay'
                    : 'Update Now'}
            </Btn>
          </ModalFoot>
        </form>
      </Modal>

      {/* Modal: Xếp ngựa vào ô chuồng (Kiểm tra double-booking & cấm chuồng cách ly) */}
      <Modal
        open={assignModalOpen}
        onClose={() => !assignBusy && setAssignModalOpen(false)}
        width={460}
      >
        <ModalHead
          icon="pin"
          title={isVi ? `Xếp ngựa vào ô chuồng ${assignTargetStall?.code}` : 'Assign Horse'}
          onClose={() => !assignBusy && setAssignModalOpen(false)}
        />
        <form onSubmit={handleAssignSubmit}>
          <ModalBody>
            <ErrorText err={assignErr} />

            <div className="p-3 rounded-btn bg-subtle text-[13px] mb-3">
              <span className="font-semibold">{isVi ? 'Ô chuồng đích:' : 'Target Stall:'}</span>{' '}
              <span className="font-bold text-info">{assignTargetStall?.code}</span> (Khu{' '}
              {assignTargetStall?.barn})
            </div>

            <Field label={isVi ? 'Chọn chiến mã cần xếp vào chuồng' : 'Select Horse'} req>
              <select
                className="h-10 w-full rounded-btn border border-line-strong bg-white px-3 text-[14px] outline-none transition-colors focus:border-info focus:ring-2 focus:ring-info/15"
                value={selectedHorseId}
                onChange={(e) => setSelectedHorseId(e.target.value)}
                required
              >
                {unassignedHorses.length === 0 ? (
                  <option value="">{isVi ? '— Không có ngựa nào chưa có chuồng —' : 'No horses'}</option>
                ) : (
                  unassignedHorses.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.breed ?? '—'}) — Chủ: {h.owner.name}
                    </option>
                  ))
                )}
              </select>
            </Field>
          </ModalBody>
          <ModalFoot>
            <Btn onClick={() => setAssignModalOpen(false)} disabled={assignBusy}>
              {isVi ? 'Hủy' : 'Cancel'}
            </Btn>
            <Btn v="p" type="submit" disabled={assignBusy || !selectedHorseId}>
              {assignBusy
                ? isVi
                  ? 'Đang xếp chuồng…'
                  : 'Assigning…'
                : isVi
                  ? 'Xác nhận xếp chuồng'
                  : 'Confirm'}
            </Btn>
          </ModalFoot>
        </form>
      </Modal>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, getFileUrl } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import type { Horse } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { ErrorText } from '../components/ErrorText';
import {
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
  fitColor,
} from '../ds/ui';

// Default predefined stable layout: Barns A, B, C with 10 stalls each
const PREDEFINED_STALLS = [
  ...Array.from({ length: 10 }, (_, i) => `A-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `B-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `C-${String(i + 1).padStart(2, '0')}`),
];

export function StableMapPage() {
  const { t, i18n } = useTranslation();
  const isVi = (i18n.resolvedLanguage || i18n.language || 'vi').toLowerCase().startsWith('vi');
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  usePageChrome({ crumbs: [t('stallsPage.title', 'Sơ đồ chuồng trại')] });

  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);

  // Filters
  const [sectionFilter, setSectionFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OCCUPIED' | 'VACANT'>('ALL');
  const [search, setSearch] = useState('');

  // Quick assign modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetStall, setTargetStall] = useState('');
  const [selectedHorseId, setSelectedHorseId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignErr, setAssignErr] = useState<unknown>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get<Horse[]>('/horses/stalls/map');
      setHorses(res.data ?? []);
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

  // Map of stallNumber -> Horse
  const stallMap = new Map<string, Horse>();
  const unassignedHorses: Horse[] = [];

  horses.forEach((h) => {
    if (h.stallNumber && h.stallNumber.trim()) {
      stallMap.set(h.stallNumber.trim().toUpperCase(), h);
    } else {
      unassignedHorses.push(h);
    }
  });

  // Collect all unique stalls (predefined + any custom ones found on horses)
  const allStallCodes = Array.from(
    new Set([
      ...PREDEFINED_STALLS,
      ...horses.map((h) => h.stallNumber?.trim().toUpperCase()).filter(Boolean) as string[],
    ])
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Filtered stalls
  const q = search.trim().toLowerCase();
  const filteredStalls = allStallCodes.filter((code) => {
    const horse = stallMap.get(code);

    // Section filter
    if (sectionFilter !== 'ALL') {
      if (!code.startsWith(sectionFilter)) return false;
    }

    // Occupied vs Vacant filter
    if (statusFilter === 'OCCUPIED' && !horse) return false;
    if (statusFilter === 'VACANT' && horse) return false;

    // Search filter
    if (q) {
      const matchCode = code.toLowerCase().includes(q);
      const matchHorse = horse && (
        horse.name.toLowerCase().includes(q) ||
        horse.breed?.toLowerCase().includes(q) ||
        horse.owner.name.toLowerCase().includes(q)
      );
      if (!matchCode && !matchHorse) return false;
    }

    return true;
  });

  // KPIs
  const totalStalls = allStallCodes.length;
  const occupiedCount = stallMap.size;
  const vacantCount = Math.max(0, totalStalls - occupiedCount);
  const lockedInStalls = Array.from(stallMap.values()).filter((h) => h.locked).length;

  const handleOpenAssign = (stallCode: string) => {
    setTargetStall(stallCode);
    setSelectedHorseId(unassignedHorses[0]?.id ?? '');
    setAssignErr(null);
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHorseId) return;

    setAssigning(true);
    setAssignErr(null);
    try {
      await api.patch(`/horses/${selectedHorseId}`, {
        stallNumber: targetStall.trim().toUpperCase(),
      });
      await loadData();
      setAssignModalOpen(false);
    } catch (err2) {
      setAssignErr(err2);
    } finally {
      setAssigning(false);
    }
  };

  const handleVacateStall = async (horse: Horse) => {
    if (!window.confirm(isVi ? `Xác nhận chuyển ngựa ${horse.name} ra khỏi ô chuồng ${horse.stallNumber}?` : `Remove ${horse.name} from stall ${horse.stallNumber}?`)) {
      return;
    }
    try {
      await api.patch(`/horses/${horse.id}`, { stallNumber: null });
      await loadData();
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <>
      <PageHeader
        title={t('stallsPage.title', 'Sơ đồ chuồng trại')}
        sub={t('stallsPage.subtitle', 'Theo dõi phân bổ vị trí từng ngựa tại các ô chuồng và chuồng còn trống.')}
        search={{
          placeholder: isVi ? 'Tìm theo mã ô chuồng, tên ngựa, chủ sở hữu' : 'Search by stall code, horse name, owner',
          value: search,
          onChange: setSearch,
        }}
      />

      {/* KPI Strip */}
      <KpiStrip
        items={[
          { label: t('stallsPage.kpiTotalStalls', 'Tổng số ô chuồng'), value: totalStalls },
          { label: t('stallsPage.kpiOccupied', 'Đang nuôi nhốt'), value: occupiedCount, unit: `/ ${totalStalls}` },
          { label: t('stallsPage.kpiAvailable', 'Ô chuồng trống'), value: vacantCount, tone: vacantCount > 0 ? 'ok' : undefined },
          { label: t('stallsPage.kpiLocked', 'Ngựa đang khóa tập'), value: lockedInStalls, tone: lockedInStalls > 0 ? 'bad' : undefined },
        ]}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip on={sectionFilter === 'ALL'} onClick={() => setSectionFilter('ALL')}>
            {t('stallsPage.allSections', 'Tất cả các khu')}
          </Chip>
          <Chip on={sectionFilter === 'A'} onClick={() => setSectionFilter('A')}>
            {t('stallsPage.sectionA', 'Khu A — Chuồng đua')}
          </Chip>
          <Chip on={sectionFilter === 'B'} onClick={() => setSectionFilter('B')}>
            {t('stallsPage.sectionB', 'Khu B — Phục hồi')}
          </Chip>
          <Chip on={sectionFilter === 'C'} onClick={() => setSectionFilter('C')}>
            {t('stallsPage.sectionC', 'Khu C — Cách ly')}
          </Chip>
        </div>

        <div className="flex items-center gap-2">
          <Chip on={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}>
            {isVi ? 'Tất cả trạng thái' : 'All status'}
          </Chip>
          <Chip on={statusFilter === 'OCCUPIED'} onClick={() => setStatusFilter('OCCUPIED')}>
            {t('stallsPage.filterOccupied', 'Đang có ngựa')} <ChipCount n={occupiedCount} />
          </Chip>
          <Chip on={statusFilter === 'VACANT'} onClick={() => setStatusFilter('VACANT')}>
            {t('stallsPage.filterVacant', 'Ô còn trống')} <ChipCount n={vacantCount} />
          </Chip>
        </div>
      </div>

      <ErrorText err={err} />

      {/* Main Stalls Grid */}
      {loading && horses.length === 0 ? (
        <p className="text-muted">{isVi ? 'Đang tải sơ đồ chuồng trại…' : 'Loading stall map…'}</p>
      ) : filteredStalls.length === 0 ? (
        <EmptyState>
          {isVi ? 'Không tìm thấy ô chuồng nào khớp với bộ lọc.' : 'No stalls match the current filter.'}
        </EmptyState>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(270px, 100%), 1fr))' }}>
          {filteredStalls.map((code) => {
            const horse = stallMap.get(code);
            const sectionLetter = code.charAt(0);
            const sectionBg =
              sectionLetter === 'A'
                ? 'bg-info/10 text-info border-info/20'
                : sectionLetter === 'B'
                  ? 'bg-ok/10 text-ok border-ok/20'
                  : 'bg-warn/10 text-warn border-warn/20';

            if (!horse) {
              // Empty stall card
              return (
                <div
                  key={code}
                  className="flex flex-col justify-between p-4 rounded-card border-2 border-dashed border-line-strong bg-subtle/40 hover:bg-subtle hover:border-info/40 transition-colors min-h-[170px]"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-badge text-[13px] font-bold border ${sectionBg}`}>
                      {code}
                    </span>
                    <span className="text-[12px] text-muted font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {t('stallsPage.stallAvailable', 'Ô trống')}
                    </span>
                  </div>

                  <div className="py-2 text-center text-muted">
                    <p className="text-[13px]">{t('stallsPage.availableHint', 'Sẵn sàng tiếp nhận ngựa')}</p>
                  </div>

                  {isManager && unassignedHorses.length > 0 && (
                    <Btn sm onClick={() => handleOpenAssign(code)} className="w-full justify-center">
                      <Icon name="plus" className="w-3.5 h-3.5" />
                      {t('stallsPage.assignHorse', 'Xếp chuồng')}
                    </Btn>
                  )}
                </div>
              );
            }

            // Occupied stall card
            return (
              <div
                key={code}
                className={`flex flex-col justify-between p-4 rounded-card border transition-shadow bg-white hover:shadow-md ${
                  horse.locked
                    ? 'border-bad/40 hover:border-bad'
                    : 'border-line hover:border-line-strong'
                }`}
              >
                {/* Stall code and quick badges */}
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`px-2.5 py-0.5 rounded-badge text-[13px] font-bold border ${sectionBg}`}>
                    {code}
                  </span>
                  <div className="flex items-center gap-1">
                    {horse.locked && <LockBadge className="text-[11px] h-5" />}
                    <CareerBadge status={horse.status} />
                  </div>
                </div>

                {/* Horse profile preview */}
                <Link
                  to={`/horses/${horse.id}`}
                  className="flex items-start gap-3 text-ink no-underline group hover:text-info"
                >
                  <HorseAvatar src={getFileUrl(horse.photoUrl)} name={horse.name} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[15px] truncate group-hover:underline">
                        {horse.name}
                      </span>
                      <Cloth n={horse.saddleNumber} />
                    </div>
                    <div className="text-[12px] text-muted truncate mt-0.5">
                      {horse.breed ?? '—'} · {horse.owner.name}
                    </div>
                  </div>
                </Link>

                {/* Status footer and actions */}
                <div className="pt-3 mt-3 border-t border-line-soft flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-1.5">
                    <HealthBadge status={horse.healthStatus} />
                    {horse.fitnessScore != null && (
                      <span className="font-medium num" style={{ color: fitColor(horse.fitnessScore) }}>
                        Fit {horse.fitnessScore}
                      </span>
                    )}
                  </div>

                  {isManager && (
                    <button
                      type="button"
                      onClick={() => void handleVacateStall(horse)}
                      className="text-muted hover:text-bad text-[11.5px] cursor-pointer"
                      title={isVi ? 'Đưa ra khỏi chuồng' : 'Vacate stall'}
                    >
                      {isVi ? 'Rút khỏi chuồng' : 'Vacate'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned horses section */}
      {unassignedHorses.length > 0 && (
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
                {t('stallsPage.unassignedDesc', 'Các ngựa trong câu lạc bộ chưa có thông tin vị trí chuồng cụ thể.')}
              </p>
            </div>
          </div>

          <Card>
            <div className="divide-y divide-line-soft max-h-[300px] overflow-y-auto">
              {unassignedHorses.map((h) => (
                <div key={h.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-subtle/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <HorseAvatar src={getFileUrl(h.photoUrl)} name={h.name} size={36} />
                    <div className="min-w-0">
                      <Link to={`/horses/${h.id}`} className="font-medium text-ink hover:underline truncate block">
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
                    {isManager && (
                      <Btn sm onClick={() => handleOpenAssign('')}>
                        <Icon name="pin" className="w-3.5 h-3.5" />
                        {isVi ? 'Gán chuồng' : 'Assign'}
                      </Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Modal Quick Assign Horse to Stall */}
      <Modal open={assignModalOpen} onClose={() => !assigning && setAssignModalOpen(false)} width={460}>
        <ModalHead
          icon="pin"
          title={t('stallsPage.assignModalTitle', 'Phân ô chuồng cho ngựa')}
          onClose={() => !assigning && setAssignModalOpen(false)}
        />
        <form onSubmit={handleAssignSubmit}>
          <ModalBody>
            <ErrorText err={assignErr} />

            <Field label={t('stallsPage.stallInputLabel', 'Mã ô chuồng')} req>
              <Input
                value={targetStall}
                onChange={(e) => setTargetStall(e.target.value.toUpperCase())}
                placeholder="Ví dụ: A-01, B-03, C-05..."
                required
                maxLength={20}
              />
            </Field>

            <Field label={isVi ? 'Chọn ngựa cần xếp vào chuồng' : 'Select horse'} req>
              <select
                className="h-10 w-full rounded-btn border border-line-strong bg-white px-3 text-[14px] outline-none transition-colors focus:border-info focus:ring-2 focus:ring-info/15"
                value={selectedHorseId}
                onChange={(e) => setSelectedHorseId(e.target.value)}
                required
              >
                {unassignedHorses.length === 0 ? (
                  <option value="">{isVi ? '— Tất cả ngựa đã có chuồng —' : 'All horses assigned'}</option>
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
            <Btn onClick={() => setAssignModalOpen(false)} disabled={assigning}>
              {isVi ? 'Hủy' : 'Cancel'}
            </Btn>
            <Btn v="p" type="submit" disabled={assigning || !selectedHorseId || !targetStall.trim()}>
              {assigning ? (isVi ? 'Đang lưu…' : 'Saving…') : (isVi ? 'Xác nhận xếp chuồng' : 'Confirm')}
            </Btn>
          </ModalFoot>
        </form>
      </Modal>
    </>
  );
}

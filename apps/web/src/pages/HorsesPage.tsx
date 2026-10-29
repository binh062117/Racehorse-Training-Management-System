import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, getFileUrl } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { CreateHorseModal } from '../components/horse/CreateHorseModal';
import { EditHorseModal } from '../components/horse/EditHorseModal';
import { DeleteHorseModal } from '../components/horse/DeleteHorseModal';
import { usePageChrome } from '../ds/AppShell';
import {
  Btn, Card, CareerBadge, Chip, ChipCount, Cloth, EmptyState, HealthBadge, HorseAvatar, Icon, KpiStrip,
  LockBadge, PageHeader, Pagination, Ring, Seg, fitColor, lockReasonText,
} from '../ds/ui';


function BadgeLegendPopover() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-btn border border-line bg-white text-[12.5px] font-medium text-muted hover:text-ink hover:bg-subtle transition-colors shadow-xs"
        aria-label={t('badgeLegend.btnLabel', 'Chú thích nhãn')}
      >
        <Icon name="info" className="w-3.5 h-3.5 text-info" />
        <span>{t('badgeLegend.btnLabel', 'Chú thích nhãn')}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('badgeLegend.title', 'Ý nghĩa các nhãn trạng thái')}
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 z-50 w-[340px] rounded-card border border-line bg-white shadow-xl p-4 flex flex-col gap-3 text-ink"
        >
          <div className="flex items-center justify-between pb-2 border-b border-line-soft">
            <span className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
              <Icon name="info" className="w-4 h-4 text-info" />
              {t('badgeLegend.title', 'Ý nghĩa các nhãn trạng thái')}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-btn inline-flex items-center justify-center text-muted hover:bg-subtle hover:text-ink"
              aria-label="Đóng"
            >
              <Icon name="x" className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
              {t('badgeLegend.careerTitle', 'Sự nghiệp (Career Status)')}
            </p>
            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-start gap-2">
                <CareerBadge status="ACTIVE" />
                <span className="text-muted leading-tight pt-0.5">{t('badgeLegend.careerActive', 'Đang thi đấu tích cực')}</span>
              </div>
              <div className="flex items-start gap-2">
                <CareerBadge status="RESTING" />
                <span className="text-muted leading-tight pt-0.5">{t('badgeLegend.careerResting', 'Đang trong giai đoạn nghỉ dưỡng')}</span>
              </div>
              <div className="flex items-start gap-2">
                <CareerBadge status="RETIRED" />
                <span className="text-muted leading-tight pt-0.5">{t('badgeLegend.careerRetired', 'Đã giải nghệ, kết thúc thi đấu')}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-line-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
              {t('badgeLegend.healthTitle', 'Sức khỏe (Health Status)')}
            </p>
            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-start gap-2">
                <HealthBadge status="FIT" />
                <span className="text-muted leading-tight pt-0.5">{t('badgeLegend.healthFit', 'Khỏe mạnh, sẵn sàng huấn luyện & thi đấu')}</span>
              </div>
              <div className="flex items-start gap-2">
                <HealthBadge status="MONITORING" />
                <span className="text-muted leading-tight pt-0.5">{t('badgeLegend.healthMonitoring', 'Cần theo dõi sát, hạn chế bài tập nặng')}</span>
              </div>
              <div className="flex items-start gap-2">
                <HealthBadge status="INJURED" />
                <span className="text-muted leading-tight pt-0.5">{t('badgeLegend.healthInjured', 'Chấn thương, đang được bác sĩ thú y điều trị')}</span>
              </div>
              <div className="flex items-start gap-2">
                <HealthBadge status="QUARANTINED" />
                <span className="text-muted leading-tight pt-0.5">{t('badgeLegend.healthQuarantined', 'Cách ly y tế, cấm hoàn toàn tập luyện')}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-line-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
              {t('badgeLegend.lockTitle', 'Khóa tập (Training Lock)')}
            </p>
            <div className="flex items-start gap-2 text-[12px]">
              <LockBadge />
              <span className="text-muted leading-tight pt-0.5">
                {t('badgeLegend.lockDesc', 'Bác sĩ thú y đã ban hành lệnh khóa tập. Không thể tạo giáo án hay buổi tập cho đến khi được mở khóa.')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Filter = 'all' | 'locked' | 'injured' | 'mon';

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return years >= 0 ? years : null;
}

export function HorsesPage({ personal = false }: { personal?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isOwner = user?.role === 'OWNER';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);
  const [deletingHorse, setDeletingHorse] = useState<Horse | null>(null);

  const queryParams = {
    limit: 500,
    ...(personal && isOwner && user?.id ? { ownerId: user.id } : {}),
  };
  const cacheKey = `horses:${JSON.stringify(queryParams)}`;
  const { data, loading, error: loadErr, reload: load } = useCachedResource(cacheKey, () =>
    api.get<Paginated<Horse>>('/horses', { params: queryParams }).then((r) => r.data),
  );
  const all = data?.data ?? [];
  const q = debouncedSearch.trim().toLowerCase();
  const bySearch = q ? all.filter((h) => h.name.toLowerCase().includes(q)) : all;

  const filters: [Filter, string, (h: Horse) => boolean][] = [
    ['all', t('horsesPage.all', 'Tất cả'), () => true],
    ['locked', t('horsesPage.filterLocked', 'Khóa tập'), (h) => h.locked],
    ['injured', t('horsesPage.filterInjured', 'Chấn thương / cách ly'), (h) => h.healthStatus === 'INJURED' || h.healthStatus === 'QUARANTINED'],
    ['mon', t('horsesPage.filterMonitoring', 'Cần theo dõi'), (h) => h.healthStatus === 'MONITORING'],
  ];

  const rows = [...bySearch].filter(filters.find((f) => f[0] === filter)![2])
    .sort((a, b) => (b.fitnessScore ?? -1) - (a.fitnessScore ?? -1));

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const locked = all.filter((h) => h.locked).length;
  const active = all.filter((h) => h.status === 'ACTIVE').length;
  const scored = all.filter((h) => h.fitnessScore != null);
  const avgFit = scored.length ? (scored.reduce((s, h) => s + (h.fitnessScore ?? 0), 0) / scored.length).toFixed(1) : null;
  const avgFitNum = avgFit != null ? Number(avgFit) : null;

  const title = personal ? t('horsesPage.myHorses', 'Ngựa của tôi') : t('horsesPage.title', 'Ngựa đua');
  usePageChrome({ crumbs: [title] });

  const sub = loading && all.length === 0
    ? t('horsesPage.loading', 'Đang tải danh sách ngựa…')
    : `${t('horsesPage.countSummary', { count: all.length })}${locked > 0 ? ` · ${t('horsesPage.countLocked', { count: locked })}` : ''}${personal ? ` ${t('horsesPage.countOwned', 'thuộc sở hữu của bạn')}` : ''}.`;

  const genderText = (g: Horse['gender']) => (
    g === 'MALE' ? t('horsesPage.genderMale', 'Đực') : g === 'FEMALE' ? t('horsesPage.genderFemale', 'Cái') : t('horsesPage.genderUnknown', 'Chưa rõ giới tính')
  );
  const ageText = (birthDate: string | null) => {
    const age = calculateAge(birthDate);
    return age != null ? t('horsesPage.age', { age }) : t('horsesPage.ageUnknown', 'Chưa rõ tuổi');
  };

  return (
    <>
      <PageHeader
        title={title}
        sub={sub}
        search={{ placeholder: t('horsesPage.searchPlaceholder', 'Tìm theo tên ngựa'), value: search, onChange: (val) => { setSearch(val); setPage(1); } }}
        actions={isManager ? <Btn v="p" onClick={() => setCreateOpen(true)}><Icon name="plus" />{t('horsesPage.addHorse', 'Thêm ngựa')}</Btn> : undefined}
      />

      <KpiStrip items={[
        { label: t('horsesPage.kpiTotal', 'Tổng số ngựa'), value: all.length },
        { label: t('horsesPage.kpiActive', 'Đang thi đấu'), value: active, unit: `/ ${all.length}` },
        { label: t('horsesPage.kpiAvgFitness', 'Thể lực trung bình'), value: avgFitNum ?? '—', unit: avgFit ? '/100' : undefined, sub: scored.length < all.length ? t('horsesPage.evaluatedCount', { count: scored.length, total: all.length }) : undefined },
        { label: t('horsesPage.kpiLocked', 'Đang khóa tập'), value: locked, tone: locked > 0 ? 'bad' : undefined },
      ]} />

      <div className="flex flex-wrap gap-2 items-center">
        {filters.map(([k, l, fn]) => (
          <Chip key={k} on={filter === k} onClick={() => { setFilter(k); setPage(1); }}>{l} <ChipCount n={bySearch.filter(fn).length} /></Chip>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <BadgeLegendPopover />
          <Seg options={[['cards', t('horsesPage.cards', 'Thẻ')], ['table', t('horsesPage.table', 'Bảng')]]} value={view} onChange={(v) => setView(v as 'cards' | 'table')} />
        </div>
      </div>

      <ErrorText err={loadErr} />

      {loading && rows.length === 0 ? (
        <p className="text-muted">{t('horsesPage.loading', 'Đang tải danh sách ngựa…')}</p>
      ) : rows.length === 0 ? (
        <EmptyState action={filter !== 'all' || q ? <Btn sm onClick={() => { setFilter('all'); setSearch(''); }}>{t('horsesPage.clearFilters', 'Xóa bộ lọc')}</Btn> : undefined}>
          {all.length === 0 ? t('horsesPage.emptyNone', 'Chưa có hồ sơ ngựa nào.') : t('horsesPage.emptyFilter', 'Không có ngựa nào khớp với bộ lọc hiện tại.')}
        </EmptyState>
      ) : view === 'cards' ? (
        <>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(290px, 100%), 1fr))' }}>
          {paginatedRows.map((h) => (
            <HorseCard
              key={h.id}
              h={h}
              canManage={isManager}
              genderText={genderText(h.gender)}
              ageText={ageText(h.birthDate)}
              onEdit={() => setEditingHorse(h)}
              onDelete={() => setDeletingHorse(h)}
            />
          ))}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={rows.length}
          pageSize={pageSize}
          pageSizeOptions={[12, 24, 48]}
          onPageChange={setPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
        />
        </>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="h-10 px-5 font-medium border-b border-line">{t('horsesPage.thHorse', 'Ngựa')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('horsesPage.thOwner', 'Chủ sở hữu')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('horsesPage.thBreed', 'Giống')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line text-right">{t('horsesPage.thFitness', 'Thể lực')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('horsesPage.thRacing', 'Thi đấu')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('horsesPage.thHealth', 'Sức khỏe')}</th>
                  <th className="h-10 px-4 font-medium border-b border-line">{t('horsesPage.thLock', 'Khóa tập')}</th>
                  {isManager && <th className="h-10 px-5 border-b border-line" aria-label={t('horsesPage.thActions', 'Thao tác')} />}
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b border-line-soft last:border-0 hover:bg-subtle">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 flex justify-center"><Cloth n={h.saddleNumber} /></span>
                        <HorseAvatar src={getFileUrl(h.photoUrl)} name={h.name} size={32} />
                        <div className="min-w-0">
                          <Link to={`/horses/${h.id}`} className="font-medium text-ink no-underline hover:text-info">{h.name}</Link>
                          <div className="text-[12.5px] text-muted">{genderText(h.gender)} · {ageText(h.birthDate)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{h.owner.name}</td>
                    <td className="px-4 py-3 text-muted">{h.breed ?? '—'}</td>
                    <td className="px-4 py-3 text-right num">
                      {h.fitnessScore != null ? <span className="font-semibold hop" style={{ color: fitColor(h.fitnessScore) }}>{h.fitnessScore}</span> : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3"><CareerBadge status={h.status} /></td>
                    <td className="px-4 py-3"><HealthBadge status={h.healthStatus} /></td>
                    <td className="px-4 py-3 max-w-[260px]">
                      {h.locked
                        ? <div className="flex flex-col gap-1 items-start"><LockBadge /><span className="text-[12.5px] text-muted line-clamp-1" title={lockReasonText(h.lockReason)}>{lockReasonText(h.lockReason)}</span></div>
                        : <span className="text-muted">—</span>}
                    </td>
                    {isManager && (
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label={`${t('common.update', 'Sửa')} ${h.name}`} onClick={() => setEditingHorse(h)} className="w-8 h-8 rounded-btn inline-flex items-center justify-center text-muted hover:bg-cream hover:text-ink"><Icon name="edit" /></button>
                          <button type="button" aria-label={`${t('common.cancel', 'Xóa')} ${h.name}`} onClick={() => setDeletingHorse(h)} className="w-8 h-8 rounded-btn inline-flex items-center justify-center text-muted hover:bg-bad-bg hover:text-bad"><Icon name="trash" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={rows.length}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 50]}
              onPageChange={setPage}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            />
          </div>
        </Card>
      )}
      {rows.length > 0 && (
        <p className="text-[13px] text-muted">
          {t('horseFlow.horsesFound', 'Hiển thị {{count}} trong {{total}} ngựa · xếp theo thể lực, cao nhất trước', { count: rows.length, total: all.length })}
        </p>
      )}

      <CreateHorseModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
      <EditHorseModal horse={editingHorse} isOpen={editingHorse !== null} onClose={() => setEditingHorse(null)} onUpdated={load} />
      <DeleteHorseModal horse={deletingHorse} isOpen={deletingHorse !== null} onClose={() => setDeletingHorse(null)} onDeleted={load} />
    </>
  );
}

function HorseCard({
  h,
  canManage,
  genderText,
  ageText,
  onEdit,
  onDelete,
}: {
  h: Horse;
  canManage: boolean;
  genderText: string;
  ageText: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="group lift hover-hop flex flex-col bg-white rounded-card border border-line hover:border-line-strong">
      <Link to={`/horses/${h.id}`} aria-label={`${t('horseFlow.openProfile', 'Hồ sơ')} ${h.name}`} className="flex gap-3 items-center px-4 pt-4 no-underline text-ink">
        <HorseAvatar src={getFileUrl(h.photoUrl)} name={h.name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold leading-5 truncate group-hover:text-info">{h.name}</span>
            <Cloth n={h.saddleNumber} />
          </div>
          <div className="text-[12.5px] text-muted mt-0.5 truncate">{h.breed ?? t('horseFlow.breedNotSet', 'Chưa rõ giống')} · {genderText} · {ageText}</div>
        </div>
      </Link>

      <div className="flex items-center gap-3 px-4 pt-4">
        <Ring value={h.fitnessScore ?? 0} size={44} color={fitColor(h.fitnessScore)} text={h.fitnessScore ?? '—'} label={`${t('horsesPage.thFitness', 'Thể lực')} ${h.fitnessScore ?? ''}`} />
        <div className="min-w-0">
          <div className="text-[13px] text-muted">{t('horsesPage.thFitness', 'Thể lực')}</div>
          <div className="text-[13.5px]">
            {h.fitnessScore != null ? (
              <><span className="num font-medium">{h.fitnessScore}</span><span className="text-muted"> / 100</span></>
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        <CareerBadge status={h.status} />
        <HealthBadge status={h.healthStatus} />
        {h.locked && <LockBadge />}
      </div>
      {h.locked && <p className="px-4 pt-2 text-[12.5px] text-bad-ink line-clamp-2" title={lockReasonText(h.lockReason)}>{lockReasonText(h.lockReason)}</p>}

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2 px-4 h-11 border-t border-line-soft">
          <span className="text-[13px] text-muted flex-1 min-w-0 truncate">{t('horsesPage.thOwner', 'Chủ sở hữu')} <span className="text-ink">{h.owner.name}</span></span>
          {canManage && (
            <div className="flex gap-0.5 -mr-1.5">
              <button type="button" aria-label={`${t('common.update', 'Sửa')} ${h.name}`} onClick={onEdit} className="w-8 h-8 rounded-btn inline-flex items-center justify-center text-muted hover:bg-cream hover:text-ink"><Icon name="edit" /></button>
              <button type="button" aria-label={`${t('common.cancel', 'Xóa')} ${h.name}`} onClick={onDelete} className="w-8 h-8 rounded-btn inline-flex items-center justify-center text-muted hover:bg-bad-bg hover:text-bad"><Icon name="trash" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

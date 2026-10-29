import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { HealthRecord, HealthStatus, Horse, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { CreateHealthRecordModal } from '../components/health/CreateHealthRecordModal';
import { formatDate } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import { Btn, Card, CardHeader, Chip, ChipCount, EmptyState, HealthBadge, HorseAvatar, Icon, KpiStrip, LockBadge, PageHeader } from '../ds/ui';

export function HealthRecordsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isVet = user?.role === 'VET';

  const [horses, setHorses] = useState<Horse[]>([]);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [horsesLoading, setHorsesLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedHorseId, setSelectedHorseId] = useState('');
  const [selectedHorseName, setSelectedHorseName] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<HealthStatus | 'ALL'>('ALL');

  usePageChrome({ crumbs: [t('nav.healthSection', 'Sức khỏe'), t('healthRecordsPage.title', 'Hồ sơ khám bệnh')] });

  const loadHorses = useCallback(async () => {
    setHorsesLoading(true);
    try {
      const res = await api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } });
      setHorses(res.data.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setHorsesLoading(false);
    }
  }, []);

  const loadRecords = useCallback(async (horseList: Horse[]) => {
    try {
      const allRecords: HealthRecord[] = [];
      const promises = horseList.slice(0, 50).map(async (h) => {
        try {
          const res = await api.get<Paginated<HealthRecord>>(`/horses/${h.id}/health-records`, { params: { limit: 5 } });
          return res.data.data;
        } catch {
          return [];
        }
      });
      const results = await Promise.all(promises);
      for (const r of results) allRecords.push(...r);
      allRecords.sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
      setRecords(allRecords);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadHorses(); }, [loadHorses]);
  useEffect(() => {
    if (horses.length > 0) void loadRecords(horses);
    else setLoading(false);
  }, [horses, loadRecords]);

  const healthCounts = horses.reduce((acc, h) => {
    acc[h.healthStatus] = (acc[h.healthStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const lockedCount = horses.filter((h) => h.locked).length;
  const fit = healthCounts.FIT ?? 0;
  const watch = healthCounts.MONITORING ?? 0;
  const sick = (healthCounts.INJURED ?? 0) + (healthCounts.QUARANTINED ?? 0);

  const [healthResult, setHealthResult] = useState<{ status: HealthStatus; source: Horse[]; rows: Horse[]; err: unknown } | null>(null);
  useEffect(() => {
    if (statusFilter === 'ALL') return;
    let active = true;
    api.get<Paginated<Horse>>('/horses', { params: { limit: 100, healthStatus: statusFilter } })
      .then((r) => { if (active) setHealthResult({ status: statusFilter, source: horses, rows: r.data.data, err: null }); })
      .catch((err: unknown) => { if (active) setHealthResult({ status: statusFilter, source: horses, rows: [], err }); });
    return () => { active = false; };
  }, [statusFilter, horses]);
  const healthCurrent = healthResult?.status === statusFilter && healthResult?.source === horses;
  const healthLoading = statusFilter !== 'ALL' && !healthCurrent;
  const healthHorses = statusFilter === 'ALL' ? horses : healthCurrent ? healthResult!.rows : [];
  const filteredHorses = healthHorses.filter((h) => {
    if (statusFilter !== 'ALL' && h.healthStatus !== statusFilter) return false;
    if (search && !h.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openModalForHorse = (horse: Horse) => {
    setSelectedHorseId(horse.id);
    setSelectedHorseName(horse.name);
    setModalOpen(true);
  };

  const handleCreated = () => { void loadHorses(); };

  const lockedNote = lockedCount ? ` · ${t('horsesPage.countLocked', { count: lockedCount })}` : '';
  const sub = loading
    ? t('healthRecordsPage.loading', 'Đang tải dữ liệu sức khỏe…')
    : horses.length === 0
      ? t('horsesPage.emptyNone', 'Chưa có ngựa nào trong hệ thống.')
      : sick + watch === 0
        ? `${t('horsesPage.countSummary', { count: horses.length })} (${t('horseStatusBadge.FIT', 'Khỏe mạnh')})${lockedNote}.`
        : `${sick + watch} / ${horses.length} ${t('horseStatusBadge.MONITORING', 'cần theo dõi')}${lockedNote}.`;

  const filters: [HealthStatus | 'ALL', string, number][] = [
    ['ALL', t('healthRecordsPage.all', 'Tất cả'), horses.length],
    ['FIT', t('horseStatusBadge.FIT', 'Khỏe mạnh'), fit],
    ['MONITORING', t('horseStatusBadge.MONITORING', 'Cần theo dõi'), watch],
    ['INJURED', t('horseStatusBadge.INJURED', 'Chấn thương'), healthCounts.INJURED ?? 0],
    ['QUARANTINED', t('horseStatusBadge.QUARANTINED', 'Cách ly'), healthCounts.QUARANTINED ?? 0],
  ];
  const th = 'h-10 px-4 text-[12px] font-medium text-muted border-b border-line';

  return (
    <>
      <PageHeader
        title={t('healthRecordsPage.title', 'Hồ sơ khám bệnh')}
        sub={sub}
        search={{ placeholder: t('horsesPage.searchPlaceholder', 'Tìm theo tên ngựa'), value: search, onChange: setSearch }}
      />

      <KpiStrip items={[
        { label: t('horsesPage.kpiTotal', 'Tổng đàn'), value: horses.length },
        { label: t('horseStatusBadge.FIT', 'Khỏe mạnh'), value: fit, tone: fit > 0 ? 'ok' : undefined },
        { label: t('horseStatusBadge.MONITORING', 'Cần theo dõi'), value: watch, tone: watch > 0 ? 'warn' : undefined },
        { label: t('horsesPage.filterInjured', 'Chấn thương / cách ly'), value: sick, tone: sick > 0 ? 'bad' : undefined, lead: sick > 0 },
        { label: t('horsesPage.kpiLocked', 'Đang khóa tập'), value: lockedCount, tone: lockedCount > 0 ? 'bad' : undefined },
      ]} />

      <div className="flex flex-wrap gap-2 items-center">
        {filters.map(([k, label, n]) => (
          <Chip key={k} on={statusFilter === k} onClick={() => setStatusFilter(k)}>{label} <ChipCount n={n} /></Chip>
        ))}
      </div>

      <p className="cap">{i18n.t(statusFilter === 'ALL' ? 'healthView.subset' : 'healthView.filterLimit')}</p>
      <ErrorText err={err || (healthCurrent ? healthResult?.err : null)} />
      {!!(err || (healthCurrent && healthResult?.err)) && <Btn onClick={() => void loadHorses()}>{i18n.t('healthView.retry')}</Btn>}

      {loading || horsesLoading || healthLoading ? (
        <p className="text-muted">{t('healthRecordsPage.loading', 'Đang tải dữ liệu…')}</p>
      ) : (
        <div className="grid gap-5 items-start xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <Card className="min-w-0">
            <CardHeader title={t('horsesPage.thHealth', 'Tình trạng từng ngựa')}>
              <span className="num text-[13px] text-muted">{t('horsesPage.countSummary', { count: filteredHorses.length })}</span>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className={`${th} pl-5`}>{t('healthRecordsPage.colHorse', 'Ngựa')}</th>
                    <th className={th}>{t('horsesPage.thBreed', 'Giống')}</th>
                    <th className={th}>{t('horsesPage.thHealth', 'Sức khỏe')}</th>
                    <th className={`${th} ${isVet ? '' : 'pr-5'}`}>{t('horsesPage.thLock', 'Khóa tập')}</th>
                    {isVet && <th className={`${th} pr-5`} aria-label={t('horsesPage.thActions', 'Thao tác')} />}
                  </tr>
                </thead>
                <tbody>
                  {filteredHorses.length === 0 ? (
                    <tr>
                      <td colSpan={isVet ? 5 : 4} className="px-5 py-6 text-center text-muted">
                        {t('healthRecordsPage.emptyFilter', 'Không có ngựa nào khớp với bộ lọc.')}
                      </td>
                    </tr>
                  ) : filteredHorses.map((h) => (
                    <tr key={h.id} className="border-b border-line-soft last:border-0 hover:bg-subtle">
                      <td className="pl-5 pr-4 py-2.5">
                        <button type="button" onClick={() => navigate(`/horses/${h.id}`)} className="flex items-center gap-2.5 font-medium text-ink hover:text-info text-left whitespace-nowrap">
                          <HorseAvatar src={h.photoUrl} name={h.name} size={28} />{h.name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">{h.breed ?? <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-2.5"><HealthBadge status={h.healthStatus} /></td>
                      <td className={`px-4 py-2.5 ${isVet ? '' : 'pr-5'}`}>
                        {h.locked ? <LockBadge /> : <span className="text-muted">—</span>}
                      </td>
                      {isVet && (
                        <td className="pl-4 pr-5 py-2.5 text-right">
                          <Btn sm onClick={() => openModalForHorse(h)}>
                            <Icon name="plus" className="w-3.5 h-3.5" />{t('healthRecordsPage.newRecord', 'Ghi khám')}
                          </Btn>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="min-w-0">
            <CardHeader title={t('healthRecordsPage.title', 'Lần khám gần đây')}>
              <span className="num text-[13px] text-muted">{records.length}</span>
            </CardHeader>
            {records.length === 0 ? (
              <div className="p-4"><EmptyState>{t('healthRecordsPage.empty', 'Chưa có hồ sơ khám nào trong hệ thống.')}</EmptyState></div>
            ) : (
              <ul className="list-none p-0 m-0">
                {records.slice(0, 20).map((r) => (
                  <li key={r.id} className="border-b border-line-soft last:border-0">
                    <button type="button" onClick={() => navigate(`/horses/${r.horseId}?tab=health`)} className="w-full text-left px-5 py-3 hover:bg-subtle">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium truncate">{r.horse.name}</span>
                        <span className="num text-[12.5px] text-muted flex-none">{formatDate(r.examDate)}</span>
                      </div>
                      {/* Doctor-entered diagnosis is kept as-is */}
                      <p className="text-[13px] text-muted mt-0.5 line-clamp-2">{r.diagnosis}</p>
                      <p className="text-[12px] text-muted mt-1">{t('healthRecordsPage.colVet', 'Bác sĩ')} {r.vet.name}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <CreateHealthRecordModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onCreated={handleCreated} horseId={selectedHorseId} horseName={selectedHorseName} />
    </>
  );
}

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
  useTranslation();
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

  usePageChrome({ crumbs: [i18n.t("ui.health"), i18n.t("nav.healthRecords")] });

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

  // A new horses array re-runs the records effect, so reloading horses refreshes both lists.
  const handleCreated = () => { void loadHorses(); };

  const lockedNote = lockedCount ? i18n.t('mergeUi.lockedSummary', { count: lockedCount }) : '';
  const sub = loading
    ? i18n.t("mergeUi.loadingHealth")
    : horses.length === 0
      ? i18n.t("mergeUi.noHorsesSystem")
      : sick + watch === 0
        ? i18n.t('mergeUi.allHealthy', { count: horses.length, locked: lockedNote })
        : i18n.t('mergeUi.needsMonitoring', { count: sick + watch, total: horses.length, locked: lockedNote });

  const filters: [HealthStatus | 'ALL', string, number][] = [
    ['ALL', i18n.t("races.filters.ALL"), horses.length],
    ['FIT', i18n.t("ui.fit"), fit],
    ['MONITORING', i18n.t("horseFlow.health.MONITORING"), watch],
    ['INJURED', i18n.t("horseFlow.health.INJURED"), healthCounts.INJURED ?? 0],
    ['QUARANTINED', i18n.t("horseFlow.health.QUARANTINED"), healthCounts.QUARANTINED ?? 0],
  ];
  const th = 'h-10 px-4 text-[12px] font-medium text-muted border-b border-line';

  return (
    <>
      <PageHeader
        title={i18n.t("nav.healthRecords")}
        sub={sub}
        search={{ placeholder: i18n.t("horseFlow.searchPlaceholder"), value: search, onChange: setSearch }}
      />

      <KpiStrip items={[
        { label: i18n.t("ui.loadedHorses2"), value: horses.length },
        { label: i18n.t("ui.fit"), value: fit, tone: fit > 0 ? 'ok' : undefined },
        { label: i18n.t("horseFlow.health.MONITORING"), value: watch, tone: watch > 0 ? 'warn' : undefined },
        { label: i18n.t("mergeUi.injuredOrQuarantined"), value: sick, tone: sick > 0 ? 'bad' : undefined, lead: sick > 0 },
        { label: i18n.t("mergeUi.locked"), value: lockedCount, tone: lockedCount > 0 ? 'bad' : undefined },
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
        <p className="text-muted">{i18n.t("mergeUi.loadingData")}</p>
      ) : (
        <div className="grid gap-5 items-start xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <Card className="min-w-0">
            <CardHeader title={i18n.t("mergeUi.horseHealth")}><span className="num text-[13px] text-muted">{filteredHorses.length} {i18n.t("ui.horses2")}</span></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className={`${th} pl-5`}>{i18n.t("incidents.horse")}</th>
                    <th className={th}>{i18n.t("horse.breed")}</th>
                    <th className={th}>{i18n.t("ui.health")}</th>
                    <th className={`${th} ${isVet ? '' : 'pr-5'}`}>{i18n.t("ui.trainingLocked2")}</th>
                    {isVet && <th className={`${th} pr-5`} aria-label={i18n.t("incidents.actions")} />}
                  </tr>
                </thead>
                <tbody>
                  {filteredHorses.length === 0 ? (
                    <tr><td colSpan={isVet ? 5 : 4} className="px-5 py-6 text-center text-muted">{i18n.t("mergeUi.noHealthMatches")}</td></tr>
                  ) : filteredHorses.map((h) => (
                    <tr key={h.id} className="border-b border-line-soft last:border-0 hover:bg-subtle">
                      <td className="pl-5 pr-4 py-2.5">
                        <button type="button" onClick={() => navigate(`/horses/${h.id}`)} className="flex items-center gap-2.5 font-medium text-ink hover:text-info text-left whitespace-nowrap">
                          <HorseAvatar src={h.photoUrl} name={h.name} size={28} />{h.name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">{h.breed ?? <span className="text-muted">{i18n.t("horse.genderUnknown")}</span>}</td>
                      <td className="px-4 py-2.5"><HealthBadge status={h.healthStatus} /></td>
                      <td className={`px-4 py-2.5 ${isVet ? '' : 'pr-5'}`}>{h.locked ? <LockBadge /> : <span className="text-muted">{i18n.t("mergeUi.no")}</span>}</td>
                      {isVet && <td className="pl-4 pr-5 py-2.5 text-right"><Btn sm onClick={() => openModalForHorse(h)}><Icon name="plus" className="w-3.5 h-3.5" />{i18n.t("mergeUi.recordExam")}</Btn></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="min-w-0">
            <CardHeader title={i18n.t("mergeUi.recentExams")}><span className="num text-[13px] text-muted">{records.length}</span></CardHeader>
            {records.length === 0 ? (
              <div className="p-4"><EmptyState>{i18n.t("ui.noMedicalExaminationsRecordedYet")}</EmptyState></div>
            ) : (
              <ul className="list-none p-0 m-0">
                {records.slice(0, 20).map((r) => (
                  <li key={r.id} className="border-b border-line-soft last:border-0">
                    <button type="button" onClick={() => navigate(`/horses/${r.horseId}?tab=health`)} className="w-full text-left px-5 py-3 hover:bg-subtle">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium truncate">{r.horse.name}</span>
                        <span className="num text-[12.5px] text-muted flex-none">{formatDate(r.examDate)}</span>
                      </div>
                      <p className="text-[13px] text-muted mt-0.5 line-clamp-2">{r.diagnosis}</p>
                      <p className="text-[12px] text-muted mt-1">{i18n.t('role.VET')}: {r.vet.name}</p>
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

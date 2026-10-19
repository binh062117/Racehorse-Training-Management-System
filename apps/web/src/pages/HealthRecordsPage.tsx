import i18n from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HealthStatusBadge } from '../components/health/HealthStatusBadge';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { HealthRecord, HealthStatus, Horse, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { CreateHealthRecordModal } from '../components/health/CreateHealthRecordModal';
import { formatDate } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, HeroStats, Icon } from '../ds/ui';

export function HealthRecordsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
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

  usePageChrome({ crumbs: [i18n.t("ui.health"), i18n.t("nav.healthRecords")], search: i18n.t("ui.searchHorseName"), onSearch: setSearch });

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

  const handleCreated = () => {
    void loadHorses();
  };

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div>
          <div className="lbl">{i18n.t("ui.medicalRecords")}</div>
          <h1 className="disp text-[56px] mt-2">{i18n.t("ui.medicalExaminations")}</h1>
          <p className="text-hero-muted mt-2 max-w-[560px]">{i18n.t("ui.browseHorseHealthRecordExaminationsAndDiagnosesAndUpdateHealthStatus")}</p>
        </div>
        <HeroStats items={[
          { label: i18n.t("ui.loadedHorses"), value: horses.length },
          { label: t('horseStatusBadge.FIT'), value: healthCounts.FIT ?? 0, color: '#9fd9b1' },
          { label: t('horseStatusBadge.MONITORING'), value: healthCounts.MONITORING ?? 0, color: '#f3d29a' },
          { label: t('horseStatusBadge.INJURED'), value: healthCounts.INJURED ?? 0, color: '#f3b4b4' },
          { label: t('horseStatusBadge.QUARANTINED'), value: healthCounts.QUARANTINED ?? 0, color: '#f3b4b4' },
          { label: i18n.t("ui.trainingLocked2"), value: lockedCount, color: '#f3b4b4' },
        ]} />
      </section>

      <div className="flex flex-wrap gap-2.5 items-center">
        {(['ALL', 'FIT', 'MONITORING', 'INJURED', 'QUARANTINED'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}
            className={`inline-flex items-center h-[30px] px-3 rounded-full border text-[12.5px] font-medium ${statusFilter === s ? 'bg-navy text-white border-navy' : 'bg-white text-ink border-line'}`}>
            {t(s === 'ALL' ? 'healthView.all' : `horseStatusBadge.${s}`)}
          </button>
        ))}
      </div>

      <p className="cap">{t(statusFilter === 'ALL' ? 'healthView.subset' : 'healthView.filterLimit')}</p>
      <ErrorText err={err || (statusFilter !== 'ALL' ? healthResult?.err : null)} />
      {!!(err || (statusFilter !== 'ALL' && healthResult?.err)) && <Btn className="self-start" onClick={() => void loadHorses()}>{t('healthView.retry')}</Btn>}

      {loading || horsesLoading || healthLoading ? (
        <p className="cap">{t('healthView.loading')}</p>
      ) : (
        <div className="flex flex-wrap gap-6 items-start">
          <div className="flex-[1.4_1_480px] min-w-0">
            <h3 className="text-[15px] font-semibold mb-3">{i18n.t("ui.healthOverview")}{filteredHorses.length} {' '}{i18n.t("ui.horses")}</h3>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead>
                    <tr className="text-left">
                      {[i18n.t("horseFlow.horse"), i18n.t("horse.gender"), i18n.t("horse.breed"), i18n.t("ui.healthStatus"), i18n.t("ui.trainingLocked2"), ...(isVet ? [i18n.t("incidents.actions")] : [])].map((th) => (
                        <th key={th} className="h-[42px] px-4 bg-cream lbl border-b border-line">{th}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHorses.length === 0 ? (
                      <tr><td colSpan={isVet ? 6 : 5} className="text-center py-6"><span className="cap">{t('healthView.empty')}</span></td></tr>
                    ) : filteredHorses.map((h) => (
                      <tr key={h.id} className="border-b border-line-soft hover:bg-subtle">
                        <td className="px-4 py-3"><button type="button" onClick={() => navigate(`/horses/${h.id}`)} className="font-semibold text-navy">{h.name}</button></td>
                        <td className="px-4 py-3">{h.gender === 'MALE' ? <Badge tone="neu">{i18n.t("horse.genderMale")}</Badge> : h.gender === 'FEMALE' ? <Badge tone="neu">{i18n.t("horse.genderFemale")}</Badge> : <span className="cap">—</span>}</td>
                        <td className="px-4 py-3">{h.breed ?? '—'}</td>
                        <td className="px-4 py-3"><HealthStatusBadge status={h.healthStatus} /></td>
                        <td className="px-4 py-3">{h.locked ? <Badge tone="bad">{i18n.t("ui.locked2")}</Badge> : <span className="cap">—</span>}</td>
                        {isVet && <td className="px-4 py-3"><Btn sm onClick={() => openModalForHorse(h)}><Icon name="plus" className="w-3.5 h-3.5" />{i18n.t("ui.examine")}</Btn></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="flex-[1_1_320px] min-w-0">
            <h3 className="text-[15px] font-semibold mb-3">{i18n.t("ui.recentExaminations")}{records.length})</h3>
            {records.length === 0 ? (
              <Card className="text-center py-6"><p className="cap">{i18n.t("ui.noMedicalExaminationsRecordedYet")}</p></Card>
            ) : (
              <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
                {records.slice(0, 20).map((r) => (
                  <li key={r.id}>
                    <Card className="p-3.5 cursor-pointer hover:border-line-strong" onClick={() => navigate(`/horses/${r.horseId}`)}>
                      <div className="flex justify-between items-center">
                        <div><strong>{r.horse.name}</strong><span className="cap ml-2">{formatDate(r.examDate)}</span></div>
                        <span className="cap">{i18n.t("ui.vet")}{' '}{r.vet.name}</span>
                      </div>
                      <p className="text-[12.5px] text-muted mt-1.5">{r.diagnosis.length > 120 ? r.diagnosis.slice(0, 120) + '...' : r.diagnosis}</p>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <CreateHealthRecordModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onCreated={handleCreated} horseId={selectedHorseId} horseName={selectedHorseName} />
    </>
  );
}

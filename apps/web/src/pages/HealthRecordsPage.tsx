import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { HealthRecord, HealthStatus, Horse, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { CreateHealthRecordModal } from '../components/health/CreateHealthRecordModal';
import { formatDate } from '../lib/format';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, HeroStats, Icon, healthTone } from '../ds/ui';

export function HealthRecordsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isVet = user?.role === 'VET';

  const [horses, setHorses] = useState<Horse[]>([]);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedHorseId, setSelectedHorseId] = useState('');
  const [selectedHorseName, setSelectedHorseName] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<HealthStatus | 'ALL'>('ALL');

  usePageChrome({ crumbs: [t('healthRecordsPage.eyebrow'), t('healthRecordsPage.title')], search: t('horseFlow.searchPlaceholder'), onSearch: setSearch });

  const loadHorses = useCallback(async () => {
    try {
      const res = await api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } });
      setHorses(res.data.data ?? []);
    } catch (e) {
      setErr(e);
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

  const filteredHorses = horses.filter((h) => {
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
    void loadHorses().then(() => {
      if (horses.length > 0) void loadRecords(horses);
    });
  };

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div>
          <div className="lbl">{t('healthRecordsPage.eyebrow')}</div>
          <h1 className="disp text-[56px] mt-2">{t('healthRecordsPage.title')}</h1>
          <p className="text-hero-muted mt-2 max-w-[560px]">{t('healthRecordsPage.description')}</p>
        </div>
        <HeroStats items={[
          { label: t('healthRecordsPage.herd'), value: horses.length },
          { label: t('horseStatusBadge.FIT'), value: healthCounts.FIT ?? 0, color: '#9fd9b1' },
          { label: t('horseStatusBadge.MONITORING'), value: healthCounts.MONITORING ?? 0, color: '#f3d29a' },
          { label: t('healthRecordsPage.injuredOrQuarantined'), value: (healthCounts.INJURED ?? 0) + (healthCounts.QUARANTINED ?? 0), color: '#f3b4b4' },
          { label: t('healthRecordsPage.trainingLocked'), value: lockedCount, color: '#f3b4b4' },
        ]} />
      </section>

      <div className="flex flex-wrap gap-2.5 items-center">
        {(['ALL', 'FIT', 'MONITORING', 'INJURED', 'QUARANTINED'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatusFilter(s)}
            className={`inline-flex items-center h-[30px] px-3 rounded-full border text-[12.5px] font-medium ${statusFilter === s ? 'bg-navy text-white border-navy' : 'bg-white text-ink border-line'}`}>
            {s === 'ALL' ? t('healthRecordsPage.allStatuses') : t(`horseStatusBadge.${s}`)}
          </button>
        ))}
      </div>

      <ErrorText err={err} />

      {loading ? (
        <p className="cap">{t('healthRecordsPage.loading')}</p>
      ) : (
        <div className="flex flex-wrap gap-6 items-start">
          <div className="flex-[1.4_1_480px] min-w-0">
            <h3 className="text-[15px] font-semibold mb-3">{t('healthRecordsPage.herdStatus', { count: filteredHorses.length })}</h3>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead>
                    <tr className="text-left">
                      {[t('healthRecordsPage.horse'), t('healthRecordsPage.gender'), t('healthRecordsPage.breed'), t('healthRecordsPage.healthStatus'), t('healthRecordsPage.trainingLock'), ...(isVet ? [t('healthRecordsPage.actions')] : [])].map((th) => (
                        <th key={th} className="h-[42px] px-4 bg-cream lbl border-b border-line">{th}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHorses.length === 0 ? (
                      <tr><td colSpan={isVet ? 6 : 5} className="text-center py-6"><span className="cap">{t('healthRecordsPage.noHorseMatch')}</span></td></tr>
                    ) : filteredHorses.map((h) => (
                      <tr key={h.id} className="border-b border-line-soft hover:bg-subtle">
                        <td className="px-4 py-3"><button type="button" onClick={() => navigate(`/horses/${h.id}`)} className="font-semibold text-navy">{h.name}</button></td>
                        <td className="px-4 py-3">{h.gender ? <Badge tone="neu">{t(`horse.gender${h.gender === 'MALE' ? 'Male' : 'Female'}`)}</Badge> : <span className="cap">—</span>}</td>
                        <td className="px-4 py-3">{h.breed ?? '—'}</td>
                        <td className="px-4 py-3"><Badge tone={healthTone[h.healthStatus]}>{t(`horseStatusBadge.${h.healthStatus}`)}</Badge></td>
                        <td className="px-4 py-3">{h.locked ? <Badge tone="bad">{t('healthRecordsPage.locked')}</Badge> : <span className="cap">—</span>}</td>
                        {isVet && <td className="px-4 py-3"><Btn sm onClick={() => openModalForHorse(h)}><Icon name="plus" className="w-3.5 h-3.5" />{t('healthRecordsPage.examine')}</Btn></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="flex-[1_1_320px] min-w-0">
            <h3 className="text-[15px] font-semibold mb-3">{t('healthRecordsPage.recentRecords', { count: records.length })}</h3>
            {records.length === 0 ? (
              <Card className="text-center py-6"><p className="cap">{t('healthRecordsPage.empty')}</p></Card>
            ) : (
              <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
                {records.slice(0, 20).map((r) => (
                  <li key={r.id}>
                    <Card className="p-3.5 cursor-pointer hover:border-line-strong" onClick={() => navigate(`/horses/${r.horseId}`)}>
                      <div className="flex justify-between items-center">
                        <div><strong>{r.horse.name}</strong><span className="cap ml-2">{formatDate(r.examDate)}</span></div>
                        <span className="cap">{t('healthRecordsPage.vet', { name: r.vet.name })}</span>
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

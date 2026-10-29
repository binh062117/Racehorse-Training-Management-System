import i18n from '../../i18n';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { Horse, HorseRaceEntry, Paginated, Race, RaceEntry } from '../../lib/types';
import { usePageChrome } from '../../ds/AppShell';
import { Badge, Btn, Card, CardHeader, EmptyState, Field, KpiStrip, NativeSelect, PageHeader, thCls } from '../../ds/ui';
import { HorseRecordNav } from './HorseRecordNav';

// Flow 1: đăng ký ngựa cho cuộc đua và xem lịch sử kết quả thi đấu.
// Chia thành 3 phần chính:
// 1) tải dữ liệu ngựa + race entries + danh sách race còn mở
// 2) form đăng ký ngựa cho giải mới
// 3) bảng hiển thị lịch sử thi đấu và thống kê nhanh
export function HorseRaceHistoryPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [entries, setEntries] = useState<HorseRaceEntry[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [registrationError, setRegistrationError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Horse>(`/horses/${id}`),
      api.get<Paginated<HorseRaceEntry>>(`/horses/${id}/race-entries`, { params: { limit: 100 } }),
      api.get<Paginated<Race>>('/races', { params: { limit: 100 } }),
    ]).then(([horseResponse, raceResponse, raceListResponse]) => {
      if (active) {
        setHorse(horseResponse.data);
        setEntries(raceResponse.data.data);
        setRaces(raceListResponse.data.data);
      }
    }).catch((reason: unknown) => { if (active) setError(reason); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  usePageChrome({ crumbs: [[i18n.t("nav.horses"), '/horses'], horse?.name ?? '…', t('horseFlow.performanceTitle')] });

  // Chỉ hiện các race còn diễn ra trong tương lai và chưa được ngựa này đăng ký.
  const enteredRaceIds = new Set(entries.map((entry) => entry.race.id));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const availableRaces = races.filter((race) => (
    new Date(race.date) >= today && !enteredRaceIds.has(race.id)
  ));

  // Tính nhanh các KPI hiển thị ở đầu tab: số lần thi, số lần lên podium, vị trí tốt nhất.
  const wins = entries.filter((entry) => entry.position === 1).length;
  const podiums = entries.filter((entry) => entry.position != null && entry.position <= 3).length;
  const bestPlace = entries.reduce<number | null>((best, entry) => entry.position != null && (best == null || entry.position < best) ? entry.position : best, null);

  const registerForRace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRaceId) return;
    setRegistrationError(null);
    setRegistering(true);
    try {
      const response = await api.post<RaceEntry>(`/races/${selectedRaceId}/entries`, { horseId: id });
      const race = races.find((item) => item.id === selectedRaceId);
      if (race) {
        setEntries((current) => [{
          ...response.data,
          race: { id: race.id, name: race.name, date: race.date, venue: race.venue },
        }, ...current].sort((left, right) => right.race.date.localeCompare(left.race.date)));
      }
      setSelectedRaceId('');
    } catch (reason) {
      setRegistrationError(reason);
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <p className="text-muted">{t('horseFlow.loading')}</p>;
  if (error) return <ErrorText err={error} />;
  if (!horse) return null;

  return (
    <>
      <PageHeader
        crumbs={[['Ngựa đua', '/horses'], [horse.name, `/horses/${id}`]]}
        title={t('horseFlow.performanceTitle')}
        sub={entries.length === 0
          ? `${horse.name} chưa có kết quả thi đấu nào.`
          : `${horse.name} đã chạy ${entries.length} giải · ${wins} lần thắng · ${podiums} lần vào top 3.`}
      />
      <HorseRecordNav horseId={id} />

      {user?.role === 'MANAGER' && (
        <Card className="p-5">
          <h2 className="font-semibold text-[15px]">{t('horseFlow.registerForRace')}</h2>
          <p className="text-[13px] text-muted mt-0.5">{t('horseFlow.entryDescription', { horse: horse.name })}</p>
          {availableRaces.length > 0 ? (
            <form onSubmit={registerForRace} className="flex items-end gap-3 flex-wrap mt-3.5">
              <Field label={t('horseFlow.upcomingRace')} className="min-w-[260px] flex-1">
                <NativeSelect value={selectedRaceId} onChange={(event) => setSelectedRaceId(event.target.value)} required>
                  <option value="">{t('horseFlow.selectRace')}</option>
                  {availableRaces.map((race) => (
                    <option key={race.id} value={race.id}>
                      {race.name} · {formatDate(race.date)}{race.venue ? ` · ${race.venue}` : ''}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Btn v="p" type="submit" disabled={registering || !selectedRaceId}>
                {registering ? t('horseFlow.registering') : t('horseFlow.registerHorse')}
              </Btn>
            </form>
          ) : (
            <p className="text-[13px] text-muted mt-3">{t('horseFlow.noAvailableRaces')}</p>
          )}
          {registrationError && <div className="mt-2"><ErrorText err={registrationError} /></div>}
        </Card>
      )}

      {entries.length > 0 && <KpiStrip items={[
        { label: t('horseFlow.racesStarted'), value: entries.length },
        { label: t('horseFlow.wins'), value: wins, lead: wins > 0 },
        { label: t('horseFlow.podiums'), value: podiums },
        { label: t('horseFlow.bestFinish'), value: bestPlace == null ? <span className="text-muted text-[16px] font-normal">Chưa có</span> : `Hạng ${bestPlace}` },
      ]} />}

      {entries.length === 0 ? (
        <EmptyState>{t('horseFlow.noRaceResults')}. {t('horseFlow.noRaceResultsDescription')}</EmptyState>
      ) : (
        <Card>
          <CardHeader title="Các giải đã tham gia" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className={`${thCls} pl-5`}>{t('horseFlow.race')}</th>
                  <th className={`${thCls} text-right`}>{t('horseFlow.date')}</th>
                  <th className={thCls}>{t('horseFlow.venue')}</th>
                  <th className={`${thCls} text-right`}>{t('horseFlow.finish')}</th>
                  <th className={`${thCls} text-right pr-5`}>{t('horseFlow.time')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-line-soft last:border-0 hover:bg-subtle">
                    <td className="pl-5 pr-4 py-3 font-medium">{entry.race.name}</td>
                    <td className="px-4 py-3 num text-right whitespace-nowrap">{formatDate(entry.race.date)}</td>
                    <td className="px-4 py-3 text-muted">{entry.race.venue ?? 'Chưa rõ'}</td>
                    <td className="px-4 py-3 text-right">
                      {entry.position == null
                        ? <Badge tone="neu">{t('horseFlow.pendingResult')}</Badge>
                        : <span className={`num font-semibold ${entry.position === 1 ? 'text-ok' : ''}`}>{entry.position}</span>}
                    </td>
                    <td className="pl-4 pr-5 py-3 num text-right">{entry.time ?? <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

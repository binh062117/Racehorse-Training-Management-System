import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { Horse, HorseRaceEntry, Paginated, Race, RaceEntry } from '../../lib/types';
import { usePageChrome } from '../../ds/AppShell';
import { Badge, Btn, Card, Field } from '../../ds/ui';
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

  usePageChrome({ crumbs: [[t('nav.horses'), '/horses'], horse?.name ?? '…', t('horseFlow.performanceTitle')] });

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

  if (loading) return <p className="cap">{t('horseFlow.loading')}</p>;
  if (error) return <ErrorText err={error} />;
  if (!horse) return null;

  return (
    <div className="flex flex-col gap-4">
      <HorseRecordNav horseId={id} />

      <div>
        <h1 className="text-lg font-semibold">{t('horseFlow.performanceTitle')}</h1>
        <p className="cap mt-0.5">{horse.name} · {t('horseFlow.performanceDescription')}</p>
      </div>

      {user?.role === 'MANAGER' && (
        <Card className="p-5">
          <p className="lbl">{t('horseFlow.entryEyebrow')}</p>
          <h2 className="font-semibold text-[15px] mt-0.5">{t('horseFlow.registerForRace')}</h2>
          <p className="cap mt-0.5">{t('horseFlow.entryDescription', { horse: horse.name })}</p>
          {availableRaces.length > 0 ? (
            <form onSubmit={registerForRace} className="flex items-end gap-3 flex-wrap mt-3.5">
              <Field label={t('horseFlow.upcomingRace')} className="min-w-[260px] flex-1">
                <select
                  className="h-10 w-full rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info"
                  value={selectedRaceId} onChange={(event) => setSelectedRaceId(event.target.value)} required
                >
                  <option value="">{t('horseFlow.selectRace')}</option>
                  {availableRaces.map((race) => (
                    <option key={race.id} value={race.id}>
                      {race.name} · {formatDate(race.date)}{race.venue ? ` · ${race.venue}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Btn v="p" type="submit" disabled={registering || !selectedRaceId}>
                {registering ? t('horseFlow.registering') : t('horseFlow.registerHorse')}
              </Btn>
            </form>
          ) : (
            <p className="cap mt-3">{t('horseFlow.noAvailableRaces')}</p>
          )}
          {registrationError && <div className="mt-2"><ErrorText err={registrationError} /></div>}
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          [t('horseFlow.racesStarted'), entries.length],
          [t('horseFlow.wins'), wins],
          [t('horseFlow.podiums'), podiums],
          [t('horseFlow.bestFinish'), bestPlace == null ? '—' : `#${bestPlace}`],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <span className="cap">{label}</span>
            <div className="num font-bold text-xl mt-0.5">{value}</div>
          </Card>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <p className="font-semibold">{t('horseFlow.noRaceResults')}</p>
          <p className="cap mt-1">{t('horseFlow.noRaceResultsDescription')}</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="text-left">
                  {[t('horseFlow.race'), t('horseFlow.date'), t('horseFlow.venue'), t('horseFlow.finish'), t('horseFlow.time')].map((th) => (
                    <th key={th} className="h-[42px] px-4 bg-cream lbl border-b border-line">{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-line-soft hover:bg-subtle">
                    <td className="px-4 py-3 font-semibold">{entry.race.name}</td>
                    <td className="px-4 py-3">{formatDate(entry.race.date)}</td>
                    <td className="px-4 py-3 cap">{entry.race.venue ?? '—'}</td>
                    <td className="px-4 py-3">
                      {entry.position == null ? <Badge tone="neu">{t('horseFlow.pendingResult')}</Badge> : <span className="num font-semibold">#{entry.position}</span>}
                    </td>
                    <td className="px-4 py-3 num">{entry.time ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

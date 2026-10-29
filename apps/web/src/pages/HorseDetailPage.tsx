import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, getFileUrl } from '../lib/api';
import type { Horse, HorseRaceEntry, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { SessionsTab } from './horse/SessionsTab';
import { TrainingProgressTab } from './horse/TrainingProgressTab';
import { HealthTab } from './horse/HealthTab';
import { FeedingTab } from './horse/FeedingTab';
import { PlansTab } from './horse/PlansTab';
import { EditHorseModal } from '../components/horse/EditHorseModal';
import { DeleteHorseModal } from '../components/horse/DeleteHorseModal';
import { PhotoUploadModal } from '../components/horse/PhotoUploadModal';
import { PedigreeTab } from './horse/PedigreeTab';
import { usePageChrome } from '../ds/AppShell';
import {
  Alert, Btn, Card, CareerBadge, CountUp, Cloth, HealthBadge, HorseAvatar, Icon, ImageLightbox, KpiStrip, LockBadge,
  fitColor, lockReasonText,
} from '../ds/ui';

const TAB_ITEMS = (): [Tab, string][] => [
  ['profile', i18n.t("ui.horseProfile")],
  ['pedigree', i18n.t("ui.pedigree")],
  ['plans', i18n.t("nav.plansTrainer")],
  ['sessions', i18n.t("session.heading")],
  ['progress', 'Tiến độ huấn luyện'],
  ['health', i18n.t("ui.medicalRecords")],
  ['feeding', i18n.t("ui.feeding")],
];

type Tab = 'profile' | 'pedigree' | 'plans' | 'sessions' | 'progress' | 'health' | 'feeding';

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const ageYears = Math.floor(
    (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
  return ageYears >= 0 ? ageYears : null;
}
const genderText = (g: Horse['gender']) => (g === 'MALE' ? i18n.t("horse.genderMale") : g === 'FEMALE' ? i18n.t("horse.genderFemale") : null);

export function HorseDetailPage() {
  useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isVet = user?.role === 'VET';

  const [params, setParams] = useSearchParams();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [raceEntries, setRaceEntries] = useState<HorseRaceEntry[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [pedigreeVersion, setPedigreeVersion] = useState(0);

  const rawTab = params.get('tab');
  const tab: Tab =
    rawTab === 'pedigree' ||
    rawTab === 'plans' ||
    rawTab === 'sessions' ||
    rawTab === 'progress' ||
    rawTab === 'health' ||
    rawTab === 'feeding'
      ? rawTab
      : 'profile';

  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'profile') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  };

  // Mỗi tab chỉ fetch dữ liệu đúng 1 lần (lúc lần đầu được mở) — sau đó giữ
  // mounted, chỉ ẩn/hiện bằng CSS, để chuyển qua lại các tab không phải gọi
  // lại API mỗi lần.
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(() => new Set([tab]));
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);

  const loadHorse = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Horse>(`/horses/${id}`);
      setHorse(res.data);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadHorse();
    api.get<Paginated<HorseRaceEntry>>(`/horses/${id}/race-entries`, { params: { limit: 100 } })
      .then((r) => setRaceEntries(r.data.data))
      .catch(() => setRaceEntries([]));
  }, [id, loadHorse]);

  const handleToggleLock = async () => {
    if (!horse) return;
    const willLock = !horse.locked;
    const reason = willLock
      ? window.prompt(i18n.t("ui.enterATrainingLockReasonOptional")) ?? ''
      : '';
    try {
      await api.patch(`/horses/${horse.id}/lock`, {
        locked: willLock,
        ...(willLock && reason.trim() ? { reason: reason.trim() } : {}),
      });
      await loadHorse();
    } catch (e) {
      alert(i18n.t("ui.unableToUpdateTheTrainingLock") + String(e));
    }
  };

  usePageChrome({ crumbs: [[i18n.t("nav.horses"), '/horses'], horse?.name ?? '…'] });

  if (loading && !horse) {
    return <p className="cap">{i18n.t("ui.loadingHorseProfile")}</p>;
  }
  if (err && !horse) {
    return <ErrorText err={err} />;
  }
  if (!horse) return null;

  const finished = raceEntries.filter((e) => e.position != null);
  const starts = finished.length;
  const wins = finished.filter((e) => e.position === 1).length;
  const podiums = finished.filter((e) => e.position != null && e.position <= 3).length;
  const photo = getFileUrl(horse.photoUrl);
  const age = calculateAge(horse.birthDate);
  const facts = [horse.breed ?? i18n.t("ui.unknownBreed2"), genderText(horse.gender), age != null ? `${age} tuổi` : null].filter(Boolean).join(' · ');
  const tabCls = (on: boolean) => `inline-flex items-center h-11 px-3 -mb-px border-b-2 whitespace-nowrap text-[14px] no-underline transition-colors ${on ? 'text-info border-info font-medium' : 'text-muted border-transparent hover:text-ink'}`;

  return (
    <>
      <header className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="flex items-start gap-4 min-w-0 flex-[1_1_420px]">
          <HorseAvatar src={photo} name={horse.name} size={64} onClick={() => setPhotoViewerOpen(true)} />
          <div className="min-w-0">
            <nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-[13px] text-muted mb-0.5">
              <Link to="/horses" className="no-underline text-muted hover:text-ink">{i18n.t("nav.horses")}</Link>
              <Icon name="chevRight" className="w-3.5 h-3.5 nudge" />
            </nav>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.01em] truncate">{horse.name}</h1>
              <Cloth n={horse.saddleNumber} />
            </div>
            <p className="text-[14px] text-muted mt-0.5">{facts} · Chủ sở hữu <span className="text-ink">{horse.owner.name}</span></p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <CareerBadge status={horse.status} />
              <HealthBadge status={horse.healthStatus} />
              {horse.locked && <LockBadge />}
            </div>
          </div>
        </div>
        {(isVet || isManager) && (
          <div className="flex flex-wrap gap-2">
            {isVet && (
              <Btn v={horse.locked ? 'p' : 's'} onClick={() => void handleToggleLock()}>
                <Icon name={horse.locked ? 'unlock' : 'lock'} />{horse.locked ? i18n.t("ui.unlockTraining") : i18n.t("ui.trainingLocked2")}
              </Btn>
            )}
            {isManager && (
              <>
                <Btn onClick={() => setPhotoOpen(true)}><Icon name="camera" />{i18n.t("ui.changePhoto")}</Btn>
                <Btn onClick={() => setEditOpen(true)}><Icon name="edit" />{i18n.t("horseFlow.editHorse")}</Btn>
                <Btn v="d" aria-label={i18n.t("ui.deleteHorse")} title={i18n.t("ui.deleteHorse")} className="!px-2.5" onClick={() => setDeleteOpen(true)}><Icon name="trash" /></Btn>
              </>
            )}
          </div>
        )}
      </header>

      {horse.locked && (
        <Alert tone="bad" icon="lock" title="Ngựa đang bị khóa tập">
          {lockReasonText(horse.lockReason)}. Không thể xếp buổi tập mới cho đến khi bác sĩ thú y mở khóa.
        </Alert>
      )}

      <KpiStrip items={[
        {
          label: i18n.t("mergeUi.fitness"), lead: true,
          value: horse.fitnessScore != null ? <span style={{ color: fitColor(horse.fitnessScore) }}><CountUp value={horse.fitnessScore} /></span> : <span className="text-muted text-[16px] font-normal">{i18n.t("ui.notAssessed")}</span>,
          unit: horse.fitnessScore != null ? '/100' : undefined,
          sub: horse.fitnessScore == null ? undefined : horse.fitnessScore >= 80 ? 'Tốt (từ 80)' : horse.fitnessScore >= 60 ? 'Cần theo dõi (60–79)' : 'Thấp (dưới 60)',
        },
        { label: 'Số lần đua', value: starts, sub: starts > 0 ? `${wins} thắng · ${podiums} lần vào top 3` : i18n.t("races.resultPending") },
        { label: i18n.t("ui.saddleNumber"), value: horse.saddleNumber ?? <span className="text-muted text-[16px] font-normal">Chưa gán số</span> },
      ]} />

      <nav className="flex border-b border-line overflow-x-auto" aria-label="Mục hồ sơ">
        {TAB_ITEMS().map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={tabCls(tab === key)}>
            {label}
          </button>
        ))}
        <Link to={`/horses/${horse.id}/performance`} className={tabCls(false)}>{i18n.t("horseFlow.performanceTitle")}</Link>
        <Link to={`/horses/${horse.id}/ownership`} className={tabCls(false)}>{i18n.t("horseFlow.ownership")}</Link>
      </nav>

      {/* Tab Contents — mỗi tab chỉ mount sau khi đã ghé qua ít nhất 1 lần
          (visitedTabs), rồi giữ mounted luôn (ẩn bằng `hidden`) để tránh
          fetch lại API mỗi lần chuyển tab. */}
      {visitedTabs.has('profile') && (
        <Card hidden={tab !== 'profile'}>
          <h2 className="px-5 pt-4 pb-1 text-[15px] font-semibold">{i18n.t("ui.profileInformation")}</h2>
          <dl className="grid sm:grid-cols-[180px_1fr] m-0 px-5 pb-2">
            {([
              [i18n.t("ui.horseName"), horse.name],
              [i18n.t("horse.breed"), horse.breed ?? <span className="text-muted">{i18n.t("horse.genderUnknown")}</span>],
              [i18n.t("horse.gender"), genderText(horse.gender) ?? <span className="text-muted">{i18n.t("horse.genderUnknown")}</span>],
              [i18n.t("horse.birthDate"), horse.birthDate ? <>{formatDate(horse.birthDate)}{age != null && <span className="text-muted"> · {age} tuổi</span>}</> : <span className="text-muted">{i18n.t("horse.genderUnknown")}</span>],
              [i18n.t("ui.owner2"), <>{horse.owner.name} <span className="text-muted">· {horse.owner.email}</span></>],
              [i18n.t("mergeUi.racing"), <CareerBadge status={horse.status} />],
              [i18n.t("ui.health"), <HealthBadge status={horse.healthStatus} />],
              [i18n.t("mergeUi.fitness"), horse.fitnessScore != null ? <><span className="num">{horse.fitnessScore}</span><span className="text-muted"> / 100</span></> : <span className="text-muted">{i18n.t("ui.notAssessed")}</span>],
              [i18n.t("ui.saddleNumber"), horse.saddleNumber ?? <span className="text-muted">Chưa gán</span>],
              ['Mã hồ sơ', <span className="font-mono text-[12.5px] text-muted" title={horse.id}>{horse.id.slice(0, 8)}…</span>],
            ] as [string, ReactNode][]).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted pt-3 sm:pb-3 sm:border-b border-line-soft">{k}</dt>
                <dd className="m-0 pb-3 sm:pt-3 border-b border-line-soft">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {visitedTabs.has('pedigree') && (
        <div hidden={tab !== 'pedigree'}>
          <PedigreeTab key={horse.id + ':' + pedigreeVersion} horseId={horse.id} onUpdated={loadHorse} />
        </div>
      )}
      {visitedTabs.has('plans') && (
        <div hidden={tab !== 'plans'}><PlansTab horse={horse} /></div>
      )}
      {visitedTabs.has('sessions') && (
        <div hidden={tab !== 'sessions'}><SessionsTab horseId={horse.id} isLocked={horse.locked} lockReason={horse.lockReason} /></div>
      )}
      {visitedTabs.has('progress') && (
        <div hidden={tab !== 'progress'}><TrainingProgressTab horseId={horse.id} /></div>
      )}
      {visitedTabs.has('health') && (
        <div hidden={tab !== 'health'}><HealthTab key={horse.id} horse={horse} onHorseChanged={loadHorse} /></div>
      )}
      {visitedTabs.has('feeding') && (
        <div hidden={tab !== 'feeding'}><FeedingTab horse={horse} /></div>
      )}

      <EditHorseModal
        horse={horse}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={async () => {
          await loadHorse();
          setPedigreeVersion((version) => version + 1);
        }}
      />
      <DeleteHorseModal horse={horse} isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={() => navigate('/horses')} />
      <PhotoUploadModal horse={horse} isOpen={photoOpen} onClose={() => setPhotoOpen(false)} onUploaded={loadHorse} />
      {photo && <ImageLightbox src={photo} alt={horse.name} open={photoViewerOpen} onClose={() => setPhotoViewerOpen(false)} />}
    </>
  );
}

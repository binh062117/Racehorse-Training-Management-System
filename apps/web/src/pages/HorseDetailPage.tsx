import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Alert, Btn, Card, CountUp, Cloth, HealthBadge, CareerBadge, HorseAvatar, Icon, ImageLightbox, KpiStrip, LockBadge,
  fitColor, lockReasonText,
} from '../ds/ui';

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

export function HorseDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  const tabItems: [Tab, string][] = [
    ['profile', t('horseDetail.tabs.profile', 'Hồ sơ chi tiết')],
    ['pedigree', t('horseDetail.tabs.pedigree', 'Phả hệ')],
    ['plans', t('horseDetail.tabs.plans', 'Giáo án huấn luyện')],
    ['sessions', t('horseDetail.tabs.sessions', 'Buổi tập luyện')],
    ['progress', t('horseDetail.tabs.progress', 'Tiến độ huấn luyện')],
    ['health', t('horseDetail.tabs.health', 'Hồ sơ y tế')],
    ['feeding', t('horseDetail.tabs.feeding', 'Khẩu phần ăn')],
  ];

  const genderText = (g: Horse['gender']) => (
    g === 'MALE' ? t('horsesPage.genderMale', 'Đực') : g === 'FEMALE' ? t('horsesPage.genderFemale', 'Cái') : null
  );

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
    const promptText = willLock
      ? (t('horsesPage.lockPrompt', 'Nhập lý do khóa tập luyện (tuỳ chọn):'))
      : '';
    const reason = willLock ? window.prompt(promptText) ?? '' : '';
    try {
      await api.patch(`/horses/${horse.id}/lock`, {
        locked: willLock,
        ...(willLock && reason.trim() ? { reason: reason.trim() } : {}),
      });
      await loadHorse();
    } catch (e) {
      alert(t('horsesPage.lockUpdateFailed', 'Không thể cập nhật trạng thái khóa tập luyện: ') + String(e));
    }
  };

  usePageChrome({ crumbs: [[t('horsesPage.title', 'Ngựa đua'), '/horses'], horse?.name ?? '…'] });

  if (loading && !horse) {
    return <p className="cap">{t('horsesPage.loading', 'Đang tải thông tin hồ sơ ngựa…')}</p>;
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
  const facts = [
    horse.breed ?? t('horseFlow.breedNotSet', 'Chưa rõ giống'),
    genderText(horse.gender),
    age != null ? t('horsesPage.age', { age }) : null,
  ].filter(Boolean).join(' · ');

  const tabCls = (on: boolean) =>
    `inline-flex items-center h-11 px-3 -mb-px border-b-2 whitespace-nowrap text-[14px] no-underline transition-colors ${
      on ? 'text-info border-info font-medium' : 'text-muted border-transparent hover:text-ink'
    }`;

  return (
    <>
      <header className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="flex items-start gap-4 min-w-0 flex-[1_1_420px]">
          <HorseAvatar src={photo} name={horse.name} size={64} onClick={() => setPhotoViewerOpen(true)} />
          <div className="min-w-0">
            <nav aria-label={t('nav.menu', 'Đường dẫn')} className="flex items-center gap-1.5 text-[13px] text-muted mb-0.5">
              <Link to="/horses" className="no-underline text-muted hover:text-ink">{t('horsesPage.title', 'Ngựa đua')}</Link>
              <Icon name="chevRight" className="w-3.5 h-3.5 nudge" />
            </nav>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.01em] truncate">{horse.name}</h1>
              <Cloth n={horse.saddleNumber} />
            </div>
            <p className="text-[14px] text-muted mt-0.5">
              {facts} · {t('horsesPage.thOwner', 'Chủ sở hữu')} <span className="text-ink">{horse.owner.name}</span>
            </p>
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
                <Icon name={horse.locked ? 'unlock' : 'lock'} />
                {horse.locked ? t('horseFlow.unlocked', 'Mở khóa tập') : t('horseFlow.locked', 'Khóa tập')}
              </Btn>
            )}
            {isManager && (
              <>
                <Btn onClick={() => setPhotoOpen(true)}><Icon name="camera" />{t('horseDetail.uploadPhoto', 'Đổi ảnh')}</Btn>
                <Btn onClick={() => setEditOpen(true)}><Icon name="edit" />{t('horseDetail.edit', 'Sửa hồ sơ')}</Btn>
                <Btn v="d" aria-label={t('horseDetail.delete', 'Xóa ngựa')} title={t('horseDetail.delete', 'Xóa ngựa')} className="!px-2.5" onClick={() => setDeleteOpen(true)}><Icon name="trash" /></Btn>
              </>
            )}
          </div>
        )}
      </header>

      {horse.locked && (
        <Alert tone="bad" icon="lock" title={t('horseDetail.lockedWarning', 'Ngựa đang bị khóa tập')}>
          {lockReasonText(horse.lockReason)}. {t('horsesPage.lockBannerDesc', 'Không thể xếp buổi tập mới cho đến khi bác sĩ thú y mở khóa.')}
        </Alert>
      )}

      <KpiStrip items={[
        {
          label: t('horsesPage.thFitness', 'Thể lực'),
          lead: true,
          value: horse.fitnessScore != null ? <span style={{ color: fitColor(horse.fitnessScore) }}><CountUp value={horse.fitnessScore} /></span> : <span className="text-muted text-[16px] font-normal">—</span>,
          unit: horse.fitnessScore != null ? '/100' : undefined,
          sub: horse.fitnessScore == null ? undefined : horse.fitnessScore >= 80 ? 'Tốt (≥80)' : horse.fitnessScore >= 60 ? 'Cần theo dõi (60–79)' : 'Thấp (<60)',
        },
        {
          label: t('horseDetail.racesStarted', 'Số lần đua'),
          value: starts,
          sub: starts > 0 ? `${wins} ${t('horseFlow.wins', 'thắng')} · ${podiums} ${t('horseFlow.podiums', 'vào top 3')}` : '—',
        },
        {
          label: t('horseFlow.saddleNumber', 'Số áo đua'),
          value: horse.saddleNumber ?? <span className="text-muted text-[16px] font-normal">—</span>,
        },
      ]} />

      <nav className="flex border-b border-line overflow-x-auto" aria-label={t('horseFlow.recordSections', 'Mục hồ sơ')}>
        {tabItems.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={tabCls(tab === key)}>
            {label}
          </button>
        ))}
        <Link to={`/horses/${horse.id}/performance`} className={tabCls(false)}>{t('horseFlow.performance', 'Thành tích')}</Link>
        <Link to={`/horses/${horse.id}/ownership`} className={tabCls(false)}>{t('horseFlow.ownership', 'Quyền sở hữu')}</Link>
      </nav>

      {visitedTabs.has('profile') && (
        <Card hidden={tab !== 'profile'}>
          <h2 className="px-5 pt-4 pb-1 text-[15px] font-semibold">{t('horseDetail.details', 'Thông tin lý lịch')}</h2>
          <dl className="grid sm:grid-cols-[180px_1fr] m-0 px-5 pb-2">
            {([
              [t('horse.name', 'Tên ngựa'), horse.name],
              [t('horse.breed', 'Giống'), horse.breed ?? <span className="text-muted">—</span>],
              [t('horse.gender', 'Giới tính'), genderText(horse.gender) ?? <span className="text-muted">—</span>],
              [t('horse.birthDate', 'Ngày sinh'), horse.birthDate ? <>{formatDate(horse.birthDate)}{age != null && <span className="text-muted"> · {t('horsesPage.age', { age })}</span>}</> : <span className="text-muted">—</span>],
              [t('horse.owner', 'Chủ sở hữu'), <>{horse.owner.name} <span className="text-muted">· {horse.owner.email}</span></>],
              [t('horsesPage.thRacing', 'Thi đấu'), <CareerBadge status={horse.status} />],
              [t('horsesPage.thHealth', 'Sức khỏe'), <HealthBadge status={horse.healthStatus} />],
              [t('horsesPage.thFitness', 'Thể lực'), horse.fitnessScore != null ? <><span className="num">{horse.fitnessScore}</span><span className="text-muted"> / 100</span></> : <span className="text-muted">—</span>],
              [t('horseFlow.saddleNumber', 'Số áo đua'), horse.saddleNumber ?? <span className="text-muted">—</span>],
              [t('horseDetail.code', 'Mã hồ sơ'), <span className="font-mono text-[12.5px] text-muted" title={horse.id}>{horse.id.slice(0, 8)}…</span>],
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
        <div hidden={tab !== 'health'}><HealthTab horse={horse} /></div>
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

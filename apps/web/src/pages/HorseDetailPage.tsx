import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, getFileUrl } from '../lib/api';
import type { Horse, HorseRaceEntry, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { SessionsTab } from './horse/SessionsTab';
import { HealthTab } from './horse/HealthTab';
import { FeedingTab } from './horse/FeedingTab';
import { PlansTab } from './horse/PlansTab';
import { EditHorseModal } from '../components/horse/EditHorseModal';
import { DeleteHorseModal } from '../components/horse/DeleteHorseModal';
import { PhotoUploadModal } from '../components/horse/PhotoUploadModal';
import { PedigreeTab } from './horse/PedigreeTab';
import { HorseRecordNav } from './horse/HorseRecordNav';
import { usePageChrome } from '../ds/AppShell';
import {
  Badge, Btn, Card, Cloth, HeroStats, Icon, LockBadge, Silk,
  careerTone, healthTone,
} from '../ds/ui';

const TAB_ITEMS: [Tab, string][] = [
  ['profile', 'Hồ sơ chi tiết'],
  ['pedigree', 'Phả hệ'],
  ['plans', 'Giáo án huấn luyện'],
  ['sessions', 'Buổi tập luyện'],
  ['health', 'Hồ sơ y tế'],
  ['feeding', 'Khẩu phần ăn'],
];

type Tab = 'profile' | 'pedigree' | 'plans' | 'sessions' | 'health' | 'feeding';

function calculateAge(birthDate: string | null): string {
  if (!birthDate) return '—';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '—';
  const ageYears = Math.floor(
    (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
  return ageYears >= 0 ? `${ageYears} tuổi` : '—';
}

export function HorseDetailPage() {
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
  const [pedigreeVersion, setPedigreeVersion] = useState(0);

  const rawTab = params.get('tab');
  const tab: Tab =
    rawTab === 'pedigree' ||
    rawTab === 'plans' ||
    rawTab === 'sessions' ||
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
      ? window.prompt('Nhập lý do khóa tập luyện (tuỳ chọn):') ?? ''
      : '';
    try {
      await api.patch(`/horses/${horse.id}/lock`, {
        locked: willLock,
        ...(willLock && reason.trim() ? { reason: reason.trim() } : {}),
      });
      await loadHorse();
    } catch (e) {
      alert('Không thể cập nhật trạng thái khóa tập luyện: ' + String(e));
    }
  };

  usePageChrome({ crumbs: [['Ngựa đua', '/horses'], horse?.name ?? '…'] });

  if (loading && !horse) {
    return <p className="cap">Đang tải thông tin hồ sơ ngựa…</p>;
  }
  if (err && !horse) {
    return <ErrorText err={err} />;
  }
  if (!horse) return null;

  const finished = raceEntries.filter((e) => e.position != null);
  const starts = finished.length;
  const wins = finished.filter((e) => e.position === 1).length;
  const photo = getFileUrl(horse.photoUrl);

  return (
    <>
      <section className="hero">
        <div className="flex flex-wrap gap-7 px-8 pt-[30px] pb-[26px] items-stretch">
          <div className="flex-[2_1_520px] min-w-0 flex flex-col gap-4">
            <div className="flex gap-4 items-center">
              {photo ? (
                <img src={photo} alt={horse.name} className="w-[50px] h-[50px] rounded-full object-cover border-2 border-white/20" />
              ) : (
                <Cloth n={horse.saddleNumber ?? '—'} inv lg />
              )}
              <Silk owner={horse.owner.id} size={64} />
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={careerTone[horse.status]}>{horse.status}</Badge>
                <Badge tone={healthTone[horse.healthStatus]}>{horse.healthStatus}</Badge>
                {horse.locked && <LockBadge>Khóa tập luyện</LockBadge>}
              </div>
            </div>
            <div>
              <h1 className="disp text-[64px] sm:text-[84px]">{horse.name}</h1>
              <p className="mt-2.5 text-hero-line text-sm">
                {horse.breed ?? 'Chưa rõ giống'} · {horse.gender === 'MALE' ? 'Đực' : horse.gender === 'FEMALE' ? 'Cái' : 'Chưa rõ giới tính'} · {calculateAge(horse.birthDate)}
              </p>
              <p className="cap num mt-1">Chủ sở hữu {horse.owner.name} ({horse.owner.email})</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-auto">
              {isVet && (
                <Btn v={horse.locked ? 'ghostDark' : 'light'} onClick={() => void handleToggleLock()}>
                  <Icon name={horse.locked ? 'unlock' : 'lock'} />{horse.locked ? 'Mở khóa tập' : 'Khóa tập luyện'}
                </Btn>
              )}
              {isManager && (
                <>
                  <Btn v="ghostDark" onClick={() => setPhotoOpen(true)}><Icon name="camera" />Đổi ảnh</Btn>
                  <Btn v="ghostDark" onClick={() => setEditOpen(true)}><Icon name="edit" />Sửa hồ sơ</Btn>
                  <Btn v="ghostDark" aria-label="Xóa ngựa" className="!text-bad-on !px-3" onClick={() => setDeleteOpen(true)}><Icon name="trash" /></Btn>
                </>
              )}
            </div>
          </div>
          {horse.locked && (
            <div className="flex-[1_1_280px] min-w-0 rounded-xl bg-white/[.06] border border-white/[.12] p-5 flex flex-col gap-2.5 text-bad-on">
              <span className="lbl !text-bad-on">Training Lock</span>
              <Icon name="lock" className="w-10 h-10" />
              <div className="cap">{horse.lockReason || 'Chưa có lý do cụ thể'}. Không thể xếp lịch tập mới cho đến khi bác sĩ thú y mở khóa.</div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-y-5 items-end px-8 pt-5 pb-6 border-t border-white/10 bg-black/[.12]">
          <HeroStats items={[
            { label: 'Fitness', value: horse.fitnessScore ?? '—', small: horse.fitnessScore != null ? '/ 100' : undefined, color: '#9fd9b1' },
            { label: 'Lần đua', value: starts, small: `${wins} thắng` },
            { label: 'Số áo đua', value: horse.saddleNumber ?? '—' },
          ]} />
        </div>
      </section>

      <HorseRecordNav horseId={horse.id} />

      <nav className="flex gap-1 border-b border-line overflow-x-auto" aria-label="Mục">
        {TAB_ITEMS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 h-10 px-3.5 -mb-px border-b-2 whitespace-nowrap ${tab === key ? 'text-info border-info font-semibold' : 'text-muted border-transparent font-medium hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tab Contents — mỗi tab chỉ mount sau khi đã ghé qua ít nhất 1 lần
          (visitedTabs), rồi giữ mounted luôn (ẩn bằng `hidden`) để tránh
          fetch lại API mỗi lần chuyển tab. */}
      {visitedTabs.has('profile') && (
        <Card className="p-5" hidden={tab !== 'profile'}>
          <h2 className="text-[15px] font-semibold mb-3">Thông tin lý lịch</h2>
          <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-2.5 m-0 text-[13px]">
            <dt className="text-muted">Tên ngựa</dt><dd className="m-0">{horse.name}</dd>
            <dt className="text-muted">Giới tính</dt><dd className="m-0">{horse.gender === 'MALE' ? 'Đực' : horse.gender === 'FEMALE' ? 'Cái' : 'Chưa xác định'}</dd>
            <dt className="text-muted">Giống loài</dt><dd className="m-0">{horse.breed ?? '—'}</dd>
            <dt className="text-muted">Ngày sinh</dt><dd className="m-0">{formatDate(horse.birthDate)} ({calculateAge(horse.birthDate)})</dd>
            <dt className="text-muted">Chủ sở hữu</dt><dd className="m-0">{horse.owner.name} ({horse.owner.email})</dd>
            <dt className="text-muted">Trạng thái thi đấu</dt><dd className="m-0"><Badge tone={careerTone[horse.status]}>{horse.status}</Badge></dd>
            <dt className="text-muted">Tình trạng y tế</dt><dd className="m-0"><Badge tone={healthTone[horse.healthStatus]}>{horse.healthStatus}</Badge></dd>
            <dt className="text-muted">Điểm thể trạng</dt><dd className="m-0">{horse.fitnessScore != null ? `${horse.fitnessScore} / 100` : 'Chưa đánh giá'}</dd>
            <dt className="text-muted">Số áo đua</dt><dd className="m-0">{horse.saddleNumber ?? '—'}</dd>
            <dt className="text-muted">Mã hồ sơ hệ thống</dt><dd className="m-0 font-mono text-xs">{horse.id}</dd>
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
    </>
  );
}

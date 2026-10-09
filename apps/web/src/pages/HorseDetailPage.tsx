import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, getFileUrl } from '../lib/api';
import type { Horse } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { SessionsTab } from './horse/SessionsTab';
import { HealthTab } from './horse/HealthTab';
import { PlansTab } from './horse/PlansTab';
import { HorseStatusBadge } from '../components/horse/HorseStatusBadge';
import { EditHorseModal } from '../components/horse/EditHorseModal';
import { DeleteHorseModal } from '../components/horse/DeleteHorseModal';
import { PhotoUploadModal } from '../components/horse/PhotoUploadModal';
import { CameraIcon, LockIcon, UnlockIcon, EditIcon, TrashIcon } from '../components/Icons';
import { PedigreeTab } from './horse/PedigreeTab';

type Tab = 'profile' | 'pedigree' | 'plans' | 'sessions' | 'health';

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
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isVet = user?.role === 'VET';

  const [params, setParams] = useSearchParams();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [pedigreeVersion, setPedigreeVersion] = useState(0);

  const rawTab = params.get('tab');
  const tab: Tab =
    rawTab === 'pedigree' ||
    rawTab === 'plans' ||
    rawTab === 'sessions' ||
    rawTab === 'health'
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
  }, [loadHorse]);

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

  if (loading && !horse) {
    return <p className="muted">Đang tải thông tin hồ sơ ngựa…</p>;
  }

  if (err && !horse) {
    return (
      <div className="stack">
        <p>
          <Link to="/horses">← Danh sách ngựa</Link>
        </p>
        <ErrorText err={err} />
      </div>
    );
  }

  if (!horse) return null;

  return (
    <div className="stack">
      <div>
        <Link to="/horses" style={{ fontWeight: 600, fontSize: '13px', color: 'var(--brand-blue)' }}>
          ← Quay lại danh sách ngựa
        </Link>
      </div>

      {/* Hero Header Card */}
      <div className="card">
        <div className="detail-hero" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Avatar with Upload button for Manager */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div className="avatar avatar-lg">
              {horse.photoUrl ? (
                <img src={getFileUrl(horse.photoUrl) ?? undefined} alt={horse.name} />
              ) : (
                horse.name.slice(0, 1).toUpperCase()
              )}
            </div>
            {isManager && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => setPhotoOpen(true)}
              >
                <CameraIcon /> Đổi ảnh
              </button>
            )}
          </div>

          {/* Horse Main Info */}
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0 }}>{horse.name}</h1>
              <HorseStatusBadge
                status={horse.status}
                healthStatus={horse.healthStatus}
                locked={horse.locked}
              />
            </div>

            <p className="muted" style={{ margin: '6px 0 12px', fontSize: '13.5px' }}>
              {horse.breed ?? 'Chưa rõ giống'} ·{' '}
              {horse.gender === 'MALE' ? 'Giới tính: Đực' : horse.gender === 'FEMALE' ? 'Giới tính: Cái' : 'Chưa rõ giới tính'} ·{' '}
              {calculateAge(horse.birthDate)} · Chủ sở hữu:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{horse.owner.name}</strong>
            </p>

            <div className="row">
              {horse.fitnessScore != null ? (
                <span className="badge badge-neutral" style={{ padding: '4px 10px', fontSize: '12px' }}>
                  Điểm thể trạng: <strong>{horse.fitnessScore} / 100</strong>
                </span>
              ) : (
                <span className="badge badge-neutral" style={{ padding: '4px 10px', fontSize: '12px' }}>
                  Thể trạng: Chưa đánh giá
                </span>
              )}
            </div>
          </div>

          {/* Top Actions */}
          <div className="row" style={{ marginLeft: 'auto', gap: '8px' }}>
            {isVet && (
              <button
                type="button"
                className={`btn btn-sm ${horse.locked ? 'btn-ghost' : 'btn-danger'}`}
                onClick={handleToggleLock}
              >
                {horse.locked ? (
                  <>
                    <UnlockIcon /> Mở khóa tập
                  </>
                ) : (
                  <>
                    <LockIcon /> Khóa tập luyện
                  </>
                )}
              </button>
            )}
            {isManager && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setEditOpen(true)}
                >
                  <EditIcon /> Sửa hồ sơ
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={{ color: 'var(--status-danger)' }}
                  onClick={() => setDeleteOpen(true)}
                >
                  <TrashIcon /> Xóa
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lock Warning Banner */}
      {horse.locked && (
        <div className="lock-banner">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <LockIcon width="20" height="20" />
          </div>
          <div>
            <strong>Ngựa đang bị khóa tập luyện</strong>
            {horse.lockReason ? `: ${horse.lockReason}` : ''}
            <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
              Huấn luyện viên không thể tạo buổi tập mới cho đến khi bác sĩ thú y mở khóa.
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tabs">
        <button
          type="button"
          className={tab === 'profile' ? 'tab active' : 'tab'}
          onClick={() => setTab('profile')}
        >
          Hồ sơ chi tiết
        </button>
        <button
          type="button"
          className={tab === 'pedigree' ? 'tab active' : 'tab'}
          onClick={() => setTab('pedigree')}
        >
          {t('tab.pedigree')}
        </button>
        <button
          type="button"
          className={tab === 'plans' ? 'tab active' : 'tab'}
          onClick={() => setTab('plans')}
        >
          Giáo án huấn luyện
        </button>
        <button
          type="button"
          className={tab === 'sessions' ? 'tab active' : 'tab'}
          onClick={() => setTab('sessions')}
        >
          Buổi tập luyện
        </button>
        <button
          type="button"
          className={tab === 'health' ? 'tab active' : 'tab'}
          onClick={() => setTab('health')}
        >
          Hồ sơ y tế
        </button>
      </div>

      {/* Tab Contents — mỗi tab chỉ mount sau khi đã ghé qua ít nhất 1 lần
          (visitedTabs), rồi giữ mounted luôn (ẩn bằng `hidden`) để tránh
          fetch lại API mỗi lần chuyển tab. */}
      {visitedTabs.has('profile') && (
        <div className="card" hidden={tab !== 'profile'}>
          <h2>Thông tin lý lịch</h2>
          <dl className="kv">
            <div>
              <dt>Tên ngựa</dt>
              <dd>{horse.name}</dd>
            </div>
            <div>
              <dt>Giới tính</dt>
              <dd>
                {horse.gender === 'MALE' ? 'Đực' : horse.gender === 'FEMALE' ? 'Cái' : 'Chưa xác định'}
              </dd>
            </div>
            <div>
              <dt>Giống loài</dt>
              <dd>{horse.breed ?? '—'}</dd>
            </div>
            <div>
              <dt>Ngày sinh</dt>
              <dd>{formatDate(horse.birthDate)} ({calculateAge(horse.birthDate)})</dd>
            </div>
            <div>
              <dt>Chủ sở hữu</dt>
              <dd>{horse.owner.name} ({horse.owner.email})</dd>
            </div>
            <div>
              <dt>Trạng thái thi đấu</dt>
              <dd>
                <HorseStatusBadge status={horse.status} />
              </dd>
            </div>
            <div>
              <dt>Tình trạng y tế</dt>
              <dd>
                <HorseStatusBadge healthStatus={horse.healthStatus} locked={horse.locked} />
              </dd>
            </div>
            <div>
              <dt>Điểm thể trạng</dt>
              <dd>{horse.fitnessScore != null ? `${horse.fitnessScore} / 100` : 'Chưa đánh giá'}</dd>
            </div>
            <div>
              <dt>Mã hồ sơ hệ thống</dt>
              <dd style={{ fontFamily: 'monospace', fontSize: '12px' }}>{horse.id}</dd>
            </div>
          </dl>
        </div>
      )}

      {visitedTabs.has('pedigree') && (
        <div hidden={tab !== 'pedigree'}>
          <PedigreeTab
            key={horse.id + ':' + pedigreeVersion}
            horseId={horse.id}
            onUpdated={loadHorse}
          />
        </div>
      )}
      {visitedTabs.has('plans') && (
        <div hidden={tab !== 'plans'}>
          <PlansTab horse={horse} />
        </div>
      )}
      {visitedTabs.has('sessions') && (
        <div hidden={tab !== 'sessions'}>
          <SessionsTab
            horseId={horse.id}
            isLocked={horse.locked}
            lockReason={horse.lockReason}
          />
        </div>
      )}
      {visitedTabs.has('health') && (
        <div hidden={tab !== 'health'}>
          <HealthTab horse={horse} />
        </div>
      )}

      {/* Modals */}
      <EditHorseModal
        horse={horse}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={async () => {
          await loadHorse();
          setPedigreeVersion((version) => version + 1);
        }}
      />

      <DeleteHorseModal
        horse={horse}
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate('/horses')}
      />

      <PhotoUploadModal
        horse={horse}
        isOpen={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onUploaded={loadHorse}
      />
    </div>
  );
}

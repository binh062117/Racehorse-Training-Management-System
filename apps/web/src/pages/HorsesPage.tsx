import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, HorseStatus, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { HorseStatusBadge } from '../components/horse/HorseStatusBadge';
import { HorseMetricCards } from '../components/horse/HorseMetricCards';
import { CreateHorseModal } from '../components/horse/CreateHorseModal';
import { EditHorseModal } from '../components/horse/EditHorseModal';
import { DeleteHorseModal } from '../components/horse/DeleteHorseModal';
import { PlusIcon, EditIcon, TrashIcon } from '../components/Icons';

function calculateAge(birthDate: string | null): string {
  if (!birthDate) return '—';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '—';
  const ageYears = Math.floor(
    (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
  return ageYears >= 0 ? `${ageYears} tuổi` : '—';
}

export function HorsesPage({ personal = false }: { personal?: boolean }) {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isOwner = user?.role === 'OWNER';

  // Filters & Search
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | HorseStatus>('ALL');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Modal States
  const [createOpen, setCreateOpen] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);
  const [deletingHorse, setDeletingHorse] = useState<Horse | null>(null); 

  const queryParams = {
    limit: 100,
    ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(personal && isOwner && user?.id ? { ownerId: user.id } : {}),
  };
  const cacheKey = `horses:${JSON.stringify(queryParams)}`;
  const {
    data,
    loading,
    error: loadErr,
    reload: load,
  } = useCachedResource(cacheKey, () =>
    api
      .get<Paginated<Horse>>('/horses', { params: queryParams })
      .then((r) => r.data),
  );
  const horses = data?.data ?? [];

  return (
    <div className="stack">
      <div>
        <h1>Hồ sơ Ngựa đua</h1>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
          Quản lý toàn bộ hồ sơ ngựa, theo dõi phả hệ, thể trạng và trạng thái hoạt động trong câu lạc bộ.
        </p>
      </div>

      {/* KPI / Metric Summary Cards */}
      <HorseMetricCards horses={horses} />

      {/* Toolbar: Search, Filter Chips, Action Button */}
      <div className="toolbar">
        <input
          className="search-input"
          type="text"
          placeholder="Tìm theo tên ngựa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="chip-row">
          <button
            type="button"
            className={`chip ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`chip ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Đang thi đấu (ACTIVE)
          </button>
          <button
            type="button"
            className={`chip ${statusFilter === 'RESTING' ? 'active' : ''}`}
            onClick={() => setStatusFilter('RESTING')}
          >
            Nghỉ dưỡng (RESTING)
          </button>
          <button
            type="button"
            className={`chip ${statusFilter === 'RETIRED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('RETIRED')}
          >
            Giải nghệ (RETIRED)
          </button>
        </div>

        {isManager && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon /> Thêm ngựa mới
          </button>
        )}
      </div>

      {/* Main Table / Roster */}
      {loading && horses.length === 0 ? (
        <p className="muted">Đang tải danh sách ngựa…</p>
      ) : loadErr ? (
        <ErrorText err={loadErr} />
      ) : horses.length === 0 ? (
        <div className="card center" style={{ padding: '40px 20px' }}>
          <p className="muted" style={{ margin: 0, fontSize: '14px' }}>
            Không tìm thấy hồ sơ ngựa nào phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ngựa &amp; Giống</th>
                <th>Giới tính</th>
                <th>Tuổi &amp; Ngày sinh</th>
                <th>Chủ sở hữu</th>
                <th>Thể trạng</th>
                <th>Trạng thái</th>
                {isManager && <th style={{ textAlign: 'right' }}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {horses.map((h) => (
                <tr key={h.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar">
                        {h.photoUrl ? (
                          <img src={h.photoUrl} alt={h.name} />
                        ) : (
                          h.name.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div>
                        <Link
                          to={`/horses/${h.id}`}
                          style={{ fontWeight: 600, fontSize: '14px', color: 'var(--brand-navy)' }}
                        >
                          {h.name}
                        </Link>
                        <div className="muted" style={{ fontSize: '12px' }}>
                          {h.breed ?? 'Chưa rõ giống'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {h.gender === 'MALE' ? (
                      <span className="badge badge-neutral">Đực</span>
                    ) : h.gender === 'FEMALE' ? (
                      <span className="badge badge-neutral">Cái</span>
                    ) : (
                      <span className="muted" style={{ fontSize: '12px' }}>Chưa rõ</span>
                    )}
                  </td>
                  <td>
                    <div>{calculateAge(h.birthDate)}</div>
                    <div className="muted" style={{ fontSize: '12px' }}>
                      {formatDate(h.birthDate)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{h.owner.name}</div>
                    <div className="muted" style={{ fontSize: '12px' }}>
                      {h.owner.email}
                    </div>
                  </td>
                  <td>
                    {h.fitnessScore != null ? (
                      <div style={{ fontWeight: 600 }}>{h.fitnessScore} / 100</div>
                    ) : (
                      <span className="muted" style={{ fontSize: '12px' }}>Chưa đánh giá</span>
                    )}
                  </td>
                  <td>
                    <HorseStatusBadge
                      status={h.status}
                      healthStatus={h.healthStatus}
                      locked={h.locked}
                    />
                  </td>
                  {isManager && (
                    <td style={{ textAlign: 'right' }}>
                      <div className="row" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setEditingHorse(h)}
                        >
                          <EditIcon /> Sửa
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          style={{ color: 'var(--status-danger)' }}
                          onClick={() => setDeletingHorse(h)}
                        >
                          <TrashIcon /> Xóa
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CreateHorseModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />

      <EditHorseModal
        horse={editingHorse}
        isOpen={editingHorse !== null}
        onClose={() => setEditingHorse(null)}
        onUpdated={load}
      />

      <DeleteHorseModal
        horse={deletingHorse}
        isOpen={deletingHorse !== null}
        onClose={() => setDeletingHorse(null)}
        onDeleted={load}
      />
    </div>
  );
}

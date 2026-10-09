import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { HealthRecord, HealthStatus, Horse, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { CreateHealthRecordModal } from '../components/health/CreateHealthRecordModal';
import { PlusIcon, SearchIcon } from '../components/Icons';
import { formatDate } from '../lib/format';

/* ---------- Health status helpers ---------- */
const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  FIT: 'Khỏe mạnh',
  MONITORING: 'Cần theo dõi',
  INJURED: 'Chấn thương',
  QUARANTINED: 'Cách ly',
};

const HEALTH_STATUS_CSS: Record<HealthStatus, string> = {
  FIT: 'badge-success',
  MONITORING: 'badge-warning',
  INJURED: 'badge-danger',
  QUARANTINED: 'badge-danger',
};

export function HealthRecordsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isVet = user?.role === 'VET';

  const [horses, setHorses] = useState<Horse[]>([]);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);

  /* Modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedHorseId, setSelectedHorseId] = useState('');
  const [selectedHorseName, setSelectedHorseName] = useState('');

  /* Filter state */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<HealthStatus | 'ALL'>('ALL');

  /* Load all horses for the VET overview */
  const loadHorses = useCallback(async () => {
    try {
      const res = await api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } });
      setHorses(res.data.data ?? []);
    } catch (e) {
      setErr(e);
    }
  }, []);

  /* Load recent health records for all horses */
  const loadRecords = useCallback(async (horseList: Horse[]) => {
    try {
      const allRecords: HealthRecord[] = [];
      // Fetch recent records for each horse (max 5 per horse)
      const promises = horseList.slice(0, 50).map(async (h) => {
        try {
          const res = await api.get<Paginated<HealthRecord>>(
            `/horses/${h.id}/health-records`,
            { params: { limit: 5 } },
          );
          return res.data.data;
        } catch {
          return [];
        }
      });
      const results = await Promise.all(promises);
      for (const r of results) allRecords.push(...r);
      // Sort by examDate desc
      allRecords.sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
      setRecords(allRecords);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadHorses();
    })();
  }, [loadHorses]);

  useEffect(() => {
    if (horses.length > 0) {
      void loadRecords(horses);
    } else {
      setLoading(false);
    }
  }, [horses, loadRecords]);

  /* Derived: health status counts */
  const healthCounts = horses.reduce(
    (acc, h) => {
      acc[h.healthStatus] = (acc[h.healthStatus] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const lockedCount = horses.filter((h) => h.locked).length;

  /* Derived: filtered horses for the status overview */
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
    <div className="stack">
      {/* Page header */}
      <div className="panel">
        <p className="eyebrow">HỒ SƠ Y TẾ</p>
        <h1 style={{ margin: '4px 0 0' }}>Quản lý Hồ sơ Khám bệnh</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Tổng quan sức khỏe toàn đàn ngựa. Ghi nhận kết quả khám, chẩn đoán và cập nhật trạng thái y tế.
        </p>
      </div>

      {/* KPI summary cards */}
      <div className="kpi-grid">
        <div className="kpi-tile">
          <span className="kpi-label">Tổng đàn ngựa|</span>
          <span className="kpi-value">{horses.length}</span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">Khỏe mạnh|</span>
          <span className="kpi-value" style={{ color: 'var(--success)' }}>
            {healthCounts['FIT'] ?? 0}
          </span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">Cần theo dõi|</span>
          <span className="kpi-value" style={{ color: 'var(--warning)' }}>
            {healthCounts['MONITORING'] ?? 0}
          </span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">Chấn thương / Cách ly|</span>
          <span className="kpi-value" style={{ color: 'var(--danger)' }}>
            {(healthCounts['INJURED'] ?? 0) + (healthCounts['QUARANTINED'] ?? 0)}
          </span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">Khóa tập|</span>
          <span className="kpi-value" style={{ color: 'var(--danger)' }}>
            {lockedCount}
          </span>
        </div>
      </div>

      {/* Toolbar: search + filter + create button */}
      <div className="toolbar">
        <div className="row" style={{ gap: 10, flex: 1 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <SearchIcon
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              className="input search-input"
              placeholder="Tìm theo tên ngựa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as HealthStatus | 'ALL')}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="FIT">Khỏe mạnh</option>
            <option value="MONITORING">Cần theo dõi</option>
            <option value="INJURED">Chấn thương</option>
            <option value="QUARANTINED">Cách ly</option>
          </select>
        </div>
      </div>

      <ErrorText err={err} />

      {loading ? (
        <p className="muted">Đang tải dữ liệu...</p>
      ) : (
        <div className="two-col" style={{ gap: 24, alignItems: 'flex-start' }}>
          {/* Left: Horse health status list */}
          <div>
            <h3 style={{ margin: '0 0 12px' }}>
              Sơ đồ trạng thái sức khỏe ({filteredHorses.length} ngựa)
            </h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Chiến mã</th>
                    <th>Giới tính</th>
                    <th>Giống</th>
                    <th>Trạng thái Y tế</th>
                    <th>Khóa tập</th>
                    {isVet && <th>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredHorses.length === 0 ? (
                    <tr>
                      <td colSpan={isVet ? 6 : 5} style={{ textAlign: 'center' }}>
                        <span className="muted">Không tìm thấy ngựa phù hợp</span>
                      </td>
                    </tr>
                  ) : (
                    filteredHorses.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => navigate(`/horses/${h.id}`)}
                            style={{ fontWeight: 600 }}
                          >
                            {h.name}
                          </button>
                        </td>
                        <td>
                          {h.gender === 'MALE' ? (
                            <span className="badge badge-neutral">Đực</span>
                          ) : h.gender === 'FEMALE' ? (
                            <span className="badge badge-neutral">Cái</span>
                          ) : (
                            <span className="muted small">—</span>
                          )}
                        </td>
                        <td>{h.breed ?? '—'}</td>
                        <td>
                          <span className={`badge ${HEALTH_STATUS_CSS[h.healthStatus]}`}>
                            {HEALTH_STATUS_LABEL[h.healthStatus]}
                          </span>
                        </td>
                        <td>
                          {h.locked ? (
                            <span className="badge badge-danger">Khóa</span>
                          ) : (
                            <span className="muted small">—</span>
                          )}
                        </td>
                        {isVet && (
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => openModalForHorse(h)}
                            >
                              <PlusIcon style={{ marginRight: 4, width: 12, height: 12 }} />
                              Khám
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Recent health records */}
          <div>
            <h3 style={{ margin: '0 0 12px' }}>
              Hồ sơ khám gần đây ({records.length})
            </h3>
            {records.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 24 }}>
                <p className="muted">Chưa có hồ sơ khám nào trong hệ thống.</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {records.slice(0, 20).map((r) => (
                  <li
                    key={r.id}
                    className="card"
                    style={{ padding: '12px 16px', marginBottom: 10, cursor: 'pointer' }}
                    onClick={() => navigate(`/horses/${r.horseId}`)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{r.horse.name}</strong>
                        <span className="muted small" style={{ marginLeft: 8 }}>
                          {formatDate(r.examDate)}
                        </span>
                      </div>
                      <span className="muted small">BS: {r.vet.name}</span>
                    </div>
                    <p className="small" style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
                      {r.diagnosis.length > 120 ? r.diagnosis.slice(0, 120) + '...' : r.diagnosis}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      <CreateHealthRecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        horseId={selectedHorseId}
        horseName={selectedHorseName}
      />
    </div>
  );
}

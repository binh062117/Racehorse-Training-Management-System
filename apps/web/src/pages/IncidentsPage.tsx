import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/useAuth';
import { api, getFileUrl } from '../lib/api';
import { ErrorText } from '../components/ErrorText';
import { Field } from '../components/Field';
import { PlusIcon } from '../components/Icons';
import { formatDate } from '../lib/format';
import type {
  Horse,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  Paginated,
} from '../lib/types';

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  LOW: 'Nhẹ',
  MEDIUM: 'Trung bình',
  HIGH: 'Nặng',
};

const SEVERITY_CSS: Record<IncidentSeverity, string> = {
  LOW: 'badge-neutral',
  MEDIUM: 'badge-warning',
  HIGH: 'badge-danger',
};

const STATUS_LABEL: Record<IncidentStatus, string> = {
  OPEN: 'Chưa xử lý',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
};

const STATUS_CSS: Record<IncidentStatus, string> = {
  OPEN: 'badge-danger',
  IN_PROGRESS: 'badge-warning',
  RESOLVED: 'badge-success',
};

// Forward-only, mirrors IncidentsService.update() on the backend.
const NEXT_STATUS: Record<IncidentStatus, IncidentStatus | null> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
  RESOLVED: null,
};

export function IncidentsPage() {
  const { user } = useAuth();
  const isGroom = user?.role === 'GROOM';
  const isVet = user?.role === 'VET';

  const [horses, setHorses] = useState<Horse[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncidentStatus>('ALL');

  const load = useCallback(async () => {
    try {
      const horseRes = await api.get<Paginated<Horse>>('/horses', {
        params: { limit: 100 },
      });
      const horseList = horseRes.data.data;
      setHorses(horseList);

      const results = await Promise.all(
        horseList.slice(0, 50).map((h) =>
          api
            .get<Paginated<Incident>>(`/horses/${h.id}/incidents`, {
              params: { limit: 10 },
            })
            .then((r) => r.data.data)
            .catch(() => []),
        ),
      );
      const all = results.flat();
      all.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setIncidents(all);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = incidents.filter(
    (i) => statusFilter === 'ALL' || i.status === statusFilter,
  );

  return (
    <div className="stack">
      <div className="panel">
        <p className="eyebrow">Y TẾ</p>
        <h1 style={{ margin: '4px 0 0' }}>Sự cố</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          {isGroom
            ? 'Báo cáo nhanh sự cố/chấn thương bạn phát hiện khi chăm sóc ngựa. Sự cố mức Nặng sẽ tự khóa tập luyện và được AI đánh giá rủi ro ngay.'
            : 'Theo dõi các sự cố/chấn thương đã được báo cáo cho đàn ngựa.'}
        </p>
      </div>

      {isGroom && <CreateIncidentForm horses={horses} onCreated={load} />}

      <div className="toolbar">
        <div className="chip-row">
          {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'ALL' ? 'Tất cả' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <ErrorText err={err} />

      {loading ? (
        <p className="muted">Đang tải dữ liệu...</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="muted">Chưa có sự cố nào phù hợp.</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filtered.map((i) => (
            <IncidentCard key={i.id} incident={i} canAdvance={isVet} onChanged={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateIncidentForm({
  horses,
  onCreated,
}: {
  horses: Horse[];
  onCreated: () => Promise<void>;
}) {
  const [horseId, setHorseId] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('LOW');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/horses/${horseId}/incidents`, {
        description: description.trim(),
        severity,
      });
      setDescription('');
      setSeverity('LOW');
      await onCreated();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" style={{ padding: '16px 20px' }} onSubmit={submit}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Báo cáo sự cố mới</h2>
      <div className="form-grid-2">
        <Field label="Ngựa">
          <select
            className="input"
            value={horseId}
            onChange={(e) => setHorseId(e.target.value)}
            required
          >
            <option value="">Chọn ngựa...</option>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mức độ">
          <select
            className="input"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
          >
            <option value="LOW">Nhẹ</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HIGH">Nặng (tự khóa tập luyện)</option>
          </select>
        </Field>
      </div>
      <Field label="Mô tả sự cố">
        <textarea
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          required
          placeholder="Ví dụ: ngựa khập khiễng chân trước sau buổi tập, nghi ngờ căng cơ..."
        />
      </Field>
      <ErrorText err={error} />
      <button
        className="btn btn-primary"
        type="submit"
        disabled={saving || !horseId}
        style={{ marginTop: 10 }}
      >
        <PlusIcon style={{ marginRight: 6 }} />
        {saving ? 'Đang gửi...' : 'Báo cáo sự cố'}
      </button>
    </form>
  );
}

function IncidentCard({
  incident,
  canAdvance,
  onChanged,
}: {
  incident: Incident;
  canAdvance: boolean;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const next = NEXT_STATUS[incident.status];

  const advance = async () => {
    if (!next) return;
    setError(null);
    setBusy(true);
    try {
      await api.patch(`/incidents/${incident.id}`, { status: next });
      await onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div>
          <strong style={{ fontSize: 15 }}>{incident.horse.name}</strong>
          <span className="muted small" style={{ marginLeft: 10 }}>
            {formatDate(incident.createdAt)} · Báo bởi {incident.reportedBy.name}
          </span>
          <div style={{ marginTop: 6 }}>
            <span className={`badge ${SEVERITY_CSS[incident.severity]}`}>
              {SEVERITY_LABEL[incident.severity]}
            </span>
            <span
              className={`badge ${STATUS_CSS[incident.status]}`}
              style={{ marginLeft: 6 }}
            >
              {STATUS_LABEL[incident.status]}
            </span>
          </div>
        </div>
        {canAdvance && next && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={advance}
            disabled={busy}
          >
            {busy ? 'Đang cập nhật...' : `Chuyển sang "${STATUS_LABEL[next]}"`}
          </button>
        )}
      </div>
      <p style={{ margin: '10px 0 0', lineHeight: 1.5 }}>{incident.description}</p>
      {incident.photoUrl && (
        <img
          src={getFileUrl(incident.photoUrl) ?? undefined}
          alt=""
          style={{ marginTop: 10, maxWidth: 200, borderRadius: 8 }}
        />
      )}
      <ErrorText err={error} />
    </li>
  );
}

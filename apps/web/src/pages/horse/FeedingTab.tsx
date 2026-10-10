import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { FeedingRecord, Horse, Paginated } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { Field } from '../../components/Field';
import { ErrorText } from '../../components/ErrorText';
import { PlusIcon } from '../../components/Icons';
import { formatDate } from '../../lib/format';

export function FeedingTab({ horse }: { horse: Horse }) {
  const { user } = useAuth();
  const isGroom = user?.role === 'GROOM';

  const [records, setRecords] = useState<FeedingRecord[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<FeedingRecord>>(
        `/horses/${horse.id}/feeding-records`,
        { params: { limit: 50 } },
      );
      setRecords(res.data.data);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [horse.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>Khẩu phần ăn</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            {isGroom
              ? 'Ghi lại loại thức ăn và khối lượng mỗi lần cho ăn, phục vụ phân tích dinh dưỡng của AI.'
              : 'Lịch sử khẩu phần ăn của chiến mã.'}
          </p>
        </div>
        {isGroom && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm((s) => !s)}
          >
            <PlusIcon style={{ marginRight: 6 }} />
            {showForm ? 'Đóng' : 'Ghi nhận khẩu phần'}
          </button>
        )}
      </div>

      {showForm && (
        <CreateFeedingForm
          horseId={horse.id}
          onCreated={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      {loading ? (
        <p className="muted">Đang tải...</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : records.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="muted">Chưa có bản ghi khẩu phần ăn nào.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Loại thức ăn</th>
                <th>Khối lượng</th>
                <th>Ghi chú</th>
                <th>Người ghi</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.feedType}</td>
                  <td>{r.quantityKg} kg</td>
                  <td className="muted small">{r.notes ?? '—'}</td>
                  <td className="muted small">{r.recordedBy.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateFeedingForm({
  horseId,
  onCreated,
}: {
  horseId: string;
  onCreated: () => void;
}) {
  const [feedType, setFeedType] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/horses/${horseId}/feeding-records`, {
        feedType: feedType.trim(),
        quantityKg: Number(quantityKg),
        date: new Date(`${date}T00:00:00`).toISOString(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onCreated();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" style={{ padding: '16px 20px' }} onSubmit={submit}>
      <div className="form-grid-2">
        <Field label="Loại thức ăn">
          <input
            className="input"
            value={feedType}
            onChange={(e) => setFeedType(e.target.value)}
            maxLength={120}
            required
            placeholder="Ví dụ: Cỏ khô Alfalfa, Cám hỗn hợp..."
          />
        </Field>
        <Field label="Khối lượng (kg)">
          <input
            className="input"
            type="number"
            step="0.1"
            min="0.1"
            max="100"
            value={quantityKg}
            onChange={(e) => setQuantityKg(e.target.value)}
            required
          />
        </Field>
        <Field label="Ngày">
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Ghi chú (tuỳ chọn)">
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Ví dụ: ăn ít hơn bình thường..."
          />
        </Field>
      </div>
      <ErrorText err={error} />
      <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 10 }}>
        {saving ? 'Đang lưu...' : 'Lưu khẩu phần'}
      </button>
    </form>
  );
}

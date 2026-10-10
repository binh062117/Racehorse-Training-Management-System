import { useState } from 'react';
import { api } from '../../lib/api';
import { ErrorText } from '../ErrorText';
import { SparkleIcon } from '../Icons';

interface SuggestedFeed {
  feedType: string;
  quantityKg: number;
  note: string;
}

interface FeedingSuggestion {
  summary: string;
  suggestedFeeds: SuggestedFeed[];
  cautions: string[];
}

/** AI-generated feeding plan suggestion for a horse (VET/MANAGER/GROOM). */
export function FeedingSuggestionCard({
  horseId,
  onApply,
}: {
  horseId: string;
  onApply?: (feed: SuggestedFeed) => void;
}) {
  const [suggestion, setSuggestion] = useState<FeedingSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const analyze = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.post<FeedingSuggestion>(
        `/horses/${horseId}/feeding-suggestion`,
      );
      setSuggestion(res.data);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <SparkleIcon /> Trợ lý AI — đề xuất khẩu phần ăn
          </h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            Dựa vào khẩu phần hiện tại, cường độ tập luyện và tình trạng sức khỏe để gợi ý điều chỉnh. Chỉ mang tính tham khảo.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={analyze}
          disabled={loading}
          style={{ whiteSpace: 'nowrap' }}
        >
          {loading ? 'Đang tạo đề xuất…' : suggestion ? 'Đề xuất lại' : 'Đề xuất khẩu phần'}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 12 }}>
          <ErrorText err={err} />
        </div>
      )}

      {suggestion && !loading && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border-default)', paddingTop: 14 }}>
          <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>{suggestion.summary}</p>

          {suggestion.suggestedFeeds.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {suggestion.suggestedFeeds.map((f, i) => (
                <li
                  key={i}
                  className="card"
                  style={{
                    padding: '10px 14px',
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div>
                    <strong>{f.feedType}</strong>
                    <span style={{ marginLeft: 8 }} className="badge badge-neutral">
                      {f.quantityKg} kg
                    </span>
                    {f.note && (
                      <p className="muted small" style={{ margin: '4px 0 0' }}>
                        {f.note}
                      </p>
                    )}
                  </div>
                  {onApply && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onApply(f)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Dùng gợi ý này
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {suggestion.cautions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span className="muted small" style={{ fontWeight: 600 }}>
                Lưu ý
              </span>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {suggestion.cautions.map((c, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

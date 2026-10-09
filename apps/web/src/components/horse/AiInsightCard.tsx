import { useState } from 'react';
import { api } from '../../lib/api';
import { ErrorText } from '../ErrorText';
import { SparkleIcon } from '../Icons';

interface HorseInsight {
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskReasons: string[];
  recommendations: string[];
}

const RISK_LABEL: Record<HorseInsight['riskLevel'], string> = {
  LOW: 'Rủi ro thấp',
  MEDIUM: 'Rủi ro trung bình',
  HIGH: 'Rủi ro cao',
};

const RISK_CSS: Record<HorseInsight['riskLevel'], string> = {
  LOW: 'badge-success',
  MEDIUM: 'badge-warning',
  HIGH: 'badge-danger',
};

/** AI-generated health/injury-risk summary for a horse (VET/MANAGER only). */
export function AiInsightCard({ horseId }: { horseId: string }) {
  const [insight, setInsight] = useState<HorseInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const analyze = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.post<HorseInsight>(`/horses/${horseId}/ai-insight`);
      setInsight(res.data);
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
            <SparkleIcon /> Trợ lý AI — phân tích rủi ro sức khỏe
          </h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            Dùng AI tóm tắt lịch sử khám bệnh, sự cố và tập luyện, gợi ý rủi ro chấn thương. Chỉ mang tính tham khảo.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={analyze}
          disabled={loading}
          style={{ whiteSpace: 'nowrap' }}
        >
          {loading ? 'Đang phân tích…' : insight ? 'Phân tích lại' : 'Phân tích ngay'}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 12 }}>
          <ErrorText err={err} />
        </div>
      )}

      {insight && !loading && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border-default)', paddingTop: 14 }}>
          <span className={`badge ${RISK_CSS[insight.riskLevel]}`}>
            {RISK_LABEL[insight.riskLevel]}
          </span>
          <p style={{ margin: '10px 0 0', lineHeight: 1.6 }}>{insight.summary}</p>

          {insight.riskReasons.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span className="muted small" style={{ fontWeight: 600 }}>
                Yếu tố rủi ro
              </span>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {insight.riskReasons.map((reason, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {insight.recommendations.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span className="muted small" style={{ fontWeight: 600 }}>
                Khuyến nghị
              </span>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {insight.recommendations.map((rec, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

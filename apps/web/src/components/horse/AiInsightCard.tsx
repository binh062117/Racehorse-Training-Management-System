import { useState } from 'react';
import { api } from '../../lib/api';
import { ErrorText } from '../ErrorText';
import { Badge, Btn, Card, Icon, type Tone } from '../../ds/ui';

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

const RISK_TONE: Record<HorseInsight['riskLevel'], Tone> = {
  LOW: 'ok',
  MEDIUM: 'warn',
  HIGH: 'bad',
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
    <Card className="p-5">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-semibold flex items-center gap-2"><Icon name="sparkle" />Trợ lý AI — phân tích rủi ro sức khỏe</h2>
          <p className="cap mt-1">Dùng AI tóm tắt lịch sử khám bệnh, sự cố và tập luyện, gợi ý rủi ro chấn thương. Chỉ mang tính tham khảo.</p>
        </div>
        <Btn v="p" sm onClick={() => void analyze()} disabled={loading} className="whitespace-nowrap">
          {loading ? 'Đang phân tích…' : insight ? 'Phân tích lại' : 'Phân tích ngay'}
        </Btn>
      </div>

      {err && <div className="mt-3"><ErrorText err={err} /></div>}

      {insight && !loading && (
        <div className="mt-3.5 pt-3.5 border-t border-line-soft">
          <Badge tone={RISK_TONE[insight.riskLevel]}>{RISK_LABEL[insight.riskLevel]}</Badge>
          <p className="mt-2.5 leading-relaxed">{insight.summary}</p>

          {insight.riskReasons.length > 0 && (
            <div className="mt-3">
              <span className="lbl">Yếu tố rủi ro</span>
              <ul className="mt-1.5 pl-5 list-disc">
                {insight.riskReasons.map((reason, i) => <li key={i} className="mb-1">{reason}</li>)}
              </ul>
            </div>
          )}

          {insight.recommendations.length > 0 && (
            <div className="mt-3">
              <span className="lbl">Khuyến nghị</span>
              <ul className="mt-1.5 pl-5 list-disc">
                {insight.recommendations.map((rec, i) => <li key={i} className="mb-1">{rec}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { ErrorText } from '../ErrorText';
import { Badge, Btn, Card, Icon, type Tone } from '../../ds/ui';

interface HorseInsight {
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskReasons: string[];
  recommendations: string[];
}

const RISK_TONE: Record<HorseInsight['riskLevel'], Tone> = {
  LOW: 'ok',
  MEDIUM: 'warn',
  HIGH: 'bad',
};

/** AI-generated health/injury-risk summary for a horse (VET/MANAGER only). */
export function AiInsightCard({ horseId }: { horseId: string }) {
  const { t } = useTranslation();
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
          <h2 className="text-[15px] font-semibold flex items-center gap-2"><Icon name="sparkle" />{t('aiInsight.title')}</h2>
          <p className="cap mt-1">{t('aiInsight.description')}</p>
        </div>
        <Btn v="p" sm onClick={() => void analyze()} disabled={loading} className="whitespace-nowrap">
          {loading ? t('aiInsight.analyzing') : insight ? t('aiInsight.again') : t('aiInsight.analyze')}
        </Btn>
      </div>

      {err && <div className="mt-3"><ErrorText err={err} /></div>}

      {insight && !loading && (
        <div className="mt-3.5 pt-3.5 border-t border-line-soft">
          <Badge tone={RISK_TONE[insight.riskLevel]}>{t(`aiInsight.risk${insight.riskLevel === 'LOW' ? 'Low' : insight.riskLevel === 'MEDIUM' ? 'Medium' : 'High'}`)}</Badge>
          <p className="mt-2.5 leading-relaxed">{insight.summary}</p>

          {insight.riskReasons.length > 0 && (
            <div className="mt-3">
              <span className="lbl">{t('aiInsight.riskFactors')}</span>
              <ul className="mt-1.5 pl-5 list-disc">
                {insight.riskReasons.map((reason, i) => <li key={i} className="mb-1">{reason}</li>)}
              </ul>
            </div>
          )}

          {insight.recommendations.length > 0 && (
            <div className="mt-3">
              <span className="lbl">{t('aiInsight.recommendations')}</span>
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

import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useState } from 'react';
import { api } from '../../lib/api';
import { ErrorText } from '../ErrorText';
import { Badge, Btn, Card, Icon } from '../../ds/ui';

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
  useTranslation();
  const [suggestion, setSuggestion] = useState<FeedingSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const analyze = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.post<FeedingSuggestion>(`/horses/${horseId}/feeding-suggestion`);
      setSuggestion(res.data);
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
          <h2 className="text-[15px] font-semibold flex items-center gap-2"><Icon name="sparkle" />{i18n.t("ui.aiAssistantFeedingSuggestions")}</h2>
          <p className="cap mt-1">{i18n.t("ui.suggestFeedingAdjustmentsBasedOnCurrentFeedTrainingIntensityAndHealthF")}</p>
        </div>
        <Btn v="p" sm onClick={() => void analyze()} disabled={loading} className="whitespace-nowrap">
          {loading ? i18n.t("ui.generatingSuggestions") : suggestion ? i18n.t("ui.suggestAgain") : i18n.t("ui.suggestFeeding")}
        </Btn>
      </div>

      {err && <div className="mt-3"><ErrorText err={err} /></div>}

      {suggestion && !loading && (
        <div className="mt-3.5 pt-3.5 border-t border-line-soft">
          <p className="mb-3 leading-relaxed">{suggestion.summary}</p>

          {suggestion.suggestedFeeds.length > 0 && (
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {suggestion.suggestedFeeds.map((f, i) => (
                <li key={i}>
                  <Card className="px-3.5 py-2.5 flex justify-between items-center gap-2.5">
                    <div>
                      <strong>{f.feedType}</strong>
                      <Badge tone="neu" className="ml-2">{f.quantityKg} kg</Badge>
                      {f.note && <p className="cap mt-1">{f.note}</p>}
                    </div>
                    {onApply && <Btn sm onClick={() => onApply(f)} className="whitespace-nowrap">{i18n.t("ui.useThisSuggestion")}</Btn>}
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {suggestion.cautions.length > 0 && (
            <div className="mt-3">
              <span className="lbl">{i18n.t("ui.pleaseNote")}</span>
              <ul className="mt-1.5 pl-5 list-disc">
                {suggestion.cautions.map((c, i) => <li key={i} className="mb-1">{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

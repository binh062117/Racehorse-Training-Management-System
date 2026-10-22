import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { FeedingRecord, Horse, Paginated } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { FeedingSuggestionCard } from '../../components/horse/FeedingSuggestionCard';
import { formatDate } from '../../lib/format';
import { Btn, Card, Field, Icon, Input } from '../../ds/ui';

interface FormPrefill {
  feedType: string;
  quantityKg: string;
}

export function FeedingTab({ horse }: { horse: Horse }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGroom = user?.role === 'GROOM';
  const canSuggest = isGroom || user?.role === 'VET' || user?.role === 'MANAGER';

  const [records, setRecords] = useState<FeedingRecord[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [prefill, setPrefill] = useState<FormPrefill | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<FeedingRecord>>(`/horses/${horse.id}/feeding-records`, { params: { limit: 50 } });
      setRecords(res.data.data);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [horse.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-semibold">{t('feedingTab.title')}</h2>
          <p className="cap mt-0.5">
            {isGroom ? t('feedingTab.groomDescription') : t('feedingTab.description')}
          </p>
        </div>
        {isGroom && (
          <Btn v="p" onClick={() => { setPrefill(null); setShowForm((s) => !s); }}>
            <Icon name="plus" />{showForm ? t('feedingTab.close') : t('feedingTab.record')}
          </Btn>
        )}
      </div>

      {canSuggest && (
        <FeedingSuggestionCard
          horseId={horse.id}
          onApply={isGroom ? (f) => { setPrefill({ feedType: f.feedType, quantityKg: String(f.quantityKg) }); setShowForm(true); } : undefined}
        />
      )}

      {showForm && (
        <CreateFeedingForm
          key={prefill ? `${prefill.feedType}:${prefill.quantityKg}` : 'blank'}
          horseId={horse.id}
          initial={prefill}
          onCreated={() => { setShowForm(false); setPrefill(null); void load(); }}
        />
      )}

      {loading ? (
        <p className="cap">{t('feedingTab.loading')}</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : records.length === 0 ? (
        <Card className="px-5 py-10 text-center"><p className="cap">{t('feedingTab.empty')}</p></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="text-left">
                  {[t('feedingTab.date'), t('feedingTab.feedType'), t('feedingTab.quantity'), t('feedingTab.notes'), t('feedingTab.recorder')].map((th) => (
                    <th key={th} className="h-[42px] px-4 bg-cream lbl border-b border-line">{th}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-line-soft hover:bg-subtle">
                    <td className="px-4 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">{r.feedType}</td>
                    <td className="px-4 py-3 num">{r.quantityKg} kg</td>
                    <td className="px-4 py-3 cap">{r.notes ?? '—'}</td>
                    <td className="px-4 py-3 cap">{r.recordedBy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CreateFeedingForm({ horseId, initial, onCreated }: { horseId: string; initial: FormPrefill | null; onCreated: () => void }) {
  const { t } = useTranslation();
  const [feedType, setFeedType] = useState(initial?.feedType ?? '');
  const [quantityKg, setQuantityKg] = useState(initial?.quantityKg ?? '');
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
    <form onSubmit={submit}>
      <Card className="p-5 flex flex-col gap-4">
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
          <Field label={t('feedingTab.feedType')}>
            <Input value={feedType} onChange={(e) => setFeedType(e.target.value)} maxLength={120} required placeholder={t('feedingTab.exampleFeed')} />
          </Field>
          <Field label={`${t('feedingTab.quantity')} (kg)`}>
            <Input type="number" step="0.1" min="0.1" max="100" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} required />
          </Field>
          <Field label={t('feedingTab.date')}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label={t('feedingTab.optionalNotes')}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder={t('feedingTab.exampleNotes')} />
          </Field>
        </div>
        <ErrorText err={error} />
        <Btn v="p" type="submit" disabled={saving} className="self-start">{saving ? t('feedingTab.saving') : t('feedingTab.save')}</Btn>
      </Card>
    </form>
  );
}

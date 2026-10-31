import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { api } from '../../lib/api';
import { useCachedResource } from '../../lib/useCachedResource';
import type { TrialVideo } from '../../lib/types';
import { formatDate } from '../../lib/format';
import { ErrorText } from '../../components/ErrorText';
import { Btn, Card, EmptyState, Field, Input } from '../../ds/ui';

export function TrialVideosTab({ horseId }: { horseId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === 'MANAGER' || user?.role === 'TRAINER';
  const { data, loading, error, reload } = useCachedResource(
    `trial-videos:${user?.id}:${horseId}`,
    () =>
      api
        .get<TrialVideo[]>(`/horses/${horseId}/trial-videos`)
        .then((r) => r.data),
  );
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [date, setDate] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/horses/${horseId}/trial-videos`, {
        title,
        videoUrl: url,
        recordedAt: new Date(`${date}T00:00:00+07:00`).toISOString(),
      });
      setTitle('');
      setUrl('');
      setDate('');
      await reload();
    } catch (reason) {
      setErr(reason);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold">{t('raceFeatures.videos')}</h2>
      {canEdit && (
        <Card className="p-4">
          <form onSubmit={save} className="flex flex-wrap items-end gap-3">
            <Field label={t('raceFeatures.videoTitle')}>
              <Input
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label={t('raceFeatures.videoUrl')}>
              <Input
                type="url"
                required
                maxLength={2000}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://.../video.mp4"
              />
            </Field>
            <Field label={t('races.date')}>
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Btn type="submit" v="p" disabled={busy}>
              {t('common.save')}
            </Btn>
          </form>
          <p className="cap mt-2">{t('raceFeatures.videoHint')}</p>
        </Card>
      )}
      <ErrorText err={error ?? err} />
      {loading ? (
        <p>{t('races.loading')}</p>
      ) : !data?.length ? (
        <EmptyState>{t('raceFeatures.noVideos')}</EmptyState>
      ) : (
        data.map((video) => (
          <Card key={video.id} className="p-4">
            <h3 className="font-semibold">{video.title}</h3>
            <p className="cap mb-3">{formatDate(video.recordedAt)}</p>
            {/\.(mp4|webm|ogg)(\?|$)/i.test(video.videoUrl) && (
              <video
                controls
                preload="metadata"
                className="w-full max-h-[420px] bg-black"
                src={video.videoUrl}
              />
            )}
            <a
              className="text-info block mt-2"
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('raceFeatures.openVideo')}
            </a>
            {video.notes && <p className="mt-2">{video.notes}</p>}
            {canEdit && (
              <Btn
                sm
                className="mt-3"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm(t('raceFeatures.deleteVideo'))) return;
                  setBusy(true);
                  setErr(null);
                  try {
                    await api.delete(
                      `/horses/${horseId}/trial-videos/${video.id}`,
                    );
                    await reload();
                  } catch (reason) {
                    setErr(reason);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t('common.delete')}
              </Btn>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

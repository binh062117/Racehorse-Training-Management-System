import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trialVideoSource } from '../../lib/trialVideo';

export function TrialVideoPlayer({ url, title }: { url: string; title: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const source = trialVideoSource(url);

  if (!source || failed) {
    return <p role="status" className="rounded-btn bg-subtle p-4 text-muted">{t('raceFeatures.videoUnavailable')}</p>;
  }

  return source.kind === 'embed' ? (
    <iframe
      title={title}
      src={source.url}
      className="w-full aspect-video min-h-[200px] rounded-btn border-0 bg-black"
      allow="encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  ) : (
    <video
      aria-label={title}
      controls
      playsInline
      preload="metadata"
      className="w-full max-h-[420px] rounded-btn bg-black"
      src={source.url}
      onError={() => setFailed(true)}
    />
  );
}

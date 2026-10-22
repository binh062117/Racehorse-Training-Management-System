import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { api } from '../../lib/api';
import type { Horse } from '../../lib/types';
import { usePageChrome } from '../../ds/AppShell';
import { Badge, Card, Icon } from '../../ds/ui';
import { HorseRecordNav } from './HorseRecordNav';

export function HorseOwnershipPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    api.get<Horse>(`/horses/${id}`).then((response) => {
      if (active) setHorse(response.data);
    }).catch((reason: unknown) => { if (active) setError(reason); });
    return () => { active = false; };
  }, [id]);

  usePageChrome({ crumbs: [[t('nav.horses'), '/horses'], horse?.name ?? '…', t('horseFlow.ownershipTitle')] });

  if (error) return <ErrorText err={error} />;
  if (!horse) return <p className="cap">{t('horseFlow.loading')}</p>;

  return (
    <div className="flex flex-col gap-4">
      <HorseRecordNav horseId={id} />

      <div>
        <h1 className="text-lg font-semibold">{t('horseFlow.ownershipTitle')}</h1>
        <p className="cap mt-0.5">{t('horseFlow.ownershipDescription')}</p>
      </div>

      <Card className="p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-navy text-white flex items-center justify-center font-semibold text-lg flex-none" aria-hidden="true">
          {horse.owner.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <span className="lbl">{t('horseFlow.currentOwner')}</span>
          <h2 className="font-semibold text-[15px] mt-0.5">{horse.owner.name}</h2>
          <p className="cap mt-0.5">{horse.owner.email}</p>
        </div>
        <Badge tone="ok"><Icon name="check" className="w-3.5 h-3.5" />{t('horseFlow.current')}</Badge>
      </Card>

      <Card className="p-5 flex gap-3 items-start">
        <Icon name="info" className="w-5 h-5 text-muted mt-px flex-none" />
        <div>
          <h2 className="font-semibold text-[15px]">{t('horseFlow.transferHistoryUnavailable')}</h2>
          <p className="cap mt-1">{t('horseFlow.transferHistoryExplanation')}</p>
        </div>
      </Card>
    </div>
  );
}

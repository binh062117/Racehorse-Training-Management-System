import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { api } from '../../lib/api';
import type { Horse } from '../../lib/types';
import { usePageChrome } from '../../ds/AppShell';
import { Alert, Badge, Card, PageHeader } from '../../ds/ui';
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

  usePageChrome({ crumbs: [[t('horsesPage.title', 'Ngựa đua'), '/horses'], horse?.name ?? '…', t('horseFlow.ownershipTitle')] });

  if (error) return <ErrorText err={error} />;
  if (!horse) return <p className="text-muted">{t('horseFlow.loading')}</p>;

  const initials = horse.owner.name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();

  return (
    <>
      <PageHeader
        crumbs={[[t('horsesPage.title', 'Ngựa đua'), '/horses'], [horse.name, `/horses/${id}`]]}
        title={t('horseFlow.ownershipTitle')}
        sub={t('horseFlow.currentOwnerSub', { horse: horse.name, owner: horse.owner.name })}
      />
      <HorseRecordNav horseId={id} />

      <Card className="p-5 flex flex-wrap items-center gap-4">
        <span className="w-11 h-11 rounded-full bg-cream text-ink flex items-center justify-center font-semibold text-[14px] flex-none" aria-hidden="true">
          {initials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-muted">{t('horseFlow.currentOwner', 'Chủ sở hữu hiện tại')}</div>
          <div className="font-semibold text-[15px] mt-0.5">{horse.owner.name}</div>
          <div className="text-[13px] text-muted truncate">{horse.owner.email}</div>
        </div>
        <Badge tone="ok">{t('horseFlow.current')}</Badge>
      </Card>

      <Alert tone="info" title={t('horseFlow.transferHistoryUnavailable')}>{t('horseFlow.transferHistoryExplanation')}</Alert>
    </>
  );
}

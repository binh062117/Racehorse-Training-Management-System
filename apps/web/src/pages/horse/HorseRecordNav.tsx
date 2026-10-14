import { useTranslation } from 'react-i18next';
import { SubNav } from '../../ds/ui';

export function HorseRecordNav({ horseId }: { horseId: string }) {
  const { t } = useTranslation();
  return (
    <SubNav
      items={[
        [`/horses/${horseId}`, t('horseFlow.overview')],
        [`/horses/${horseId}/performance`, t('horseFlow.performance')],
        [`/horses/${horseId}/ownership`, t('horseFlow.ownership')],
      ]}
    />
  );
}

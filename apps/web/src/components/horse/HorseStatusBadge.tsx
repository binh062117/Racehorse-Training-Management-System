import { useTranslation } from 'react-i18next';
import type { HealthStatus, HorseStatus } from '../../lib/types';

interface HorseStatusBadgeProps {
  status?: HorseStatus;
  healthStatus?: HealthStatus;
  locked?: boolean;
}

export function HorseStatusBadge({ status, healthStatus, locked }: HorseStatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <div className="row" style={{ gap: '4px' }}>
      {status === 'ACTIVE' && (
        <span className="badge badge-info">{t('horseStatusBadge.ACTIVE')}</span>
      )}
      {status === 'RESTING' && (
        <span className="badge badge-neutral">{t('horseStatusBadge.RESTING')}</span>
      )}
      {status === 'RETIRED' && (
        <span className="badge badge-neutral">{t('horseStatusBadge.RETIRED')}</span>
      )}

      {healthStatus === 'FIT' && (
        <span className="badge badge-success">{t('horseStatusBadge.FIT')}</span>
      )}
      {healthStatus === 'MONITORING' && (
        <span className="badge badge-warning">{t('horseStatusBadge.MONITORING')}</span>
      )}
      {healthStatus === 'QUARANTINED' && (
        <span className="badge badge-warning">{t('horseStatusBadge.QUARANTINED')}</span>
      )}
      {healthStatus === 'INJURED' && (
        <span className="badge badge-danger">{t('horseStatusBadge.INJURED')}</span>
      )}

      {locked && (
        <span className="badge badge-danger">{t('horseStatusBadge.locked')}</span>
      )}
    </div>
  );
}

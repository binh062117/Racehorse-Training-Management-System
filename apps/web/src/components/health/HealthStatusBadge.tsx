import { useTranslation } from 'react-i18next';
import { Badge, healthTone } from '../../ds/ui';
import type { HealthStatus } from '../../lib/types';

export function HealthStatusBadge({ status }: { status: HealthStatus }) {
  const { t } = useTranslation();
  return <Badge tone={healthTone[status]}>{t(`horseStatusBadge.${status}`)}</Badge>;
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Horse, RaceReadiness, Role } from '../../lib/types';
import { lockReasonText } from '../../ds/ui';

const READINESS_ROLES: Role[] = ['MANAGER', 'TRAINER', 'OWNER'];

/**
 * One line answering "what is this horse doing right now?":
 * locked / under treatment / ready to race / in training — with the reason.
 */
export function HorseStatusLine({ horse, role }: { horse: Horse; role?: Role | null }) {
  const { t } = useTranslation();
  const [readiness, setReadiness] = useState<RaceReadiness | null>(null);
  useEffect(() => {
    if (!role || !READINESS_ROLES.includes(role)) return;
    let live = true;
    api.get<RaceReadiness[]>('/races/readiness')
      .then((r) => { if (live) setReadiness(r.data.find((x) => x.horseId === horse.id) ?? null); })
      .catch(() => { if (live) setReadiness(null); });
    return () => { live = false; };
  }, [horse.id, horse.locked, horse.fitnessScore, role]);

  let tone: 'bad' | 'warn' | 'ok' | 'info';
  let label: string;
  let reason: string | null = null;
  if (horse.status === 'RETIRED') {
    tone = 'info'; label = t('horseState.retired');
  } else if (horse.locked) {
    tone = 'bad'; label = t('horseState.locked'); reason = lockReasonText(horse.lockReason);
  } else if (horse.healthStatus === 'INJURED' || horse.healthStatus === 'QUARANTINED' || horse.healthStatus === 'MONITORING') {
    tone = 'warn'; label = t('horseState.treatment'); reason = t(`horseStatusBadge.${horse.healthStatus}`);
  } else if (readiness?.ready) {
    tone = 'ok'; label = t('horseState.ready'); reason = t('horseState.readyReason', { score: readiness.fitnessScore });
  } else {
    tone = 'info'; label = t('horseState.training'); reason = readiness?.reasons[0] ?? null;
  }
  const dot = { bad: 'bg-bad', warn: 'bg-warn', ok: 'bg-ok', info: 'bg-info' }[tone];
  const ink = { bad: 'text-bad-ink', warn: 'text-warn-ink', ok: 'text-ok-ink', info: 'text-info-ink' }[tone];

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      <span className={`inline-flex items-center gap-1.5 font-semibold ${ink}`}>
        <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />{label}
      </span>
      {reason && <span className="text-muted">— {reason}</span>}
      <span className="text-line-strong" aria-hidden>|</span>
      {role !== 'OWNER' && <Link to={`/incidents?horseId=${horse.id}`} className="text-info no-underline hover:underline">{t('horseState.linkIncidents')}</Link>}
      {role === 'VET' && <Link to={`/health-records?horseId=${horse.id}`} className="text-info no-underline hover:underline">{t('horseState.linkExams')}</Link>}
      {role !== 'OWNER' && <Link to={`/vaccinations?horseId=${horse.id}`} className="text-info no-underline hover:underline">{t('horseState.linkVaccines')}</Link>}
      {(role === 'OWNER' || role === 'MANAGER') && (
        <Link to={`/reports?horseId=${horse.id}`} className="text-info no-underline hover:underline">{t('horseState.linkReport')}</Link>
      )}
    </div>
  );
}

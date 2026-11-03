import { isAxiosError } from 'axios';
import i18n from '../i18n';
import { apiErrorCode, apiErrorMessage } from './api';

const DETAIL_KEYS: Record<string, string> = {
  'Session time cannot be in the past': 'pastTime',
  'Session time must fall within the training plan dates': 'planDates',
  'Assigned groom must be an active GROOM': 'invalidGroom',
  'MISSED is assigned automatically': 'automaticMissed',
  'Only a planned session can be edited': 'plannedOnly',
  'planId must reference a training plan for this horse': 'planHorse',
  'resultMetric and resultValue are required to mark a session DONE': 'resultRequired',
  'endDate cannot be before startDate': 'trainingDateOrder',
  'Email is already registered': 'emailRegistered',
};

function messageKey(resources: Record<string, unknown>, message: string, prefix = ''): string | undefined {
  for (const [key, value] of Object.entries(resources)) {
    const fullKey = prefix + key;
    if (value === message) return fullKey;
    if (value && typeof value === 'object') {
      const found = messageKey(value as Record<string, unknown>, message, fullKey + '.');
      if (found) return found;
    }
  }
}

/** Presentation only: retain specific known errors without changing API codes. */
export function localizedError(err: unknown): string {
  const message = apiErrorMessage(err) ?? (err instanceof Error ? err.message : undefined);
  if (message) {
    if (DETAIL_KEYS[message]) return i18n.t(`errorDetails.${DETAIL_KEYS[message]}`);
    for (const lang of ['en', 'vi']) {
      const key = messageKey(i18n.getResourceBundle(lang, 'translation') as Record<string, unknown>, message);
      if (key) return i18n.t(key);
    }
    const conflict = /^This horse already has a planned session within (\d+) minutes of (.+)$/.exec(message);
    if (conflict) return i18n.t('errorDetails.sessionConflict', { minutes: conflict[1], time: conflict[2] });
    const rescheduleConflict = /^Ngựa đã có buổi tập "(.+)" lúc (.+) — hai buổi tập phải cách nhau ít nhất (\d+) phút\.$/.exec(message);
    if (rescheduleConflict) return i18n.t('errorDetails.sessionClash', {
      type: rescheduleConflict[1], time: rescheduleConflict[2], minutes: rescheduleConflict[3],
    });
    const locked = /^Horse training is locked(?:: (.*))?$/.exec(message);
    if (locked) return i18n.t('session.locked') + (locked[1] ? ': ' + locked[1] : '');
    const terminal = /^Session is already (DONE|CANCELLED|MISSED)$/.exec(message);
    if (terminal) return i18n.t('errorDetails.sessionTerminal', { status: i18n.t(`session.displayStatus.${terminal[1]}`) });
    if (message.includes('đã giải nghệ (RETIRED)')) return i18n.t('errorDetails.retiredHorse');
    if (message.includes('trạng thái cách ly (QUARANTINED)')) return i18n.t('errorDetails.quarantinedHorse');
    // Locally authored form errors are already translated at their source.
    if (!isAxiosError(err)) return message;
  }
  const key = `error.${apiErrorCode(err)}`;
  return i18n.exists(key) ? i18n.t(key) : message ?? i18n.t('error.INTERNAL');
}

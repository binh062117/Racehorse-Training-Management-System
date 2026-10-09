import type { Horse } from '../../lib/types';

interface HorseMetricCardsProps {
  horses: Horse[];
}

export function HorseMetricCards({ horses }: HorseMetricCardsProps) {
  const total = horses.length;
  const active = horses.filter((h) => h.status === 'ACTIVE').length;
  const restingOrRetired = horses.filter((h) => h.status === 'RESTING' || h.status === 'RETIRED').length;
  const needAttention = horses.filter((h) => h.locked || (h.healthStatus && h.healthStatus !== 'FIT')).length;

  return (
    <div className="metric-grid">
      <div className="metric-card">
        <div className="metric-label">Tổng số ngựa</div>
        <div className="metric-val" style={{ color: 'var(--brand-navy)' }}>
          {total}
        </div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Đang hoạt động</div>
        <div className="metric-val" style={{ color: 'var(--status-info)' }}>
          {active}
        </div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Nghỉ dưỡng / Giải nghệ</div>
        <div className="metric-val" style={{ color: 'var(--status-neutral)' }}>
          {restingOrRetired}
        </div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Cần chú ý / Khóa</div>
        <div className="metric-val" style={{ color: needAttention > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
          {needAttention}
        </div>
      </div>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useState } from 'react';
import { Tip } from './ui';

const FONT = 'Inter, sans-serif';

export interface BodyZone {
  key: string;
  name: string;
  x: number;
  y: number;
}

// Body-map zones on the 420×270 horse silhouette (near side, facing left).
// bodyRegion/side on InjuryLocation are free-text — these keys are the
// Vietnamese labels we standardize on when writing new injury records.
export const BODY_ZONES: BodyZone[] = (
  [
    ['head', 'Đầu', 70, 82], ['neck', 'Cổ', 120, 90], ['sh', 'Vai', 150, 124], ['back', 'Lưng', 222, 104],
    ['hip', 'Hông / mông', 300, 120], ['belly', 'Bụng / ngực', 205, 152], ['fu', 'Cẳng trước', 134, 178],
    ['ft', 'Gân chân trước', 136, 212], ['fh', 'Móng trước', 132, 243], ['hock', 'Khớp cổ chân sau', 304, 196],
    ['ht', 'Gân chân sau', 298, 222], ['hh', 'Móng sau', 295, 243],
  ] as [string, string, number, number][]
).map(([key, name, x, y]) => ({ key, name, x, y }));

/** Line chart with crosshair + tooltip on hover. Single series → no legend needed. */
export function LineChart({
  values, labels, min = 50, max = 100, ticks = [100, 85, 70, 55], W = 520, H = 190, target, zonesBg, color = '#2f62a8', unit = '', describe,
}: {
  values: number[]; labels: (string | null)[]; min?: number; max?: number; ticks?: number[]; W?: number; H?: number; target?: number; zonesBg?: boolean; color?: string; unit?: string; describe?: string;
}) {
  useTranslation();
  const [h, setH] = useState(values.length - 1);
  const left = 40, right = W - 10, top = 20, bottom = H - 30;
  const x = (i: number) => left + (i * (right - left)) / (values.length - 1);
  const y = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const colW = (right - left) / (values.length - 1);
  const d = h > 0 ? values[h] - values[h - 1] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={describe}>
        {zonesBg && <>
          <rect x={left} y={y(100)} width={right - left} height={y(80) - y(100)} fill="#edf7f0" opacity={0.6} />
          <rect x={left} y={y(80)} width={right - left} height={y(60) - y(80)} fill="#fdf6e8" opacity={0.6} />
          <text x={right - 4} y={y(100) + 14} textAnchor="end" fontFamily={FONT} fontSize="10.5" fontWeight="600" fill="#3a6b4a">{i18n.t("ui.good80")}</text>
          <text x={right - 4} y={y(80) + 14} textAnchor="end" fontFamily={FONT} fontSize="10.5" fontWeight="600" fill="#8a6218">{i18n.t("ui.monitoring6079")}</text>
        </>}
        {ticks.map((t) => <g key={t}><line x1={left} x2={right} y1={y(t)} y2={y(t)} stroke="#eceae4" /><text x={left - 8} y={y(t) + 4} textAnchor="end" fontFamily={FONT} fontSize="11" fill="#6b7280">{t}</text></g>)}
        {target != null && <line x1={left} x2={right} y1={y(target)} y2={y(target)} stroke="#6b7280" strokeWidth="1.5" strokeDasharray="6 5" />}
        <path d={`M${pts.split(' ').join(' L')} L${x(values.length - 1)},${bottom} L${left},${bottom} Z`} fill={color} fillOpacity={0.08} />
        <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={pts} />
        <line x1={x(h)} x2={x(h)} y1={top} y2={bottom} stroke="#cdc9c3" strokeDasharray="3 3" />
        <circle cx={x(h)} cy={y(values[h])} r="5.5" fill={color} stroke="#fff" strokeWidth="2.5" />
        {labels.map((l, i) => (l ? <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontFamily={FONT} fontSize="11" fill="#6b7280">{l}</text> : null))}
        {values.map((_, i) => <rect key={i} x={x(i) - colW / 2} y={top - 10} width={colW} height={bottom - top + 15} fill="transparent" onMouseEnter={() => setH(i)} />)}
      </svg>
      <Tip left={`${(x(h) / W) * 100}%`} top={`${(y(values[h]) / H) * 100}%`}>
        <b className="font-display text-lg">{values[h]}{unit}</b>{d != null && <span className="text-hero-muted"> {d >= 0 ? '+' : ''}{d}</span>}
      </Tip>
    </div>
  );
}

/** 5-axis radar vs club average. */
export function Radar({ axes, a, b }: { axes: string[]; a: number[]; b: number[] }) {
  const cx = 150, cy = 140, R = 100;
  const pt = (v: number, i: number): [number, number] => { const t = ((-90 + 72 * i) * Math.PI) / 180; return [cx + (R * v / 100) * Math.cos(t), cy + (R * v / 100) * Math.sin(t)]; };
  const poly = (vals: number[]) => vals.map((v, i) => pt(v, i).map((n) => n.toFixed(1)).join(',')).join(' ');
  const labelPos: [number, number, 'middle' | 'start' | 'end'][] = [[150, 20, 'middle'], [258, 100, 'start'], [222, 244, 'middle'], [78, 244, 'middle'], [42, 100, 'end']];
  return (
    <svg viewBox="0 0 300 260" className="w-full max-w-[340px] h-auto" role="img" aria-label={axes.map((x, i) => `${x} ${a[i]}`).join(', ')}>
      {[25, 50, 75, 100].map((r) => <polygon key={r} points={poly([r, r, r, r, r])} fill="none" stroke={r === 100 ? '#e2e0db' : '#eceae4'} />)}
      {axes.map((_, i) => { const [x2, y2] = pt(100, i); return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#eceae4" />; })}
      <polygon points={poly(b)} fill="none" stroke="#c8862a" strokeWidth="2" strokeDasharray="5 4" />
      <polygon points={poly(a)} fill="#2f62a8" fillOpacity={0.12} stroke="#2f62a8" strokeWidth="2" strokeLinejoin="round" />
      {a.map((v, i) => { const [x, y] = pt(v, i); return <circle key={i} cx={x} cy={y} r="4.5" fill="#2f62a8" stroke="#fff" strokeWidth="2" />; })}
      {axes.map((ax, i) => <text key={ax} x={labelPos[i][0]} y={labelPos[i][1]} textAnchor={labelPos[i][2]} fontFamily={FONT} fontSize="11.5" fontWeight="600" fill="#6b7280">{ax} <tspan fill="#1a1f2e">{a[i]}</tspan></text>)}
    </svg>
  );
}

const HORSE_FAR = 'M168,176 L172,234 C173,240 170,246 164,246 L152,246 C150,242 152,238 154,234 L152,180 Z M276,170 L296,206 L296,236 C297,242 294,246 288,246 L276,246 C274,242 276,238 278,234 L280,206 L264,172 Z';
const HORSE_TAIL = 'M322,106 C346,114 354,142 348,190 C342,172 334,152 326,130 Z';
const HORSE_BODY = 'M48,104 C44,96 50,86 60,80 L84,52 L86,36 L94,48 L100,50 C116,58 132,78 150,96 C190,92 240,94 282,92 C300,92 316,98 322,108 C326,124 326,150 316,166 L306,196 L308,236 C309,242 306,248 300,248 L288,248 C286,244 288,240 290,236 L292,204 C290,186 282,172 274,166 C252,172 210,174 172,170 C160,170 152,172 148,176 L146,236 C147,242 144,248 138,248 L126,248 C124,244 126,240 128,236 L128,190 C126,170 122,156 118,148 C112,136 104,126 96,118 C88,112 78,112 70,114 C62,116 54,114 48,104 Z';

/**
 * Injury-location body map (UC-16). Side view; "R" mirrors the drawing.
 * Controlled: pass zone/side + onZone, or readOnly with a single marked zone.
 */
export function HorseMap({
  zone, side = 'L', onZone, readOnly, label, zones = BODY_ZONES,
}: {
  zone?: string | null; side?: 'L' | 'R'; onZone?: (key: string) => void; readOnly?: boolean; label?: string; zones?: BodyZone[];
}) {
  useTranslation();
  const zn = zones.find((z) => z.key === zone);
  const zoneKeys: Record<string, string> = { head: 'bodyHead', neck: 'bodyNeck', sh: 'bodyShoulder', back: 'bodyBack', hip: 'bodyHip', belly: 'bodyBelly', fu: 'bodyForeleg', ft: 'bodyFrontTendon', fh: 'bodyFrontHoof', hock: 'bodyHock', ht: 'bodyHindTendon', hh: 'bodyHindHoof' };
  // Preserve canonical names used by injury data; translate only their display.
  const zoneName = (z: BodyZone) => BODY_ZONES.some((base) => base.key === z.key && base.name === z.name)
    ? i18n.t(`ui.${zoneKeys[z.key]}`) : z.name;
  return (
    <svg viewBox="0 0 420 270" className="w-full h-auto block bg-[#fbfaf7] rounded-card" role="img"
      aria-label={i18n.t('ui.horseMap', { side: i18n.t(side === 'L' ? 'ui.left' : 'ui.right'), location: zn ? i18n.t('ui.location') + ' ' + zoneName(zn) : '' })}>
      <g transform={side === 'R' ? 'translate(420 0) scale(-1 1)' : undefined}>
        <path d={HORSE_FAR} fill="#d9dde3" />
        <path d={HORSE_TAIL} fill="#9aa5b3" />
        <path d={HORSE_BODY} fill="#c3cad3" stroke="#9aa5b3" strokeWidth="1.5" />
        <circle cx="74" cy="74" r="3" fill="#1c2b3a" />
        {zones.map((z) => {
          const on = z.key === zone;
          if (readOnly && !on) return null;
          return (
            <g key={z.key} onClick={readOnly ? undefined : () => onZone?.(z.key)} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
              <circle cx={z.x} cy={z.y} r="16" fill="transparent" />
              {on && <circle cx={z.x} cy={z.y} r="9" fill="none" stroke="#8a2020" strokeWidth="2"><animate attributeName="r" from="9" to="22" dur="1.6s" repeatCount="indefinite" /><animate attributeName="opacity" from=".6" to="0" dur="1.6s" repeatCount="indefinite" /></circle>}
              <circle cx={z.x} cy={z.y} r={on ? 9 : 5} fill={on ? '#8a2020' : '#fff'} stroke={on ? '#fff' : '#8a2020'} strokeWidth={on ? 2.5 : 2} opacity={on ? 1 : 0.75}>
                <title>{zoneName(z)}</title>
              </circle>
            </g>
          );
        })}
      </g>
      {label && zn && <text x={side === 'R' ? 420 - zn.x - 24 : zn.x + 24} y={zn.y + 14} textAnchor={side === 'R' ? 'end' : 'start'} fontFamily={FONT} fontSize="15" fontWeight="700" fill="#8a2020">{label}</text>}
    </svg>
  );
}

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

/* ---------- icons (stroke, 24px grid) ---------- */
const P: Record<string, string[]> = {
  dashboard: ['M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z'],
  horse: ['M6 20v-9a6 6 0 0 1 12 0v9', 'M4 20h4M16 20h4M9 8h.01M15 8h.01'],
  plans: ['M8 2h8v4H8z', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M9 12h6M9 16h4'],
  calendar: ['M3 4h18v18H3z', 'M16 2v4M8 2v4M3 10h18'],
  live: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  heart: ['M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z'],
  alert: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z', 'M12 9v4M12 17h.01'],
  reports: ['M3 3v18h18', 'M8 17v-6M13 17V7M18 17v-4'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'm21 21-4.3-4.3'],
  chevDown: ['m6 9 6 6 6-6'], chevRight: ['m9 18 6-6-6-6'], chevLeft: ['m15 18-6-6 6-6'],
  plus: ['M12 5v14M5 12h14'], check: ['M20 6 9 17l-5-5'], x: ['M18 6 6 18M6 6l12 12'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'], unlock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 7.5-2'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'], trash: ['M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6'],
  user: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M4 21a8 8 0 0 1 16 0'], flag: ['M4 22V4M4 4h13l-2 4 2 4H4'],
  download: ['M12 3v12M7 10l5 5 5-5M5 21h14'], external: ['M7 17 17 7M7 7h10v10'],
  camera: ['M3 7h3l2-3h8l2 3h3v13H3Z', 'M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'], send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  pin: ['M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11Z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'], info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 11v5M12 8h.01'],
  syringe: ['m18 2 4 4M7 13l4 4M3 21l4-4M14 4l6 6-9 9-6-6Z'], steth: ['M4 4v6a6 6 0 0 0 12 0V4', 'M8 4H4M16 4h-4', 'M20 12a2 2 0 1 0 0 .01', 'M10 16v1a5 5 0 0 0 10 0v-1'],
  pill: ['M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z', 'M8.5 8.5l7 7'], file: ['M3 3h18v18H3z', 'M8 8h8M8 12h8M8 16h5'],
  sparkle: ['M12 3v4M12 17v4M3 12h4M17 12h4', 'M8 8 6 6M18 18l-2-2M16 8l2-2M6 18l2-2'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  eyeOff: ['M2 12s3.5-7 10-7c2 0 3.6.6 4.9 1.4M22 12s-3.5 7-10 7c-2 0-3.6-.6-4.9-1.4', 'M9.9 9.9a3 3 0 0 0 4.2 4.2', 'M3 3l18 18'],
  menu: ['M4 6h16M4 12h16M4 18h16'], logout: ['M15 4h4v16h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
};
export function Icon({ name, className = 'w-4 h-4', label }: { name: string; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={'flex-none ' + className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined} aria-label={label}>
      {(P[name] || []).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ---------- status ---------- */
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neu' | 'lock';
/** Pale tint with dark ink of the same hue — the only way status shows colour. */
export const tones: Record<Tone, string> = {
  ok: 'text-ok-ink bg-ok-bg', warn: 'text-warn-ink bg-warn-bg', bad: 'text-bad-ink bg-bad-bg', info: 'text-info-ink bg-info-bg',
  neu: 'text-neu-ink bg-neu-bg', lock: 'text-bad-ink bg-bad-bg',
};
export function Badge({ tone = 'neu', className = '', children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={`inline-flex flex-none items-center gap-1 h-[22px] px-2 rounded-badge text-[12px] font-medium whitespace-nowrap leading-none ${tones[tone]} ${className}`}>{children}</span>;
}
export const healthTone: Record<string, Tone> = { FIT: 'ok', MONITORING: 'warn', QUARANTINED: 'bad', INJURED: 'bad' };
export const careerTone: Record<string, Tone> = { ACTIVE: 'ok', RESTING: 'neu', RETIRED: 'neu' };
export const healthLabel: Record<string, string> = { FIT: 'Khỏe mạnh', MONITORING: 'Cần theo dõi', QUARANTINED: 'Cách ly', INJURED: 'Chấn thương' };
export const careerLabel: Record<string, string> = { ACTIVE: 'Đang thi đấu', RESTING: 'Nghỉ dưỡng', RETIRED: 'Giải nghệ' };
export function HealthBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return <Badge tone={healthTone[status] ?? 'neu'}>{t(`horseStatusBadge.${status}`, healthLabel[status] ?? status)}</Badge>;
}
export function CareerBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return <Badge tone={careerTone[status] ?? 'neu'}>{t(`horseStatusBadge.${status}`, careerLabel[status] ?? status)}</Badge>;
}
export const notificationTone: Record<string, Tone> = {
  TRAINING_LOCKED: 'bad', TRAINING_UNLOCKED: 'ok', INCIDENT_REPORTED: 'bad', FITNESS_WARNING: 'warn', AI_RISK_ALERT: 'bad',
};
export const notificationIcon: Record<string, string> = {
  TRAINING_LOCKED: 'lock', TRAINING_UNLOCKED: 'unlock', INCIDENT_REPORTED: 'alert', FITNESS_WARNING: 'heart', AI_RISK_ALERT: 'sparkle',
};
/** Fitness scale: ≥80 good, 60–79 watch, <60 low. Grey when not assessed. */
export const fitColor = (v: number | null | undefined) => (v == null ? '#9ca3af' : v >= 80 ? '#247b50' : v >= 60 ? '#b45309' : '#c4242a');
export function LockBadge({ children, className = '' }: { children?: ReactNode; className?: string }) {
  const { t } = useTranslation();
  const label = children ?? t('horsesPage.filterLocked', 'Khóa tập');
  return <Badge tone="lock" className={className}><Icon name="lock" className="w-3 h-3" />{label}</Badge>;
}
/** Lock reasons are written by the backend as "Incident: …" — show them in the UI's language. */
export function lockReasonText(reason: string | null | undefined): string {
  const isEn = (i18n.resolvedLanguage || i18n.language || 'vi').toLowerCase().startsWith('en');
  if (!reason) return isEn ? 'No specific reason provided' : 'Chưa có lý do cụ thể';
  if (isEn) {
    return reason.replace(/^(Sự cố|Incident):\s*/i, 'Incident: ');
  }
  return reason.replace(/^(Sự cố|Incident):\s*/i, 'Sự cố: ');
}

/* ---------- buttons ---------- */
type BtnVariant = 'p' | 's' | 'd' | 'g';
const btnV: Record<BtnVariant, string> = {
  p: 'bg-info text-white hover:bg-info-ink hover:shadow-[0_6px_16px_rgba(26,75,138,.25)]',
  s: 'bg-white text-ink border-line-strong hover:bg-subtle',
  d: 'bg-white text-bad border-bad-bd hover:bg-bad-bg',
  g: 'bg-transparent text-ink hover:bg-cream',
};
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  to?: string;
  v?: BtnVariant;
  sm?: boolean;
}
export function Btn({ to, v = 's', sm, className = '', children, ...rest }: BtnProps) {
  const cls = `inline-flex items-center justify-center gap-1.5 rounded-btn border border-transparent font-medium whitespace-nowrap no-underline transition-[color,background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed disabled:active:translate-y-0 ${sm ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-[13.5px]'} ${btnV[v]} ${className}`;
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

/* ---------- surfaces ---------- */
export function Card({ className = '', children, ...rest }: { className?: string; children: ReactNode; [k: string]: unknown }) {
  return <section className={`bg-white border border-line rounded-card ${className}`} {...rest}>{children}</section>;
}
export function CardHeader({ title, children, className = '' }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-line-soft ${className}`}>
      {typeof title === 'string' ? <h2 className="flex-1 text-[15px] font-semibold leading-5">{title}</h2> : title}
      {children}
    </div>
  );
}

/**
 * The screen's title row: breadcrumb, h1, one sentence about the data (the
 * finding, not the interface), then search and the real actions on the right.
 */
export function PageHeader({ crumbs, title, sub, actions, search }: {
  crumbs?: [string, string][];
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  search?: { placeholder: string; value: string; onChange: (v: string) => void };
}) {
  return (
    <header className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div className="min-w-0 flex-[1_1_320px]">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-[13px] text-muted mb-1">
            {crumbs.map(([label, to]) => (
              <span key={to} className="flex items-center gap-1.5">
                <Link to={to} className="no-underline text-muted hover:text-ink">{label}</Link>
                <Icon name="chevRight" className="w-3.5 h-3.5" />
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.01em]">{typeof title === 'string' ? <WaveText text={title} /> : title}</h1>
        {sub && <p className="text-[14px] text-muted mt-1 max-w-[720px]">{sub}</p>}
      </div>
      {(search || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {search && (
            <label className="flex items-center gap-2 h-9 w-[260px] max-w-full rounded-btn border border-line-strong bg-white px-3 text-muted focus-within:border-info">
              <Icon name="search" />
              <input type="search" placeholder={search.placeholder} aria-label={search.placeholder} value={search.value}
                onChange={(e) => search.onChange(e.target.value)} className="flex-1 min-w-0 outline-none bg-transparent text-ink text-[13.5px]" />
            </label>
          )}
          {actions}
        </div>
      )}
    </header>
  );
}

/**
 * Headline figures as one container split by 1px dividers — label over value,
 * no tiles, no icons. `lead` makes one figure the screen's answer.
 */
export function KpiStrip({ items }: { items: { label: string; value: ReactNode; unit?: ReactNode; sub?: ReactNode; tone?: 'bad' | 'ok' | 'warn'; lead?: boolean }[] }) {
  const toneCls = { bad: 'text-bad', ok: 'text-ok', warn: 'text-warn' };
  const cols = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5' }[items.length] ?? 'md:grid-cols-4';
  // 1px dividers come from the 1px grid gap over the border colour, so they stay
  // exact at every column count; an odd last cell spans the phone's 2-up grid.
  return (
    <Card className={`grid grid-cols-2 ${cols} gap-px bg-line overflow-hidden`}>
      {items.map((k, i) => (
        <div key={k.label} className={`hover-hop group/kpi bg-white px-5 py-4 min-w-0 transition-colors hover:bg-subtle ${items.length % 2 === 1 && i === items.length - 1 ? 'col-span-2 md:col-span-1' : ''}`}>
          <div className="text-[13px] text-muted transition-colors group-hover/kpi:text-ink">{k.label}</div>
          <div className={`num mt-1 font-semibold leading-tight ${k.lead ? 'text-[30px]' : 'text-[24px]'} ${k.tone ? toneCls[k.tone] : k.lead ? 'text-info' : 'text-ink'}`}>
            <span className="hop">{typeof k.value === 'number' ? <CountUp value={k.value} /> : k.value}</span>{k.unit && <span className="text-[14px] font-normal text-muted ml-1">{k.unit}</span>}
          </div>
          {k.sub && <div className="text-[12px] text-muted mt-1">{k.sub}</div>}
        </div>
      ))}
    </Card>
  );
}

/* ---------- motion helpers ---------- */
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that counts up to its value when it first appears, and glides to a
 * new value when it changes. Keeps the value's own decimal places.
 */
export function CountUp({ value, duration = 800 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (prefersReducedMotion()) { from.current = value; return; }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = origin + (value - origin) * eased;
      from.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  const decimals = (String(value).split('.')[1] ?? '').length;
  const display = prefersReducedMotion() ? value : shown;
  return <>{display.toFixed(decimals)}</>;
}

/** Text whose letters jump in turn while hovered (letters split by grapheme, so Vietnamese marks stay on their letter). */
export function WaveText({ text }: { text: string }) {
  const chars = typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? [...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text)].map((x) => x.segment)
    : [...text];
  return (
    <span className="wave" aria-label={text}>
      {chars.map((c, i) => <span key={i} aria-hidden style={{ '--i': i } as CSSProperties}>{c}</span>)}
    </span>
  );
}

/** Table header cell: sentence-case grey 12px, no band. Add pl-5/pr-5 on the edge columns. */
export const thCls = 'h-10 px-4 text-left text-[12px] font-medium text-muted border-b border-line whitespace-nowrap';

/** One sentence in the block's frame when it has nothing to show. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-line-strong px-4 py-3.5 text-[13.5px] text-muted">
      <span>{children}</span>{action}
    </div>
  );
}

/* ---------- racing identity ---------- */
/** Saddle-cloth number. Renders nothing when the horse has no number, so an
 *  empty cloth never reads as a stray "—" button. */
export function Cloth({ n, className = '' }: { n: number | string | null | undefined; className?: string }) {
  if (n == null || n === '') return null;
  return <span className={`cloth ${className}`} title="Số áo đua">{n}</span>;
}
export const HORSE_LOGO = '/icons/manager-horse-head.png';
/** Soft grounds for horses without a photo — one per horse, picked from its name so it never changes. */
const AVATAR_TINTS = ['#e3ecf8', '#dff2e7', '#fbefd9', '#efe6f8', '#fbe5e3', '#dcf0f2'];
function tintFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}
/** The horse's photo, or the club's horse-head mark when there is none or it fails to load. */
export function HorseAvatar({ src, name, size = 36, className = '', onClick }: { src?: string | null; name: string; size?: number; className?: string; onClick?: () => void }) {
  const [broken, setBroken] = useState(false);
  const photo = src && !broken;
  const inner = photo
    ? <img src={src} alt={name} onError={() => setBroken(true)} className="w-full h-full object-cover" />
    : <img src={HORSE_LOGO} alt="" className="w-full h-full object-contain p-[14%] mix-blend-multiply" />;
  const cls = `inline-flex flex-none items-center justify-center rounded-full overflow-hidden border border-black/[.06] ${className}`;
  if (onClick && photo) {
    return <button type="button" onClick={onClick} aria-label={`Xem ảnh lớn ${name}`} className={`${cls} cursor-zoom-in`} style={{ width: size, height: size, background: photo ? '#fff' : tintFor(name) }}>{inner}</button>;
  }
  return <span className={cls} style={{ width: size, height: size, background: photo ? '#fff' : tintFor(name) }}>{inner}</span>;
}

/* ---------- controls ---------- */
export function Seg({ options, value, onChange }: { options: (string | [string, ReactNode])[]; value: string; onChange?: (k: string) => void }) {
  return (
    <div role="tablist" className="inline-flex p-[3px] gap-0.5 rounded-btn bg-cream">
      {options.map((o) => {
        const [k, l] = Array.isArray(o) ? o : [o, o];
        const on = k === value;
        return <button key={k} type="button" role="tab" aria-selected={on} onClick={() => onChange?.(k)}
          className={`h-[28px] px-3 rounded-[5px] text-[13px] ${on ? 'bg-white text-ink font-medium shadow-[0_1px_2px_rgba(17,24,39,.08)]' : 'text-muted hover:text-ink'}`}>{l}</button>;
      })}
    </div>
  );
}
export function Chip({ on, onClick, children, className = '' }: { on?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return <button type="button" aria-pressed={on} onClick={onClick}
    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-btn border text-[13px] transition-colors ${on ? 'bg-info text-white border-info' : 'bg-white text-ink border-line-strong hover:bg-subtle'} ${className}`}>{children}</button>;
}
/** A filter count inside a Chip — inherits the chip's colour so it stays legible when active. */
export function ChipCount({ n }: { n: number }) {
  return <span className="num opacity-70 hop">{n}</span>;
}
export function Field({ label, htmlFor, req, hint, err, children, className = '' }: { label?: string; htmlFor?: string; req?: boolean; hint?: ReactNode; err?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      {label && <label htmlFor={htmlFor} className="text-[13px] font-medium">{label}{req && <span className="text-bad"> *</span>}</label>}
      {children}
      {hint && <span className={`text-[12px] leading-4 ${err ? 'text-bad font-medium' : 'text-muted'}`}>{hint}</span>}
    </div>
  );
}
export const inputCls = (err?: boolean, ro?: boolean) => `h-10 w-full rounded-btn border bg-white px-3 text-[14px] outline-none transition-colors focus:border-info focus:ring-2 focus:ring-info/15 ${err ? 'border-bad ring-2 ring-bad/15' : 'border-line-strong'} ${ro ? 'bg-subtle text-muted' : ''}`;
export function Input({ err, ro, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { err?: boolean; ro?: boolean }) {
  return <input className={`${inputCls(err, ro)} ${className}`} readOnly={ro} {...rest} />;
}
export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`w-full min-h-[88px] rounded-btn border border-line-strong bg-white px-3 py-2.5 text-[14px] leading-5 outline-none transition-colors focus:border-info focus:ring-2 focus:ring-info/15 resize-y ${className}`} {...rest} />;
}
/** A native select styled like Input, with real id/label options. */
export function NativeSelect({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <select className={`${inputCls()} appearance-none pr-9 disabled:bg-subtle disabled:text-muted`} {...rest}>{children}</select>
      <Icon name="chevDown" className="w-4 h-4 absolute right-3 text-muted pointer-events-none" />
    </div>
  );
}
export function Select({ options, className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) {
  return <NativeSelect className={className} {...rest}>{options.map((o) => <option key={o}>{o}</option>)}</NativeSelect>;
}

/* ---------- feedback ---------- */
type AlertTone = 'bad' | 'warn' | 'info' | 'ok';
const alertTone: Record<AlertTone, string> = { bad: 'bg-bad-bg border-bad-bd text-bad-ink', warn: 'bg-warn-bg border-warn-bd text-warn-ink', info: 'bg-info-bg border-info-bd text-info-ink', ok: 'bg-ok-bg border-ok-bd text-ok-ink' };
export function Alert({ tone = 'info', icon = 'info', title, children, action, className = '' }: { tone?: AlertTone; icon?: string; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={`flex gap-3 items-start rounded-card border px-4 py-3 text-[13.5px] ${alertTone[tone]} ${className}`}>
      <Icon name={icon} className="w-4 h-4 mt-0.5" />
      <div className="flex-1 min-w-0">{title && <div className="font-semibold">{title}</div>}{children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}</div>
      {action}
    </div>
  );
}
/** A progress track at the true ratio. */
export function Bar({ pct, color = '#1a4b8a', className = 'w-16' }: { pct: number; color?: string; className?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return <span className={`block h-1.5 rounded-full bg-line-soft overflow-hidden ${className}`}><span className="block h-full rounded-full" style={{ width: w + '%', background: color }} /></span>;
}
export function Tip({ left, top, children }: { left: number | string; top: number | string; children: ReactNode }) {
  return <div className="absolute pointer-events-none bg-navy text-white rounded-btn px-2.5 py-1.5 text-xs shadow-pop whitespace-nowrap -translate-x-1/2 -translate-y-full -mt-3" style={{ left, top }}>{children}</div>;
}
export function SubNav({ items }: { items: [string, ReactNode, (number | null)?][] }) {
  return (
    <nav className="flex flex-wrap gap-0.5 p-[3px] bg-cream rounded-btn w-fit max-w-full">
      {items.map(([to, label, n]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `inline-flex items-center gap-2 h-8 px-3 rounded-[5px] text-[13px] no-underline ${isActive ? 'bg-white text-ink font-medium shadow-[0_1px_2px_rgba(17,24,39,.08)]' : 'text-muted hover:text-ink'}`}>
          {label}{n ? <span className="num min-w-[18px] h-[18px] px-1.5 rounded-full bg-bad text-white text-[11px] inline-flex items-center justify-center">{n}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}

/* ---------- modal ---------- */
export function Modal({ open, onClose, width = 560, labelledBy, children }: { open: boolean; onClose?: () => void; width?: number; labelledBy?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[rgba(17,24,39,.42)]" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="w-full max-h-full overflow-auto bg-white rounded-card shadow-pop flex flex-col animate-sheet" style={{ maxWidth: width }}>
        {children}
      </div>
    </div>
  );
}
/** Dialog title row. A destructive dialog (tone="bad") colours its title, never an icon tile. */
export function ModalHead({ tone = 'info', title, sub, onClose, id }: { icon?: string; tone?: 'bad' | 'info' | 'ok' | 'warn'; title: ReactNode; sub?: ReactNode; onClose?: () => void; id?: string }) {
  return (
    <div className="flex items-start gap-3 px-6 pt-5 pb-4">
      <div className="flex-1 min-w-0"><h2 id={id} className={`text-[17px] leading-6 font-semibold ${tone === 'bad' ? 'text-bad' : ''}`}>{title}</h2>{sub && <p className="text-[13.5px] text-muted mt-1">{sub}</p>}</div>
      <button type="button" aria-label="Đóng" onClick={onClose} className="w-8 h-8 -mr-2 -mt-1 rounded-btn inline-flex items-center justify-center text-muted hover:bg-cream hover:text-ink"><Icon name="x" /></button>
    </div>
  );
}
export const ModalBody = ({ children }: { children: ReactNode }) => <div className="px-6 pb-5 flex flex-col gap-4">{children}</div>;
export const ModalFoot = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap justify-end items-center gap-2 px-6 py-3.5 border-t border-line-soft">{children}</div>;

/** Full-screen click-to-view for a thumbnail image (e.g. a horse's photo). */
export function ImageLightbox({ src, alt, open, onClose }: { src: string; alt: string; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[rgba(17,24,39,.86)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" onClick={onClose} aria-label="Đóng" className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20">
        <Icon name="x" className="w-5 h-5" />
      </button>
      <img src={src} alt={alt} className="max-w-full max-h-full rounded-card object-contain" />
    </div>
  );
}

/* ---------- small charts ---------- */
export function Ring({ value, size = 52, stroke = 4, color, track = '#eff0f3', text, textColor = '#1a1f2e', label }: { value: number; size?: number; stroke?: number; color: string; track?: string; text?: ReactNode; textColor?: string; label?: string }) {
  const r = size / 2 - stroke;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label || `${value}`} className="flex-none">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      {/* pathLength=100 lets the arc draw itself in from 0 with one CSS animation (.ring-arc). */}
      {value > 0 && <circle className="ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" pathLength={100} strokeDasharray={`${value} 100`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600" fontSize={size * 0.3} fill={textColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{text ?? value}</text>
    </svg>
  );
}

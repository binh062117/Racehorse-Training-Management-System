import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, NavLink } from 'react-router-dom';

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
  lock: ['M4 11h16v10H4z', 'M8 11V7a4 4 0 0 1 8 0v4'], unlock: ['M4 11h16v10H4z', 'M8 11V7a4 4 0 0 1 7.5-2'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'], trash: ['M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6'],
  user: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M4 21a8 8 0 0 1 16 0'], flag: ['M4 22V4M4 4h13l-2 4 2 4H4'],
  download: ['M12 3v12M7 10l5 5 5-5M5 21h14'], external: ['M7 17 17 7M7 7h10v10'],
  camera: ['M3 7h3l2-3h8l2 3h3v13H3Z', 'M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'], send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  pin: ['M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11Z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'], info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 11v5M12 8h.01'],
  syringe: ['m18 2 4 4M7 13l4 4M3 21l4-4M14 4l6 6-9 9-6-6Z'], steth: ['M4 4v6a6 6 0 0 0 12 0V4', 'M8 4H4M16 4h-4', 'M20 12a2 2 0 1 0 0 .01', 'M10 16v1a5 5 0 0 0 10 0v-1'],
  pill: ['M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z', 'M8.5 8.5l7 7'], file: ['M3 3h18v18H3z', 'M8 8h8M8 12h8M8 16h5'],
  sparkle: ['M12 3v4M12 17v4M3 12h4M17 12h4', 'M8 8 6 6M18 18l-2-2M16 8l2-2M6 18l2-2'],
};
export function Icon({ name, className = 'w-4 h-4', label }: { name: string; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={'flex-none ' + className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined} aria-label={label}>
      {(P[name] || []).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ---------- badges ---------- */
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neu' | 'lock';
const tones: Record<Tone, string> = {
  ok: 'text-ok bg-ok-bg', warn: 'text-warn bg-warn-bg', bad: 'text-bad bg-bad-bg', info: 'text-info bg-info-bg',
  neu: 'text-neu bg-neu-bg border border-line', lock: 'text-bad bg-bad-bg border border-bad',
};
export function Badge({ tone = 'neu', className = '', children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-[5px] h-[22px] px-2 rounded-badge text-[10.5px] font-bold uppercase tracking-[.05em] whitespace-nowrap leading-none ${tones[tone]} ${className}`}>{children}</span>;
}
export const healthTone: Record<string, Tone> = { FIT: 'ok', MONITORING: 'warn', QUARANTINED: 'bad', INJURED: 'bad' };
export const careerTone: Record<string, Tone> = { ACTIVE: 'ok', RESTING: 'warn', RETIRED: 'neu' };
export const fitColor = (v: number | null | undefined) => (v == null ? '#9ca3af' : v >= 80 ? '#3a6b4a' : v >= 60 ? '#8a6218' : '#8a2020');
export function LockBadge({ children = 'Locked', className = '' }: { children?: ReactNode; className?: string }) {
  return <Badge tone="lock" className={className}><Icon name="lock" className="w-3.5 h-3.5" />{children}</Badge>;
}

/* ---------- buttons ---------- */
type BtnVariant = 'p' | 's' | 'd' | 'g' | 'light' | 'ghostDark';
const btnV: Record<BtnVariant, string> = {
  p: 'bg-navy text-white hover:bg-navy-hover',
  s: 'bg-white text-navy border-line hover:bg-cream',
  d: 'bg-bad text-white hover:bg-[#741a1a]',
  g: 'bg-transparent text-navy hover:bg-info-bg',
  light: 'bg-cream text-navy hover:bg-white',
  ghostDark: 'bg-white/10 text-white border-white/20 hover:bg-white/15',
};
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  to?: string;
  v?: BtnVariant;
  sm?: boolean;
}
export function Btn({ to, v = 's', sm, className = '', children, ...rest }: BtnProps) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-btn border border-transparent font-semibold whitespace-nowrap no-underline transition-colors disabled:bg-line-soft disabled:text-faint disabled:border-line-soft disabled:cursor-not-allowed ${sm ? 'h-8 px-3 text-[12.5px]' : 'h-10 px-4 text-[13px]'} ${btnV[v]} ${className}`;
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

/* ---------- surfaces ---------- */
export function Card({ className = '', children, ...rest }: { className?: string; children: ReactNode; [k: string]: unknown }) {
  return <section className={`bg-white border border-line rounded-card ${className}`} {...rest}>{children}</section>;
}
export function CardHeader({ title, children, className = '' }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 px-5 py-4 border-b border-line-soft ${className}`}>
      {typeof title === 'string' ? <h2 className="flex-1 text-[15px] font-semibold leading-5">{title}</h2> : title}
      {children}
    </div>
  );
}
export function Kpi({ label, value, small, color, sub }: { label: string; value: ReactNode; small?: ReactNode; color?: string; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4">
      <span className="lbl">{label}</span>
      <span className="font-display font-bold text-[36px] leading-9 num" style={{ color }}>{value}{small && <small className="font-sans text-[12.5px] font-medium text-muted ml-1">{small}</small>}</span>
      {sub && <span className="cap">{sub}</span>}
    </div>
  );
}
export function HeroStat({ label, value, small, color, first }: { label: string; value: ReactNode; small?: ReactNode; color?: string; first?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${first ? '' : 'pl-6 border-l border-white/10'} pr-6`}>
      <span className="lbl">{label}</span>
      <span className="font-display font-bold text-[44px] leading-10 num" style={{ color }}>{value}{small && <small className="font-sans text-[13px] font-medium text-hero-muted ml-1">{small}</small>}</span>
    </div>
  );
}
export function HeroStats({ items }: { items: { label: string; value: ReactNode; small?: ReactNode; color?: string }[] }) {
  return <div className="flex flex-wrap gap-y-4">{items.map((s, i) => <HeroStat key={s.label} first={i === 0} {...s} />)}</div>;
}

/* ---------- racing identity ---------- */
const SILK_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
function hashSilk(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return SILK_LETTERS[h % SILK_LETTERS.length];
}
export function silkOf(ownerKey: string | null | undefined): string {
  return 'silk silk-' + (ownerKey ? hashSilk(ownerKey) : 'a');
}
export function Silk({ owner, size = 30, className = '' }: { owner?: string | null; size?: number; className?: string }) {
  return <span aria-hidden="true" className={`${silkOf(owner)} ${className}`} style={{ width: size, height: size }} />;
}
export function Cloth({ n, inv, lg, className = '' }: { n: ReactNode; inv?: boolean; lg?: boolean; className?: string }) {
  return <span className={`cloth ${inv ? 'cloth-inv' : ''} ${className}`} style={lg ? { minWidth: 44, height: 50, fontSize: 32, borderRadius: 6 } : undefined}>{n}</span>;
}
export function HorseIdent({ horse, size = 30, nameClass = 'text-[19px] leading-5', sub }: { horse: { no: ReactNode; owner?: string | null; name: string }; size?: number; nameClass?: string; sub?: ReactNode }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <Cloth n={horse.no} />
      <Silk owner={horse.owner} size={size} />
      <span className="min-w-0">
        <span className={`disp block truncate ${nameClass}`}>{horse.name}</span>
        {sub && <span className="cap block">{sub}</span>}
      </span>
    </span>
  );
}
export function FormGuide({ form, dark }: { form: string; dark?: boolean }) {
  return (
    <span className="inline-flex gap-[3px]">
      {form.split('').map((v, i) => {
        const win = v === '1', place = v === '2' || v === '3';
        const cls = dark
          ? (win ? 'bg-[#4f8a62] text-white border-[#4f8a62]' : 'bg-white/10 text-hero-line border-white/15')
          : (win ? 'bg-ok text-white border-ok' : place ? 'bg-white text-ink border-line' : 'bg-cream text-muted border-line');
        return <i key={i} className={`not-italic w-5 h-5 rounded-badge inline-flex items-center justify-center font-display font-bold text-[13px] border ${cls}`}>{v}</i>;
      })}
    </span>
  );
}

/* ---------- controls ---------- */
export function Seg({ options, value, onChange, dark }: { options: (string | [string, ReactNode])[]; value: string; onChange?: (k: string) => void; dark?: boolean }) {
  return (
    <div role="tablist" className={`inline-flex p-[3px] gap-0.5 rounded-btn border ${dark ? 'bg-white/5 border-white/15' : 'bg-white border-line'}`}>
      {options.map((o) => {
        const [k, l] = Array.isArray(o) ? o : [o, o];
        const on = k === value;
        return <button key={k} type="button" role="tab" aria-selected={on} onClick={() => onChange?.(k)}
          className={`h-[30px] px-3 rounded-md text-[12.5px] ${on ? (dark ? 'bg-cream text-navy font-semibold' : 'bg-navy text-white font-semibold') : (dark ? 'text-hero-line' : 'text-muted font-medium')}`}>{l}</button>;
      })}
    </div>
  );
}
export function Chip({ on, onClick, children, className = '' }: { on?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return <button type="button" aria-pressed={on} onClick={onClick}
    className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[12.5px] font-medium ${on ? 'bg-navy text-white border-navy' : 'bg-white text-ink border-line'} ${className}`}>{children}</button>;
}
export function Field({ label, htmlFor, req, hint, err, children, className = '' }: { label?: string; htmlFor?: string; req?: boolean; hint?: ReactNode; err?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      {label && <label htmlFor={htmlFor} className="text-[12.5px] font-semibold">{label}{req && <span className="text-bad"> *</span>}</label>}
      {children}
      {hint && <span className={`text-[11.5px] leading-4 ${err ? 'text-bad font-medium' : 'text-muted'}`}>{hint}</span>}
    </div>
  );
}
const inputCls = (err?: boolean, ro?: boolean) => `h-10 w-full rounded-btn border bg-white px-3 text-[13px] outline-none focus:border-info focus:ring-1 focus:ring-info ${err ? 'border-bad ring-1 ring-bad' : 'border-line'} ${ro ? 'bg-cream text-muted' : ''}`;
export function Input({ err, ro, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { err?: boolean; ro?: boolean }) {
  return <input className={`${inputCls(err, ro)} ${className}`} readOnly={ro} {...rest} />;
}
export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`w-full min-h-[88px] rounded-btn border border-line bg-white px-3 py-2.5 text-[13px] leading-[19px] outline-none focus:border-info focus:ring-1 focus:ring-info resize-y ${className}`} {...rest} />;
}
export function Select({ options, className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <select className={`${inputCls()} appearance-none pr-9`} {...rest}>{options.map((o) => <option key={o}>{o}</option>)}</select>
      <Icon name="chevDown" className="w-4 h-4 absolute right-3 text-muted pointer-events-none" />
    </div>
  );
}
export function SearchInput({ placeholder, className = '', value, onChange }: { placeholder?: string; className?: string; value?: string; onChange?: (v: string) => void }) {
  return (
    <label className={`flex items-center gap-2 h-9 rounded-btn border border-line bg-white px-3 text-muted ${className}`}>
      <Icon name="search" />
      <input type="search" placeholder={placeholder} aria-label={placeholder} value={value} onChange={(e) => onChange?.(e.target.value)} className="flex-1 min-w-0 border-0 outline-none bg-transparent text-ink" />
    </label>
  );
}
export function OptionCard({ on, disabled, onClick, children, className = '' }: { on?: boolean; disabled?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} aria-disabled={disabled} onClick={disabled ? undefined : onClick}
      className={`flex items-center gap-3 w-full text-left rounded-btn border px-3 py-2.5 ${disabled ? 'bg-cream text-faint cursor-not-allowed border-line' : on ? 'border-info ring-1 ring-info bg-[#f7f9fd]' : 'border-line bg-white hover:bg-subtle'} ${className}`}>
      <span className={`w-4 h-4 flex-none rounded-full border-[1.5px] inline-flex items-center justify-center bg-white ${on ? 'border-info' : 'border-line-strong'}`}>{on && <span className="w-2 h-2 rounded-full bg-info" />}</span>
      {children}
    </button>
  );
}

/* ---------- feedback ---------- */
type AlertTone = 'bad' | 'warn' | 'info' | 'ok';
const alertTone: Record<AlertTone, string> = { bad: 'bg-bad-bg border-bad-bd text-bad', warn: 'bg-warn-bg border-warn-bd text-warn', info: 'bg-info-bg border-info-bd text-info', ok: 'bg-ok-bg border-ok-bd text-ok' };
export function Alert({ tone = 'info', icon = 'info', title, children, action, className = '' }: { tone?: AlertTone; icon?: string; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={`flex gap-3 items-start rounded-btn border px-4 py-3 ${alertTone[tone]} ${className}`}>
      <Icon name={icon} className="w-5 h-5 mt-px" />
      <div className="flex-1">{title && <div className="font-semibold">{title}</div>}{children && <div className="text-ink mt-0.5">{children}</div>}</div>
      {action}
    </div>
  );
}
export function Bar({ pct, color = '#1a4b8a', className = 'w-16' }: { pct: number; color?: string; className?: string }) {
  return <span className={`inline-block h-1.5 rounded bg-line-soft overflow-hidden flex-none ${className}`}><i className="block h-full rounded" style={{ width: pct + '%', background: color }} /></span>;
}
export function Sev({ level, dark }: { level: 0 | 1 | 2 | 3; dark?: boolean }) {
  const c = ['#3a6b4a', '#8a6218', '#8a2020', '#5e1414'][level];
  const n = ['Thấp', 'Trung bình', 'Cao', 'Khẩn cấp'][level];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.05em]" style={{ color: dark ? '#f3b4b4' : c }}>
      {n}<i className="inline-flex gap-0.5">{[0, 1, 2, 3].map((k) => <b key={k} className="w-[5px] h-3 rounded-[1px]" style={{ background: k <= level ? (dark ? '#f3b4b4' : c) : (dark ? 'rgba(255,255,255,.2)' : '#e2e0db') }} />)}</i>
    </span>
  );
}
export function Tip({ left, top, children }: { left: number | string; top: number | string; children: ReactNode }) {
  return <div className="absolute pointer-events-none bg-navy text-white rounded-btn px-2.5 py-2 text-xs shadow-pop whitespace-nowrap -translate-x-1/2 -translate-y-full -mt-3" style={{ left, top }}>{children}</div>;
}
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-y-2">
      {steps.map((s, i) => {
        const done = i < current, cur = i === current;
        return (
          <span key={s} className="flex items-center">
            {i > 0 && <span className={`w-9 h-0.5 mx-2.5 ${done || cur ? 'bg-ok-on' : 'bg-white/20'}`} />}
            <span className={`flex items-center gap-2 text-[12.5px] font-semibold ${done || cur ? 'text-white' : 'text-hero-label'}`}>
              <b className={`w-[26px] h-[26px] rounded-full inline-flex items-center justify-center font-display text-[15px] border-[1.5px] ${done ? 'bg-ok-on border-ok-on text-navy' : cur ? 'bg-cream border-cream text-navy' : 'border-white/30'}`}>{done ? '✓' : i + 1}</b>{s}
            </span>
          </span>
        );
      })}
    </div>
  );
}
export function Tabs({ items }: { items: [string, ReactNode, boolean?][] }) {
  return (
    <nav className="flex gap-1 border-b border-line overflow-x-auto" aria-label="Mục">
      {items.map(([to, label, ext]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `inline-flex items-center gap-2 h-10 px-3.5 -mb-px border-b-2 whitespace-nowrap no-underline ${isActive ? 'text-info border-info font-semibold' : 'text-muted border-transparent font-medium hover:text-ink'}`}>
          {label}{ext && <Icon name="external" className="w-3.5 h-3.5" />}
        </NavLink>
      ))}
    </nav>
  );
}
export function SubNav({ items }: { items: [string, ReactNode, (number | null)?][] }) {
  return (
    <nav className="flex flex-wrap gap-1 p-1 bg-[#efede8] rounded-card w-fit max-w-full">
      {items.map(([to, label, n]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `inline-flex items-center gap-2 h-9 px-3.5 rounded-[7px] text-[12.5px] font-semibold no-underline ${isActive ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
          {label}{n ? <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-bad text-white text-[10.5px] inline-flex items-center justify-center">{n}</span> : null}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-navy/40" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="w-full max-h-full overflow-auto bg-white border border-line rounded-xl shadow-pop flex flex-col" style={{ maxWidth: width }}>
        {children}
      </div>
    </div>
  );
}
export function ModalHead({ icon, tone = 'info', title, sub, onClose, id }: { icon?: string; tone?: 'bad' | 'info' | 'ok' | 'warn'; title: ReactNode; sub?: ReactNode; onClose?: () => void; id?: string }) {
  const t = { bad: 'bg-bad-bg text-bad', info: 'bg-info-bg text-info', ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn' }[tone];
  return (
    <div className="flex items-start gap-3 px-6 pt-5 pb-4">
      {icon && <span className={`w-10 h-10 rounded-card flex items-center justify-center flex-none ${t}`}><Icon name={icon} className="w-5 h-5" /></span>}
      <div className="flex-1"><h2 id={id} className="text-base font-semibold">{title}</h2>{sub && <p className="text-muted mt-1">{sub}</p>}</div>
      <button type="button" aria-label="Đóng" onClick={onClose} className="w-8 h-8 rounded-btn inline-flex items-center justify-center text-muted hover:bg-cream"><Icon name="x" /></button>
    </div>
  );
}
export const ModalBody = ({ children }: { children: ReactNode }) => <div className="px-6 pb-5 flex flex-col gap-4">{children}</div>;
export const ModalFoot = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap justify-end items-center gap-2 px-6 py-4 border-t border-line-soft bg-subtle rounded-b-xl">{children}</div>;

/* ---------- small charts ---------- */
export function Ring({ value, size = 60, stroke = 5, color, track = '#eceae4', text, textColor = '#1a1f2e', label }: { value: number; size?: number; stroke?: number; color: string; track?: string; text?: ReactNode; textColor?: string; label?: string }) {
  const r = size / 2 - stroke, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label || `${value}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" fontFamily="Barlow Condensed, Arial Narrow, sans-serif" fontWeight="700" fontSize={size * 0.32} fill={textColor}>{text ?? value}</text>
    </svg>
  );
}
export function Sparkline({ values, w = 120, h = 30, color = '#2f62a8', dot = true, className = '' }: { values: number[]; w?: number; h?: number; color?: string; dot?: boolean; className?: string }) {
  const min = 55, max = 90;
  const y = (v: number) => (h - 2 - ((v - min) / (max - min)) * (h - 4)).toFixed(1);
  const step = (w - 4) / (values.length - 1);
  const pts = values.map((v, i) => `${(2 + i * step).toFixed(1)},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts} />
      {dot && <circle cx={w - 2} cy={Number(y(values[values.length - 1]))} r="3" fill={color} />}
    </svg>
  );
}

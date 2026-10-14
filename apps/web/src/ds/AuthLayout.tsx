import type { ReactNode } from 'react';

/** Centered navy-on-cream auth shell (login/register) — no reference screen
 * in the racehorse-ui mockup (auth wasn't in scope), designed to match its
 * token set (navy hero, Barlow Condensed display type). */
export function AuthLayout({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="hero px-7 py-6 mb-0 rounded-b-none">
          <span className="w-10 h-10 rounded-full bg-cream text-navy flex items-center justify-center text-xs font-bold tracking-wider">RH</span>
          <div className="mt-3 lbl">{eyebrow}</div>
          <h1 className="disp text-[40px] mt-1">{title}</h1>
        </div>
        <div className="bg-white border border-line border-t-0 rounded-b-xl px-7 py-7 shadow-lift flex flex-col gap-4">
          {children}
        </div>
      </div>
    </div>
  );
}

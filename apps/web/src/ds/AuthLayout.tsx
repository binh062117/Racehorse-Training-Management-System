import type { ReactNode } from 'react';
import { Icon } from './ui';

const FEATURES: [string, string][] = [
  ['horse', 'Hồ sơ & phả hệ từng chiến mã'],
  ['plans', 'Giáo án huấn luyện theo giai đoạn'],
  ['steth', 'Theo dõi sức khỏe, cảnh báo AI'],
  ['flag', 'Quản lý lịch thi đấu & kết quả'],
];

/** Split-screen auth shell (login/register) — left: branded banner, right:
 * form card. No reference screen in the racehorse-ui mockup (auth wasn't in
 * scope), self-designed to match its token set (navy hero, track-lane
 * pattern, Barlow Condensed display type). */
export function AuthLayout({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-page">
      <div className="hero rounded-none relative flex flex-col justify-between gap-8 px-8 py-10 lg:px-14 lg:py-14 lg:min-h-screen overflow-hidden">
        <Icon
          name="horse"
          className="pointer-events-none absolute -bottom-10 -right-10 w-[320px] h-[320px] text-white/[0.06]"
        />

        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-cream text-navy flex items-center justify-center text-xs font-bold tracking-wider flex-none">RH</span>
          <span className="lbl">Racehorse Club</span>
        </div>

        <div>
          <div className="lbl">Training &amp; Management System</div>
          <h1 className="disp text-[40px] lg:text-[52px] leading-[0.95] mt-2">
            Quản lý &amp; huấn luyện<br />ngựa đua chuyên nghiệp
          </h1>
          <p className="text-hero-muted mt-4 max-w-[420px] leading-relaxed">
            Nền tảng hợp nhất hồ sơ ngựa, giáo án huấn luyện, hồ sơ y tế và giải đua cho toàn bộ câu lạc bộ.
          </p>

          <ul className="list-none p-0 mt-8 flex flex-col gap-3.5">
            {FEATURES.map(([icon, label]) => (
              <li key={label} className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-card bg-white/10 flex items-center justify-center flex-none">
                  <Icon name={icon} className="w-[18px] h-[18px] text-white" />
                </span>
                <span className="text-[13.5px] text-white/90">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-hero-muted text-[11.5px]">© {new Date().getFullYear()} Racehorse Club · SWP391</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-[400px]">
          <div className="lbl">{eyebrow}</div>
          <h2 className="disp text-[32px] mt-1 mb-6">{title}</h2>
          <div className="flex flex-col gap-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';

const FEATURES: { label: string; icon: ReactNode }[] = [
  {
    label: 'Hồ sơ & phả hệ từng ngựa',
    icon: <><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="12" r="2.2" /><path d="M8.2 6h2.3A3.5 3.5 0 0 1 14 9.5V12m0 0v2.5a3.5 3.5 0 0 1-3.5 3.5H8.2M14 12h1.8" /></>,
  },
  {
    label: 'Giáo án huấn luyện theo giai đoạn',
    icon: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM9.5 14l2 2 3.5-4" /></>,
  },
  {
    label: 'Theo dõi sức khỏe, cảnh báo AI',
    icon: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  },
  {
    label: 'Quản lý lịch thi đấu & kết quả',
    icon: <path d="M6 21V4M6 5h11l-2 4 2 4H6" />,
  },
];

const ROLES = ['Quản lý', 'Huấn luyện viên', 'Thú y', 'Chăm sóc', 'Chủ ngựa'];

/** Split-screen auth shell (login/register) — left: branded banner, right:
 * form card. No reference screen in the racehorse-ui mockup (auth wasn't in
 * scope); banner design ported from the "Racehorse Club Login" canvas the
 * user approved, adapted to the app's own DS v3 tokens where they already
 * cover a color (navy/cream/ink/line-strong) and kept as one-off accent
 * blues (#5b9bd5 / #8fb8e0) where the canvas intentionally departs from the
 * flatter brand-blue used elsewhere, to preserve that banner's own look. */
/* `eyebrow` is accepted for the callers' sake but no longer shown: the form side
 * leads with its title, the way every app screen does. */
export function AuthLayout({ title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-page">
      <div className="relative overflow-hidden flex flex-col justify-between gap-10 px-6 py-8 sm:px-8 lg:px-16 lg:py-14 lg:min-h-screen bg-navy text-cream">
        {/* The track ornament sits in the bottom-right corner, behind the copy column's right edge, never under the text. */}
        <svg aria-hidden="true" viewBox="0 0 980 760" className="hidden xl:block pointer-events-none absolute -right-[460px] -bottom-[400px] w-[980px] h-[760px]">
          <defs>
            <pattern id="auth-chk" width="16" height="16" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="8" height="8" fill="#f5f4f1" />
              <rect x="8" y="8" width="8" height="8" fill="#f5f4f1" />
            </pattern>
          </defs>
          <g fill="none" stroke="#f5f4f1">
            <rect x="40" y="120" width="900" height="520" rx="260" strokeOpacity="0.14" strokeWidth="2" />
            <rect x="82" y="156" width="816" height="448" rx="224" strokeOpacity="0.09" strokeWidth="1.5" />
            <rect x="124" y="192" width="732" height="376" rx="188" strokeOpacity="0.09" strokeWidth="1.5" />
            <rect x="166" y="228" width="648" height="304" rx="152" strokeOpacity="0.09" strokeWidth="1.5" />
            <rect x="208" y="264" width="564" height="232" rx="116" strokeOpacity="0.14" strokeWidth="2" />
          </g>
          <rect x="124" y="192" width="732" height="376" rx="188" fill="none" stroke="#5b9bd5" strokeWidth="3" strokeLinecap="round" pathLength={1000} strokeDasharray="220 780" />
          <rect x="124" y="192" width="732" height="376" rx="188" fill="none" stroke="#5b9bd5" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" pathLength={1000} strokeDasharray="90 910" strokeDashoffset={-240} />
          <rect x="556" y="116" width="16" height="190" fill="url(#auth-chk)" opacity="0.32" />
        </svg>

        <div className="relative flex items-center gap-3">
          <span className="w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-white flex-none overflow-hidden flex items-center justify-center">
            <img src="/icons/manager-horse-head.png" alt="Logo Racehorse Club" className="w-full h-full object-contain scale-[1.35]" />
          </span>
          <span className="leading-tight"><span className="block text-[15px] font-semibold text-white">Racehorse Club</span><span className="block text-[12.5px] text-[#b7c0cc]">Huấn luyện &amp; quản lý</span></span>
        </div>

        <div className="relative flex flex-col gap-7">
          <div className="flex flex-col gap-[18px]">
            <h1 className="m-0 max-w-[600px] text-[30px] sm:text-[36px] lg:text-[50px] leading-[1.08] font-semibold tracking-[-0.025em] text-white">
              Quản lý &amp; huấn luyện <span className="text-[#5b9bd5]">ngựa đua</span> chuyên nghiệp
            </h1>
            <p className="m-0 max-w-[520px] text-[15px] lg:text-[17px] leading-relaxed text-[#c3cbd6]">
              Nền tảng hợp nhất hồ sơ ngựa, giáo án huấn luyện, hồ sơ y tế và giải đua cho toàn bộ câu lạc bộ.
            </p>
          </div>

          <div className="hidden lg:grid grid-cols-2 gap-x-8 gap-y-4 max-w-[560px] pt-6 border-t border-white/10">
            {FEATURES.map(({ label, icon }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex-none text-[#8fb8e0]">
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    {icon}
                  </svg>
                </span>
                <div className="text-[14px] leading-[1.35] text-[#e3e8ee]">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex flex-col gap-4">
          <div className="hidden lg:flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12.5px] text-[#aab4c2]">Dành cho</span>
            {ROLES.map((role) => (
              <span key={role} className="px-2.5 py-1 rounded-badge border border-white/[.16] text-[12.5px] text-[#d3d9e1]">{role}</span>
            ))}
          </div>
          <div className="text-[12.5px] text-[#aab4c2]">© {new Date().getFullYear()} Racehorse Club · SWP391</div>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-8 sm:p-10 lg:p-14">
        <div className="w-full max-w-[400px]">
          <h2 className="text-[24px] leading-8 font-semibold tracking-[-0.01em]">{title}</h2>
          {subtitle && <p className="text-[14px] text-muted mt-1">{subtitle}</p>}
          <div className="flex flex-col gap-4 mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

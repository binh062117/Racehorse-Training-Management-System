import type { ReactNode } from 'react';

const FEATURES: { label: string; icon: ReactNode }[] = [
  {
    label: 'Hồ sơ & phả hệ từng chiến mã',
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
export function AuthLayout({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-page">
      <div
        className="relative overflow-hidden flex flex-col justify-between gap-10 px-8 py-10 lg:px-16 lg:py-14 lg:min-h-screen bg-navy text-cream"
        style={{ backgroundImage: 'radial-gradient(60% 55% at 88% 92%, rgba(91,155,213,0.20), rgba(91,155,213,0) 70%)' }}
      >
        <svg aria-hidden="true" viewBox="0 0 980 760" className="hidden lg:block pointer-events-none absolute -right-[300px] -bottom-[110px] w-[980px] h-[760px]">
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
        <img
          aria-hidden="true" alt="" src="/icons/manager-horse-head.png"
          className="hidden lg:block pointer-events-none absolute -right-[60px] -bottom-[30px] w-[500px] h-[500px] object-contain invert mix-blend-screen opacity-20"
        />

        <div className="relative flex items-center gap-3">
          <span className="w-14 h-14 rounded-full bg-white flex-none overflow-hidden flex items-center justify-center">
            <img src="/icons/manager-horse-head.png" alt="Logo Racehorse Club" className="w-full h-full object-contain scale-[1.35]" />
          </span>
          <span className="text-[13px] font-semibold tracking-[.16em] uppercase text-[#b7c0cc]">Racehorse Club</span>
        </div>

        <div className="relative flex flex-col gap-7">
          <div className="flex flex-col gap-[18px]">
            <div className="text-[11px] font-semibold tracking-[.14em] uppercase text-[#8fb8e0]">Hệ thống huấn luyện &amp; quản lý</div>
            <h1 className="m-0 max-w-[640px] text-[34px] lg:text-[54px] leading-[1.07] font-semibold tracking-[-0.025em]">
              Quản lý &amp; huấn luyện <span className="text-[#5b9bd5]">ngựa đua</span> chuyên nghiệp
            </h1>
            <p className="m-0 max-w-[520px] text-[17px] leading-relaxed text-[#b7c0cc]">
              Nền tảng hợp nhất hồ sơ ngựa, giáo án huấn luyện, hồ sơ y tế và giải đua cho toàn bộ câu lạc bộ.
            </p>
          </div>

          <div className="hidden lg:grid grid-cols-2 gap-3 max-w-[620px]">
            {FEATURES.map(({ label, icon }) => (
              <div key={label} className="flex items-center gap-3.5 px-4 py-3.5 rounded-[10px] border border-white/10 bg-white/[.04]">
                <span className="w-10 h-10 flex-none rounded-lg bg-[#5b9bd5]/[.16] text-[#8fb8e0] flex items-center justify-center">
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    {icon}
                  </svg>
                </span>
                <div className="text-[14px] leading-[1.35] font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex flex-col gap-4">
          <div className="hidden lg:flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12px] text-[#98a3b3]">Dành cho</span>
            {ROLES.map((role) => (
              <span key={role} className="px-3 py-1 rounded-full border border-white/[.16] text-[12px] text-[#d3d9e1]">{role}</span>
            ))}
          </div>
          <div className="text-[12px] text-[#98a3b3]">© {new Date().getFullYear()} Racehorse Club · SWP391</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-[400px]">
          <div className="lbl">{eyebrow}</div>
          <h2 className="disp text-[32px] mt-1">{title}</h2>
          {subtitle && <p className="cap mt-2 mb-2">{subtitle}</p>}
          <div className="flex flex-col gap-4 mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

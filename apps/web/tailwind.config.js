/**
 * Tokens: "Achromatic ledger" app style (tasteskill), with the Racehorse brand
 * kept — navy #1c2b3a is the near-black primary, brand blue #1a4b8a is the one
 * data hue. The chrome holds no colour; colour goes on data and status only.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1c2b3a', hover: '#243447', deep: '#17242f', track: '#2a3f55' },
        // A ledger's blue-grey ground, one step off white and low in chroma.
        page: '#f2f4f7',
        cream: '#eceef2',
        subtle: '#f8f9fb',
        ink: '#1a1f2e',
        muted: '#5f6368',
        faint: '#6b6b6b',
        line: { DEFAULT: '#e5e7eb', soft: '#eff0f3', strong: '#d1d5db' },
        brand: { blue: '#1a4b8a' },
        // Status: pale tint + dark ink of the same hue (DEFAULT = the signal colour).
        ok: { DEFAULT: '#247b50', bg: '#dcf5e4', bd: '#b9e6c8', ink: '#14532d', on: '#9fd9b1' },
        warn: { DEFAULT: '#b45309', bg: '#fdf6e3', bd: '#fde68a', ink: '#92400e', on: '#f3d29a' },
        bad: { DEFAULT: '#c4242a', bg: '#fdecea', bd: '#f5c6c2', ink: '#831c1e', on: '#f3b4b4', deep: '#5e1414' },
        info: { DEFAULT: '#1a4b8a', bg: '#eaf0f9', bd: '#c9d8ef', ink: '#163e72' },
        neu: { DEFAULT: '#5f6368', bg: '#eff0f3', ink: '#3f444a' },
        chart: { blue: '#1a4b8a', amber: '#c8862a', light: '#c4d5ee', mid: '#7da2d6' },
        hero: { muted: '#a9b6c7', label: '#93a3b8', line: '#cbd5e1' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Second face, one job: the saddle-cloth number and the wordmark.
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'ui-sans-serif', 'sans-serif'],
      },
      borderRadius: { card: '8px', btn: '6px', badge: '4px' },
      boxShadow: {
        // Only for what floats: menus, popovers, dialogs, tooltips.
        pop: '0 12px 32px rgba(17,24,39,.14)',
        lift: '0 8px 24px rgba(28,43,58,.08)',
      },
      keyframes: {
        toastIn: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        sheetIn: { '0%': { opacity: 0, transform: 'translateY(-6px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { toast: 'toastIn .2s ease-out', sheet: 'sheetIn .16s ease-out' },
    },
  },
  plugins: [],
}

/** Tokens mirror "Racehorse Design System" v3 (navy / cream / blue). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1c2b3a', hover: '#243447', deep: '#17242f', track: '#2a3f55' },
        cream: '#f5f4f1',
        page: '#f5f4f1',
        subtle: '#fafaf8',
        ink: '#1a1f2e',
        muted: '#6b7280',
        faint: '#9ca3af',
        line: { DEFAULT: '#e2e0db', soft: '#eceae4', strong: '#cdc9c3' },
        brand: { blue: '#1a4b8a' },
        ok: { DEFAULT: '#3a6b4a', bg: '#edf7f0', bd: '#c6dfcd', on: '#9fd9b1' },
        warn: { DEFAULT: '#8a6218', bg: '#fdf6e8', bd: '#ecdcb6', on: '#f3d29a' },
        bad: { DEFAULT: '#8a2020', bg: '#fdf0f0', bd: '#e8c4c4', on: '#f3b4b4', deep: '#5e1414' },
        info: { DEFAULT: '#1a4b8a', bg: '#eef3fb', bd: '#c9d8ef' },
        neu: { DEFAULT: '#6b7280', bg: '#f5f4f1' },
        chart: { blue: '#2f62a8', amber: '#c8862a', light: '#c4d5ee', mid: '#7da2d6' },
        hero: { muted: '#a9b6c7', label: '#93a3b8', line: '#cbd5e1' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'ui-sans-serif', 'sans-serif'],
      },
      borderRadius: { card: '10px', btn: '8px', badge: '4px' },
      boxShadow: {
        pop: '0 10px 25px rgba(26,31,46,.15)',
        lift: '0 8px 24px rgba(28,43,58,.08)',
      },
      keyframes: {
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(74,222,128,.6)' }, '70%': { boxShadow: '0 0 0 8px rgba(74,222,128,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(74,222,128,0)' } },
        toastIn: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { live: 'pulseRing 1.8s infinite', toast: 'toastIn .2s ease-out' },
    },
  },
  plugins: [],
}

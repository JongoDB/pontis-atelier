import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pearl: '#f9f7f4',
        bone: '#edeae2',
        midnight: '#214144',
        clay: '#828279',
        burnt: '#61655f',
        laser: '#e9ff14',
        ink: '#1a3134',
        cream: '#f5f1e8',
      },
      fontFamily: {
        sans: [
          '"Mabry Pro"',
          '"Inter"',
          '"Helvetica Neue"',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '"Mabry Pro"',
          '"Inter Display"',
          '"Helvetica Neue"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(3.5rem, 9vw, 6.5rem)', { lineHeight: '0.95', letterSpacing: '-0.04em' }],
        'display-lg': ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        'display': ['clamp(1.75rem, 3.5vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
      },
      letterSpacing: {
        widish: '0.08em',
        wide2: '0.14em',
        wide3: '0.22em',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
      },
      keyframes: {
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        sweep: {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        tourPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(233, 255, 20, 0.55)' },
          '50%': { boxShadow: '0 0 0 8px rgba(233, 255, 20, 0)' },
        },
      },
      animation: {
        riseIn: 'riseIn 600ms cubic-bezier(0.16, 1, 0.3, 1) both',
        fade: 'fade 500ms ease-out both',
        sweep: 'sweep 800ms cubic-bezier(0.16, 1, 0.3, 1) both',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        tourPulse: 'tourPulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;

/** Zeeto tokens: night black, chalk white, zeeto orange. One dark theme. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        panel: '#141414',
        raised: '#1F1F1F',
        line: 'rgba(250,248,243,0.08)',
        'line-2': 'rgba(250,248,243,0.16)',
        chalk: '#FAF8F3',
        mute: '#A1A1A1',
        dim: '#6B6B6B',
        z: { DEFAULT: '#FF7A1A', hot: '#FF5A00', ink: '#1A0B00', soft: 'rgba(255,122,26,0.13)' },
        good: { DEFAULT: '#3DD68C', soft: 'rgba(61,214,140,0.13)' },
        warn: { DEFAULT: '#F5B83D', soft: 'rgba(245,184,61,0.13)' },
        bad: { DEFAULT: '#F2685F', soft: 'rgba(242,104,95,0.13)' },
      },
      fontFamily: {
        sans: ['"Inter Tight"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: { glow: '0 0 0 1px rgba(255,122,26,.35), 0 12px 40px -12px rgba(255,122,26,.6)', lift: '0 24px 60px -24px rgba(0,0,0,.9)' },
    },
  },
  plugins: [],
};

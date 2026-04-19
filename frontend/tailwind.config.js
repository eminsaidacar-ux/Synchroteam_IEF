/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0f1117',
        card:     '#161b27',
        border:   '#242b3d',
        accent:   '#ff6b00',
        'accent-dim': '#b34a00',
        text:     '#e6e9ef',
        muted:    '#8a93a8',
        good:     '#22c55e',
        warn:     '#f59e0b',
        bad:      '#ef4444',
        ko:       '#a855f7',
      },
      fontFamily: {
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.02), 0 10px 30px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};

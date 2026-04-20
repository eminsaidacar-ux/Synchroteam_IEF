/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Palette macOS-like : plus cool, plus neutre, elevation bien définie.
        // Note : les noms de couleurs évitent de démarrer par la même
        // racine qu'un préfixe utilitaire pour éviter les collisions
        // @apply (ex: bg-bg-2 est ambigu → on utilise "panel").
        bg:          '#0a0c10', // fond app (base)
        panel:       '#12151c', // fond zones secondaires
        surface:     '#181b23', // cartes niveau 1
        raised:      '#1f232d', // cartes niveau 2 (hover/actif)
        floating:    '#262b37', // modals, popovers
        border:      '#262b37',
        strong:      '#343a4c', // border renforcée

        accent:      '#ff6b00',
        'accent-soft': '#ff8a38',
        'accent-dim':  '#b34a00',

        text:        '#ecedf0',
        text2:       '#b9bdc8',
        muted:       '#7c8293',
        subtle:      '#565b6a',

        good:        '#30d158', // SF system green
        warn:        '#ff9f0a', // SF system orange
        bad:         '#ff453a', // SF system red
        ko:          '#bf5af2', // SF system purple
        info:        '#0a84ff', // SF system blue
      },
      fontFamily: {
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['"Inter Variable"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Échelle typographique proche des guidelines Apple (1.125 ratio, resserré).
        'xs':    ['11px', { lineHeight: '14px', letterSpacing: '0.01em' }],
        'sm':    ['13px', { lineHeight: '18px', letterSpacing: '0' }],
        'base':  ['14px', { lineHeight: '20px', letterSpacing: '-0.005em' }],
        'lg':    ['16px', { lineHeight: '22px', letterSpacing: '-0.01em' }],
        'xl':    ['18px', { lineHeight: '24px', letterSpacing: '-0.015em' }],
        '2xl':   ['22px', { lineHeight: '28px', letterSpacing: '-0.02em' }],
        '3xl':   ['28px', { lineHeight: '34px', letterSpacing: '-0.025em' }],
        '4xl':   ['34px', { lineHeight: '40px', letterSpacing: '-0.03em' }],
      },
      boxShadow: {
        'card':      '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.35)',
        'card-hi':   '0 1px 0 rgba(255,255,255,0.04) inset, 0 16px 40px rgba(0,0,0,0.45)',
        'popover':   '0 2px 6px rgba(0,0,0,0.3), 0 24px 60px rgba(0,0,0,0.55)',
        'glow':      '0 0 0 1px rgba(255,107,0,0.3), 0 8px 24px rgba(255,107,0,0.18)',
        'ring':      '0 0 0 3px rgba(255,107,0,0.25)',
      },
      borderRadius: {
        'xl':   '12px',
        '2xl':  '16px',
        '3xl':  '22px',
      },
      backdropBlur: {
        'xs':  '4px',
        'sm':  '8px',
        'md':  '14px',
        'lg':  '22px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      animation: {
        'fade-in':   'fadeIn 180ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'slide-up':  'slideUp 240ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'pop-in':    'popIn 220ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'shimmer':   'shimmer 1.5s linear infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        popIn:   { '0%': { opacity: 0, transform: 'scale(0.96)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};

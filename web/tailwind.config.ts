import type { Config } from 'tailwindcss';

/**
 * The brand lives in start-saudi-kit/brand/tokens.css and nowhere else.
 *
 * Every entry below is a reference to a custom property from that file, never
 * a copied value: change the token and this config follows, and the two can
 * never drift. A hex literal in this directory is a bug — if you find yourself
 * reaching for one, the token you want is missing from tokens.css and that is
 * where it belongs.
 *
 * The cost of the indirection is that Tailwind's slash-opacity syntax
 * (`bg-navy/50`) cannot work, because Tailwind would have to inject an alpha
 * channel into a value it cannot see. Use `color-mix(in srgb, ...)` in a
 * utility class instead; `src/index.css` defines the few that are needed.
 */
const token = (name: string) => `var(--ss-${name})`;

export default {
  darkMode: ['class', '[data-surface="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Core palette */
        navy: { DEFAULT: token('navy'), alt: token('navy-alt'), raised: token('navy-raised') },
        green: { DEFAULT: token('green'), deep: token('green-deep') },
        cream: token('cream'),
        paper: token('white'),

        neutral: {
          50: token('neutral-50'),
          100: token('neutral-100'),
          200: token('neutral-200'),
          300: token('neutral-300'),
          400: token('neutral-400'),
          500: token('neutral-500'),
          600: token('neutral-600'),
          700: token('neutral-700'),
          800: token('neutral-800'),
          900: token('neutral-900'),
        },

        /* Surface-aware semantics. These flip with [data-surface="dark"],
           which is how a navy panel inside a light page stays legible without
           a single conditional class. */
        surface: {
          DEFAULT: token('bg'),
          raised: token('bg-raised'),
          soft: token('surface-soft'),
        },
        ink: { DEFAULT: token('ink'), muted: token('ink-muted') },
        accent: token('accent'),
        hairline: token('hairline'),

        success: token('success'),
        caution: token('caution'),
        danger: token('danger'),
      },

      /* Tailwind's `border` with no colour should mean the brand hairline. */
      borderColor: { DEFAULT: token('hairline') },
      ringColor: { DEFAULT: token('accent') },

      fontFamily: {
        display: token('font-display'),
        body: token('font-body'),
        arabic: token('font-arabic'),
        mono: token('font-mono'),
      },

      fontSize: {
        xs: [token('text-xs'), { lineHeight: token('leading-normal') }],
        sm: [token('text-sm'), { lineHeight: token('leading-normal') }],
        base: [token('text-base'), { lineHeight: token('leading-normal') }],
        lg: [token('text-lg'), { lineHeight: token('leading-snug') }],
        xl: [token('text-xl'), { lineHeight: token('leading-snug') }],
        '2xl': [token('text-2xl'), { lineHeight: token('leading-tight') }],
        '3xl': [token('text-3xl'), { lineHeight: token('leading-tight') }],
        '4xl': [token('text-4xl'), { lineHeight: token('leading-tight') }],
      },

      lineHeight: {
        tight: token('leading-tight'),
        snug: token('leading-snug'),
        normal: token('leading-normal'),
        loose: token('leading-loose'),
      },

      letterSpacing: {
        display: token('tracking-display'),
        normal: token('tracking-normal'),
      },

      spacing: {
        1: token('space-1'),
        2: token('space-2'),
        3: token('space-3'),
        4: token('space-4'),
        6: token('space-6'),
        8: token('space-8'),
        12: token('space-12'),
        16: token('space-16'),
      },

      borderRadius: {
        sm: token('radius-sm'),
        md: token('radius-md'),
        lg: token('radius-lg'),
        icon: token('radius-icon'),
        full: token('radius-full'),
      },

      boxShadow: {
        sm: token('shadow-sm'),
        md: token('shadow-md'),
        lg: token('shadow-lg'),
      },

      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
        breathe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'fade-up': 'fade-up 180ms ease-out both',
        /* The only motion tied to "something is happening". It never implies
           progress, only liveness — see AgentStatus. */
        breathe: 'breathe 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;

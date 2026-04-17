import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'gold-primary': '#D4A853',
        'gold-light': '#F5DC90',
        'gold-dark': '#B8912F',
        'cosmic-deep': '#0A0014',
        'cosmic-mid': '#140028',
        'cosmic-purple': '#1A0028',
        'linen': '#E8E0D0',
      },
      fontFamily: {
        display: ['var(--font-cinzel-decorative)', 'serif'],
        serif: ['var(--font-cinzel)', 'serif'],
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: { primary: '#0a0a0a', secondary: '#0f0f0f', card: '#141414', hover: '#1a1a1a', elevated: '#1f1f1f' },
        border: { subtle: 'rgba(255,255,255,0.06)', default: 'rgba(255,255,255,0.1)', hover: 'rgba(255,255,255,0.15)' },
        accent: { DEFAULT: '#3b82f6', hover: '#60a5fa', muted: 'rgba(59,130,246,0.15)', glow: 'rgba(59,130,246,0.3)' },
        success: { DEFAULT: '#10b981', muted: 'rgba(16,185,129,0.15)' },
        warning: { DEFAULT: '#f59e0b', muted: 'rgba(245,158,11,0.15)' },
        danger: { DEFAULT: '#ef4444', muted: 'rgba(239,68,68,0.15)' },
      },
      fontFamily: { mono: ['JetBrains Mono', 'Fira Code', 'monospace'] },
    },
  },
  plugins: [],
}

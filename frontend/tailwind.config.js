/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        logo: ['Playfair Display', 'serif'],
        heading: ['Space Grotesk', 'sans-serif'],
        chat: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        btn: ['Manrope', 'sans-serif'],
        input: ['Plus Jakarta Sans', 'sans-serif'],
        quote: ['Cormorant Garamond', 'serif'],
        bangla: ['Noto Sans Bengali', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        light: {
          bg: '#f8fafc',
          surface: '#ffffff',
          card: '#f1f5f9',
          border: '#e2e8f0',
          text: '#0f172a',
          'text-secondary': '#475569',
        },
        dark: {
          bg: '#080d19',
          surface: '#111827',
          card: '#1f2937',
          border: '#334155',
          text: '#f8fafc',
          'text-secondary': '#cbd5e1',
        },
        eye: {
          bg: '#1a1410',
          surface: '#2a1f18',
          card: '#33261e',
          border: '#4a372b',
          text: '#e8d5b8',
          'text-secondary': '#b8a088',
        },
      },
    },
  },
  plugins: [],
}
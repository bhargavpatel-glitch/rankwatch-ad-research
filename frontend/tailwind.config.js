/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#07080a',
          900: '#0a0b0e', // Canvas base
          850: '#0f1115', // Panel / Sidebar surface
          800: '#13151a', // Card surface
          750: '#171920', // Elevated card surface
          700: '#222630', // Lighter black border hairline
          600: '#2a303d', // Hover border
          500: '#384052',
        },
        mint: {
          400: '#34d399',
          500: '#2fe593', // Reference vibrant primary mint
          600: '#10b981', // Solid emerald
          700: '#059669',
          dark: '#0e261a', // Active tab container
          border: '#184530', // Active tab border
          glow: 'rgba(47, 229, 147, 0.25)',
        },
        sage: {
          100: '#f8fafc', // Main heading text
          300: '#cbd5e1',
          400: '#94a3b8', // Muted body text
          500: '#64748b', // Subtle meta/placeholder
          600: '#475569',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#222630',
          800: '#13151a',
          900: '#0f1115',
          950: '#0a0b0e',
          surface: '#0f1115',
          card: '#13151a',
          hover: '#181b21',
          border: '#222630'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      borderRadius: {
        'card': '20px',
        'media': '16px',
      }
    },
  },
  plugins: [],
}

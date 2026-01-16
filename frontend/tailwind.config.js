/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // SAP-inspired professional color palette
        sap: {
          primary: '#0070f2',
          'primary-hover': '#0057d2',
          'primary-light': '#e5f0ff',
          bg: '#f5f6f7',
          'bg-hover': '#e8e9ea',
          'bg-secondary': '#ffffff',
          sidebar: '#354a5f',
          'sidebar-hover': '#2d3f52',
          text: '#32363a',
          'text-secondary': '#6a6d70',
          'text-tertiary': '#9ea0a4',
          border: '#d1d5db',
          'border-hover': '#9ca3af',
          success: '#107e3e',
          warning: '#e9730c',
          danger: '#bb0000',
          'table-header': '#f5f6f7',
        },
        // Notion-inspired color palette (mantener para compatibilidad)
        notion: {
          bg: '#ffffff',
          bgSecondary: '#f7f6f3',
          bgTertiary: '#f1f1ef',
          border: '#e9e9e7',
          borderHover: '#d9d9d7',
          text: '#37352f',
          textSecondary: '#787774',
          textTertiary: '#9b9a97',
          accent: '#2383e2',
          accentHover: '#1a73d1',
          success: '#0f7b0f',
          warning: '#d9730d',
          danger: '#e16259',
          purple: '#9065b0',
          blue: '#2383e2',
          green: '#0f7b0f',
          yellow: '#d9b300',
          orange: '#d9730d',
          red: '#e16259',
          pink: '#c377e0',
          brown: '#a0674a',
          gray: '#787774',
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#2383e2', // Notion blue
          600: '#1a73d1',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'notion-xs': ['12px', { lineHeight: '16px' }],
        'notion-sm': ['14px', { lineHeight: '20px' }],
        'notion-base': ['16px', { lineHeight: '24px' }],
        'notion-lg': ['18px', { lineHeight: '24px' }],
        'notion-xl': ['20px', { lineHeight: '28px' }],
        'notion-2xl': ['24px', { lineHeight: '32px' }],
        'notion-3xl': ['30px', { lineHeight: '36px' }],
      },
      boxShadow: {
        'notion': 'rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px',
        'notion-sm': 'rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 2px 4px',
        'notion-hover': 'rgba(15, 15, 15, 0.08) 0px 0px 0px 1px, rgba(15, 15, 15, 0.12) 0px 4px 8px, rgba(15, 15, 15, 0.25) 0px 12px 32px',
      },
      borderRadius: {
        'notion': '3px',
        'notion-sm': '2px',
      },
    },
  },
  plugins: [],
}


/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Structured-inspired color palette (dark theme)
        coral: {
          50: '#fff5f4',
          100: '#ffeae9',
          200: '#ffdedb',
          300: '#ffccc7',
          400: '#f49f99',
          500: '#ff9494',
          600: '#e87c7c',
          700: '#d16464',
          800: '#b54d4d',
          900: '#8a3939',
          950: '#5c2525',
        },
        // Accent colors
        accent: {
          blue: '#6185a8',
          green: '#69a859',
          teal: '#4ec757',
        },
        // Dark background colors (Structured style)
        dark: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d9d9de',
          300: '#b8b8c1',
          400: '#91919f',
          500: '#737384',
          600: '#5d5d6c',
          700: '#4c4c58',
          800: '#2a2a32',
          900: '#1c1c22',
          950: '#121216',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Noto Sans JP"',
          'sans-serif',
        ],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 3s ease infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}

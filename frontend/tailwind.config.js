/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ==========================================
        // アプリ画面のトークン（frontend/DESIGN.md §2）
        // ==========================================
        canvas: '#F2F2F5',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#111114',
          muted: '#5C5C66',
          soft: '#3C3C44',
        },
        line: {
          DEFAULT: '#E5E5EA',
          strong: '#D8D8DE',
        },
        control: '#E3E3E8',
        accent: {
          DEFAULT: '#1F7A4D',
          strong: '#175C3A',
        },
        family: {
          DEFAULT: '#EDF5F0',
          ink: '#1F5C3A',
          chip: '#D9EBDF',
        },
        personal: {
          DEFAULT: '#E9EEF8',
          ink: '#2B4C7E',
          chip: '#DCE4F4',
        },
        cycle: {
          DEFAULT: '#E1ECFA',
          ink: '#1D4E89',
        },
        once: {
          DEFAULT: '#FDECD2',
          ink: '#8A4B08',
        },
        danger: '#B42318',
        placeholder: '#8E8E96',
        'icon-muted': '#B0B0B8',

        // ==========================================
        // LP（/landing）専用の旧パレット。アプリ画面では使わない
        // ==========================================
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
          '-apple-system',
          'BlinkMacSystemFont',
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Noto Sans JP"',
          'sans-serif',
        ],
      },
      borderRadius: {
        box: '14px',
        card: '10px',
        chip: '6px',
      },
      minHeight: {
        tap: '44px',
      },
      minWidth: {
        tap: '44px',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        magenta: {
          DEFAULT: '#E4007F',
          50:  '#ffe0f0',
          100: '#ffb3d9',
          200: '#ff80bf',
          300: '#ff4da6',
          400: '#ff1a8c',
          500: '#E4007F',
          600: '#b30063',
          700: '#800047',
          800: '#4d002b',
          900: '#1a000e',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"SF Mono"', '"Cascadia Code"', '"Fira Code"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};

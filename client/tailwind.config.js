/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        overlayIn: { from: { opacity: '0' } },
        modalIn: {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
        },
      },
      animation: {
        overlayIn: 'overlayIn 0.15s ease',
        modalIn: 'modalIn 0.18s ease',
      },
    },
  },
  plugins: [],
};

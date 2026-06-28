import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.ts so the production build config stays untouched.
// jsdom gives the component/hook tests a DOM; localStorage (used by
// usePagination) is provided by jsdom as well.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

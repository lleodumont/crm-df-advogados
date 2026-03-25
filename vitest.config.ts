import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
    pool: 'vmForks',
    poolOptions: { vmForks: { singleFork: true } },
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});

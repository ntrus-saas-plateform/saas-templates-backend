import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/integration/**/*.spec.ts'],
    // Control-plane migrations + Testcontainers startup exceed the default 30s.
    testTimeout: 180_000,
    hookTimeout: 300_000,
  },
});

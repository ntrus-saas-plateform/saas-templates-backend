import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  ssr: {
    noExternal: [/@nestjs\/.*/, 'class-transformer', 'class-validator'],
  },
  test: {
    globals: true,
    root: './',
    include: ['test/security/**/*.spec.ts'],
    pool: 'forks',
    testTimeout: 60_000,
    setupFiles: ['./test/vitest-setup.ts'],
  },
});

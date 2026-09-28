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
    include: ['**/*.e2e-spec.ts'],
    pool: 'forks',
    testTimeout: 180_000,
    setupFiles: ['./test/vitest-setup.ts'],
  },
});

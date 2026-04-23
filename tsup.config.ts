import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['cjs'],
  target: 'node18',
  clean: true,
  dts: false,
  sourcemap: false,
  outDir: 'dist',
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'cli/index': 'src/cli/index.ts' },
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  platform: 'node',
  target: 'node20',
});

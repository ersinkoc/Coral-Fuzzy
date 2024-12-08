import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  target: 'es2020',
  outDir: 'dist',
  esbuildOptions(options) {
    options.banner = {
      js: `/**
 * Coral Fuzzy v${require('./package.json').version}
 * (c) ${new Date().getFullYear()} 
 * Released under the MIT License.
 */`,
    };
  },
});

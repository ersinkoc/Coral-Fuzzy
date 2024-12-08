import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

const banner = `/*!
 * Coral Fuzzy v${pkg.version}
 * (c) ${new Date().getFullYear()} Ersin Koç
 * Released under the MIT License.
 */`;

export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      banner
    },
    {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
      banner
    },
    {
      file: 'dist/index.min.js',
      format: 'umd',
      name: 'CoralFuzzy',
      sourcemap: true,
      banner,
      plugins: [terser()]
    }
  ],
  plugins: [
    typescript({
      typescript: require('typescript'),
      useTsconfigDeclarationDir: true
    })
  ],
  external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})]
};

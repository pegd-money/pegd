import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { chmodSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Bundle the CLI into a single self-contained ESM file.
//
// The @pegd/* workspace packages are inlined straight from their TypeScript
// source (via alias) so the bundle does not depend on those packages being
// pre-built, and so the published `pegd` package carries no workspace:* deps.
// The real npm dependencies (@solana/web3.js, bn.js, chalk, commander) stay
// external and are declared in package.json "dependencies".
await build({
  entryPoints: [resolve(__dirname, 'src/cli.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: resolve(__dirname, 'dist/cli.js'),
  banner: { js: '#!/usr/bin/env node' },
  external: ['@solana/web3.js', 'bn.js', 'chalk', 'commander'],
  alias: {
    '@pegd/issuance-core': resolve(__dirname, '../issuance-core/src/index.ts'),
    '@pegd/risk-module': resolve(__dirname, '../risk-module/src/index.ts'),
    '@pegd/sdk': resolve(__dirname, '../sdk-ts/src/index.ts'),
  },
});

chmodSync(resolve(__dirname, 'dist/cli.js'), 0o755);
console.log('bundled dist/cli.js');

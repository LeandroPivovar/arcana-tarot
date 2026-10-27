// Bundles the API into one plain-JavaScript file for Vercel. The server shares src/*.ts with the frontend,
// and Vercel's function packager renames those to .js, which breaks the `.ts` imports Node runs locally.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/handler.mjs'],
  outfile: 'build/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
  logLevel: 'warning',
});
console.log('API empacotada em build/server.mjs');

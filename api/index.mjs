// Vercel function: every /api/* request is rewritten here (see vercel.json); the built frontend is served as static files.
// build/server.mjs is produced by `npm run build` (scripts/build-server.mjs).
export { default } from '../build/server.mjs';

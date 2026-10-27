// Vercel function: every /api/* request is rewritten here (see vercel.json); the built frontend is served as static files.
import { createApp } from '../server/app.mjs';
import { appOptions } from '../server/config.mjs';

export default createApp(appOptions());

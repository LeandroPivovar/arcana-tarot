// Entry bundled into build/server.mjs for the Vercel function (see scripts/build-server.mjs).
import { createApp } from './app.mjs';
import { appOptions } from './config.mjs';

export default createApp(appOptions());

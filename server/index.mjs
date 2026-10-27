import 'dotenv/config';
import { createApp } from './app.mjs';
import { appOptions } from './config.mjs';

const port = Number(process.env.PORT || 3001);
const options = appOptions();
const app = createApp({ ...options, serveStatic: process.env.NODE_ENV === 'production' });
const server = app.listen(port, '0.0.0.0', () => console.log(`Arcana API: http://localhost:${port} · IA ${options.apiKey ? 'configurada' : 'não configurada'} · banco ${options.database.url ? 'Postgres' : 'SQLite'}`));
server.on('error', error => { console.error(`Não foi possível iniciar a API (${error.code || 'erro'}).`); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));

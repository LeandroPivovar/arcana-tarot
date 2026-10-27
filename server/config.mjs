// Settings shared by the local server (server/index.mjs) and the Vercel function (api/index.mjs).
export function appOptions(env = process.env) {
  const vercel = !!env.VERCEL;
  const production = vercel || env.NODE_ENV === 'production';
  const url = env.DATABASE_URL || env.POSTGRES_URL || '';
  // Vercel functions lose their disk between requests, so accounts there need Postgres.
  if (vercel && !url) throw new Error('Configure DATABASE_URL (Postgres) nas variáveis de ambiente da Vercel.');
  return {
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
    database: url ? { url } : { path: env.DATABASE_PATH || 'data/arcana.db' },
    secureCookies: production && env.INSECURE_COOKIES !== 'true',
    trustProxy: vercel || env.TRUST_PROXY === 'true',
  };
}

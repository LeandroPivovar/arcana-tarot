// Settings shared by the local server (server/index.mjs) and the Vercel function (api/index.mjs).
export function appOptions(env = process.env) {
  const vercel = !!env.VERCEL;
  const production = vercel || env.NODE_ENV === 'production';
  const url = env.DATABASE_URL || env.POSTGRES_URL || '';
  return {
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
    // Vercel functions lose their disk between requests, so accounts there need Postgres; without it the routes answer 503.
    database: url ? { url } : vercel ? { missing: true } : { path: env.DATABASE_PATH || 'data/arcana.db' },
    secureCookies: production && env.INSECURE_COOKIES !== 'true',
    trustProxy: vercel || env.TRUST_PROXY === 'true',
  };
}

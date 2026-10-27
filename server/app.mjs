import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createTarotAI, InputError, ProviderError } from './groq.mjs';
import { openDatabase } from './db.mjs';
import { AuthError, createAccounts, SESSION_COOKIE, SESSION_MAX_AGE } from './accounts.mjs';

function readCookie(req, name) {
  for (const part of (req.get('cookie') || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) { try { return decodeURIComponent(value.join('=')); } catch { return null; } }
  }
  return null;
}

export function createApp({ ai, apiKey, model, serveStatic = false, rateLimitMax = 20, authRateLimitMax = 10, database = {}, secureCookies = false, trustProxy = false } = {}) {
  const app = express();
  const tarot = ai || createTarotAI({ apiKey, model });
  // The database opens on the first request that needs it; a failed connection is retried on the next one.
  let opening = null;
  const accounts = () => opening ??= openDatabase(database).then(createAccounts).catch(error => { opening = null; throw error; });
  const limiter = max => rateLimit({ windowMs: 60000, limit: max, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.' } });
  const setSession = (res, token) => res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/', maxAge: SESSION_MAX_AGE * 1000 });
  // Every reading and history route needs a signed-in account.
  const requireUser = message => async (req, res, next) => {
    try { req.user = await (await accounts()).userForToken(readCookie(req, SESSION_COOKIE)); } catch (error) { return next(error); }
    if (!req.user) return res.status(401).json({ error: message });
    next();
  };

  app.disable('x-powered-by');
  // Behind Vercel (or another proxy) the client address comes from X-Forwarded-For; the rate limits need it.
  if (trustProxy) app.set('trust proxy', 1);
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', aiConfigured: !!(apiKey || ai) }));
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (req.method !== 'GET' && origin) { try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Origem não permitida.' }); } catch { return res.status(403).json({ error: 'Origem inválida.' }); } }
    next();
  });
  app.use('/api/auth/register', limiter(authRateLimitMax));
  app.use('/api/auth/login', limiter(authRateLimitMax));
  app.use('/api/tarot', limiter(rateLimitMax));
  app.use(express.json({ limit: '32kb' }));

  app.post('/api/auth/register', async (req, res, next) => {
    try { const { user, token } = await (await accounts()).register(req.body); setSession(res, token).status(201).json({ user }); } catch (error) { next(error); }
  });
  app.post('/api/auth/login', async (req, res, next) => {
    try { const { user, token } = await (await accounts()).login(req.body); setSession(res, token).json({ user }); } catch (error) { next(error); }
  });
  app.post('/api/auth/logout', async (req, res, next) => {
    try { await (await accounts()).logout(readCookie(req, SESSION_COOKIE)); } catch (error) { return next(error); }
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' }).status(204).end();
  });
  app.get('/api/auth/me', requireUser('Você não está conectado.'), (req, res) => res.json({ user: req.user }));

  app.use('/api/tarot', requireUser('Entre na sua conta para fazer uma pergunta.'));
  app.post('/api/tarot/method', async (req, res, next) => {
    try { res.json(await tarot.choose(req.body?.question)); } catch (error) { next(error); }
  });
  app.post('/api/tarot/interpret', async (req, res, next) => {
    try { res.json(await tarot.interpret(req.body)); } catch (error) { next(error); }
  });

  app.use('/api/readings', requireUser('Entre na sua conta para ver seu histórico.'));
  app.get('/api/readings', async (req, res, next) => {
    try { res.json({ readings: await (await accounts()).readings(req.user.id) }); } catch (error) { next(error); }
  });
  app.post('/api/readings', async (req, res, next) => {
    try { res.status(201).json(await (await accounts()).saveReading(req.user.id, req.body)); } catch (error) { next(error); }
  });
  app.delete('/api/readings/:id', async (req, res, next) => {
    try { await (await accounts()).deleteReading(req.user.id, req.params.id); res.status(204).end(); } catch (error) { next(error); }
  });
  app.delete('/api/readings', async (req, res, next) => {
    try { await (await accounts()).clearReadings(req.user.id); res.status(204).end(); } catch (error) { next(error); }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  if (serveStatic && existsSync(resolve('dist/index.html'))) {
    app.use(express.static(resolve('dist'), { dotfiles: 'deny', index: 'index.html' }));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
  }
  app.use((error, _req, res, _next) => {
    if (error instanceof InputError) return res.status(400).json({ error: error.message });
    if (error instanceof AuthError) return res.status(error.status).json({ error: error.message });
    if (error instanceof ProviderError) {
      const code = error.code;
      return res.status(code === 'rate_limit' ? 429 : 503).json({ error: code === 'not_configured' ? 'O serviço de IA ainda não foi configurado.' : 'Não foi possível consultar a IA. Tente novamente em instantes.', code });
    }
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitação muito grande.' });
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    console.error(error);
    res.status(500).json({ error: 'Não foi possível concluir a consulta.' });
  });
  return app;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.mjs';
import { appOptions } from '../server/config.mjs';
import { cards, spreads } from '../src/data.ts';
import { localInterpretation } from '../src/services.ts';

// Production runs on Postgres; PGlite is a real Postgres compiled to WebAssembly, so the same SQL is exercised here.
test('contas e histórico funcionam no Postgres usado em produção', async () => {
  const pg = new PGlite();
  const server = createApp({ database: { client: pg } }).listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { method = 'GET', body, cookie = '' } = {}) => fetch(`${base}${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    const created = await call('/api/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ana@example.com', password: 'senha-segura-1' } });
    assert.equal(created.status, 201); assert.equal((await created.json()).user.id, 1);
    assert.equal((await call('/api/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ANA@example.com', password: 'senha-segura-1' } })).status, 409);
    const logged = await call('/api/auth/login', { method: 'POST', body: { email: 'ana@example.com', password: 'senha-segura-1' } });
    const cookie = logged.headers.get('set-cookie').split(';')[0];
    const method = spreads.find(s => s.id === 'triangle'), selected = [cards[3], cards[4], cards[5]];
    for (const question of ['Primeira pergunta do teste', 'Segunda pergunta do teste']) {
      const saved = await call('/api/readings', { method: 'POST', cookie, body: { question, methodId: method.id, methodReason: '', cardIds: selected.map(c => c.id), interpretation: localInterpretation({ question, method, selected }) } });
      assert.equal(saved.status, 201);
    }
    const list = (await (await call('/api/readings', { cookie })).json()).readings;
    assert.deepEqual(list.map(r => r.question), ['Segunda pergunta do teste', 'Primeira pergunta do teste']);
    await call(`/api/readings/${list[0].id}`, { method: 'DELETE', cookie });
    assert.equal((await (await call('/api/readings', { cookie })).json()).readings.length, 1);
    assert.equal((await call('/api/auth/logout', { method: 'POST', cookie })).status, 204);
    assert.equal((await call('/api/auth/me', { cookie })).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); await pg.close(); }
});

test('na Vercel o app exige Postgres e usa cookies seguros atrás do proxy', () => {
  assert.throws(() => appOptions({ VERCEL: '1' }), /DATABASE_URL/);
  const vercel = appOptions({ VERCEL: '1', POSTGRES_URL: 'postgres://u:p@host/db' });
  assert.deepEqual(vercel.database, { url: 'postgres://u:p@host/db' }); assert.equal(vercel.secureCookies, true); assert.equal(vercel.trustProxy, true);
  const local = appOptions({});
  assert.deepEqual(local.database, { path: 'data/arcana.db' }); assert.equal(local.secureCookies, false); assert.equal(local.trustProxy, false);
});

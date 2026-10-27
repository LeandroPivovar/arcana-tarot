import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { hashPassword, verifyPassword } from '../server/accounts.mjs';
import { cards, spreads } from '../src/data.ts';
import { localInterpretation } from '../src/services.ts';

async function withServer(options, run) {
  const server = createApp(options).listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { method = 'GET', body, cookie = '', headers = {} } = {}) => fetch(`${base}${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  try { await run(call); } finally { await new Promise(resolve => server.close(resolve)); }
}
const sessionOf = response => response.headers.get('set-cookie')?.split(';')[0] || '';
const method = spreads.find(s => s.id === 'triangle');
const selected = [cards[3], cards[4], cards[5]];
const reading = (question = 'Devo mudar de emprego este ano?') => ({ question, methodId: method.id, methodReason: 'Duas alternativas.', cardIds: selected.map(c => c.id), interpretation: localInterpretation({ question, method, selected }) });

test('senhas são guardadas com scrypt e salt, nunca em texto puro', async () => {
  const a = await hashPassword('senha-segura-1'), b = await hashPassword('senha-segura-1');
  assert.match(a, /^scrypt\$/); assert.notEqual(a, b); assert.ok(!a.includes('senha-segura-1'));
  assert.equal(await verifyPassword('senha-segura-1', a), true); assert.equal(await verifyPassword('outra-senha', a), false);
});

test('cadastro valida dados, cria sessão HttpOnly e impede e-mail repetido', async () => {
  await withServer({}, async call => {
    for (const body of [{}, { name: 'A', email: 'a@b.co', password: 'senha-segura-1' }, { name: 'Ana', email: 'invalido', password: 'senha-segura-1' }, { name: 'Ana', email: 'ana@example.com', password: 'curta' }]) {
      assert.equal((await call('/api/auth/register', { method: 'POST', body })).status, 400);
    }
    const created = await call('/api/auth/register', { method: 'POST', body: { name: '  Ana   Souza ', email: ' Ana@Example.com ', password: 'senha-segura-1' } });
    assert.equal(created.status, 201);
    assert.deepEqual((await created.json()).user, { id: 1, name: 'Ana Souza', email: 'ana@example.com' });
    const cookie = created.headers.get('set-cookie'); assert.match(cookie, /arcana_session=/); assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i);
    const duplicate = await call('/api/auth/register', { method: 'POST', body: { name: 'Outra', email: 'ANA@example.com', password: 'senha-segura-2' } }); assert.equal(duplicate.status, 409);
    const me = await call('/api/auth/me', { cookie: sessionOf(created) }); assert.equal((await me.json()).user.email, 'ana@example.com');
  });
});

test('login confere a senha, logout encerra a sessão e sessões inválidas são recusadas', async () => {
  await withServer({}, async call => {
    await call('/api/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ana@example.com', password: 'senha-segura-1' } });
    for (const body of [{ email: 'ana@example.com', password: 'errada-123' }, { email: 'ninguem@example.com', password: 'senha-segura-1' }, {}]) {
      const failed = await call('/api/auth/login', { method: 'POST', body }); assert.equal(failed.status, 401); assert.equal((await failed.json()).error, 'E-mail ou senha incorretos.');
    }
    const logged = await call('/api/auth/login', { method: 'POST', body: { email: 'ANA@example.com', password: 'senha-segura-1' } }); assert.equal(logged.status, 200);
    const cookie = sessionOf(logged);
    assert.equal((await call('/api/auth/me', { cookie })).status, 200);
    assert.equal((await call('/api/auth/me', { cookie: 'arcana_session=forjado' })).status, 401);
    assert.equal((await call('/api/auth/me')).status, 401);
    assert.equal((await call('/api/auth/logout', { method: 'POST', cookie })).status, 204);
    assert.equal((await call('/api/auth/me', { cookie })).status, 401);
  });
});

test('login e cadastro têm limite de tentativas e recusam outra origem', async () => {
  await withServer({ authRateLimitMax: 2 }, async call => {
    const foreign = await call('/api/auth/login', { method: 'POST', body: { email: 'a@b.co', password: 'x' }, headers: { Origin: 'https://unrelated.example' } }); assert.equal(foreign.status, 403);
    for (let i = 0; i < 2; i++) await call('/api/auth/login', { method: 'POST', body: { email: 'a@b.co', password: 'x' } });
    assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'a@b.co', password: 'x' } })).status, 429);
  });
});

test('histórico pertence à conta: salva, lista, apaga e não vaza entre pessoas', async () => {
  await withServer({}, async call => {
    assert.equal((await call('/api/readings')).status, 401);
    assert.equal((await call('/api/readings', { method: 'POST', body: reading() })).status, 401);
    const ana = sessionOf(await call('/api/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ana@example.com', password: 'senha-segura-1' } }));
    const bia = sessionOf(await call('/api/auth/register', { method: 'POST', body: { name: 'Bia', email: 'bia@example.com', password: 'senha-segura-1' } }));
    const first = await call('/api/readings', { method: 'POST', cookie: ana, body: { ...reading(), id: 'escolhido-pelo-cliente', extra: 'ignorado' } });
    assert.equal(first.status, 201);
    const saved = await first.json(); assert.notEqual(saved.id, 'escolhido-pelo-cliente'); assert.equal('extra' in saved, false);
    await call('/api/readings', { method: 'POST', cookie: ana, body: reading('Outra pergunta para o histórico') });
    for (const invalid of [{ ...reading(), methodId: 'inexistente' }, { ...reading(), cardIds: [3, 3, 4] }, { ...reading(), question: 'x'.repeat(501) }]) {
      assert.equal((await call('/api/readings', { method: 'POST', cookie: ana, body: invalid })).status, 400);
    }
    const list = (await (await call('/api/readings', { cookie: ana })).json()).readings;
    assert.deepEqual(list.map(r => r.question), ['Outra pergunta para o histórico', 'Devo mudar de emprego este ano?']);
    assert.deepEqual((await (await call('/api/readings', { cookie: bia })).json()).readings, []);
    assert.equal((await call(`/api/readings/${saved.id}`, { method: 'DELETE', cookie: bia })).status, 204);
    assert.equal((await (await call('/api/readings', { cookie: ana })).json()).readings.length, 2);
    await call(`/api/readings/${saved.id}`, { method: 'DELETE', cookie: ana });
    assert.equal((await (await call('/api/readings', { cookie: ana })).json()).readings.length, 1);
    await call('/api/readings', { method: 'DELETE', cookie: ana });
    assert.deepEqual((await (await call('/api/readings', { cookie: ana })).json()).readings, []);
  });
});

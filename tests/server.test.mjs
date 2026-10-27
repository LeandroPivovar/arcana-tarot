import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { createTarotAI, validateReading, validateQuestion, InputError, ProviderError } from '../server/groq.mjs';
import { cards, spreads } from '../src/data.ts';

const question = 'Como posso cuidar dos meus relacionamentos?';
function reading(method = spreads[1]) { return { question, method: { id: method.id }, cards: cards.slice(0, method.positions.length).map((c, i) => ({ id: c.id, position: method.positions[i], orientation: 'upright' })) }; }
function mockClient(handler) { return { chat: { completions: { create: handler } } }; }
async function signup(base, email = 'pessoa@example.com') {
  const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Pessoa Teste', email, password: 'senha-segura-1' }) });
  assert.equal(response.status, 201);
  return response.headers.get('set-cookie').split(';')[0];
}
function completion(value) { return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }; }

test('backend valida pergunta, cartas únicas, quantidade e posição antes de chamar a IA', () => {
  for (const value of ['', 'abc', null, 42, 'x'.repeat(501)]) assert.throws(() => validateQuestion(value), InputError);
  assert.equal(validateQuestion(`  ${question}  `), question);
  assert.equal(validateReading(reading()).selected.length, 3);
  for (const invalid of [
    { ...reading(), method: { id: 'fake' } },
    { ...reading(), cards: [] },
    { ...reading(), cards: reading().cards.map(c => ({ ...c, id: 0 })) },
    { ...reading(), cards: reading().cards.map(c => ({ ...c, position: 'inventada' })) },
    { ...reading(), cards: reading().cards.map(c => ({ ...c, orientation: 'reversed' })) },
    { ...reading(), cards: reading().cards.map(c => ({ ...c, id: 999 })) },
  ]) assert.throws(() => validateReading(invalid), InputError);
});
test('seleção pede schema estrito com os nove IDs e retorna motivo da escolha', async () => {
  let request;
  const ai = createTarotAI({ client: mockClient(async value => { request = value; return completion({ methodId: 'aphrodite', reason: 'Explora o vínculo em diferentes dimensões.' }); }) });
  const result = await ai.choose(question);
  assert.equal(result.source, 'ai'); assert.equal(result.methodId, 'aphrodite');
  assert.equal(request.model, 'openai/gpt-oss-120b'); assert.equal(request.response_format.json_schema.strict, true);
  assert.equal(request.response_format.json_schema.schema.properties.methodId.enum.length, 9);
  assert.equal(JSON.parse(request.messages[1].content).question, question); assert.equal(request.include_reasoning, false);
});
test('leitura usa catálogo confiável, rejeita cartas inventadas/reordenadas e normaliza posições', async () => {
  let request;
  const method = spreads[1];
  const ai = createTarotAI({ client: mockClient(async value => { request = value; return completion({ summary: 'Uma visão da situação.', reflection: 'Qual passo faz sentido?', cards: [0, 1, 2].map(cardId => ({ cardId, text: 'Interpretação contextual da carta.' })) }); }) });
  const body = reading(); body.cards[0].name = 'nome inventado';
  const result = await ai.interpret(body); assert.equal(result.source, 'ai'); assert.deepEqual(result.cards.map(c => c.position), method.positions);
  const payload = JSON.parse(request.messages[1].content); assert.equal(payload.cards[0].name, 'O Louco'); assert.ok(payload.cards[0].baseMeaning);
  for (const bad of [
    { summary: 'x', reflection: 'y', cards: [{ cardId: 2, text: 'x' }, { cardId: 1, text: 'x' }, { cardId: 0, text: 'x' }] },
    { summary: 'x', reflection: 'y', cards: [null, null, null] },
    { summary: 'x', reflection: 'y', cards: [] },
    { summary: '', reflection: '', cards: [] },
  ]) {
    const invalid = createTarotAI({ client: mockClient(async () => completion(bad)) });
    await assert.rejects(invalid.interpret(reading()), ProviderError);
  }
});
test('erros do provedor e configuração não expõem credenciais ou respostas internas', async () => {
  const unconfigured = createTarotAI(); await assert.rejects(unconfigured.choose(question), { code: 'not_configured' });
  const ai = createTarotAI({ client: mockClient(async () => { throw Object.assign(new Error('secret-provider-response'), { status: 401 }); }) });
  await assert.rejects(ai.choose(question), error => error.code === 'authentication' && !error.message.includes('secret'));
  const incomplete = createTarotAI({ client: mockClient(async () => ({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] })) });
  await assert.rejects(incomplete.choose(question), { code: 'incomplete_response' });
});
test('rotas HTTP validam entrada, origem, limite e não expõem erros internos', async () => {
  let calls = 0;
  const server = createApp({ ai: { choose: async () => { calls++; return { methodId: 'one', reason: 'Um conselho direto.' }; }, interpret: async () => { throw new ProviderError('authentication'); } }, rateLimitMax: 3 }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const post = (path, body, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: JSON.stringify(body) });
  try {
    const anonymous = await post('/api/tarot/method', { question }); assert.equal(anonymous.status, 401); assert.equal(calls, 0);
    cookie = await signup(base);
    const health = await fetch(`${base}/api/health`); assert.equal(health.status, 200); assert.equal(health.headers.get('cache-control'), 'no-store');
    const wrongOrigin = await post('/api/tarot/method', { question }, { Origin: 'https://unrelated.example' }); assert.equal(wrongOrigin.status, 403); assert.equal(calls, 0);
    const method = await post('/api/tarot/method', { question }); assert.equal(method.status, 200); assert.equal((await method.json()).methodId, 'one');
    const failed = await post('/api/tarot/interpret', reading()); assert.equal(failed.status, 503); const text = await failed.text(); assert.ok(!text.includes('secret')); assert.ok(!text.includes('gsk_'));
    await post('/api/tarot/method', { question });
    const limited = await post('/api/tarot/method', { question }); assert.equal(limited.status, 429);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('entradas HTTP inválidas não alcançam o provedor real', async () => {
  const server = createApp().listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const Cookie = await signup(base);
    for (const [route, body] of [['method', { question: 'ab' }], ['interpret', { ...reading(), cards: [] }]]) {
      const response = await fetch(`${base}/api/tarot/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie }, body: JSON.stringify(body) }); assert.equal(response.status, 400);
    }
    const unconfigured = await fetch(`${base}/api/tarot/method`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie }, body: JSON.stringify({ question }) }); assert.equal(unconfigured.status, 503); assert.equal((await unconfigured.json()).code, 'not_configured');
    const malformed = await fetch(`${base}/api/tarot/method`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie }, body: '{' }); assert.equal(malformed.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

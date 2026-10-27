import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HISTORY_LIMIT, isSavedReading } from '../src/history.ts';
import { InputError } from './groq.mjs';

const derive = promisify(scrypt);
const SESSION_DAYS = 30;
export const SESSION_COOKIE = 'arcana_session';
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
export class AuthError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(key, expected);
}
// Compared against when the e-mail does not exist, so a failed login takes the same time either way.
const dummyHash = await hashPassword(randomBytes(16).toString('hex'));
const tokenHash = token => createHash('sha256').update(token).digest('hex');

function validName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 60) throw new InputError('O nome deve ter entre 2 e 60 caracteres.');
  return name;
}
function validEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError('Informe um e-mail válido.');
  return email;
}
function validPassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) throw new InputError('A senha deve ter entre 8 e 128 caracteres.');
  return value;
}
const publicUser = row => ({ id: row.id, name: row.name, email: row.email });

export function createAccounts(db) {
  async function startSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    await db.run('DELETE FROM sessions WHERE expires_at <= ?', [new Date(now).toISOString()]);
    await db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [tokenHash(token), userId, new Date(now + SESSION_MAX_AGE * 1000).toISOString()]);
    return token;
  }
  const userByEmail = email => db.get('SELECT * FROM users WHERE email = ?', [email]);

  return {
    async register(body) {
      const name = validName(body?.name), email = validEmail(body?.email), password = validPassword(body?.password);
      if (await userByEmail(email)) throw new AuthError('Já existe uma conta com este e-mail.', 409);
      const hash = await hashPassword(password);
      let id;
      try { id = Number((await db.get('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?) RETURNING id', [name, email, hash, new Date().toISOString()])).id); }
      catch { throw new AuthError('Já existe uma conta com este e-mail.', 409); }
      return { user: { id, name, email }, token: await startSession(id) };
    },
    async login(body) {
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body?.password === 'string' ? body.password.slice(0, 128) : '';
      const row = email ? await userByEmail(email) : undefined;
      const valid = await verifyPassword(password, row?.password_hash ?? dummyHash);
      if (!row || !valid) throw new AuthError('E-mail ou senha incorretos.');
      return { user: publicUser(row), token: await startSession(row.id) };
    },
    async userForToken(token) {
      if (!token) return null;
      const row = await db.get('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?', [tokenHash(token), new Date().toISOString()]);
      return row ? publicUser(row) : null;
    },
    async logout(token) { if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash(token)]); },
    async readings(userId) {
      const rows = await db.all('SELECT data FROM readings WHERE user_id = ? ORDER BY seq DESC LIMIT ?', [userId, HISTORY_LIMIT]);
      return rows.map(row => JSON.parse(row.data)).filter(isSavedReading);
    },
    async saveReading(userId, body) {
      // Rebuild the entry field by field so nothing unexpected from the client is stored.
      const interpretation = body?.interpretation;
      const entry = {
        id: randomUUID(), createdAt: new Date().toISOString(),
        question: typeof body?.question === 'string' ? body.question.trim() : '',
        methodId: body?.methodId, methodReason: typeof body?.methodReason === 'string' ? body.methodReason.trim() : '',
        cardIds: Array.isArray(body?.cardIds) ? body.cardIds : [],
        interpretation: {
          source: interpretation?.source, summary: interpretation?.summary, reflection: interpretation?.reflection,
          cards: Array.isArray(interpretation?.cards) ? interpretation.cards.map(card => ({ cardId: card?.cardId, position: card?.position, text: card?.text })) : [],
        },
      };
      if (entry.question.length > 500 || entry.methodReason.length > 1000 || !isSavedReading(entry)) throw new InputError('Tiragem inválida.');
      await db.run('INSERT INTO readings (id, user_id, created_at, data) VALUES (?, ?, ?, ?)', [entry.id, userId, entry.createdAt, JSON.stringify(entry)]);
      await db.run('DELETE FROM readings WHERE user_id = ? AND seq NOT IN (SELECT seq FROM readings WHERE user_id = ? ORDER BY seq DESC LIMIT ?)', [userId, userId, HISTORY_LIMIT]);
      return entry;
    },
    async deleteReading(userId, id) { await db.run('DELETE FROM readings WHERE id = ? AND user_id = ?', [String(id), userId]); },
    async clearReadings(userId) { await db.run('DELETE FROM readings WHERE user_id = ?', [userId]); },
  };
}

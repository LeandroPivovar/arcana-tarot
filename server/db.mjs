import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// One small async interface over two engines: SQLite for local development and tests, Postgres in production
// (Vercel functions have no persistent disk). Queries are written once with `?` placeholders.
//   all(sql, params) → rows · get(sql, params) → first row · run(sql, params) → nothing
export async function openDatabase({ url, path = ':memory:', client } = {}) {
  if (client) return openPostgres(client);
  if (url) {
    const { default: pg } = await import('pg');
    return openPostgres(new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10000 }), { pooled: true });
  }
  return openSqlite(path);
}

async function openSqlite(path) {
  const { DatabaseSync } = await import('node:sqlite');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
  `);
  // Databases made before readings had their own sequence column are copied over once, keeping their order.
  const columns = db.prepare('PRAGMA table_info(readings)').all().map(column => column.name);
  if (columns.length && !columns.includes('seq')) db.exec('ALTER TABLE readings RENAME TO readings_old; DROP INDEX IF EXISTS readings_by_user;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      seq INTEGER PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS readings_by_user ON readings(user_id, seq DESC);
  `);
  if (columns.length && !columns.includes('seq')) db.exec('INSERT INTO readings (id, user_id, created_at, data) SELECT id, user_id, created_at, data FROM readings_old ORDER BY created_at, rowid; DROP TABLE readings_old;');
  return {
    async all(sql, params = []) { return db.prepare(sql).all(...params); },
    async get(sql, params = []) { return db.prepare(sql).get(...params); },
    async run(sql, params = []) { db.prepare(sql).run(...params); },
  };
}

const POSTGRES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS readings (
    seq BIGSERIAL PRIMARY KEY,
    id TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS readings_by_user ON readings(user_id, seq DESC);
`;

async function openPostgres(client, { pooled = false } = {}) {
  // Several cold-started functions may create the tables at once; the advisory lock lets one go first.
  const connection = pooled ? await client.connect() : client;
  try {
    await connection.query('SELECT pg_advisory_lock(7302001)');
    try { await (connection.exec ? connection.exec(POSTGRES_SCHEMA) : connection.query(POSTGRES_SCHEMA)); }
    finally { await connection.query('SELECT pg_advisory_unlock(7302001)'); }
  } finally { if (pooled) connection.release(); }
  const numbered = sql => { let n = 0; return sql.replace(/\?/g, () => `$${++n}`); };
  const query = async (sql, params) => (await client.query(numbered(sql), params)).rows;
  return {
    all: (sql, params = []) => query(sql, params),
    async get(sql, params = []) { return (await query(sql, params))[0]; },
    async run(sql, params = []) { await query(sql, params); },
  };
}

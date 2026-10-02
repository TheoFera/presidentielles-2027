// Base D1 simulée pour les tests : SQLite intégré à Node (node:sqlite), en mémoire.
// Même interface que Cloudflare D1 (prepare/bind/first/all/run/batch) et mêmes migrations.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';

const MIGRATIONS = new URL('../serveur-en-ligne/migrations/', import.meta.url);

// D1 refuse « undefined » et convertit les booléens : on fait pareil pour détecter les erreurs.
function value(v) {
  if (v === undefined) throw new Error('D1_TYPE_ERROR: undefined');
  return typeof v === 'boolean' ? Number(v) : v;
}
const plain = row => row ? { ...row } : null;

export function createMemoryD1() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) raw.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  class Statement {
    constructor(sql, params = []) { this.sql = sql; this.params = params; }
    bind(...params) { return new Statement(this.sql, params.map(value)); }
    async first(column) { const row = plain(raw.prepare(this.sql).get(...this.params)); return column ? row?.[column] ?? null : row; }
    async all() { return { success: true, results: raw.prepare(this.sql).all(...this.params).map(plain), meta: {} }; }
    async run() {
      const result = raw.prepare(this.sql).run(...this.params);
      return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    }
  }
  return {
    raw,
    prepare: sql => new Statement(sql),
    // Un lot D1 est une transaction : tout ou rien.
    async batch(statements) {
      raw.exec('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(/^\s*(SELECT|WITH)/i.test(s.sql) ? await s.all() : await s.run());
        raw.exec('COMMIT');
        return out;
      } catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  };
}

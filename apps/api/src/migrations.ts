import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import {backfillIgnForms} from './ign.js';
/** Serialize migration runners and reject edits to migrations already applied. */
export async function migrate(pool: Pool, directory=resolve('apps/api/db/migrations')) {
  const client=await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(85120491)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    for(const name of (await readdir(directory)).filter(n=>/^\d+.*\.sql$/.test(n)).sort()) {
      const sql=await readFile(resolve(directory,name),'utf8');
      const checksum=createHash('sha256').update(sql.replace(/\r\n/g,'\n')).digest('hex');
      const existing=await client.query<{checksum:string}>('SELECT checksum FROM schema_migrations WHERE name=$1',[name]);
      if(existing.rows[0]) { if(existing.rows[0].checksum!==checksum) throw new Error(`Applied migration changed: ${name}`); continue; }
      await client.query('BEGIN');
      try { await client.query(sql); await client.query('INSERT INTO schema_migrations (name,checksum) VALUES ($1,$2)',[name,checksum]); await client.query('COMMIT'); }
      catch(error) { await client.query('ROLLBACK'); throw error; }
    }
    if((await client.query("SELECT to_regclass('roster_ign_derivations') AS table_name")).rows[0]?.table_name)await backfillIgnForms(client);
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(85120491)'); }
    finally { client.release(); }
  }
}

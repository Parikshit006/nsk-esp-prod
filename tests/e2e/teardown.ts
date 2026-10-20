import 'dotenv/config';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

export default async function teardown() {
  const path=resolve('.local/e2e-schema');
  const marker=await readFile(path,'utf8').catch((error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT')return null;throw error;});
  if(marker===null)return;
  const schema=marker.trim();
  if(!/^e2e_[0-9a-f]{32}$/.test(schema))throw new Error('Invalid browser test schema marker.');
  const source=process.env.DATABASE_URL_TEST;
  if(!source||!new URL(source).pathname.endsWith('_test'))throw new Error('Browser teardown requires the _test database.');
  const pool=new Pool({connectionString:source});
  try {await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);}
  finally {await pool.end();await rm(path,{force:true});}
}

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { migrate } from '../../apps/api/src/migrations.js';
import { createAdmin } from '../../apps/api/src/auth.js';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';

const source=process.env.DATABASE_URL_TEST;
if(!source||!new URL(source).pathname.endsWith('_test'))throw new Error('Browser tests require a separate DATABASE_URL_TEST ending in _test.');
const schema=`e2e_${randomUUID().replaceAll('-','')}`;
const admin=new Pool({connectionString:source});
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped=new URL(source);scoped.searchParams.set('options',`-c search_path=${schema}`);
const pool=new Pool({connectionString:scoped.toString()});
try {await migrate(pool);await createAdmin(pool,'browser-admin@example.test','browser-test-password-1234');}
catch(error) {await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();throw error;}
await mkdir(resolve('.local'),{recursive:true});
await writeFile(resolve('.local/e2e-schema'),schema);
const config=readConfig({...process.env,DATABASE_URL:scoped.toString(),PORT:'3002',WEB_ORIGIN:'http://127.0.0.1:5174',NODE_ENV:'test'});
const server=createApp(config,pool).listen(config.PORT);
let closing=false;
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{
  if(closing)return;closing=true;
  server.close(()=>{void (async()=>{await pool.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();process.exit(0);})().catch(()=>process.exit(1));});
});

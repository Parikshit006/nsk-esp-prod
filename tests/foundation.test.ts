import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { Pool } from 'pg';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/src/app.js';
import { readConfig } from '../apps/api/src/config.js';
import { migrate } from '../apps/api/src/migrations.js';
import { statusLabel } from '../packages/shared/status.js';
import { publicConfigSchema, errorSchema } from '../packages/shared/contracts.js';

const secret='test-only-readiness-token-with-32-characters';
const env={NODE_ENV:'test',WEB_ORIGIN:'http://localhost:5173',DATABASE_URL:'postgresql://esp_test@127.0.0.1:55432/esp_test',READINESS_TOKEN:secret};
describe('Configuration and vocabulary',()=>{
  it('TEST-078 rejects missing/invalid configuration without echoing credentials',()=>{
    expect(()=>readConfig({})).toThrow('Invalid configuration');
    const bad='private-value-that-must-not-be-logged';
    try {readConfig({...env,DATABASE_URL:bad});} catch(error) {expect(String(error)).not.toContain(bad);}
    expect(()=>readConfig({...env,PORT:'0'})).toThrow('PORT');
    expect(()=>readConfig({...env,NODE_ENV:'production'})).toThrow('WEB_ORIGIN');
    expect(()=>readConfig({...env,WEB_ORIGIN:'http://localhost:5173/path'})).toThrow();
    expect(()=>readConfig({...env,DATABASE_URL:'https://example.com'})).toThrow();
  });
  it('TEST-087 matches every exact label in design §10.3 and rejects unknown states',async()=>{
    const design=await readFile('design.md','utf8');
    const table=design.split('## 10.3 Status vocabulary (single source)')[1]!.split('## 10.4')[0]!;
    const names={Tournament:'tournament',Registration:'registration',Payment:'payment',Approval:'approval',Slot:'slot',Match:'match','Extraction job (admin)':'job','Identity row':'identity',Result:'result','Room details':'credentials',Dispute:'dispute'} as const;
    const {statuses}=await import('../packages/shared/status.js');
    for(const [name,key] of Object.entries(names)) {
      const line=table.split('\n').find(line=>line.startsWith(`| ${name} |`))!;
      const labels=line.split('|')[2]!.split(' (**')[0]!.trim().split(' · ');
      expect(Object.values(statuses[key])).toEqual(labels);
    }
    expect(()=>statusLabel('result','Official')).toThrow('Unknown status');
    expect(()=>statusLabel('result','toString')).toThrow('Unknown status');
  });
});

// A separate real database is mandatory; fail, never silently skip integrity tests.
const testUrl=process.env.DATABASE_URL_TEST;
if(!testUrl) throw new Error('DATABASE_URL_TEST is required for real PostgreSQL integration tests.');
if(!new URL(testUrl).pathname.endsWith('_test')) throw new Error('Test database name must end in _test.');
const schema=`test_${crypto.randomUUID().replaceAll('-','')}`;
const admin=new Pool({connectionString:testUrl});
const pool=new Pool({connectionString:testUrl,options:`-c search_path=${schema}`,connectionTimeoutMillis:2000,statement_timeout:3000});
beforeAll(async()=>{await admin.query(`CREATE SCHEMA ${schema}`);await migrate(pool);});
afterAll(async()=>{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
describe('Real database and API',()=>{
  it('TEST-094 migrations run from empty, are repeatable and reject applied edits',async()=>{
    await migrate(pool);
    const result=await pool.query('SELECT * FROM schema_migrations');
    expect(result.rowCount).toBe(13);
    const dir=await mkdtemp(join(tmpdir(),'esp-migration-'));
    try {await writeFile(join(dir,'0001_foundation.sql'),'SELECT 1;');await expect(migrate(pool,dir)).rejects.toThrow('Applied migration changed');} finally {await rm(dir,{recursive:true});}
    const data=await pool.query('SELECT schema_version FROM platform_metadata');expect(data.rows).toEqual([{schema_version:13}]);
  });
  it('TEST-090 readiness is authenticated and verifies migrated database',async()=>{
    const app=createApp(readConfig(env),pool);
    expect((await request(app).get('/api/v1/health/live')).body).toEqual({data:{status:'alive'}});
    const denied=await request(app).get('/api/v1/health/ready');expect(denied.status).toBe(401);expect(errorSchema.safeParse(denied.body).success).toBe(true);
    const ready=await request(app).get('/api/v1/health/ready').set('Authorization',`Bearer ${secret}`);expect(ready.status).toBe(200);expect(ready.body.data.database).toBe('ready');
    const failedPool=new Pool({connectionString:'postgresql://unused@127.0.0.1:1/unavailable',connectionTimeoutMillis:100});
    try {const failed=await request(createApp(readConfig(env),failedPool)).get('/api/v1/health/ready').set('Authorization',`Bearer ${secret}`);expect(failed.status).toBe(503);expect(failed.body.error.code).toBe('PROVIDER_UNAVAILABLE');expect(JSON.stringify(failed.body)).not.toContain('postgresql');} finally {await failedPool.end();}
  });
  it('TEST-078 public config and logs do not disclose secrets or request values',async()=>{
    const logs:object[]=[];const app=createApp(readConfig(env),pool,event=>logs.push(event));
    const response=await request(app).get('/api/v1/meta/config?token=secret-query').set('Authorization','secret-authorization');
    expect(publicConfigSchema.safeParse(response.body.data).success).toBe(true);
    const output=JSON.stringify({logs,response:response.body});for(const value of [secret,env.DATABASE_URL,'secret-query','secret-authorization']) expect(output).not.toContain(value);
    expect(response.headers['x-content-type-options']).toBe('nosniff');expect(response.headers['cache-control']).toBe('no-store');
  });
  it('TEST-078 strict CORS, malformed JSON and unknown APIs fail safely',async()=>{
    const app=createApp(readConfig(env),pool);
    expect((await request(app).get('/api/v1/meta/config').set('Origin','https://evil.example')).status).toBe(403);
    const allowed=await request(app).get('/api/v1/meta/config').set('Origin',env.WEB_ORIGIN);expect(allowed.headers['access-control-allow-origin']).toBe(env.WEB_ORIGIN);
    const malformed=await request(app).post('/api/v1/anything').set('Content-Type','application/json').send('{secret broken');expect(malformed.status).toBe(400);expect(JSON.stringify(malformed.body)).not.toContain('secret broken');
    const absent=await request(app).get('/api/v1/missing');expect(absent.status).toBe(404);expect(errorSchema.safeParse(absent.body).success).toBe(true);
  });
});

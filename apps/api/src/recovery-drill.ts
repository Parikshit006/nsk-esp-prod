import 'dotenv/config';
import { randomUUID, randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Pool } from 'pg';
import { migrate } from './migrations.js';

const value=process.env.DATABASE_URL_TEST;
if(!value||!new URL(value).pathname.endsWith('_test'))throw new Error('Recovery drill requires DATABASE_URL_TEST ending in _test.');
const url=new URL(value),schema=`drill_${randomUUID().replaceAll('-','')}`,retained=`${schema}_source`;
const connection=new Pool({connectionString:value});
const scoped=new Pool({connectionString:value,options:`-c search_path=${schema}`});
const directory=resolve('.local/recovery-drills');await mkdir(directory,{recursive:true});
const backup=join(directory,`${schema}.dump`);
const executable=(name:string)=>process.env.PG_BIN?join(process.env.PG_BIN,process.platform==='win32'?`${name}.exe`:name):name;
const childEnv={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1))};
const run=promisify(execFile),started=Date.now();let success=false;
try{
  await connection.query(`CREATE SCHEMA ${schema}`);await migrate(scoped);
  const bytes=randomBytes(1024),key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update('synthetic-room-secret'),cipher.final()]),tag=cipher.getAuthTag();
  const hash=createHash('sha256').update(bytes).digest('hex');
  await scoped.query('CREATE TABLE recovery_fixture(id integer PRIMARY KEY, image bytea NOT NULL, encrypted bytea NOT NULL, snapshot jsonb NOT NULL)');
  await scoped.query('INSERT INTO recovery_fixture VALUES(1,$1,$2,$3)',[bytes,encrypted,JSON.stringify({rank:1,points:'123.45'})]);
  await run(executable('pg_dump'),['--format=custom','--no-owner','--no-acl',`--schema=${schema}`,`--file=${backup}`],{env:childEnv});
  await connection.query(`ALTER SCHEMA ${schema} RENAME TO ${retained}`);
  await run(executable('pg_restore'),['--exit-on-error','--no-owner','--no-acl',`--dbname=${childEnv.PGDATABASE}`,backup],{env:childEnv});
  const restored=await scoped.query('SELECT * FROM recovery_fixture');
  if(restored.rowCount!==1||createHash('sha256').update(restored.rows[0].image).digest('hex')!==hash)throw new Error('Restored evidence bytes differ.');
  const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
  if(Buffer.concat([decipher.update(restored.rows[0].encrypted),decipher.final()]).toString()!=='synthetic-room-secret')throw new Error('Restored credentials differ.');
  if(restored.rows[0].snapshot.points!=='123.45')throw new Error('Restored snapshot differs.');
  await migrate(scoped);
  success=true;process.stdout.write(JSON.stringify({status:'passed',elapsed_ms:Date.now()-started,checks:['schema and migration checksums','binary evidence hash','encrypted credential recovery','exact-decimal snapshot']})+'\n');
}catch{process.stderr.write('Recovery drill failed. Inspect the local drill backup and PostgreSQL configuration; no production database was targeted.\n');process.exitCode=1;}
finally{
  await scoped.end();
  await connection.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await connection.query(`DROP SCHEMA IF EXISTS ${retained} CASCADE`);
  await connection.end();if(success)await rm(backup);
}

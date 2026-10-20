import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createAdmin} from './auth.js';
import {createApp} from './app.js';
import {readConfig} from './config.js';
import {migrate} from './migrations.js';

const source=process.env.DATABASE_URL_TEST;
if(!source||!new URL(source).pathname.endsWith('_test'))throw new Error('Use a separate DATABASE_URL_TEST ending in _test.');
const schema=`load_${randomUUID().replaceAll('-','')}`,admin=new Pool({connectionString:source}),pool=new Pool({connectionString:source,options:`-c search_path=${schema}`,max:20});
let server:ReturnType<ReturnType<typeof createApp>['listen']>|undefined;
try{
  await admin.query(`CREATE SCHEMA ${schema}`);await migrate(pool);
  const operator=await createAdmin(pool,'load-admin@example.test',randomUUID()+randomUUID());
  const tournament=randomUUID();
  await pool.query("INSERT INTO tournaments(id,name,capacity,timezone,status,created_by,team_size,fee_minor,currency) VALUES($1,'Load check event',12,'Asia/Kolkata','Published',$2,4,0,'INR')",[tournament,operator]);
  const config=readConfig({NODE_ENV:'test',WEB_ORIGIN:'http://127.0.0.1:5173',DATABASE_URL:source,READINESS_TOKEN:'test-only-readiness-token-with-32-characters'});
  server=createApp(config,pool).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server!.once('listening',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('Local server address unavailable.');
  const base=`http://127.0.0.1:${address.port}`,paths=['/api/v1/tournaments',`/api/v1/tournaments/${tournament}`,'/api/v1/meta/config'];
  const durations:number[]=[],total=600,concurrency=30;let next=0,errors=0;
  await Promise.all(Array.from({length:concurrency},async()=>{while(next<total){const index=next++;const start=performance.now();try{const response=await fetch(base+paths[index%paths.length]);if(!response.ok)errors++;else await response.arrayBuffer();}catch{errors++;}durations.push(performance.now()-start);}}));
  durations.sort((a,b)=>a-b);
  const percentile=(value:number)=>Math.round(durations[Math.min(durations.length-1,Math.ceil(value*durations.length)-1)]??0);
  process.stdout.write(`${JSON.stringify({environment:'local isolated database; not a production capacity claim',requests:total,concurrency,errors,p50_ms:percentile(0.5),p95_ms:percentile(0.95),p99_ms:percentile(0.99)})}\n`);
  if(errors)process.exitCode=1;
}finally{
  if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
  await pool.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();
}

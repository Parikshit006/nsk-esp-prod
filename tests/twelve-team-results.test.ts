import {afterAll,beforeAll,expect,it} from 'vitest';
import request from 'supertest';
import {Pool} from 'pg';
import sharp from 'sharp';
import {createApp} from '../apps/api/src/app.js';
import {createAdmin} from '../apps/api/src/auth.js';
import {readConfig} from '../apps/api/src/config.js';
import {migrate} from '../apps/api/src/migrations.js';

const url=process.env.DATABASE_URL_TEST;
if(!url||!new URL(url).pathname.endsWith('_test'))throw new Error('DATABASE_URL_TEST must be a separate _test database.');
const schema=`test_${crypto.randomUUID().replaceAll('-','')}`;
const admin=new Pool({connectionString:url}),pool=new Pool({connectionString:url,options:`-c search_path=${schema}`});
const config=readConfig({NODE_ENV:'test',WEB_ORIGIN:'http://localhost:5173',DATABASE_URL:url,READINESS_TOKEN:'test-only-readiness-token-with-32-characters',CREDENTIAL_ENCRYPTION_KEY:'0123456789abcdef'.repeat(4)});
const app=createApp(config,pool);
const event=crypto.randomUUID(),match=crypto.randomUUID(),attempt=crypto.randomUUID();
const registrations:string[]=[],entries:string[]=[];

beforeAll(async()=>{
  await admin.query(`CREATE SCHEMA ${schema}`);await migrate(pool);
  const operator=await createAdmin(pool,'twelve-team-operator@example.test','operator-password-1234');
  const client=await pool.connect();
  try{await client.query('BEGIN');
    await client.query("INSERT INTO tournaments(id,name,capacity,timezone,status,created_by,team_size,fee_minor,currency) VALUES($1,'Twelve team trial',12,'Asia/Kolkata','InProgress',$2,1,0,'INR')",[event,operator]);
    await client.query("INSERT INTO tournament_rulesets(id,tournament_id,version_no,config,status,created_by) VALUES($1,$2,1,$3,'Frozen',$4)",[crypto.randomUUID(),event,JSON.stringify({points_per_kill:'1',placement_points:[12,9,8,7,6,5,4,3,2,1,0,0].map((points,index)=>({rank:index+1,points:String(points)})),kill_cap:null,tie_break_order:['admin_decision'],disqualification_policy:'void_all_results',cancelled_match_policy:'exclude_all_results'}),operator]);
    for(let n=1;n<=12;n++){
      const team=crypto.randomUUID(),registration=crypto.randomUUID(),entry=crypto.randomUUID();registrations.push(registration);entries.push(entry);
      await client.query('INSERT INTO teams(id,captain_id,name) VALUES($1,$2,$3)',[team,operator,`Team ${n}`]);
      await client.query("INSERT INTO registrations(id,tournament_id,team_id,name_key,status,payment_status,approval_status,slot_status,eligibility_status) VALUES($1,$2,$3,$4,'Submitted','NotRequired','Approved','Assigned','Verified')",[registration,event,team,`team ${n}`]);
      await client.query('INSERT INTO roster_entries(id,tournament_id,registration_id,display_name,ign_raw,ign_exact,role) VALUES($1,$2,$3,$4,$5,true,$6)',[entry,event,registration,`Player ${n}`,`PLAYER${n}NAME`,'Captain']);
      await client.query('INSERT INTO slots(id,tournament_id,slot_no,registration_id,assigned_by) VALUES($1,$2,$3,$4,$5)',[crypto.randomUUID(),event,n,registration,operator]);
    }
    await client.query("INSERT INTO matches(id,tournament_id,match_no,map,scheduled_at,ends_at,status,version,current_attempt_id) VALUES($1,$2,1,'Bermuda',now()-interval '2 hours',now()-interval '1 hour','AwaitingEvidence',1,$3)",[match,event,attempt]);
    await client.query('INSERT INTO match_attempts(id,match_id,attempt_no) VALUES($1,$2,1)',[attempt,match]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});
afterAll(async()=>{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});

it('requires all twelve teams and publishes organizer-entered hidden placements with configured scores',async()=>{
  const operator=request.agent(app),login=await operator.post('/api/v1/auth/login').send({email:'twelve-team-operator@example.test',password:'operator-password-1234'});
  const csrf=login.body.data.csrf_token as string;
  const screenshot=await sharp({create:{width:16,height:16,channels:3,background:'#ffffff'}}).png().toBuffer();
  const uploaded=await operator.post(`/api/v1/admin/matches/${match}/evidence`).set('X-CSRF-Token',csrf).set('Content-Type','image/png').send(screenshot);
  expect(uploaded.status).toBe(201);
  const rows=registrations.map((registration,index)=>({registration_id:registration,placement:index+1,player_kills:[{roster_entry_id:entries[index],kills:index<10?index+1:2}],adjustment:'0'}));
  const body={expected_match_version:1,evidence_id:uploaded.body.data.id,reason:'Organizer checked ten visible teams and entered both hidden teams.',rows};
  expect((await operator.post(`/api/v1/admin/matches/${match}/results`).set('X-CSRF-Token',csrf).send({...body,rows:rows.slice(0,10)})).status).toBe(409);
  const drafted=await operator.post(`/api/v1/admin/matches/${match}/results`).set('X-CSRF-Token',csrf).send(body);
  expect(drafted.status).toBe(201);
  expect((await request(app).get(`/api/v1/matches/${match}/results`)).status).toBe(404);
  expect((await operator.post(`/api/v1/admin/results/${drafted.body.data.id}/verify`).set('X-CSRF-Token',csrf).send({expected_match_version:2})).status).toBe(200);
  const verified=await operator.get(`/api/v1/admin/results/${drafted.body.data.id}`);
  expect(verified.body.data.rows.map((row:{score_breakdown:{match_points:string}})=>row.score_breakdown.match_points)).toEqual(['13','11','11','11','11','11','11','11','11','11','2','2']);
  expect((await operator.post(`/api/v1/admin/results/${drafted.body.data.id}/publish`).set('X-CSRF-Token',csrf).send({expected_match_version:3})).status).toBe(200);
  const publicResult=await request(app).get(`/api/v1/matches/${match}/results`);
  expect(publicResult.status).toBe(200);
  expect(publicResult.body.data.rows).toHaveLength(12);
  expect(publicResult.body.data.rows.slice(-2).map((row:{placement:number})=>row.placement)).toEqual([11,12]);
});

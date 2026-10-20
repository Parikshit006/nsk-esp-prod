import {afterAll,beforeAll,it,expect} from 'vitest';
import request from 'supertest';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.js';
import {createAdmin} from '../apps/api/src/auth.js';
import {readConfig} from '../apps/api/src/config.js';
import {migrate} from '../apps/api/src/migrations.js';
const url=process.env.DATABASE_URL_TEST;if(!url||!new URL(url).pathname.endsWith('_test'))throw new Error('Separate _test database required.');
const schema=`test_${crypto.randomUUID().replaceAll('-','')}`,admin=new Pool({connectionString:url}),pool=new Pool({connectionString:url,options:`-c search_path=${schema}`});
const app=createApp(readConfig({NODE_ENV:'test',DATABASE_URL:url,WEB_ORIGIN:'http://localhost:5173',READINESS_TOKEN:'test-readiness-token-with-at-least-32-characters'}),pool);
const event=crypto.randomUUID(),match=crypto.randomUUID(),team=crypto.randomUUID(),reg=crypto.randomUUID();const base=Date.now();const at=(h:number)=>new Date(base+h*3600000).toISOString();
beforeAll(async()=>{
 await admin.query(`CREATE SCHEMA ${schema}`);await migrate(pool);const actor=await createAdmin(pool,'schedule@example.test','schedule-test-password');await createAdmin(pool,'outsider@example.test','outsider-test-password');
 await pool.query("INSERT INTO tournaments(id,name,status,capacity,timezone,created_by,starts_at,ends_at) VALUES($1,'Schedule test','RegistrationClosed',12,'Asia/Kolkata',$2,$3,$4)",[event,actor,at(1),at(6)]);
 await pool.query("INSERT INTO teams(id,captain_id,name) VALUES($1,$2,'Schedule team')",[team,actor]);await pool.query("INSERT INTO registrations(id,tournament_id,team_id,name_key,status) VALUES($1,$2,$3,'schedule team','Submitted')",[reg,event,team]);
 const client=await pool.connect();try{await client.query('BEGIN');for(const [n,id,start,end] of [[1,match,2,3],[2,crypto.randomUUID(),4,5]] as const){const attempt=crypto.randomUUID();await client.query("INSERT INTO matches(id,tournament_id,match_no,map,scheduled_at,ends_at,current_attempt_id,status) VALUES($1,$2,$3,'Bermuda',$4,$5,$6,'Ready')",[id,event,n,at(start),at(end),attempt]);await client.query('INSERT INTO match_attempts(id,match_id,attempt_no) VALUES($1,$2,1)',[attempt,id]);}await client.query('COMMIT');}finally{client.release();}
 await pool.query("INSERT INTO match_credentials(id,match_id,version_no,iv,ciphertext,auth_tag,release_at,status,created_by) VALUES($1,$2,1,$3,$4,$5,$6,'Set',$7)",[crypto.randomUUID(),match,Buffer.alloc(12),Buffer.from('test encrypted bytes'),Buffer.alloc(16),at(1.5),actor]);
});
afterAll(async()=>{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
it('reschedules atomically, shifts release, isolates notices and rejects stale or overlapping writes',async()=>{
 const agent=request.agent(app),csrf=(await agent.post('/api/v1/auth/login').send({email:'schedule@example.test',password:'schedule-test-password'})).body.data.csrf_token;
 const path=`/api/v1/admin/matches/${match}/reschedule`,body={expected_version:1,scheduled_at:at(3),ends_at:at(4),reason:'Moving the lobby to accommodate the event delay.'};
 expect((await agent.post(path).send(body)).status).toBe(403);
 expect((await agent.post(path).set('X-CSRF-Token',csrf).send({...body,scheduled_at:at(3.5),ends_at:at(4.5)})).status).toBe(409);
 const result=await agent.post(path).set('X-CSRF-Token',csrf).send(body);expect(result.status).toBe(200);expect(result.body.data).toMatchObject({status:'Scheduled',version:2});
 expect((await agent.post(path).set('X-CSRF-Token',csrf).send(body)).status).toBe(409);
 const credentials=(await pool.query('SELECT status,release_at,ciphertext FROM match_credentials WHERE match_id=$1 ORDER BY version_no',[match])).rows;
 expect(credentials.map(c=>c.status)).toEqual(['Superseded','Set']);expect(credentials[1].release_at.toISOString()).toBe(at(2.5));expect(credentials[1].ciphertext.equals(credentials[0].ciphertext)).toBe(true);
 const notices=(await agent.get('/api/v1/me/notifications')).body.data;expect(notices).toHaveLength(1);expect(notices[0].title).toBe('Match 1 rescheduled');expect(JSON.stringify(notices)).not.toContain('test encrypted bytes');
 const other=request.agent(app),otherCsrf=(await other.post('/api/v1/auth/login').send({email:'outsider@example.test',password:'outsider-test-password'})).body.data.csrf_token;
 expect((await other.get('/api/v1/me/notifications')).body.data).toEqual([]);expect((await other.post(`/api/v1/me/notifications/${notices[0].id}/read`).set('X-CSRF-Token',otherCsrf)).status).toBe(404);
 expect((await agent.post(`/api/v1/me/notifications/${notices[0].id}/read`).set('X-CSRF-Token',csrf)).body.data.read_at).toBeTruthy();
 await pool.query("UPDATE matches SET status='InProgress' WHERE id=$1",[match]);expect((await agent.post(path).set('X-CSRF-Token',csrf).send({...body,expected_version:2})).status).toBe(409);
});
it('moves an unstarted whole event with its rounds and credential releases',async()=>{
 const event2=crypto.randomUUID(),first=crypto.randomUUID(),second=crypto.randomUUID(),owner=(await pool.query("SELECT id FROM accounts WHERE email='schedule@example.test'")).rows[0].id as string;
 const client=await pool.connect();try{await client.query('BEGIN');await client.query("INSERT INTO tournaments(id,name,status,capacity,timezone,created_by,starts_at,ends_at,registration_close_at) VALUES($1,'Shiftable event','RegistrationClosed',12,'Asia/Kolkata',$2,$3,$4,$5)",[event2,owner,at(8),at(13),at(7)]);await client.query("INSERT INTO registrations(id,tournament_id,team_id,name_key,status) VALUES($1,$2,$3,'schedule team','Submitted')",[crypto.randomUUID(),event2,team]);for(const [n,id,start,end] of [[1,first,9,10],[2,second,11,12]] as const){const attempt=crypto.randomUUID();await client.query("INSERT INTO matches(id,tournament_id,match_no,map,scheduled_at,ends_at,current_attempt_id,status) VALUES($1,$2,$3,'Bermuda',$4,$5,$6,'Ready')",[id,event2,n,at(start),at(end),attempt]);await client.query('INSERT INTO match_attempts(id,match_id,attempt_no) VALUES($1,$2,1)',[attempt,id]);}await client.query("INSERT INTO match_credentials(id,match_id,version_no,iv,ciphertext,auth_tag,release_at,status,created_by) VALUES($1,$2,1,$3,$4,$5,$6,'Set',$7)",[crypto.randomUUID(),first,Buffer.alloc(12),Buffer.from('shift encrypted bytes'),Buffer.alloc(16),at(8.5),owner]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 const agent=request.agent(app),csrf=(await agent.post('/api/v1/auth/login').send({email:'schedule@example.test',password:'schedule-test-password'})).body.data.csrf_token;
 const path=`/api/v1/admin/tournaments/${event2}/reschedule`,body={expected_version:1,starts_at:at(10),reason:'Venue access moved, so the full event must move together.'};
 expect((await agent.post(path).send(body)).status).toBe(403);
 expect((await agent.post(path).set('X-CSRF-Token',csrf).send({...body,starts_at:at(6)})).status).toBe(409);
 const moved=await agent.post(path).set('X-CSRF-Token',csrf).send(body);expect(moved.status).toBe(200);expect(moved.body.data).toMatchObject({version:2,shifted_matches:2,starts_at:at(10),ends_at:at(15)});
 expect((await agent.post(path).set('X-CSRF-Token',csrf).send(body)).status).toBe(409);
 const rounds=(await pool.query('SELECT scheduled_at,ends_at,status,version FROM matches WHERE tournament_id=$1 ORDER BY match_no',[event2])).rows;expect(rounds.map(item=>[item.scheduled_at.toISOString(),item.ends_at.toISOString(),item.status,item.version])).toEqual([[at(11),at(12),'Scheduled',2],[at(13),at(14),'Scheduled',2]]);
 const credentials=(await pool.query('SELECT status,release_at,ciphertext FROM match_credentials WHERE match_id=$1 ORDER BY version_no',[first])).rows;expect(credentials.map(item=>item.status)).toEqual(['Superseded','Set']);expect(credentials[1].release_at.toISOString()).toBe(at(10.5));expect(credentials[1].ciphertext.equals(credentials[0].ciphertext)).toBe(true);
 expect((await agent.get('/api/v1/me/notifications')).body.data.some((item:{title:string})=>item.title==='Tournament rescheduled')).toBe(true);
 expect((await pool.query("SELECT 1 FROM audit_events WHERE entity_id=$1 AND action='tournament.rescheduled'",[event2])).rowCount).toBe(1);
 await pool.query("UPDATE matches SET status='InProgress' WHERE id=$1",[first]);expect((await agent.post(path).set('X-CSRF-Token',csrf).send({...body,expected_version:2,starts_at:at(12)})).status).toBe(409);
});

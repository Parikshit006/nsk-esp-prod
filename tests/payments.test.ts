import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import { Pool } from 'pg';
import sharp from 'sharp';
import { createApp } from '../apps/api/src/app.js';
import { readConfig } from '../apps/api/src/config.js';
import { createAdmin } from '../apps/api/src/auth.js';
import { migrate } from '../apps/api/src/migrations.js';

const url=process.env.DATABASE_URL_TEST;if(!url||!new URL(url).pathname.endsWith('_test'))throw new Error('DATABASE_URL_TEST must be a separate _test database.');
const schema=`test_${crypto.randomUUID().replaceAll('-','')}`;const admin=new Pool({connectionString:url});const pool=new Pool({connectionString:url,options:`-c search_path=${schema}`});const config=readConfig({NODE_ENV:'test',WEB_ORIGIN:'http://localhost:5173',DATABASE_URL:url,READINESS_TOKEN:'test-only-readiness-token-with-32-characters',CREDENTIAL_ENCRYPTION_KEY:'0123456789abcdef'.repeat(4)});const app=createApp(config,pool);
const event=crypto.randomUUID(),match=crypto.randomUUID(),attempt=crypto.randomUUID(),registrations=[crypto.randomUUID(),crypto.randomUUID()];
beforeAll(async()=>{
  await admin.query(`CREATE SCHEMA ${schema}`);await migrate(pool);const operator=await createAdmin(pool,'payment-operator@example.test','operator-password-1234');
  const accounts=[];for(let n=1;n<=2;n++){const response=await request(app).post('/api/v1/auth/register').send({display_name:`Captain ${n}`,email:`payment-captain-${n}@example.test`,password:'captain-password-1234'});accounts.push(response.body.data.id as string);}
  const client=await pool.connect();try{await client.query('BEGIN');await client.query("INSERT INTO tournaments(id,name,capacity,timezone,status,created_by,team_size,fee_minor,currency,payment_instructions,payment_proof_max_bytes) VALUES($1,'Paid entry test',12,'Asia/Kolkata','RegistrationClosed',$2,1,5000,'INR','Pay to organizer reference',65536)",[event,operator]);for(let n=0;n<2;n++){const team=crypto.randomUUID();await client.query('INSERT INTO teams(id,captain_id,name) VALUES($1,$2,$3)',[team,accounts[n],`Paid Team ${n+1}`]);await client.query("INSERT INTO registrations(id,tournament_id,team_id,name_key,status,payment_status,approval_status,slot_status,eligibility_status) VALUES($1,$2,$3,$4,'Submitted','Pending','Unreviewed','Unassigned','Verified')",[registrations[n],event,team,`paid team ${n+1}`]);await client.query('INSERT INTO roster_entries(id,tournament_id,registration_id,account_id,display_name,ign_raw,ign_exact,role) VALUES($1,$2,$3,$4,$5,$6,true,$7)',[crypto.randomUUID(),event,registrations[n],accounts[n],`Captain ${n+1}`,`PAY${n+1}`,'Captain']);}await client.query("INSERT INTO matches(id,tournament_id,match_no,map,scheduled_at,ends_at,current_attempt_id) VALUES($1,$2,1,'Bermuda',now()+interval '1 hour',now()+interval '2 hours',$3)",[match,event,attempt]);await client.query('INSERT INTO match_attempts(id,match_id,attempt_no) VALUES($1,$2,1)',[attempt,match]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});
afterAll(async()=>{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
it('reviews private paid proofs, flags duplicates and gates approval and room access on reversal',async()=>{
  const operator=request.agent(app),first=request.agent(app),second=request.agent(app);const adminCsrf=(await operator.post('/api/v1/auth/login').send({email:'payment-operator@example.test',password:'operator-password-1234'})).body.data.csrf_token as string;const firstCsrf=(await first.post('/api/v1/auth/login').send({email:'payment-captain-1@example.test',password:'captain-password-1234'})).body.data.csrf_token as string;const secondCsrf=(await second.post('/api/v1/auth/login').send({email:'payment-captain-2@example.test',password:'captain-password-1234'})).body.data.csrf_token as string;
  const image=await sharp({create:{width:16,height:16,channels:3,background:'#ffffff'}}).png().toBuffer();
  async function upload(agent:ReturnType<typeof request.agent>,csrf:string,registration:string,reference:string,bytes:Buffer){return agent.post(`/api/v1/registrations/${registration}/payment-proofs`).set('X-CSRF-Token',csrf).set('Content-Type','image/png').set('X-Payment-Reference',reference).set('X-Payment-Amount-Minor','5000').send(bytes);}
  expect((await operator.post(`/api/v1/admin/registrations/${registrations[0]}/decision`).set('X-CSRF-Token',adminCsrf).send({expected_version:1,decision:'approve'})).status).toBe(409);
  const submitted=await upload(first,firstCsrf,registrations[0]!,'REF-100',image);expect(submitted.status).toBe(201);expect(submitted.body.data.duplicate_flags.same_image).toBe(false);const firstId=submitted.body.data.id as string;
  expect((await request(app).get(`/api/v1/payment-proofs/${firstId}/image`)).status).toBe(401);
  expect((await second.get(`/api/v1/payment-proofs/${firstId}/image`)).status).toBe(404);
  const secondProof=await upload(second,secondCsrf,registrations[1]!,'REF-100',image);expect(secondProof.status).toBe(201);expect(secondProof.body.data.duplicate_flags).toMatchObject({same_image:true,same_reference:true});
  const review=await operator.get(`/api/v1/admin/registrations/${registrations[1]}/payment-proofs`);expect(review.body.data[0].duplicate_flags.same_image).toBe(true);
  expect((await operator.post(`/api/v1/admin/payment-proofs/${secondProof.body.data.id}/decision`).set('X-CSRF-Token',adminCsrf).send({expected_version:2,decision:'verify',note:'Investigated duplicate payment reference.'})).status).toBe(409);
  expect((await operator.post(`/api/v1/admin/payment-proofs/${secondProof.body.data.id}/decision`).set('X-CSRF-Token',adminCsrf).send({expected_version:2,decision:'verify',note:'Investigated duplicate payment reference.',duplicate_reviewed:true})).status).toBe(200);
  const verified=await operator.post(`/api/v1/admin/payment-proofs/${firstId}/decision`).set('X-CSRF-Token',adminCsrf).send({expected_version:2,decision:'verify',note:'Checked amount and duplicate transaction source.',duplicate_reviewed:true});expect(verified.status).toBe(200);
  const approved=await operator.post(`/api/v1/admin/registrations/${registrations[0]}/decision`).set('X-CSRF-Token',adminCsrf).send({expected_version:3,decision:'approve'});expect(approved.status).toBe(200);
  const slot=await operator.put(`/api/v1/admin/tournaments/${event}/slots/1`).set('X-CSRF-Token',adminCsrf).send({expected_version:4,registration_id:registrations[0]});expect(slot.status).toBe(201);
  const room=await operator.post(`/api/v1/admin/matches/${match}/credentials`).set('X-CSRF-Token',adminCsrf).send({expected_version:1,room_id:'PAID-ROOM',password:'PAID-PASSWORD',release_at:new Date(Date.now()-1000).toISOString()});expect(room.status).toBe(201);expect((await first.get(`/api/v1/matches/${match}/credentials`)).status).toBe(200);
  const reversed=await operator.post(`/api/v1/admin/payment-proofs/${firstId}/decision`).set('X-CSRF-Token',adminCsrf).send({expected_version:5,decision:'reverse',note:'Reference was reversed by the payment provider.'});expect(reversed.body.data).toMatchObject({status:'Rejected',payment_recheck_required:true});expect((await first.get(`/api/v1/matches/${match}/credentials`)).status).toBe(403);
  const replacement=await sharp({create:{width:16,height:16,channels:3,background:'#000000'}}).png().toBuffer();const resubmitted=await upload(first,firstCsrf,registrations[0]!,'REF-101',replacement);expect(resubmitted.status).toBe(201);
  expect((await operator.post(`/api/v1/admin/payment-proofs/${resubmitted.body.data.id}/decision`).set('X-CSRF-Token',adminCsrf).send({expected_version:7,decision:'verify',note:'Replacement reference and amount confirmed.'})).status).toBe(200);
  expect((await first.get(`/api/v1/matches/${match}/credentials`)).status).toBe(403);
  const recheck=await operator.post(`/api/v1/admin/registrations/${registrations[0]}/payment-recheck`).set('X-CSRF-Token',adminCsrf).send({expected_version:8,reason:'Fresh payment proof independently reviewed.'});expect(recheck.status).toBe(200);expect((await first.get(`/api/v1/matches/${match}/credentials`)).status).toBe(200);
  const detail=await operator.get(`/api/v1/admin/tournaments/${event}`);
  const cancelled=await operator.post(`/api/v1/admin/tournaments/${event}/transition`).set('X-CSRF-Token',adminCsrf).send({expected_version:detail.body.data.version,action:'cancel',reason:'The venue is unavailable so the tournament is cancelled.'});expect(cancelled.status).toBe(200);
  const revoked=await first.get(`/api/v1/matches/${match}/credentials`);expect(revoked.status).toBe(409);expect(JSON.stringify(revoked.body)).not.toContain('PAID-PASSWORD');
  expect((await first.get(`/api/v1/registrations/${registrations[0]}`)).body.data).toMatchObject({status:'Cancelled',slot_status:'Released'});
  expect((await operator.get(`/api/v1/admin/tournaments/${event}/slots`)).body.data).toHaveLength(0);
  expect((await operator.get(`/api/v1/admin/matches/${match}`)).body.data.status).toBe('Cancelled');
  const reviews=(await operator.get(`/api/v1/admin/tournaments/${event}/refund-reviews`)).body.data;expect(reviews).toHaveLength(2);
  const own=(await first.get('/api/v1/me/refund-reviews')).body.data;expect(own).toHaveLength(1);expect(own[0].registration_id).toBe(registrations[0]);
  const outcome={resolution:'Refunded',amount_minor:5000,note:'Refund completed outside the platform, reference TEST-REFUND-001.'};
  expect((await first.post(`/api/v1/admin/refund-reviews/${own[0].id}/decision`).set('X-CSRF-Token',firstCsrf).send(outcome)).status).toBe(403);
  expect((await operator.post(`/api/v1/admin/refund-reviews/${own[0].id}/decision`).set('X-CSRF-Token',adminCsrf).send({...outcome,amount_minor:6000})).status).toBe(409);
  expect((await operator.post(`/api/v1/admin/refund-reviews/${own[0].id}/decision`).set('X-CSRF-Token',adminCsrf).send(outcome)).status).toBe(200);
  expect((await operator.post(`/api/v1/admin/refund-reviews/${own[0].id}/decision`).set('X-CSRF-Token',adminCsrf).send(outcome)).status).toBe(409);
  expect((await first.get('/api/v1/me/refund-reviews')).body.data[0]).toMatchObject({status:'Resolved',amount_minor:5000});
});

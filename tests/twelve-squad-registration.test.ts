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
const adminPool=new Pool({connectionString:url}),pool=new Pool({connectionString:url,options:`-c search_path=${schema}`});
const config=readConfig({NODE_ENV:'test',WEB_ORIGIN:'http://localhost:5173',DATABASE_URL:url,READINESS_TOKEN:'test-only-readiness-token-with-32-characters'});
const app=createApp(config,pool);
const eventId=crypto.randomUUID(),password='trial-password-1234';

beforeAll(async()=>{
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  await migrate(pool);
  const operator=await createAdmin(pool,'scale-operator@example.test',password);
  await pool.query("INSERT INTO tournaments(id,name,capacity,timezone,status,created_by,team_size,fee_minor,currency,registration_open_at,registration_close_at,starts_at,ends_at) VALUES($1,'Twelve squad registration trial',12,'Asia/Kolkata','RegistrationOpen',$2,4,0,'INR',now()-interval '1 hour',now()+interval '1 hour',now()+interval '2 hours',now()+interval '5 hours')",[eventId,operator]);
});
afterAll(async()=>{await pool.end();await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);await adminPool.end();});

it('registers and links 48 players in twelve squads before approval and slot assignment',async()=>{
  const operator=request.agent(app);
  const adminLogin=await operator.post('/api/v1/auth/login').send({email:'scale-operator@example.test',password});
  expect(adminLogin.status).toBe(200);
  const adminCsrf=adminLogin.body.data.csrf_token as string;
  const adminPost=(path:string,body:object)=>operator.post(path).set('X-CSRF-Token',adminCsrf).send(body);
  const registrations:string[]=[];

  for(let squad=1;squad<=12;squad++){
    const captainEmail=`captain-${squad}@example.test`;
    expect((await request(app).post('/api/v1/auth/register').send({display_name:`Captain ${squad}`,email:captainEmail,password})).status).toBe(201);
    const captain=request.agent(app);
    const captainLogin=await captain.post('/api/v1/auth/login').send({email:captainEmail,password});
    expect(captainLogin.status).toBe(200);
    const csrf=captainLogin.body.data.csrf_token as string;
    const captainPost=(path:string,body:object)=>captain.post(path).set('X-CSRF-Token',csrf).send(body);
    expect((await captain.put('/api/v1/me/game-profile').set('X-CSRF-Token',csrf).send({ign_raw:`CAPTAIN${squad}`,game_uid:`C-${squad}`})).status).toBe(200);
    const team=await captainPost('/api/v1/teams',{name:`Trial Team ${squad}`});
    expect(team.status).toBe(201);
    const draft=await captainPost(`/api/v1/tournaments/${eventId}/registrations`,{team_id:team.body.data.id});
    expect(draft.status).toBe(201);
    const registrationId=draft.body.data.id as string;
    registrations.push(registrationId);
    let version=draft.body.data.version as number;
    const captainEntry=await captainPost(`/api/v1/registrations/${registrationId}/roster`,{expected_version:version,display_name:`Captain ${squad}`,ign_raw:`CAPTAIN${squad}`,ign_exact:true,game_uid:`C-${squad}`,role:'Captain',self:true});
    expect(captainEntry.status).toBe(201);
    version=captainEntry.body.data.version;

    for(let member=1;member<=3;member++){
      const email=`player-${squad}-${member}@example.test`;
      expect((await request(app).post('/api/v1/auth/register').send({display_name:`Player ${squad}-${member}`,email,password,account_type:'member'})).status).toBe(201);
      const player=request.agent(app);
      const playerLogin=await player.post('/api/v1/auth/login').send({email,password});
      expect(playerLogin.status).toBe(200);
      const playerCsrf=playerLogin.body.data.csrf_token as string;
      const ign=`PLAYER${squad}${member}`;
      expect((await player.put('/api/v1/me/game-profile').set('X-CSRF-Token',playerCsrf).send({ign_raw:ign,game_uid:`P-${squad}-${member}`})).status).toBe(200);
      const entry=await captainPost(`/api/v1/registrations/${registrationId}/roster`,{expected_version:version,display_name:`Player ${squad}-${member}`,ign_raw:ign,ign_exact:true,game_uid:`P-${squad}-${member}`,role:'Player',self:false});
      expect(entry.status).toBe(201);
      version=entry.body.data.version;
      const invitation=await captainPost(`/api/v1/registrations/${registrationId}/roster/${entry.body.data.id}/invitations`,{email});
      expect(invitation.status).toBe(201);
      const token=new URL(invitation.body.data.invite_url).hash.slice(1);
      const accepted=await player.post('/api/v1/invitations/accept').set('X-CSRF-Token',playerCsrf).send({token});
      expect(accepted.status).toBe(200);
    }
    const beforeSubmit=await captain.get(`/api/v1/registrations/${registrationId}`);
    expect(beforeSubmit.body.data.roster).toHaveLength(4);
    expect(beforeSubmit.body.data.roster.every((entry:{account_id:string|null})=>Boolean(entry.account_id))).toBe(true);
    const submitted=await captainPost(`/api/v1/registrations/${registrationId}/submit`,{expected_version:version,eligibility_note:'All four players meet the event requirements.'});
    expect(submitted.status).toBe(200);
    version=submitted.body.data.version;
    const eligibility=await adminPost(`/api/v1/admin/registrations/${registrationId}/eligibility`,{expected_version:version,approved:true,note:'Organizer checked all four player identities.'});
    expect(eligibility.status).toBe(200);
    version=eligibility.body.data.version;
    const approval=await adminPost(`/api/v1/admin/registrations/${registrationId}/decision`,{expected_version:version,decision:'approve'});
    expect(approval.status).toBe(200);
    version=approval.body.data.version;
    const assigned=await operator.put(`/api/v1/admin/tournaments/${eventId}/slots/${squad}`).set('X-CSRF-Token',adminCsrf).send({expected_version:version,registration_id:registrationId});
    expect(assigned.status).toBe(201);
    const publicEvent=await request(app).get(`/api/v1/tournaments/${eventId}`);
    expect(publicEvent.body.data.assigned_slots).toBe(squad);
  }

  expect(registrations).toHaveLength(12);
  expect((await pool.query('SELECT count(*)::int AS count FROM game_profiles')).rows[0].count).toBe(48);
  expect((await pool.query("SELECT count(*)::int AS count FROM roster_entries WHERE tournament_id=$1 AND status='Active' AND account_id IS NOT NULL",[eventId])).rows[0].count).toBe(48);
  expect((await pool.query("SELECT count(*)::int AS count FROM slots WHERE tournament_id=$1 AND status='Assigned'",[eventId])).rows[0].count).toBe(12);
  const operatorId=(await pool.query("SELECT id FROM accounts WHERE email='scale-operator@example.test'")).rows[0].id as string;
  const matchId=crypto.randomUUID(),attemptId=crypto.randomUUID();
  const rules={points_per_kill:'1',placement_points:[12,9,8,7,6,5,4,3,2,1,0,0].map((points,index)=>({rank:index+1,points:String(points)})),kill_cap:null,tie_break_order:['admin_decision'],disqualification_policy:'void_all_results',cancelled_match_policy:'exclude_all_results'};
  const setup=await pool.connect();
  try{
    await setup.query('BEGIN');
    await setup.query("UPDATE tournaments SET status='InProgress' WHERE id=$1",[eventId]);
    await setup.query("INSERT INTO tournament_rulesets(id,tournament_id,version_no,config,status,created_by) VALUES($1,$2,1,$3,'Frozen',$4)",[crypto.randomUUID(),eventId,JSON.stringify(rules),operatorId]);
    await setup.query("INSERT INTO matches(id,tournament_id,match_no,map,scheduled_at,ends_at,status,version,current_attempt_id) VALUES($1,$2,1,'Bermuda',now()-interval '2 hours',now()-interval '1 hour','AwaitingEvidence',1,$3)",[matchId,eventId,attemptId]);
    await setup.query('INSERT INTO match_attempts(id,match_id,attempt_no) VALUES($1,$2,1)',[attemptId,matchId]);
    await setup.query('COMMIT');
  }catch(error){await setup.query('ROLLBACK');throw error;}finally{setup.release();}
  const screenshot=await sharp({create:{width:16,height:16,channels:3,background:'#ffffff'}}).png().toBuffer();
  const uploaded=await operator.post(`/api/v1/admin/matches/${matchId}/evidence`).set('X-CSRF-Token',adminCsrf).set('Content-Type','image/png').send(screenshot);
  expect(uploaded.status).toBe(201);
  const resultRows=[];
  for(const [index,registrationId] of registrations.entries()){
    const players=(await pool.query<{id:string}>('SELECT id FROM roster_entries WHERE registration_id=$1 ORDER BY created_at,id',[registrationId])).rows;
    expect(players).toHaveLength(4);
    resultRows.push({registration_id:registrationId,placement:index+1,player_kills:players.map((player,slot)=>({roster_entry_id:player.id,kills:slot===0?1:0})),adjustment:'0'});
  }
  const drafted=await adminPost(`/api/v1/admin/matches/${matchId}/results`,{expected_match_version:1,evidence_id:uploaded.body.data.id,reason:'Checked all visible teams and entered the two hidden placements.',rows:resultRows});
  expect(drafted.status).toBe(201);
  expect((await request(app).get(`/api/v1/matches/${matchId}/results`)).status).toBe(404);
  expect((await adminPost(`/api/v1/admin/results/${drafted.body.data.id}/verify`,{expected_match_version:2})).status).toBe(200);
  expect((await adminPost(`/api/v1/admin/results/${drafted.body.data.id}/publish`,{expected_match_version:3})).status).toBe(200);
  const published=await request(app).get(`/api/v1/matches/${matchId}/results`);
  expect(published.status).toBe(200);
  expect(published.body.data.rows).toHaveLength(12);
  expect(published.body.data.rows.slice(-2).map((row:{placement:number})=>row.placement)).toEqual([11,12]);
},150000);

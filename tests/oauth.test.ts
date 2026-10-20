import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import request from 'supertest';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.js';
import {createAdmin} from '../apps/api/src/auth.js';
import {readConfig} from '../apps/api/src/config.js';
import {migrate} from '../apps/api/src/migrations.js';

const url=process.env.DATABASE_URL_TEST;
if(!url||!new URL(url).pathname.endsWith('_test'))throw new Error('DATABASE_URL_TEST must be a separate _test database.');
const schema=`test_${crypto.randomUUID().replaceAll('-','')}`;
const admin=new Pool({connectionString:url}),pool=new Pool({connectionString:url,options:`-c search_path=${schema}`});
const config=readConfig({NODE_ENV:'test',WEB_ORIGIN:'http://localhost:5173',DATABASE_URL:url,READINESS_TOKEN:'test-only-readiness-token-with-32-characters',CREDENTIAL_ENCRYPTION_KEY:'0123456789abcdef'.repeat(4),GOOGLE_CLIENT_ID:'google-test-id',GOOGLE_CLIENT_SECRET:'google-test-secret',DISCORD_CLIENT_ID:'discord-test-id',DISCORD_CLIENT_SECRET:'discord-test-secret'});
const app=createApp(config,pool);
beforeAll(async()=>{await admin.query(`CREATE SCHEMA ${schema}`);await migrate(pool);});
afterAll(async()=>{vi.unstubAllGlobals();await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});

function mockProvider(provider:'google'|'discord',email:string,verified=true){
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:string|URL,options?:RequestInit)=>{
    const target=String(input);calls.push(target);
    if(target.includes('/token')){
      const params=new URLSearchParams(String(options?.body));
      expect(params.get('code_verifier')).toBeTruthy();
      expect(params.get('redirect_uri')).toBe(`http://localhost:5173/api/v1/auth/oauth/${provider}/callback`);
      return new Response(JSON.stringify({access_token:'private-test-token',token_type:'Bearer'}),{status:200});
    }
    expect(options?.headers).toMatchObject({Authorization:'Bearer private-test-token'});
    return new Response(JSON.stringify(provider==='google'?{sub:'google-subject',email,email_verified:verified,name:'OAuth Player'}:{id:'discord-subject',email,verified,username:'OAuth Player'}),{status:200});
  }));
  return calls;
}
function stateFrom(response:{headers:Record<string,string>}){return new URL(response.headers.location!).searchParams.get('state')!;}

it('binds Google login to browser state, creates only a captain and rejects callback replay',async()=>{
  expect((await request(app).get('/api/v1/auth/oauth/providers')).body.data.providers).toEqual(['google','discord']);
  const browser=request.agent(app);
  const start=await browser.get('/api/v1/auth/oauth/google/start?role=captain&return_to=participate');
  expect(start.status).toBe(302);
  const state=stateFrom(start);
  expect(new URL(start.headers.location!).searchParams.get('code_challenge_method')).toBe('S256');
  expect((await request(app).get(`/api/v1/auth/oauth/google/callback?state=${state}&code=sample`)).headers.location).toBe('/participate?oauth=failed');
  const calls=mockProvider('google','new-oauth@example.test');
  const done=await browser.get(`/api/v1/auth/oauth/google/callback?state=${state}&code=sample`);
  expect(done.headers.location).toBe('/participate?oauth=signed-in');
  expect(calls).toHaveLength(2);
  expect((await browser.get('/api/v1/auth/me')).body.data.user).toMatchObject({email:'new-oauth@example.test',role:'captain',email_verified:true});
  expect((await browser.get(`/api/v1/auth/oauth/google/callback?state=${state}&code=sample`)).headers.location).toBe('/participate?oauth=failed');
  const account=await pool.query<{password_hash:string}>('SELECT password_hash FROM accounts WHERE email=$1',['new-oauth@example.test']);
  expect(account.rows[0]!.password_hash).toMatch(/^scrypt\$32768\$/);
  vi.unstubAllGlobals();
});

it('requires explicit linking for an existing organizer and permits linked Discord sign-in',async()=>{
  const operatorId=await createAdmin(pool,'oauth-organizer@example.test','organizer-password-1234');
  const operator=request.agent(app);
  const csrf=(await operator.post('/api/v1/auth/login').send({email:'oauth-organizer@example.test',password:'organizer-password-1234'})).body.data.csrf_token as string;
  const unlinked=request.agent(app);
  const first=await unlinked.get('/api/v1/auth/oauth/discord/start?return_to=admin');
  mockProvider('discord','oauth-organizer@example.test');
  expect((await unlinked.get(`/api/v1/auth/oauth/discord/callback?state=${stateFrom(first)}&code=sample`)).headers.location).toBe('/admin?oauth=failed');
  expect((await pool.query('SELECT * FROM oauth_identities WHERE account_id=$1',[operatorId])).rowCount).toBe(0);
  expect((await operator.post('/api/v1/auth/oauth/discord/link?return_to=admin')).status).toBe(403);
  const linked=await operator.post('/api/v1/auth/oauth/discord/link?return_to=admin').set('X-CSRF-Token',csrf);
  expect(linked.status).toBe(200);
  const state=new URL(linked.body.data.authorization_url).searchParams.get('state')!;
  expect((await operator.get(`/api/v1/auth/oauth/discord/callback?state=${state}&code=sample`)).headers.location).toBe('/admin?oauth=linked');
  expect((await pool.query('SELECT subject FROM oauth_identities WHERE account_id=$1',[operatorId])).rows).toEqual([{subject:'discord-subject'}]);
  const next=request.agent(app),newStart=await next.get('/api/v1/auth/oauth/discord/start?return_to=admin');
  expect((await next.get(`/api/v1/auth/oauth/discord/callback?state=${stateFrom(newStart)}&code=sample`)).headers.location).toBe('/admin?oauth=signed-in');
  expect((await next.get('/api/v1/auth/me')).body.data.user.role).toBe('super_admin');
  vi.unstubAllGlobals();
});

it('does not create an account from an unverified provider email',async()=>{
  const browser=request.agent(app),start=await browser.get('/api/v1/auth/oauth/google/start?return_to=participate');
  mockProvider('google','unverified-oauth@example.test',false);
  expect((await browser.get(`/api/v1/auth/oauth/google/callback?state=${stateFrom(start)}&code=sample`)).headers.location).toBe('/participate?oauth=failed');
  expect((await pool.query('SELECT id FROM accounts WHERE email=$1',['unverified-oauth@example.test'])).rowCount).toBe(0);
  vi.unstubAllGlobals();
});

it('allows a full shared-network lobby to begin OAuth sign-in while retaining a rate limit',async()=>{
  await pool.query('DELETE FROM login_attempts');
  for(let player=0;player<100;player++){
    const started=await request(app).get('/api/v1/auth/oauth/google/start?role=member&return_to=join');
    expect(started.status).toBe(302);
  }
  const capped=await request(app).get('/api/v1/auth/oauth/google/start?role=member&return_to=join');
  expect(capped.status).toBe(429);
},15000);

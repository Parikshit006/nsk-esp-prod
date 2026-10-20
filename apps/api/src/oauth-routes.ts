import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {Router,type Request,type Response} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
import type {Config} from './config.js';
import {hashPassword,requireAccount,requireCsrf} from './auth.js';

type Provider='google'|'discord';
type Destination='participate'|'join'|'admin';
type Flow={provider:Provider;purpose:'login'|'link';requested_role:'captain'|'member';return_to:Destination;code_verifier:string;account_id:string|null;session_id:string|null};
type Profile={subject:string;email:string;name:string};
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const nonce=()=>randomBytes(32).toString('base64url');
const cookieName='esp_oauth_browser';
const accountCookie='esp_admin_session';
const requestSchema=z.object({role:z.enum(['captain','member']).default('captain'),return_to:z.enum(['participate','join','admin']).default('participate')});
const callbackSchema=z.object({state:z.string().min(30).max(256),code:z.string().min(1).max(4096)});
const providerSchema=z.enum(['google','discord']);
const profileSchema=z.object({sub:z.string().min(1).max(255),email:z.email(),email_verified:z.literal(true),name:z.string().optional()});
const discordProfileSchema=z.object({id:z.string().min(1).max(255),email:z.email(),verified:z.literal(true),global_name:z.string().nullable().optional(),username:z.string().optional()});

function client(config:Config,provider:Provider){
  const id=provider==='google'?config.GOOGLE_CLIENT_ID:config.DISCORD_CLIENT_ID;
  const secret=provider==='google'?config.GOOGLE_CLIENT_SECRET:config.DISCORD_CLIENT_SECRET;
  return id&&secret?{id,secret}:null;
}
function endpoints(provider:Provider){return provider==='google'?{
  authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',profile:'https://openidconnect.googleapis.com/v1/userinfo',scope:'openid email profile'
}:{authorize:'https://discord.com/oauth2/authorize',token:'https://discord.com/api/oauth2/token',profile:'https://discord.com/api/v10/users/@me',scope:'identify email'};}
function redirectUri(config:Config,provider:Provider){return `${config.WEB_ORIGIN}/api/v1/auth/oauth/${provider}/callback`;}
function cookie(req:{headers:{cookie?:string}},name:string){return req.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith(`${name}=`))?.slice(name.length+1)??'';}
function clearBrowserCookie(res:Response,config:Config){res.cookie(cookieName,'',{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'lax',path:'/api/v1/auth/oauth',maxAge:0});}
function destination(target:Destination,status:string){return `/${target}?oauth=${encodeURIComponent(status)}`;}
function failure(res:Response,status:number,code:string,message:string){return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId}});}
async function profileFor(config:Config,provider:Provider,code:string,verifier:string):Promise<Profile>{
  const credentials=client(config,provider)!;
  const urls=endpoints(provider);
  const params=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri(config,provider),client_id:credentials.id,client_secret:credentials.secret,code_verifier:verifier});
  const exchanged=await fetch(urls.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params,redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!exchanged.ok)throw new Error('OAuth code exchange failed');
  const token=z.object({access_token:z.string().min(1),token_type:z.literal('Bearer')}).safeParse(await exchanged.json());
  if(!token.success)throw new Error('OAuth token response was invalid');
  const response=await fetch(urls.profile,{headers:{Authorization:`Bearer ${token.data.access_token}`},redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('OAuth profile request failed');
  const raw:unknown=await response.json();
  if(provider==='google'){
    const parsed=profileSchema.safeParse(raw);if(!parsed.success)throw new Error('Verified provider email required');
    return {subject:parsed.data.sub,email:parsed.data.email.toLowerCase(),name:parsed.data.name?.trim()||parsed.data.email};
  }
  const parsed=discordProfileSchema.safeParse(raw);if(!parsed.success)throw new Error('Verified provider email required');
  return {subject:parsed.data.id,email:parsed.data.email.toLowerCase(),name:parsed.data.global_name?.trim()||parsed.data.username?.trim()||parsed.data.email};
}

export function oauthRouter(config:Config,pool:Pool){
  const router=Router();
  router.get('/providers',(_req,res)=>res.json({data:{providers:(['google','discord'] as const).filter(provider=>Boolean(client(config,provider)))}}));

  async function start(provider:Provider,purpose:'login'|'link',req:Request,res:Response){
    const credentials=client(config,provider);if(!credentials)return failure(res,404,'PROVIDER_UNAVAILABLE','This sign-in provider is not configured.');
    const parsed=requestSchema.safeParse(req.query);if(!parsed.success)return failure(res,400,'VALIDATION_FAILED','Choose a valid sign-in destination.');
    const key=digest(`oauth-start|${req.ip}`);
    const limit=await pool.query<{attempts:number}>("INSERT INTO login_attempts(key,attempts,window_started_at) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_started_at=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END RETURNING attempts",[key]);
    if(limit.rows[0]!.attempts>30)return failure(res,429,'RATE_LIMITED','Too many sign-in attempts. Try again later.');
    const state=nonce(),browser=nonce(),verifier=nonce();
    const challenge=createHash('sha256').update(verifier).digest('base64url');
    await pool.query("DELETE FROM oauth_flows WHERE expires_at<now()-interval '1 hour'");
    await pool.query("INSERT INTO oauth_flows(state_hash,browser_nonce_hash,provider,code_verifier,purpose,requested_role,return_to,account_id,session_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '10 minutes')",[digest(state),digest(browser),provider,verifier,purpose,parsed.data.role,parsed.data.return_to,purpose==='link'?res.locals.admin.id:null,purpose==='link'?res.locals.sessionId:null]);
    res.cookie(cookieName,browser,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'lax',path:'/api/v1/auth/oauth',maxAge:10*60*1000});
    const url=new URL(endpoints(provider).authorize);
    for(const [key,value] of Object.entries({client_id:credentials.id,redirect_uri:redirectUri(config,provider),response_type:'code',scope:endpoints(provider).scope,state,code_challenge:challenge,code_challenge_method:'S256'}))url.searchParams.set(key,value);
    if(purpose==='link')return res.json({data:{authorization_url:url.toString()}});
    return res.redirect(302,url.toString());
  }

  router.get('/:provider/start',async(req,res)=>{
    const provider=providerSchema.safeParse(req.params.provider);if(!provider.success)return res.sendStatus(404);
    return start(provider.data,'login',req,res);
  });
  router.post('/:provider/link',requireAccount(pool),requireCsrf(pool),async(req,res)=>{
    const provider=providerSchema.safeParse(req.params.provider);if(!provider.success)return res.sendStatus(404);
    return start(provider.data,'link',req,res);
  });
  router.get('/:provider/callback',async(req,res)=>{
    const provider=providerSchema.safeParse(req.params.provider);if(!provider.success)return res.sendStatus(404);
    const parsed=callbackSchema.safeParse(req.query),browser=cookie(req,cookieName);
    if(!parsed.success||!browser){clearBrowserCookie(res,config);return res.redirect(302,destination('participate','failed'));}
    const consumed=await pool.query<Flow>("UPDATE oauth_flows SET consumed_at=now() WHERE state_hash=$1 AND provider=$2 AND browser_nonce_hash=$3 AND consumed_at IS NULL AND expires_at>now() RETURNING provider,purpose,requested_role,return_to,code_verifier,account_id,session_id",[digest(parsed.data.state),provider.data,digest(browser)]);
    clearBrowserCookie(res,config);
    const flow=consumed.rows[0];if(!flow)return res.redirect(302,destination('participate','failed'));
    try{
      const profile=await profileFor(config,provider.data,parsed.data.code,flow.code_verifier);
      const clientDb=await pool.connect();
      try{await clientDb.query('BEGIN');
        if(flow.purpose==='link'){
          const session=await clientDb.query<{id:string;email:string}>("SELECT a.id,a.email FROM sessions s JOIN accounts a ON a.id=s.user_id WHERE s.id=$1 AND a.id=$2 AND s.revoked_at IS NULL AND s.expires_at>now() AND a.disabled_at IS NULL FOR SHARE OF s,a",[flow.session_id,flow.account_id]);
          if(!session.rows[0]||session.rows[0].email.toLowerCase()!==profile.email)throw new Error('Provider email must match the signed-in account');
          await clientDb.query('INSERT INTO oauth_identities(provider,subject,account_id) VALUES($1,$2,$3)',[provider.data,profile.subject,flow.account_id]);
          await clientDb.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'account.oauth_linked','account',$2,$3)",[randomUUID(),flow.account_id,JSON.stringify({provider:provider.data})]);
          await clientDb.query('COMMIT');return res.redirect(302,destination(flow.return_to,'linked'));
        }
        const linked=await clientDb.query<{id:string;email:string;role:string}>("SELECT a.id,a.email,a.role FROM oauth_identities i JOIN accounts a ON a.id=i.account_id WHERE i.provider=$1 AND i.subject=$2 AND a.disabled_at IS NULL AND (a.role<>'organizer' OR a.organizer_activated_at IS NOT NULL) FOR SHARE OF a",[provider.data,profile.subject]);
        let account=linked.rows[0];
        if(account){if(account.email.toLowerCase()!==profile.email)throw new Error('Provider email changed');}
        else{
          if(flow.return_to==='admin')throw new Error('Administrators must connect a provider from their signed-in account first');
          const existing=await clientDb.query('SELECT id FROM accounts WHERE email=$1',[profile.email]);
          if(existing.rowCount)throw new Error('Existing account must connect provider first');
          const id=randomUUID();
          const unknownPassword=await hashPassword(randomBytes(32).toString('hex'));
          await clientDb.query('INSERT INTO accounts(id,email,password_hash,role,display_name,email_verified_at) VALUES($1,$2,$3,$4,$5,now())',[id,profile.email,unknownPassword,flow.requested_role,profile.name.slice(0,80)]);
          await clientDb.query('INSERT INTO oauth_identities(provider,subject,account_id) VALUES($1,$2,$3)',[provider.data,profile.subject,id]);
          await clientDb.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'account.oauth_created','account',$2,$3)",[randomUUID(),id,JSON.stringify({provider:provider.data})]);
          account={id,email:profile.email,role:flow.requested_role};
        }
        const sessionToken=randomBytes(32).toString('hex'),csrf=digest(`csrf|${sessionToken}`);
        await clientDb.query("INSERT INTO sessions(id,user_id,token_hash,csrf_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '8 hours')",[randomUUID(),account.id,digest(sessionToken),digest(csrf)]);
        await clientDb.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'account.oauth_login','account',$2,$3)",[randomUUID(),account.id,JSON.stringify({provider:provider.data})]);
        await clientDb.query('COMMIT');
        res.cookie(accountCookie,sessionToken,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:8*60*60*1000});
        return res.redirect(302,destination(account.role==='organizer'||account.role==='super_admin'?'admin':account.role==='member'?'join':'participate','signed-in'));
      }catch(error){await clientDb.query('ROLLBACK');throw error;}finally{clientDb.release();}
    }catch{
      return res.redirect(302,destination(flow.return_to,'failed'));
    }
  });
  return router;
}

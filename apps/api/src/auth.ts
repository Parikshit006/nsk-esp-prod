import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { Config } from './config.js';
import { recoverySender, type RecoverySender } from './mail.js';

const loginSchema=z.object({email:z.email().max(254),password:z.string().min(1).max(1024)}).strict();
const signupSchema=loginSchema.extend({display_name:z.string().trim().min(2).max(80),account_type:z.enum(['captain','member']).default('captain')});
const changePasswordSchema=z.object({current_password:z.string().min(1).max(1024),new_password:z.string().min(12).max(1024)}).strict();
const recoveryRequestSchema=z.object({email:z.email().max(254)}).strict();
const recoveryCompleteSchema=z.object({token:z.string().regex(/^[0-9a-f]{64}$/),new_password:z.string().min(12).max(1024)}).strict();
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const passwordOptions={N:32768,r:8,p:1,maxmem:64*1024*1024};
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,passwordOptions,(error,key)=>error?reject(error):resolve(key)));
const cookieName='esp_admin_session';
function error(res:Parameters<RequestHandler>[1],status:number,code:string,message:string) { return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId}}); }

export async function hashPassword(password:string) {
  if(password.length<12 || password.length>1024) throw new Error('Password must contain 12–1024 characters.');
  const salt=randomBytes(32).toString('hex');
  const hash=await derive(password,salt);
  return `scrypt$32768$${salt}$${hash.toString('hex')}`;
}
async function verifyPassword(password:string,stored:string) {
  const [,n,salt,expected]=stored.split('$');
  if(n!=='32768'||!salt||!expected||expected.length!==128) return false;
  const actual=await derive(password,salt);
  return timingSafeEqual(actual,Buffer.from(expected,'hex'));
}
export async function createAdmin(pool:Pool,email:string,password:string) {
  const normalized=z.email().max(254).parse(email.trim().toLowerCase());
  const hashed=await hashPassword(password);
  const id=randomUUID();
  await pool.query('INSERT INTO accounts(id,email,password_hash,role,display_name) VALUES($1,$2,$3,$4,$5)',[id,normalized,hashed,'super_admin',normalized]);
  return id;
}
function cookie(req:Parameters<RequestHandler>[0]) {
  const match=req.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${cookieName}=`));
  return match?.slice(cookieName.length+1)??'';
}
function setCookie(res:Parameters<RequestHandler>[1],token:string,config:Config,maxAge=8*60*60*1000) {
  res.cookie(cookieName,token,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge});
}
export function authRouter(config:Config,pool:Pool,sendRecovery?:RecoverySender) {
  const router=Router();
  const deliver=sendRecovery??recoverySender(config);
  router.post('/register',async(req,res)=>{
    const parsed=signupSchema.safeParse(req.body);
    if(!parsed.success)return error(res,400,'VALIDATION_FAILED','Enter a display name, valid email and password.');
    const email=parsed.data.email.trim().toLowerCase();
    let hash:string;try{hash=await hashPassword(parsed.data.password);}catch{return error(res,400,'VALIDATION_FAILED','Password must contain at least 12 characters.');}
    const id=randomUUID();
    try {await pool.query('INSERT INTO accounts(id,email,password_hash,role,display_name) VALUES($1,$2,$3,$4,$5)',[id,email,hash,parsed.data.account_type,parsed.data.display_name]);}
    catch(caught){if((caught as {code?:string}).code==='23505')return error(res,409,'DUPLICATE','An account with this email already exists.');throw caught;}
    return res.status(201).json({data:{id,email,display_name:parsed.data.display_name}});
  });
  router.post('/login',async(req,res)=>{
    const parsed=loginSchema.safeParse(req.body);
    if(!parsed.success) return error(res,400,'VALIDATION_FAILED','Enter a valid email and password.');
    const email=parsed.data.email.trim().toLowerCase();
    const key=digest(`${email}|${req.ip}`);
    const limits=await pool.query<{attempts:number}>("SELECT attempts FROM login_attempts WHERE key=$1 AND window_started_at>now()-interval '15 minutes'",[key]);
    if((limits.rows[0]?.attempts??0)>=5) return error(res,429,'RATE_LIMITED','Too many attempts. Try again later.');
    const found=await pool.query<{id:string;email:string;role:string;password_hash:string}>("SELECT id,email,role,password_hash FROM accounts WHERE email=$1 AND disabled_at IS NULL AND (role<>'organizer' OR organizer_activated_at IS NOT NULL)",[email]);
    const user=found.rows[0];
    const valid=await verifyPassword(parsed.data.password,user?.password_hash??`scrypt$32768$${'0'.repeat(64)}$${'0'.repeat(128)}`);
    if(!user||!valid) {
      await pool.query("INSERT INTO login_attempts(key,attempts,window_started_at) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_started_at=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END",[key]);
      return error(res,401,'UNAUTHENTICATED','Email or password is incorrect.');
    }
    await pool.query('DELETE FROM login_attempts WHERE key=$1',[key]);
    const token=randomBytes(32).toString('hex');const csrf=digest(`csrf|${token}`);
    const client=await pool.connect();try{
      await client.query('BEGIN');
      // Serialize session creation with password changes so an old-password login cannot escape revocation.
      const current=await client.query<{password_hash:string}>("SELECT password_hash FROM accounts WHERE id=$1 AND disabled_at IS NULL AND (role<>'organizer' OR organizer_activated_at IS NOT NULL) FOR SHARE",[user.id]);
      if(current.rows[0]?.password_hash!==user.password_hash){await client.query('ROLLBACK');return error(res,401,'UNAUTHENTICATED','Email or password is incorrect.');}
      await client.query("INSERT INTO sessions(id,user_id,token_hash,csrf_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '8 hours')",[randomUUID(),user.id,digest(token),digest(csrf)]);
      await client.query('COMMIT');
    }catch(caught){await client.query('ROLLBACK');throw caught;}finally{client.release();}
    setCookie(res,token,config);
    return res.json({data:{user:{id:user.id,email:user.email,role:user.role},csrf_token:csrf}});
  });
  router.get('/me',requireAccount(pool),async(req,res)=>{
    const csrf=digest(`csrf|${cookie(req)}`);
    await pool.query('UPDATE sessions SET csrf_hash=$1 WHERE id=$2',[digest(csrf),res.locals.sessionId]);
    return res.json({data:{user:res.locals.admin,csrf_token:csrf}});
  });
  router.post('/logout',requireAccount(pool),requireCsrf(pool),async(_req,res)=>{
    await pool.query('UPDATE sessions SET revoked_at=now() WHERE id=$1',[res.locals.sessionId]);
    setCookie(res,'',config,0);
    return res.status(204).end();
  });
  router.post('/change-password',requireAccount(pool),requireCsrf(pool),async(req,res)=>{
    const body=changePasswordSchema.safeParse(req.body);if(!body.success)return error(res,400,'VALIDATION_FAILED','Provide your current password and a new password of at least 12 characters.');
    const key=digest(`password-change|${res.locals.admin.id}`);
    const limit=await pool.query<{attempts:number}>("INSERT INTO login_attempts(key,attempts,window_started_at) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_started_at=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END RETURNING attempts",[key]);
    if(limit.rows[0]!.attempts>5)return error(res,429,'RATE_LIMITED','Too many attempts. Try again later.');
    const client=await pool.connect();try{await client.query('BEGIN');
      const found=await client.query<{password_hash:string}>('SELECT password_hash FROM accounts WHERE id=$1 FOR UPDATE',[res.locals.admin.id]);
      if(!found.rows[0]||!await verifyPassword(body.data.current_password,found.rows[0].password_hash)){await client.query('ROLLBACK');return error(res,401,'UNAUTHENTICATED','Current password is incorrect.');}
      const hash=await hashPassword(body.data.new_password);
      await client.query('UPDATE accounts SET password_hash=$1 WHERE id=$2',[hash,res.locals.admin.id]);
      await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[res.locals.admin.id]);
      await client.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'account.password_changed','account',$2,$3)",[randomUUID(),res.locals.admin.id,JSON.stringify({sessions_revoked:true})]);
      await client.query('DELETE FROM login_attempts WHERE key=$1',[key]);await client.query('COMMIT');setCookie(res,'',config,0);return res.json({data:{changed:true,sign_in_required:true}});
    }catch(caught){await client.query('ROLLBACK');throw caught;}finally{client.release();}
  });
  router.post('/request-password-reset',async(req,res)=>{
    const body=recoveryRequestSchema.safeParse(req.body);if(!body.success)return error(res,400,'VALIDATION_FAILED','Enter a valid email address.');
    if(!config.SMTP_HOST&&!sendRecovery)return error(res,503,'PROVIDER_UNAVAILABLE','Password recovery is not configured.');
    const email=body.data.email.trim().toLowerCase(),key=digest(`password-reset|${email}|${req.ip}`);
    const ipKey=digest(`password-reset-request-ip|${req.ip}`);
    const ipCount=await pool.query<{attempts:number}>("INSERT INTO login_attempts(key,attempts,window_started_at) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_started_at=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END RETURNING attempts",[ipKey]);
    if(ipCount.rows[0]!.attempts>30)return res.status(202).json({data:{message:'If an account exists, a reset link will be sent.'}});
    const count=await pool.query<{attempts:number}>("INSERT INTO login_attempts(key,attempts,window_started_at) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_started_at=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END RETURNING attempts",[key]);
    if(count.rows[0]!.attempts<=5){
      const found=await pool.query<{id:string}>('SELECT id FROM accounts WHERE email=$1 AND disabled_at IS NULL',[email]);
      if(found.rows[0]){
        const token=randomBytes(32).toString('hex'),id=randomUUID();
        const client=await pool.connect();try{await client.query('BEGIN');
          await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[found.rows[0].id]);
          await client.query('UPDATE password_reset_tokens SET consumed_at=now() WHERE account_id=$1 AND consumed_at IS NULL',[found.rows[0].id]);
          await client.query("INSERT INTO password_reset_tokens(id,account_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",[id,found.rows[0].id,digest(token)]);
          await client.query('COMMIT');
        }catch(caught){await client.query('ROLLBACK');throw caught;}finally{client.release();}
        try{await deliver(email,`${config.WEB_ORIGIN}/reset-password#${token}`);}catch{
          await pool.query('UPDATE password_reset_tokens SET consumed_at=now() WHERE id=$1',[id]);
          process.stderr.write('Password recovery delivery failed.\n');
        }
      }
    }
    return res.status(202).json({data:{message:'If an account exists, a reset link will be sent.'}});
  });
  router.post('/reset-password',async(req,res)=>{
    const body=recoveryCompleteSchema.safeParse(req.body);if(!body.success)return error(res,400,'VALIDATION_FAILED','Enter a valid reset link and a new password of at least 12 characters.');
    const key=digest(`password-reset-consume-ip|${req.ip}`);
    const limit=await pool.query<{attempts:number}>("INSERT INTO login_attempts(key,attempts,window_started_at) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_started_at=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END RETURNING attempts",[key]);
    if(limit.rows[0]!.attempts>20)return error(res,429,'RATE_LIMITED','Too many attempts. Try again later.');
    const client=await pool.connect();
    try{await client.query('BEGIN');
      const candidate=await client.query<{account_id:string}>("SELECT account_id FROM password_reset_tokens WHERE token_hash=$1",[digest(body.data.token)]);
      if(!candidate.rows[0]){await client.query('ROLLBACK');return error(res,400,'INVALID_RESET','This reset link is invalid or expired.');}
      const account=await client.query<{id:string}>('SELECT id FROM accounts WHERE id=$1 AND disabled_at IS NULL FOR UPDATE',[candidate.rows[0].account_id]);
      if(!account.rows[0]){await client.query('ROLLBACK');return error(res,400,'INVALID_RESET','This reset link is invalid or expired.');}
      const found=await client.query<{id:string;account_id:string}>("SELECT id,account_id FROM password_reset_tokens WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE",[digest(body.data.token)]);
      if(!found.rows[0]){await client.query('ROLLBACK');return error(res,400,'INVALID_RESET','This reset link is invalid or expired.');}
      const hash=await hashPassword(body.data.new_password);
      await client.query("UPDATE accounts SET password_hash=$1,organizer_activated_at=CASE WHEN role='organizer' AND organizer_activated_at IS NULL THEN now() ELSE organizer_activated_at END WHERE id=$2",[hash,found.rows[0].account_id]);
      await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[found.rows[0].account_id]);
      await client.query('UPDATE password_reset_tokens SET consumed_at=now() WHERE account_id=$1 AND consumed_at IS NULL',[found.rows[0].account_id]);
      await client.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'account.password_reset','account',$2,$3)",[randomUUID(),found.rows[0].account_id,JSON.stringify({sessions_revoked:true})]);
      await client.query('COMMIT');return res.json({data:{changed:true,sign_in_required:true}});
    }catch(caught){await client.query('ROLLBACK');throw caught;}finally{client.release();}
  });
  return router;
}
function requireSession(pool:Pool,adminOnly:boolean):RequestHandler {
  return async(req,res,next)=>{
    const token=cookie(req);
    if(!/^[0-9a-f]{64}$/.test(token)) return error(res,401,'UNAUTHENTICATED','Sign in to continue.');
    const found=await pool.query<{session_id:string;csrf_hash:string;id:string;email:string;role:string}>("SELECT s.id session_id,s.csrf_hash,u.id,u.email,u.role FROM sessions s JOIN accounts u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.disabled_at IS NULL AND (u.role<>'organizer' OR u.organizer_activated_at IS NOT NULL)",[digest(token)]);
    const row=found.rows[0];
    if(!row) return error(res,401,'UNAUTHENTICATED','Sign in to continue.');
    if(adminOnly&&!['super_admin','organizer'].includes(row.role))return error(res,403,'FORBIDDEN','An administrator account is required.');
    res.locals.admin={id:row.id,email:row.email,role:row.role};res.locals.sessionId=row.session_id;res.locals.csrfHash=row.csrf_hash;
    next();
  };
}
export const requireAccount=(pool:Pool)=>requireSession(pool,false);
export const requireAdmin=(pool:Pool)=>requireSession(pool,true);
export function requireCsrf(_pool:Pool):RequestHandler {
  return (req,res,next)=>{
    const token=req.headers['x-csrf-token'];
    if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token)||!timingSafeEqual(Buffer.from(digest(token)),Buffer.from(res.locals.csrfHash))) return error(res,403,'FORBIDDEN','Refresh this page and try again.');
    next();
  };
}

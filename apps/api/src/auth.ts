import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { Config } from './config.js';

const loginSchema=z.object({email:z.email().max(254),password:z.string().min(1).max(1024)}).strict();
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
  await pool.query('INSERT INTO admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[id,normalized,hashed,'super_admin']);
  return id;
}
function cookie(req:Parameters<RequestHandler>[0]) {
  const match=req.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${cookieName}=`));
  return match?.slice(cookieName.length+1)??'';
}
function setCookie(res:Parameters<RequestHandler>[1],token:string,config:Config,maxAge=8*60*60*1000) {
  res.cookie(cookieName,token,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge});
}
export function authRouter(config:Config,pool:Pool) {
  const router=Router();
  router.post('/login',async(req,res)=>{
    const parsed=loginSchema.safeParse(req.body);
    if(!parsed.success) return error(res,400,'VALIDATION_FAILED','Enter a valid email and password.');
    const email=parsed.data.email.trim().toLowerCase();
    const key=digest(`${email}|${req.ip}`);
    const limits=await pool.query<{attempts:number}>("SELECT attempts FROM login_attempts WHERE key=$1 AND window_started_at>now()-interval '15 minutes'",[key]);
    if((limits.rows[0]?.attempts??0)>=5) return error(res,429,'RATE_LIMITED','Too many attempts. Try again later.');
    const found=await pool.query<{id:string;email:string;role:string;password_hash:string}>('SELECT id,email,role,password_hash FROM admin_users WHERE email=$1',[email]);
    const user=found.rows[0];
    const valid=await verifyPassword(parsed.data.password,user?.password_hash??`scrypt$32768$${'0'.repeat(64)}$${'0'.repeat(128)}`);
    if(!user||!valid) {
      await pool.query("INSERT INTO login_attempts(key,attempts,window_started_at) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_started_at=CASE WHEN login_attempts.window_started_at<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_started_at END",[key]);
      return error(res,401,'UNAUTHENTICATED','Email or password is incorrect.');
    }
    await pool.query('DELETE FROM login_attempts WHERE key=$1',[key]);
    const token=randomBytes(32).toString('hex');const csrf=randomBytes(32).toString('hex');
    await pool.query("INSERT INTO admin_sessions(id,user_id,token_hash,csrf_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '8 hours')",[randomUUID(),user.id,digest(token),digest(csrf)]);
    setCookie(res,token,config);
    return res.json({data:{user:{id:user.id,email:user.email,role:user.role},csrf_token:csrf}});
  });
  router.get('/me',requireAdmin(pool),async(_req,res)=>{
    const csrf=randomBytes(32).toString('hex');
    await pool.query('UPDATE admin_sessions SET csrf_hash=$1 WHERE id=$2',[digest(csrf),res.locals.sessionId]);
    return res.json({data:{user:res.locals.admin,csrf_token:csrf}});
  });
  router.post('/logout',requireAdmin(pool),requireCsrf(pool),async(_req,res)=>{
    await pool.query('UPDATE admin_sessions SET revoked_at=now() WHERE id=$1',[res.locals.sessionId]);
    setCookie(res,'',config,0);
    return res.status(204).end();
  });
  return router;
}
export function requireAdmin(pool:Pool):RequestHandler {
  return async(req,res,next)=>{
    const token=cookie(req);
    if(!/^[0-9a-f]{64}$/.test(token)) return error(res,401,'UNAUTHENTICATED','Sign in to continue.');
    const found=await pool.query<{session_id:string;csrf_hash:string;id:string;email:string;role:string}>("SELECT s.id session_id,s.csrf_hash,u.id,u.email,u.role FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()",[digest(token)]);
    const row=found.rows[0];
    if(!row) return error(res,401,'UNAUTHENTICATED','Sign in to continue.');
    res.locals.admin={id:row.id,email:row.email,role:row.role};res.locals.sessionId=row.session_id;res.locals.csrfHash=row.csrf_hash;
    next();
  };
}
export function requireCsrf(_pool:Pool):RequestHandler {
  return (req,res,next)=>{
    const token=req.headers['x-csrf-token'];
    if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token)||!timingSafeEqual(Buffer.from(digest(token)),Buffer.from(res.locals.csrfHash))) return error(res,403,'FORBIDDEN','Refresh this page and try again.');
    next();
  };
}

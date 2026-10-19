import {createHash} from 'node:crypto';
import type {RequestHandler,Response} from 'express';
import type {Pool} from 'pg';
import {requireAccount,requireCsrf} from './auth.js';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item as Record<string,unknown>).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
function failure(res:Response,status:number,code:string,message:string){return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId}});}
export function idempotencyMiddleware(pool:Pool):RequestHandler {
  return (req,res,next)=>{
    const key=req.headers['idempotency-key'];
    if(!key||!['POST','PUT','PATCH','DELETE'].includes(req.method)||!req.is('application/json')||req.path.startsWith('/auth/')||/^\/registrations\/[^/]+\/roster\/[^/]+\/invitations$/.test(req.path))return next();
    if(typeof key!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(key))return failure(res,400,'VALIDATION_FAILED','Use a 16–128 character Idempotency-Key.');
    return requireAccount(pool)(req,res,()=>requireCsrf(pool)(req,res,()=>{void handle(pool,req,res,key,next).catch(next);}));
  };
}
async function handle(pool:Pool,req:Parameters<RequestHandler>[0],res:Response,key:string,next:Parameters<RequestHandler>[2]){
  const accountId=res.locals.admin.id as string;
  const role=res.locals.admin.role as string;
  const path=req.originalUrl,requestHash=hash(`${req.method}\n${path}\n${canonical(req.body)}`);
  await pool.query("DELETE FROM idempotency_requests WHERE account_id=$1 AND completed_at<now()-interval '24 hours'",[accountId]);
  const inserted=await pool.query('INSERT INTO idempotency_requests(account_id,actor_role,request_key,method,path,request_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING request_key',[accountId,role,key,req.method,path,requestHash]);
  if(!inserted.rowCount){
    const found=await pool.query<{actor_role:string;method:string;path:string;request_hash:string;response_status:number|null;response_body:unknown}>('SELECT actor_role,method,path,request_hash,response_status,response_body FROM idempotency_requests WHERE account_id=$1 AND request_key=$2',[accountId,key]);const prior=found.rows[0];
    if(!prior)return failure(res,409,'CONFLICT','Retry this request shortly.');
    if(prior.actor_role!==role)return failure(res,403,'FORBIDDEN','This request was created under a different account role.');
    if(prior.method!==req.method||prior.path!==path||prior.request_hash!==requestHash)return failure(res,409,'IDEMPOTENCY_CONFLICT','This key was used for a different request.');
    if(prior.response_status===null){res.setHeader('Retry-After','2');return failure(res,409,'REQUEST_IN_PROGRESS','The first request is still being processed.');}
    res.setHeader('Idempotency-Replayed','true');return res.status(prior.response_status).json(prior.response_body);
  }
  let finished=false;
  const originalJson=res.json.bind(res);
  res.json=((body:unknown)=>{
    if(finished)return res;
    finished=true;
    void (async()=>{
      if(res.statusCode>=200&&res.statusCode<300){
        await pool.query('UPDATE idempotency_requests SET response_status=$1,response_body=$2,completed_at=now() WHERE account_id=$3 AND request_key=$4',[res.statusCode,JSON.stringify(body),accountId,key]);
      }else await pool.query('DELETE FROM idempotency_requests WHERE account_id=$1 AND request_key=$2',[accountId,key]);
      originalJson(body);
    })().catch(()=>{res.status(503);originalJson({error:{code:'PROVIDER_UNAVAILABLE',message:'The action was processed but its retry record could not be saved. Contact the organizer before retrying.',correlation_id:res.locals.correlationId}});});
    return res;
  }) as typeof res.json;
  res.on('finish',()=>{if(!finished)void pool.query('DELETE FROM idempotency_requests WHERE account_id=$1 AND request_key=$2',[accountId,key]).catch(()=>{});});
  next();
}

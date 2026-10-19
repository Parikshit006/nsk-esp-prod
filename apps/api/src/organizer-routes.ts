import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {Router} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
import {hashPassword,requireAdmin,requireCsrf} from './auth.js';
import {recoverySender,type RecoverySender} from './mail.js';
import type {Config} from './config.js';
const createSchema=z.object({email:z.email().max(254),display_name:z.string().trim().min(2).max(80)}).strict();
const statusSchema=z.object({enabled:z.boolean(),reason:z.string().trim().min(10).max(1000)}).strict();
const uuid=z.uuid();
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function organizerRouter(config:Config,pool:Pool,sendRecovery?:RecoverySender){
 const router=Router(),deliver=sendRecovery??recoverySender(config);
 router.use(requireAdmin(pool));
 router.get('/organizers',async(_req,res)=>{
  if(res.locals.admin.role!=='super_admin')return res.status(403).json({error:{code:'FORBIDDEN',message:'Platform administrator access is required.',correlation_id:res.locals.correlationId}});
  const rows=await pool.query('SELECT id,email,display_name,disabled_at,organizer_invited_at,organizer_activated_at,created_at FROM accounts WHERE role=$1 ORDER BY created_at DESC',['organizer']);
  return res.json({data:rows.rows});
 });
 router.post('/organizers',requireCsrf(pool),async(req,res)=>{
  if(res.locals.admin.role!=='super_admin')return res.status(403).json({error:{code:'FORBIDDEN',message:'Platform administrator access is required.',correlation_id:res.locals.correlationId}});
  if(!config.SMTP_HOST&&!sendRecovery)return res.status(503).json({error:{code:'PROVIDER_UNAVAILABLE',message:'Email invitations are not configured.',correlation_id:res.locals.correlationId}});
  const body=createSchema.safeParse(req.body);if(!body.success)return res.status(400).json({error:{code:'VALIDATION_FAILED',message:'Enter an organizer name and email.',correlation_id:res.locals.correlationId}});
  const email=body.data.email.trim().toLowerCase(),id=randomUUID(),token=randomBytes(32).toString('hex'),tokenId=randomUUID();
  const password=await hashPassword(randomBytes(48).toString('base64url'));
  const client=await pool.connect();try{await client.query('BEGIN');
    await client.query('INSERT INTO accounts(id,email,password_hash,role,display_name,organizer_invited_at) VALUES($1,$2,$3,$4,$5,now())',[id,email,password,'organizer',body.data.display_name]);
    await client.query("INSERT INTO password_reset_tokens(id,account_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",[tokenId,id,digest(token)]);
    await client.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'organizer.invited','account',$3,$4)",[randomUUID(),res.locals.admin.id,id,JSON.stringify({email})]);
    await client.query('COMMIT');
  }catch(caught){await client.query('ROLLBACK');if((caught as {code?:string}).code==='23505')return res.status(409).json({error:{code:'DUPLICATE',message:'This email already has an account.',correlation_id:res.locals.correlationId}});throw caught;}finally{client.release();}
  try{await deliver(email,`${config.WEB_ORIGIN}/reset-password#${token}`);}catch{
    await pool.query('UPDATE password_reset_tokens SET consumed_at=now() WHERE id=$1',[tokenId]);
    return res.status(502).json({error:{code:'DELIVERY_FAILED',message:'Organizer created, but the invitation email failed. Retry the invitation.',correlation_id:res.locals.correlationId}});
  }
  return res.status(201).json({data:{id,email,display_name:body.data.display_name,invited:true}});
 });
 router.post('/organizers/:id/invite',requireCsrf(pool),async(req,res)=>{
  if(res.locals.admin.role!=='super_admin')return res.status(403).json({error:{code:'FORBIDDEN',message:'Platform administrator access is required.',correlation_id:res.locals.correlationId}});
  if(!uuid.safeParse(req.params.id).success)return res.sendStatus(404);
  if(!config.SMTP_HOST&&!sendRecovery)return res.status(503).json({error:{code:'PROVIDER_UNAVAILABLE',message:'Email invitations are not configured.',correlation_id:res.locals.correlationId}});
  const token=randomBytes(32).toString('hex'),tokenId=randomUUID(),client=await pool.connect();let email:string;
  try{await client.query('BEGIN');
    const found=await client.query<{email:string}>("SELECT email FROM accounts WHERE id=$1 AND role='organizer' AND disabled_at IS NULL FOR UPDATE",[req.params.id]);
    if(!found.rows[0]){await client.query('ROLLBACK');return res.sendStatus(404);}email=found.rows[0].email;
    await client.query('UPDATE password_reset_tokens SET consumed_at=now() WHERE account_id=$1 AND consumed_at IS NULL',[req.params.id]);
    await client.query("INSERT INTO password_reset_tokens(id,account_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",[tokenId,req.params.id,digest(token)]);
    await client.query('UPDATE accounts SET organizer_invited_at=now() WHERE id=$1',[req.params.id]);
    await client.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'organizer.invitation_resent','account',$3)",[randomUUID(),res.locals.admin.id,req.params.id]);
    await client.query('COMMIT');
  }catch(caught){await client.query('ROLLBACK');throw caught;}finally{client.release();}
  try{await deliver(email!,`${config.WEB_ORIGIN}/reset-password#${token}`);}catch{await pool.query('UPDATE password_reset_tokens SET consumed_at=now() WHERE id=$1',[tokenId]);return res.status(502).json({error:{code:'DELIVERY_FAILED',message:'Invitation email failed. Try again.',correlation_id:res.locals.correlationId}});}
  return res.json({data:{invited:true}});
 });
 router.post('/organizers/:id/status',requireCsrf(pool),async(req,res)=>{
  if(res.locals.admin.role!=='super_admin')return res.status(403).json({error:{code:'FORBIDDEN',message:'Platform administrator access is required.',correlation_id:res.locals.correlationId}});
  if(!uuid.safeParse(req.params.id).success)return res.sendStatus(404);
  const body=statusSchema.safeParse(req.body);if(!body.success)return res.status(400).json({error:{code:'VALIDATION_FAILED',message:'Provide a status and reason of at least 10 characters.',correlation_id:res.locals.correlationId}});
  const client=await pool.connect();try{await client.query('BEGIN');
    const found=await client.query<{disabled_at:string|null}>("SELECT disabled_at FROM accounts WHERE id=$1 AND role='organizer' FOR UPDATE",[req.params.id]);
    if(!found.rows[0]){await client.query('ROLLBACK');return res.sendStatus(404);}
    if(Boolean(found.rows[0].disabled_at)===!body.data.enabled){await client.query('ROLLBACK');return res.status(409).json({error:{code:'CONFLICT',message:'Organizer already has this status.',correlation_id:res.locals.correlationId}});}
    await client.query('UPDATE accounts SET disabled_at=CASE WHEN $2 THEN NULL ELSE now() END WHERE id=$1',[req.params.id,body.data.enabled]);
    if(!body.data.enabled){await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[req.params.id]);await client.query('UPDATE password_reset_tokens SET consumed_at=now() WHERE account_id=$1 AND consumed_at IS NULL',[req.params.id]);}
    await client.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'organizer.status_changed','account',$3,$4)",[randomUUID(),res.locals.admin.id,req.params.id,JSON.stringify(body.data)]);
    await client.query('COMMIT');return res.json({data:{enabled:body.data.enabled}});
  }catch(caught){await client.query('ROLLBACK');throw caught;}finally{client.release();}
 });
 return router;
}

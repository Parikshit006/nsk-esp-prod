import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { Config } from './config.js';
import { requireAccount, requireAdmin, requireCsrf } from './auth.js';

const uuid=z.uuid(),version=z.number().int().positive();
const inviteSchema=z.object({email:z.email().max(254)}).strict();
const acceptSchema=z.object({token:z.string().regex(/^[0-9a-f]{64}$/)}).strict();
const credentialSchema=z.object({expected_version:version,room_id:z.string().trim().min(2).max(120),password:z.string().min(2).max(120),release_at:z.iso.datetime({offset:true})}).strict();
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function fail(res:Response,status:number,code:string,message:string,data?:unknown){return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId},...(data?{data}:{})});}
async function tx<T>(pool:Pool,run:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const value=await run(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
async function audit(client:PoolClient,actor:string,action:string,type:string,id:string,after:unknown){await client.query('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),actor,action,type,id,after===null?null:JSON.stringify(after)]);}
function secretKey(config:Config){return config.CREDENTIAL_ENCRYPTION_KEY?Buffer.from(config.CREDENTIAL_ENCRYPTION_KEY,'hex'):null;}
function encrypt(key:Buffer,value:{room_id:string;password:string}){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return {iv,ciphertext,tag:cipher.getAuthTag()};}
function decrypt(key:Buffer,value:{iv:Buffer;ciphertext:Buffer;auth_tag:Buffer}){const decipher=createDecipheriv('aes-256-gcm',key,value.iv);decipher.setAuthTag(value.auth_tag);return JSON.parse(Buffer.concat([decipher.update(value.ciphertext),decipher.final()]).toString('utf8')) as {room_id:string;password:string};}
export function accessRouter(config:Config,pool:Pool){
  const router=Router();
  router.post('/registrations/:id/roster/:entry/invitations',requireAccount(pool),requireCsrf(pool),async(req,res)=>{
    const id=z.uuid().safeParse(req.params.id),entryId=z.uuid().safeParse(req.params.entry),body=inviteSchema.safeParse(req.body);if(!id.success||!entryId.success||!body.success)return fail(res,400,'VALIDATION_FAILED','Choose a valid player and email.');
    const token=randomBytes(32).toString('hex');
    const data=await tx(pool,async client=>{
      const reg=await client.query<{status:string;approval_status:string;captain_id:string}>("SELECT r.status,r.approval_status,t.captain_id FROM registrations r JOIN teams t ON t.id=r.team_id WHERE r.id=$1 FOR UPDATE OF r",[id.data]);if(!reg.rows[0])return null;if(reg.rows[0].captain_id!==res.locals.admin.id)return 'forbidden' as const;if(!['Submitted','NeedsCorrection'].includes(reg.rows[0].status)||reg.rows[0].approval_status==='Disqualified')return 'locked' as const;
      const entry=await client.query<{account_id:string|null;role:string}>('SELECT account_id,role FROM roster_entries WHERE id=$1 AND registration_id=$2 AND status=$3',[entryId.data,id.data,'Active']);if(!entry.rows[0]||entry.rows[0].role!=='Player')return 'entry' as const;if(entry.rows[0].account_id)return 'linked' as const;
      await client.query('UPDATE roster_invitations SET revoked_at=now() WHERE roster_entry_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL',[entryId.data]);
      const invitationId=randomUUID(),email=body.data.email.trim().toLowerCase();await client.query("INSERT INTO roster_invitations(id,registration_id,roster_entry_id,token_hash,email,expires_at,created_by) VALUES($1,$2,$3,$4,$5,now()+interval '48 hours',$6)",[invitationId,id.data,entryId.data,hash(token),email,res.locals.admin.id]);
      await audit(client,res.locals.admin.id,'roster.invited','roster_invitation',invitationId,{registration_id:id.data,roster_entry_id:entryId.data,email});
      return {id:invitationId,email,invite_url:`${config.WEB_ORIGIN}/join#${token}`};
    });if(data===null)return fail(res,404,'NOT_FOUND','Registration not found.');if(data==='forbidden')return fail(res,403,'FORBIDDEN','This registration is not yours.');if(data==='locked')return fail(res,409,'NOT_ELIGIBLE','Player invitations are unavailable in this state.');if(data==='entry')return fail(res,404,'NOT_FOUND','Player entry not found.');if(data==='linked')return fail(res,409,'DUPLICATE','This player is already linked.');return res.status(201).json({data});
  });
  router.post('/invitations/accept',requireAccount(pool),requireCsrf(pool),async(req,res)=>{
    const body=acceptSchema.safeParse(req.body);if(!body.success)return fail(res,400,'VALIDATION_FAILED','The invitation token is invalid.');
    try{const data=await tx(pool,async client=>{
      const invitation=await client.query<{id:string;registration_id:string;roster_entry_id:string;email:string;expires_at:Date;accepted_at:Date|null;revoked_at:Date|null}>("SELECT * FROM roster_invitations WHERE token_hash=$1 FOR UPDATE",[hash(body.data.token)]);const invite=invitation.rows[0];if(!invite||invite.accepted_at||invite.revoked_at||invite.expires_at.getTime()<=Date.now())return null;
      const account=await client.query<{email:string}>('SELECT email FROM accounts WHERE id=$1',[res.locals.admin.id]);if(account.rows[0]?.email!==invite.email)return 'email' as const;
      const reg=await client.query<{status:string;approval_status:string}>("SELECT status,approval_status FROM registrations WHERE id=$1",[invite.registration_id]);if(!reg.rows[0]||!['Submitted','NeedsCorrection'].includes(reg.rows[0].status)||reg.rows[0].approval_status==='Disqualified')return 'locked' as const;
      const entry=await client.query<{account_id:string|null;status:string}>('SELECT account_id,status FROM roster_entries WHERE id=$1 FOR UPDATE',[invite.roster_entry_id]);if(!entry.rows[0]||entry.rows[0].account_id||entry.rows[0].status!=='Active')return 'linked' as const;
      await client.query('UPDATE roster_entries SET account_id=$1,version=version+1 WHERE id=$2',[res.locals.admin.id,invite.roster_entry_id]);await client.query('UPDATE roster_invitations SET accepted_at=now() WHERE id=$1',[invite.id]);await audit(client,res.locals.admin.id,'roster.invitation_accepted','roster_invitation',invite.id,{registration_id:invite.registration_id,roster_entry_id:invite.roster_entry_id});return {registration_id:invite.registration_id,roster_entry_id:invite.roster_entry_id};
    });if(data===null)return fail(res,404,'NOT_FOUND','Invitation expired or unavailable.');if(data==='email')return fail(res,403,'FORBIDDEN','Sign in with the invited email address.');if(data==='locked')return fail(res,409,'NOT_ELIGIBLE','This registration no longer accepts invitations.');if(data==='linked')return fail(res,409,'DUPLICATE','This player entry is already linked.');return res.json({data});}
    catch(error){if((error as {code?:string}).code==='23505')return fail(res,409,'DUPLICATE','This account is already linked to another active roster in the tournament.');throw error;}
  });
  router.get('/me/linked-matches',requireAccount(pool),async(_req,res)=>{
    const result=await pool.query("SELECT DISTINCT m.id,m.match_no,m.map,m.scheduled_at,m.status,t.name tournament_name,t.timezone,r.id registration_id FROM roster_entries e JOIN registrations r ON r.id=e.registration_id JOIN slots s ON s.registration_id=r.id AND s.status='Assigned' JOIN tournaments t ON t.id=r.tournament_id JOIN matches m ON m.tournament_id=t.id WHERE e.account_id=$1 AND e.status='Active' AND r.status='Submitted' AND r.approval_status='Approved' AND r.slot_status='Assigned' AND r.payment_status IN ('NotRequired','Verified','Waived') AND NOT r.payment_recheck_required AND t.status<>'Cancelled' AND m.status<>'Cancelled' ORDER BY m.scheduled_at,m.id",[res.locals.admin.id]);return res.json({data:result.rows});
  });
  router.get('/admin/matches/:id/credentials',requireAdmin(pool),async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid match ID.');const result=await pool.query("SELECT id,version_no,release_at,status,created_at FROM match_credentials WHERE match_id=$1 ORDER BY version_no DESC",[id.data]);return res.json({data:result.rows});
  });
  router.post('/admin/matches/:id/credentials',requireAdmin(pool),requireCsrf(pool),async(req,res)=>{
    const id=uuid.safeParse(req.params.id),body=credentialSchema.safeParse(req.body);if(!id.success||!body.success)return fail(res,400,'VALIDATION_FAILED','Check match, room details, release time and version.');const key=secretKey(config);if(!key)return fail(res,503,'PROVIDER_UNAVAILABLE','Credential encryption is not configured.');
    const data=await tx(pool,async client=>{
      const match=await client.query<{version:number;status:string}>('SELECT version,status FROM matches WHERE id=$1 FOR UPDATE',[id.data]);if(!match.rows[0])return null;if(match.rows[0].version!==body.data.expected_version)return 'stale' as const;if(match.rows[0].status==='Cancelled')return 'cancelled' as const;
      const current=await client.query<{version_no:number}>('SELECT version_no FROM match_credentials WHERE match_id=$1 ORDER BY version_no DESC LIMIT 1',[id.data]);const credentialVersion=(current.rows[0]?.version_no??0)+1;
      await client.query("UPDATE match_credentials SET status='Superseded' WHERE match_id=$1 AND status='Set'",[id.data]);
      const encrypted=encrypt(key,{room_id:body.data.room_id,password:body.data.password});const credentialId=randomUUID();await client.query('INSERT INTO match_credentials(id,match_id,version_no,iv,ciphertext,auth_tag,release_at,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[credentialId,id.data,credentialVersion,encrypted.iv,encrypted.ciphertext,encrypted.tag,body.data.release_at,'Set',res.locals.admin.id]);
      await client.query('UPDATE matches SET version=version+1 WHERE id=$1',[id.data]);await audit(client,res.locals.admin.id,'credential.set','match_credential',credentialId,{match_id:id.data,version_no:credentialVersion,release_at:body.data.release_at});return {id:credentialId,match_id:id.data,version_no:credentialVersion,release_at:body.data.release_at,match_version:body.data.expected_version+1};
    });if(data===null)return fail(res,404,'NOT_FOUND','Match not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Match changed. Reload and try again.');if(data==='cancelled')return fail(res,409,'INVALID_TRANSITION','Cancelled matches cannot receive credentials.');return res.status(201).json({data});
  });
  router.get('/matches/:id/credentials',requireAccount(pool),async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid match ID.');const key=secretKey(config);if(!key)return fail(res,503,'PROVIDER_UNAVAILABLE','Room access is not configured.');
    const client=await pool.connect();try{
      const match=await client.query<{tournament_id:string;status:string;tournament_status:string}>('SELECT m.tournament_id,m.status,t.status tournament_status FROM matches m JOIN tournaments t ON t.id=m.tournament_id WHERE m.id=$1',[id.data]);if(!match.rows[0])return fail(res,404,'NOT_FOUND','Match not found.');if(match.rows[0].status==='Cancelled'||match.rows[0].tournament_status==='Cancelled')return fail(res,409,'NOT_ELIGIBLE','Match is cancelled.');
      const eligible=await client.query("SELECT 1 FROM roster_entries e JOIN registrations r ON r.id=e.registration_id JOIN slots s ON s.registration_id=r.id AND s.status='Assigned' WHERE e.account_id=$1 AND e.tournament_id=$2 AND e.status='Active' AND r.approval_status='Approved' AND r.slot_status='Assigned' AND r.status='Submitted' AND r.payment_status IN ('NotRequired','Verified','Waived') AND NOT r.payment_recheck_required LIMIT 1",[res.locals.admin.id,match.rows[0].tournament_id]);if(!eligible.rowCount)return fail(res,403,'NOT_ELIGIBLE','Room details are for approved, slotted roster members.');
      const credential=await client.query<{id:string;version_no:number;iv:Buffer;ciphertext:Buffer;auth_tag:Buffer;release_at:Date}>("SELECT id,version_no,iv,ciphertext,auth_tag,release_at FROM match_credentials WHERE match_id=$1 AND status='Set'",[id.data]);const record=credential.rows[0];if(!record)return fail(res,404,'NOT_FOUND','Room details are not set.');if(record.release_at.getTime()>Date.now())return fail(res,423,'NOT_ELIGIBLE','Room details are not released yet.',{available_at:record.release_at});
      const values=decrypt(key,record);await audit(client,res.locals.admin.id,'credential.viewed','match_credential',record.id,{match_id:id.data,version_no:record.version_no});return res.json({data:{...values,version_no:record.version_no}});
    }finally{client.release();}
  });
  return router;
}

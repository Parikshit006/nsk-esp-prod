import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { registrationInputSchema, rosterInputSchema, submitRegistrationSchema, teamInputSchema } from '../../../packages/shared/registration.js';
import { requireAccount, requireCsrf } from './auth.js';

const uuid=z.uuid();
const withdrawSchema=z.object({expected_version:z.number().int().positive(),reason:z.string().trim().min(10).max(1000)}).strict();
const editRosterSchema=rosterInputSchema.omit({role:true,self:true}).extend({entry_id:z.uuid(),reason:z.string().trim().min(10).max(1000)});
function fail(res:Response,status:number,code:string,message:string,details?:unknown){return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId,...(details?{details}:{})}});}
async function tx<T>(pool:Pool,run:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const value=await run(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
async function audit(client:PoolClient,actor:string,action:string,type:string,id:string,before:unknown,after:unknown){await client.query('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),actor,action,type,id,before===null?null:JSON.stringify(before),after===null?null:JSON.stringify(after)]);}
const key=(value:string)=>value.normalize('NFKC').trim().toLocaleLowerCase('en');
type Registration={id:string;tournament_id:string;team_id:string;status:string;version:number;team_size:number;captain_id:string;team_name:string;tournament_name:string;tournament_status:string;registration_close_at:Date;payment_status:string;approval_status:string;slot_status:string;fee_minor:number;currency:string;payment_instructions:string;payment_proof_max_bytes:number|null;payment_recheck_required:boolean};
async function ownedRegistration(client:PoolClient,id:string,accountId:string,lock:boolean){const result=await client.query<Registration>(`SELECT r.id,r.tournament_id,r.team_id,r.status,r.version,t.team_size,t.name tournament_name,t.status tournament_status,t.registration_close_at,t.fee_minor,t.currency,t.payment_instructions,t.payment_proof_max_bytes,teams.captain_id,teams.name team_name,r.payment_status,r.payment_recheck_required,r.approval_status,r.slot_status FROM registrations r JOIN tournaments t ON t.id=r.tournament_id JOIN teams ON teams.id=r.team_id WHERE r.id=$1 AND teams.captain_id=$2 ${lock?'FOR UPDATE OF r':''}`,[id,accountId]);return result.rows[0]??null;}
export function participantRouter(pool:Pool){
  const router=Router();
  router.use((req,res,next)=>{
    if(!(/^\/(teams|me\/(teams|registrations)|registrations\/[^/]+(\/roster|\/roster-edit|\/submit|\/withdraw)?|tournaments\/[^/]+\/registrations)$/.test(req.path)))return next();
    return requireAccount(pool)(req,res,next);
  });
  router.use((req,res,next)=>req.method==='GET'||!res.locals.admin?next():requireCsrf(pool)(req,res,next));
  router.post('/teams',async(req,res)=>{
    if(res.locals.admin.role!=='captain')return fail(res,403,'FORBIDDEN','A captain account is required.');
    const parsed=teamInputSchema.safeParse(req.body);if(!parsed.success)return fail(res,400,'VALIDATION_FAILED','Enter a team name of 3–80 characters.');
    const id=randomUUID();await tx(pool,async client=>{await client.query('INSERT INTO teams(id,captain_id,name) VALUES($1,$2,$3)',[id,res.locals.admin.id,parsed.data.name]);await audit(client,res.locals.admin.id,'team.created','team',id,null,{name:parsed.data.name});});
    return res.status(201).json({data:{id,name:parsed.data.name}});
  });
  router.get('/me/teams',async(_req,res)=>{const result=await pool.query('SELECT id,name,created_at FROM teams WHERE captain_id=$1 ORDER BY created_at DESC',[res.locals.admin.id]);res.json({data:result.rows});});
  router.get('/me/registrations',async(_req,res)=>{const result=await pool.query('SELECT r.id,r.tournament_id,r.status,r.payment_status,r.approval_status,r.slot_status,r.version,teams.name team_name,t.name tournament_name FROM registrations r JOIN teams ON teams.id=r.team_id JOIN tournaments t ON t.id=r.tournament_id WHERE teams.captain_id=$1 ORDER BY r.created_at DESC',[res.locals.admin.id]);res.json({data:result.rows});});
  router.post('/tournaments/:id/registrations',async(req,res)=>{
    if(res.locals.admin.role!=='captain')return fail(res,403,'FORBIDDEN','A captain account is required.');
    const id=uuid.safeParse(req.params.id),parsed=registrationInputSchema.safeParse(req.body);if(!id.success||!parsed.success)return fail(res,400,'VALIDATION_FAILED','Choose a valid tournament and team.');
    try{
      const data=await tx(pool,async client=>{
        const tournament=await client.query<{status:string;fee_minor:number;registration_open_at:Date;registration_close_at:Date}>('SELECT status,fee_minor,registration_open_at,registration_close_at FROM tournaments WHERE id=$1 FOR UPDATE',[id.data]);
        const event=tournament.rows[0];if(!event)return null;
        const now=Date.now();if(event.status!=='RegistrationOpen'||now<event.registration_open_at.getTime()||now>=event.registration_close_at.getTime())return 'closed' as const;
        const team=await client.query<{name:string}>('SELECT name FROM teams WHERE id=$1 AND captain_id=$2',[parsed.data.team_id,res.locals.admin.id]);if(!team.rows[0])return 'team' as const;
        const registrationId=randomUUID(),payment=event.fee_minor===0?'NotRequired':'Pending';
        await client.query('INSERT INTO registrations(id,tournament_id,team_id,name_key,payment_status) VALUES($1,$2,$3,$4,$5)',[registrationId,id.data,parsed.data.team_id,key(team.rows[0].name),payment]);
        await audit(client,res.locals.admin.id,'registration.created','registration',registrationId,null,{tournament_id:id.data,team_id:parsed.data.team_id});
        return {id:registrationId,tournament_id:id.data,team_id:parsed.data.team_id,status:'Draft',payment_status:payment,approval_status:'Unreviewed',slot_status:'Unassigned',version:1};
      });
      if(data===null)return fail(res,404,'NOT_FOUND','Tournament not found.');if(data==='closed')return fail(res,409,'NOT_ELIGIBLE','Registration is not open for this event.');if(data==='team')return fail(res,403,'FORBIDDEN','This team is not yours.');return res.status(201).json({data});
    }catch(error){if((error as {code?:string}).code==='23505')return fail(res,409,'DUPLICATE','This team or team name already has an active registration for the event.');throw error;}
  });
  router.get('/registrations/:id',async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid registration ID.');
    const client=await pool.connect();try{const registration=await ownedRegistration(client,id.data,res.locals.admin.id,false);if(!registration)return fail(res,404,'NOT_FOUND','Registration not found.');const roster=await client.query('SELECT id,display_name,ign_raw,ign_exact,game_uid,role,account_id,status,version FROM roster_entries WHERE registration_id=$1 AND status=$2 ORDER BY created_at,id',[id.data,'Active']);return res.json({data:{...registration,roster:roster.rows}});}finally{client.release();}
  });
  router.post('/registrations/:id/roster',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),parsed=rosterInputSchema.safeParse(req.body);if(!id.success||!parsed.success)return fail(res,400,'VALIDATION_FAILED','Check the roster entry and version.');
    try{
      const data=await tx(pool,async client=>{
        const peek=await ownedRegistration(client,id.data,res.locals.admin.id,false);if(!peek)return null;
        const event=await client.query<{status:string;registration_close_at:Date}>('SELECT status,registration_close_at FROM tournaments WHERE id=$1 FOR UPDATE',[peek.tournament_id]);
        if(event.rows[0]?.status!=='RegistrationOpen'||Date.now()>=event.rows[0].registration_close_at.getTime())return 'locked' as const;
        const registration=await ownedRegistration(client,id.data,res.locals.admin.id,true);if(!registration)return null;
        if(registration.version!==parsed.data.expected_version)return 'stale' as const;
        if(!['Draft','NeedsCorrection'].includes(registration.status))return 'locked' as const;
        const roster=await client.query<{ign_raw:string;role:string}>('SELECT ign_raw,role FROM roster_entries WHERE registration_id=$1 AND status=$2',[id.data,'Active']);
        if(roster.rows.length>=registration.team_size)return 'full' as const;
        if(roster.rows.some(row=>key(row.ign_raw)===key(parsed.data.ign_raw)))return 'duplicate' as const;
        if(parsed.data.role==='Captain'&&(!parsed.data.self||roster.rows.some(row=>row.role==='Captain')))return 'captain' as const;
        if(parsed.data.self&&parsed.data.role!=='Captain')return 'captain' as const;
        const entryId=randomUUID();await client.query('INSERT INTO roster_entries(id,tournament_id,registration_id,account_id,display_name,ign_raw,ign_exact,game_uid,role) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[entryId,registration.tournament_id,id.data,parsed.data.self?res.locals.admin.id:null,parsed.data.display_name,parsed.data.ign_raw,parsed.data.ign_exact,parsed.data.game_uid,parsed.data.role]);
        await client.query('UPDATE registrations SET version=version+1 WHERE id=$1',[id.data]);
        await audit(client,res.locals.admin.id,'roster.added','roster_entry',entryId,null,{registration_id:id.data,ign_raw:parsed.data.ign_raw,ign_exact:parsed.data.ign_exact,role:parsed.data.role});
        return {id:entryId,registration_id:id.data,version:parsed.data.expected_version+1,...parsed.data};
      });
      if(data===null)return fail(res,404,'NOT_FOUND','Registration not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Registration changed. Reload and try again.');if(data==='locked')return fail(res,409,'NOT_ELIGIBLE','Roster is locked in this registration state.');if(data==='full')return fail(res,409,'GATE_BLOCKED','The roster is full.');if(data==='duplicate')return fail(res,409,'DUPLICATE','This in-game name is already on your roster.');if(data==='captain')return fail(res,409,'GATE_BLOCKED','Add one captain entry linked to your account.');return res.status(201).json({data});
    }catch(error){if((error as {code?:string}).code==='23505')return fail(res,409,'DUPLICATE','This account or captain entry is already on an active roster.');throw error;}
  });
  router.post('/registrations/:id/roster-edit',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),body=editRosterSchema.safeParse(req.body);if(!id.success||!body.success)return fail(res,400,'VALIDATION_FAILED','Provide the player details, current version and a correction reason.');
    const data=await tx(pool,async client=>{
      const peek=await ownedRegistration(client,id.data,res.locals.admin.id,false);if(!peek)return null;
      const event=await client.query<{status:string;registration_close_at:Date}>('SELECT status,registration_close_at FROM tournaments WHERE id=$1 FOR UPDATE',[peek.tournament_id]);
      const reg=await ownedRegistration(client,id.data,res.locals.admin.id,true);if(!reg)return null;
      if(reg.version!==body.data.expected_version)return 'stale' as const;
      if(!['Draft','NeedsCorrection'].includes(reg.status)||reg.approval_status!=='Unreviewed'||event.rows[0]?.status!=='RegistrationOpen'||Date.now()>=event.rows[0].registration_close_at.getTime())return 'locked' as const;
      const found=await client.query<{id:string;display_name:string;ign_raw:string;game_uid:string|null;role:string}>('SELECT id,display_name,ign_raw,game_uid,role FROM roster_entries WHERE registration_id=$1 AND status=$2 FOR UPDATE',[reg.id,'Active']);
      const entry=found.rows.find(row=>row.id===body.data.entry_id);if(!entry)return null;
      if(found.rows.some(row=>row.id!==entry.id&&key(row.ign_raw)===key(body.data.ign_raw)))return 'duplicate' as const;
      await client.query('UPDATE roster_invitations SET revoked_at=now() WHERE roster_entry_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL',[entry.id]);
      await client.query("UPDATE roster_entries SET display_name=$1,ign_raw=$2,ign_exact=$3,game_uid=$4,account_id=CASE WHEN role='Captain' THEN account_id ELSE NULL END,ign_admin_confirmed_at=NULL,ign_admin_confirmed_by=NULL,ign_admin_note=NULL,version=version+1 WHERE id=$5",[body.data.display_name,body.data.ign_raw,body.data.ign_exact,body.data.game_uid,entry.id]);
      await client.query("UPDATE registrations SET eligibility_status='Pending',eligibility_reviewed_by=NULL,eligibility_reviewed_at=NULL,eligibility_review_note=NULL,version=version+1 WHERE id=$1",[reg.id]);
      await audit(client,res.locals.admin.id,'roster.corrected','roster_entry',entry.id,entry,{display_name:body.data.display_name,ign_raw:body.data.ign_raw,game_uid:body.data.game_uid,reason:body.data.reason,player_link_revoked:entry.role!=='Captain'});
      return {id:entry.id,version:reg.version+1};
    });
    if(data===null)return fail(res,404,'NOT_FOUND','Roster entry not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Registration changed. Reload and try again.');if(data==='locked')return fail(res,409,'NOT_ELIGIBLE','Corrections require an unapproved draft or returned registration before registration closes.');if(data==='duplicate')return fail(res,409,'DUPLICATE','This in-game name is already on your roster.');return res.json({data});
  });
  router.post('/registrations/:id/submit',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),parsed=submitRegistrationSchema.safeParse(req.body);if(!id.success||!parsed.success)return fail(res,400,'VALIDATION_FAILED','Provide eligibility details and the current version.');
    const data=await tx(pool,async client=>{
      const registration=await ownedRegistration(client,id.data,res.locals.admin.id,true);if(!registration)return null;
      if(registration.version!==parsed.data.expected_version)return 'stale' as const;if(!['Draft','NeedsCorrection'].includes(registration.status))return 'locked' as const;
      const tournament=await client.query<{status:string;registration_close_at:Date}>('SELECT status,registration_close_at FROM tournaments WHERE id=$1',[registration.tournament_id]);if(tournament.rows[0]?.status!=='RegistrationOpen'||Date.now()>=tournament.rows[0].registration_close_at.getTime())return 'closed' as const;
      const roster=await client.query<{role:string;account_id:string|null}>('SELECT role,account_id FROM roster_entries WHERE registration_id=$1 AND status=$2',[id.data,'Active']);
      if(roster.rows.length!==registration.team_size||!roster.rows.some(row=>row.role==='Captain'&&row.account_id===res.locals.admin.id))return 'incomplete' as const;
      await client.query("UPDATE registrations SET status='Submitted',eligibility_note=$1,submitted_at=now(),version=version+1 WHERE id=$2",[parsed.data.eligibility_note,id.data]);
      await audit(client,res.locals.admin.id,'registration.submitted','registration',id.data,{status:registration.status},{status:'Submitted',roster_count:roster.rows.length});
      return {id:id.data,status:'Submitted',version:parsed.data.expected_version+1,payment_status:registration.payment_status,approval_status:registration.approval_status,slot_status:registration.slot_status};
    });
    if(data===null)return fail(res,404,'NOT_FOUND','Registration not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Registration changed. Reload and try again.');if(data==='locked')return fail(res,409,'INVALID_TRANSITION','Registration cannot be submitted now.');if(data==='closed')return fail(res,409,'NOT_ELIGIBLE','Registration is closed.');if(data==='incomplete')return fail(res,409,'GATE_BLOCKED','Complete every roster place and link your captain entry before submitting.');return res.json({data});
  });
  router.post('/registrations/:id/withdraw',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),body=withdrawSchema.safeParse(req.body);if(!id.success||!body.success)return fail(res,400,'VALIDATION_FAILED','Give a reason and current registration version.');
    const data=await tx(pool,async client=>{
      const peek=await ownedRegistration(client,id.data,res.locals.admin.id,false);if(!peek)return null;
      const tournament=await client.query<{status:string}>('SELECT status FROM tournaments WHERE id=$1 FOR UPDATE',[peek.tournament_id]);
      const reg=await ownedRegistration(client,id.data,res.locals.admin.id,true);if(!reg)return null;if(reg.version!==body.data.expected_version)return 'stale' as const;
      if(!['Draft','Submitted','NeedsCorrection'].includes(reg.status)||!['RegistrationOpen','RegistrationClosed'].includes(tournament.rows[0]?.status??''))return 'locked' as const;
      const started=await client.query("SELECT 1 FROM tournament_rulesets WHERE tournament_id=$1 AND status='Frozen' LIMIT 1",[reg.tournament_id]);if(started.rowCount)return 'started' as const;
      const slot=await client.query<{id:string;slot_no:number}>("SELECT id,slot_no FROM slots WHERE registration_id=$1 AND status='Assigned' FOR UPDATE",[reg.id]);
      if(slot.rows[0])await client.query("UPDATE slots SET status='Released',released_by=$1,released_at=now(),release_reason=$2 WHERE id=$3",[res.locals.admin.id,body.data.reason,slot.rows[0].id]);
      await client.query('UPDATE roster_invitations SET revoked_at=now() WHERE registration_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL',[reg.id]);
      await client.query("UPDATE roster_entries SET status='Removed',version=version+1 WHERE registration_id=$1 AND status='Active'",[reg.id]);
      await client.query("UPDATE registrations SET status='Withdrawn',slot_status=$1,version=version+1 WHERE id=$2",[slot.rows[0]?'Released':reg.slot_status,reg.id]);
      await audit(client,res.locals.admin.id,'registration.withdrawn','registration',reg.id,{status:reg.status,slot_status:reg.slot_status},{status:'Withdrawn',slot_status:slot.rows[0]?'Released':reg.slot_status,reason:body.data.reason,refund:'handled outside platform'});
      return {id:reg.id,status:'Withdrawn',slot_status:slot.rows[0]?'Released':reg.slot_status,version:reg.version+1};
    });
    if(data===null)return fail(res,404,'NOT_FOUND','Registration not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Registration changed. Reload and try again.');if(data==='locked')return fail(res,409,'INVALID_TRANSITION','Withdrawal is available only before match operations begin.');if(data==='started')return fail(res,409,'GATE_BLOCKED','A match has started; ask the organizer to resolve this team under event rules.');return res.json({data});
  });
  return router;
}

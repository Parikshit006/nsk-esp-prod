import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { registrationInputSchema, rosterInputSchema, submitRegistrationSchema, teamInputSchema } from '../../../packages/shared/registration.js';
import { requireAccount, requireCsrf } from './auth.js';

const uuid=z.uuid();
function fail(res:Response,status:number,code:string,message:string,details?:unknown){return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId,...(details?{details}:{})}});}
async function tx<T>(pool:Pool,run:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const value=await run(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
async function audit(client:PoolClient,actor:string,action:string,type:string,id:string,before:unknown,after:unknown){await client.query('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),actor,action,type,id,before===null?null:JSON.stringify(before),after===null?null:JSON.stringify(after)]);}
const key=(value:string)=>value.normalize('NFKC').trim().toLocaleLowerCase('en');
type Registration={id:string;tournament_id:string;team_id:string;status:string;version:number;team_size:number;captain_id:string;team_name:string;tournament_name:string;payment_status:string;approval_status:string;slot_status:string};
async function ownedRegistration(client:PoolClient,id:string,accountId:string,lock:boolean){const result=await client.query<Registration>(`SELECT r.id,r.tournament_id,r.team_id,r.status,r.version,t.team_size,t.name tournament_name,teams.captain_id,teams.name team_name,r.payment_status,r.approval_status,r.slot_status FROM registrations r JOIN tournaments t ON t.id=r.tournament_id JOIN teams ON teams.id=r.team_id WHERE r.id=$1 AND teams.captain_id=$2 ${lock?'FOR UPDATE OF r':''}`,[id,accountId]);return result.rows[0]??null;}
export function participantRouter(pool:Pool){
  const router=Router();
  router.use((req,res,next)=>{
    if(!(/^\/(teams|me\/(teams|registrations)|registrations\/[^/]+(\/roster|\/submit)?|tournaments\/[^/]+\/registrations)$/.test(req.path)))return next();
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
  return router;
}

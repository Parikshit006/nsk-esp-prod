import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { matchInputSchema, tournamentConfigInputSchema, tournamentTransitionSchema } from '../../../packages/shared/tournament.js';
import { requireAdmin, requireCsrf } from './auth.js';

const uuid=z.uuid();
function fail(res:Response,status:number,code:string,message:string,details?:unknown){return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId,...(details?{details}:{})}});}
function invalid(res:Response,issues:z.core.$ZodIssue[]){return fail(res,400,'VALIDATION_FAILED','Check the highlighted fields.',issues.map(issue=>({field:issue.path.join('.'),issue:issue.message})));}
async function tx<T>(pool:Pool,work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
async function audit(client:PoolClient,actor:string,action:string,id:string,before:unknown,after:unknown){await client.query('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),actor,action,'tournament',id,before===null?null:JSON.stringify(before),after===null?null:JSON.stringify(after)]);}
type TournamentRow={id:string;name:string;capacity:number;timezone:string;status:string;version:number;format:string|null;team_size:number|null;fee_minor:number|null;currency:string|null;registration_open_at:Date|null;registration_close_at:Date|null;starts_at:Date|null;ends_at:Date|null;rules_text:string|null;eligibility_text:string|null;payment_instructions:string|null};
async function readiness(client:PoolClient,tournament:TournamentRow){
  const blockers:{field:string;issue:string}[]=[];
  for(const field of ['format','team_size','fee_minor','registration_open_at','registration_close_at','starts_at','ends_at','rules_text','eligibility_text'] as const)if(tournament[field]===null||tournament[field]==='')blockers.push({field,issue:'Required before publication.'});
  if(tournament.fee_minor!==null&&tournament.fee_minor>0&&!tournament.payment_instructions)blockers.push({field:'payment_instructions',issue:'Required for a paid tournament.'});
  if(!tournament.currency)blockers.push({field:'currency',issue:'Choose a currency.'});
  const rules=await client.query<{status:string}>('SELECT status FROM tournament_rulesets WHERE tournament_id=$1 ORDER BY version_no DESC LIMIT 1',[tournament.id]);
  if(rules.rows[0]?.status!=='Confirmed')blockers.push({field:'ruleset',issue:'Confirm the latest rule version.'});
  const matches=await client.query<{match_no:number;scheduled_at:Date;ends_at:Date}>('SELECT match_no,scheduled_at,ends_at FROM matches WHERE tournament_id=$1 ORDER BY scheduled_at',[tournament.id]);
  if(matches.rows.length===0)blockers.push({field:'matches',issue:'Add at least one match.'});
  matches.rows.forEach((match,index)=>{
    if(match.match_no<1||!matches.rows.some(row=>row.match_no===index+1))blockers.push({field:'matches',issue:'Match numbers must be consecutive from 1.'});
    if(tournament.starts_at&&match.scheduled_at<tournament.starts_at||tournament.ends_at&&match.ends_at>tournament.ends_at)blockers.push({field:'matches',issue:'Matches must fit inside the event window.'});
    if(index>0&&match.scheduled_at<(matches.rows[index-1]?.ends_at??match.scheduled_at))blockers.push({field:'matches',issue:'Match times overlap.'});
  });
  return blockers.filter((item,index,array)=>array.findIndex(other=>other.field===item.field&&other.issue===item.issue)===index);
}

export function adminTournamentRouter(pool:Pool){
  const router=Router();router.use(requireAdmin(pool));router.use((req,res,next)=>req.method==='GET'?next():requireCsrf(pool)(req,res,next));
  router.get('/:id',async(req,res)=>{const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid tournament ID.');const result=await pool.query<TournamentRow>('SELECT id,name,capacity,timezone,status,version,format,team_size,fee_minor,currency,registration_open_at,registration_close_at,starts_at,ends_at,rules_text,eligibility_text,payment_instructions FROM tournaments WHERE id=$1',[id.data]);if(!result.rows[0])return fail(res,404,'NOT_FOUND','Tournament not found.');const matches=await pool.query('SELECT id,match_no,map,scheduled_at,ends_at,status,version FROM matches WHERE tournament_id=$1 ORDER BY match_no',[id.data]);return res.json({data:{...result.rows[0],matches:matches.rows}});});
  router.patch('/:id',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),parsed=tournamentConfigInputSchema.safeParse(req.body);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid tournament ID.');if(!parsed.success)return invalid(res,parsed.error.issues);
    const data=await tx(pool,async client=>{
      const current=await client.query<TournamentRow>('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE',[id.data]);if(!current.rows[0])return null;if(current.rows[0].version!==parsed.data.expected_version)return 'stale' as const;if(current.rows[0].status!=='Draft')return 'locked' as const;
      const v=parsed.data;
      await client.query('UPDATE tournaments SET name=$1,capacity=$2,timezone=$3,format=$4,team_size=$5,fee_minor=$6,currency=$7,registration_open_at=$8,registration_close_at=$9,starts_at=$10,ends_at=$11,rules_text=$12,eligibility_text=$13,payment_instructions=$14,version=version+1 WHERE id=$15',[v.name,v.capacity,v.timezone,v.format,v.team_size,v.fee_minor,v.currency,v.registration_open_at,v.registration_close_at,v.starts_at,v.ends_at,v.rules_text,v.eligibility_text,v.payment_instructions,id.data]);
      await audit(client,res.locals.admin.id,'tournament.configured',id.data,current.rows[0],v);
      return {id:id.data,version:v.expected_version+1,...v};
    });if(data===null)return fail(res,404,'NOT_FOUND','Tournament not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Tournament changed. Reload and try again.');if(data==='locked')return fail(res,409,'INVALID_TRANSITION','Published event configuration is locked.');return res.json({data});
  });
  router.post('/:id/matches',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),parsed=matchInputSchema.safeParse(req.body);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid tournament ID.');if(!parsed.success)return invalid(res,parsed.error.issues);
    const data=await tx(pool,async client=>{
      const tournament=await client.query<TournamentRow>('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE',[id.data]);if(!tournament.rows[0])return null;if(tournament.rows[0].version!==parsed.data.expected_version)return 'stale' as const;if(tournament.rows[0].status!=='Draft')return 'locked' as const;
      const v=parsed.data;
      const overlap=await client.query('SELECT id FROM matches WHERE tournament_id=$1 AND scheduled_at<$2 AND ends_at>$3',[id.data,v.ends_at,v.scheduled_at]);if(overlap.rowCount)return 'overlap' as const;
      const duplicate=await client.query('SELECT id FROM matches WHERE tournament_id=$1 AND match_no=$2',[id.data,v.match_no]);if(duplicate.rowCount)return 'duplicate' as const;
      const matchId=randomUUID(),attemptId=randomUUID();await client.query('INSERT INTO matches(id,tournament_id,match_no,map,scheduled_at,ends_at,current_attempt_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[matchId,id.data,v.match_no,v.map,v.scheduled_at,v.ends_at,attemptId]);
      await client.query('INSERT INTO match_attempts(id,match_id,attempt_no) VALUES($1,$2,1)',[attemptId,matchId]);
      await client.query('UPDATE tournaments SET version=version+1 WHERE id=$1',[id.data]);await audit(client,res.locals.admin.id,'match.created',id.data,null,{match_id:matchId,...v});
      return {id:matchId,tournament_id:id.data,match_no:v.match_no,map:v.map,scheduled_at:v.scheduled_at,ends_at:v.ends_at,status:'Scheduled',version:1,tournament_version:v.expected_version+1};
    });if(data===null)return fail(res,404,'NOT_FOUND','Tournament not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Tournament changed. Reload and try again.');if(data==='locked')return fail(res,409,'INVALID_TRANSITION','Published event schedules are locked.');if(data==='overlap')return fail(res,409,'SCHEDULE_CONFLICT','This match overlaps another match.');if(data==='duplicate')return fail(res,409,'DUPLICATE','This match number already exists.');return res.status(201).json({data});
  });
  router.post('/:id/validate',async(req,res)=>{const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid tournament ID.');const client=await pool.connect();try{const tournament=await client.query<TournamentRow>('SELECT * FROM tournaments WHERE id=$1',[id.data]);if(!tournament.rows[0])return fail(res,404,'NOT_FOUND','Tournament not found.');const blockers=await readiness(client,tournament.rows[0]);return res.json({data:{ready:blockers.length===0,blockers}});}finally{client.release();}});
  router.post('/:id/transition',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),parsed=tournamentTransitionSchema.safeParse(req.body);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid tournament ID.');if(!parsed.success)return invalid(res,parsed.error.issues);
    const data=await tx(pool,async client=>{
      const found=await client.query<TournamentRow>('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE',[id.data]);const tournament=found.rows[0];if(!tournament)return null;if(tournament.version!==parsed.data.expected_version)return 'stale' as const;
      const action=parsed.data.action;let next:string;
      if(action==='publish'&&tournament.status==='Draft'){const blockers=await readiness(client,tournament);if(blockers.length)return {blocked:blockers};next='Published';}
      else if(action==='open_registration'&&tournament.status==='Published'){const now=Date.now();if(!tournament.registration_open_at||!tournament.registration_close_at||now<tournament.registration_open_at.getTime()||now>=tournament.registration_close_at.getTime())return {blocked:[{field:'registration_window',issue:'Registration can open only within its configured window.'}]};next='RegistrationOpen';}
      else if(action==='close_registration'&&tournament.status==='RegistrationOpen')next='RegistrationClosed';
      else if(action==='cancel'&&['Draft','Published','RegistrationOpen','RegistrationClosed','InProgress'].includes(tournament.status))next='Cancelled';
      else return 'invalid' as const;
      await client.query('UPDATE tournaments SET status=$1,version=version+1 WHERE id=$2',[next,id.data]);
      await audit(client,res.locals.admin.id,`tournament.${action}`,id.data,{status:tournament.status},{status:next,reason:parsed.data.reason??null});
      return {id:id.data,status:next,version:tournament.version+1};
    });if(data===null)return fail(res,404,'NOT_FOUND','Tournament not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Tournament changed. Reload and try again.');if(data==='invalid')return fail(res,409,'INVALID_TRANSITION','This action is not available in the current state.');if('blocked' in data)return fail(res,409,'GATE_BLOCKED','Resolve the listed blockers before continuing.',data.blocked);return res.json({data});
  });
  return router;
}
export function publicTournamentRouter(pool:Pool){
  const router=Router();
  router.get('/',async(_req,res)=>{const result=await pool.query("SELECT id,name,game,format,capacity,team_size,fee_minor,currency,timezone,registration_open_at,registration_close_at,starts_at,ends_at,status FROM tournaments WHERE status IN ('Published','RegistrationOpen','RegistrationClosed','InProgress','Finalizing','Completed','Archived') ORDER BY starts_at,id");res.json({data:result.rows});});
  router.get('/:id',async(req,res)=>{const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid tournament ID.');const tournament=await pool.query("SELECT id,name,game,format,capacity,team_size,fee_minor,currency,timezone,registration_open_at,registration_close_at,starts_at,ends_at,status,rules_text,eligibility_text,payment_instructions FROM tournaments WHERE id=$1 AND status IN ('Published','RegistrationOpen','RegistrationClosed','InProgress','Finalizing','Completed','Archived')",[id.data]);if(!tournament.rows[0])return fail(res,404,'NOT_FOUND','Tournament not found.');const matches=await pool.query('SELECT id,match_no,map,scheduled_at,ends_at,status FROM matches WHERE tournament_id=$1 ORDER BY match_no',[id.data]);const rules=await pool.query('SELECT version_no,config FROM tournament_rulesets WHERE tournament_id=$1 AND status IN (\'Confirmed\',\'Frozen\') ORDER BY version_no DESC LIMIT 1',[id.data]);return res.json({data:{...tournament.rows[0],matches:matches.rows,rules:rules.rows[0]??null}});});
  return router;
}

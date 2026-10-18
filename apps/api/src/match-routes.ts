import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { requireAdmin, requireCsrf } from './auth.js';

const uuid=z.uuid();
const transitionSchema=z.object({expected_version:z.number().int().positive(),action:z.enum(['ready','start','finish','interrupt','restart']),reason:z.string().trim().min(10).max(1000).optional()}).strict().superRefine((value,ctx)=>{if(['interrupt','restart'].includes(value.action)&&!value.reason)ctx.addIssue({code:'custom',path:['reason'],message:'A reason is required.'});});
function fail(res:Response,status:number,code:string,message:string){return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId}});}
async function tx<T>(pool:Pool,run:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const value=await run(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}

export function matchRouter(pool:Pool){
  const router=Router();
  router.get('/admin/matches/:id',requireAdmin(pool),async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid match ID.');
    const match=await pool.query('SELECT m.*,t.name tournament_name,t.status tournament_status FROM matches m JOIN tournaments t ON t.id=m.tournament_id WHERE m.id=$1',[id.data]);if(!match.rows[0])return fail(res,404,'NOT_FOUND','Match not found.');
    const attempts=await pool.query('SELECT id,attempt_no,status,created_at FROM match_attempts WHERE match_id=$1 ORDER BY attempt_no',[id.data]);return res.json({data:{...match.rows[0],attempts:attempts.rows}});
  });
  router.post('/admin/matches/:id/transition',requireAdmin(pool),requireCsrf(pool),async(req,res)=>{
    const id=uuid.safeParse(req.params.id),body=transitionSchema.safeParse(req.body);if(!id.success||!body.success)return fail(res,400,'VALIDATION_FAILED','Check match, action, version and reason.');
    const result=await tx(pool,async client=>{
      const found=await client.query<{id:string;tournament_id:string;status:string;version:number;current_attempt_id:string;tournament_status:string}>("SELECT m.id,m.tournament_id,m.status,m.version,m.current_attempt_id,t.status tournament_status FROM matches m JOIN tournaments t ON t.id=m.tournament_id WHERE m.id=$1 FOR UPDATE OF m,t",[id.data]);const match=found.rows[0];if(!match)return 'missing' as const;if(match.version!==body.data.expected_version)return 'stale' as const;
      const action=body.data.action;let next:string;
      if(action==='ready'){
        if(match.status!=='Scheduled'||!['RegistrationClosed','InProgress'].includes(match.tournament_status))return 'state' as const;
        const slots=await client.query<{n:number}>("SELECT count(*)::int n FROM slots s JOIN registrations r ON r.id=s.registration_id WHERE s.tournament_id=$1 AND s.status='Assigned' AND r.approval_status='Approved' AND r.slot_status='Assigned' AND r.status='Submitted'",[match.tournament_id]);
        if((slots.rows[0]?.n??0)<2)return 'slots' as const;
        const credential=await client.query("SELECT 1 FROM match_credentials WHERE match_id=$1 AND status='Set'",[match.id]);if(!credential.rowCount)return 'credential' as const;
        const rules=await client.query("SELECT 1 FROM tournament_rulesets WHERE tournament_id=$1 AND status IN ('Confirmed','Frozen')",[match.tournament_id]);if(!rules.rowCount)return 'rules' as const;
        next='Ready';
      }else if(action==='start'){
        if(match.status!=='Ready'||!['RegistrationClosed','InProgress'].includes(match.tournament_status))return 'state' as const;
        await client.query("UPDATE tournament_rulesets SET status='Frozen' WHERE tournament_id=$1 AND status='Confirmed'",[match.tournament_id]);
        if(match.tournament_status==='RegistrationClosed')await client.query("UPDATE tournaments SET status='InProgress',version=version+1 WHERE id=$1",[match.tournament_id]);next='InProgress';
      }else if(action==='finish'){
        if(match.status!=='InProgress'||match.tournament_status!=='InProgress')return 'state' as const;next='AwaitingEvidence';
      }else if(action==='interrupt'){
        if(!['Ready','InProgress','AwaitingEvidence'].includes(match.status))return 'state' as const;
        await client.query("UPDATE match_attempts SET status='Interrupted' WHERE id=$1",[match.current_attempt_id]);next='Interrupted';
      }else{
        if(match.status!=='Interrupted')return 'state' as const;
        const attempt=await client.query<{attempt_no:number}>('SELECT attempt_no FROM match_attempts WHERE id=$1',[match.current_attempt_id]);const nextAttempt=randomUUID();
        await client.query('INSERT INTO match_attempts(id,match_id,attempt_no) VALUES($1,$2,$3)',[nextAttempt,match.id,(attempt.rows[0]?.attempt_no??0)+1]);
        await client.query('UPDATE matches SET current_attempt_id=$1 WHERE id=$2',[nextAttempt,match.id]);next='Scheduled';
      }
      await client.query('UPDATE matches SET status=$1,version=version+1 WHERE id=$2',[next,match.id]);
      await client.query('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),res.locals.admin.id,`match.${action}`,'match',match.id,JSON.stringify({status:match.status,version:match.version}),JSON.stringify({status:next,version:match.version+1,reason:body.data.reason??null})]);
      return {id:match.id,status:next,version:match.version+1};
    });
    if(result==='missing')return fail(res,404,'NOT_FOUND','Match not found.');if(result==='stale')return fail(res,409,'STALE_VERSION','Match changed. Reload and try again.');if(result==='slots')return fail(res,409,'NOT_READY','At least two approved, slotted teams are needed.');if(result==='credential')return fail(res,409,'NOT_READY','Set private room details first.');if(result==='rules')return fail(res,409,'NOT_READY','Confirm tournament rules first.');if(result==='state')return fail(res,409,'INVALID_TRANSITION','Match or tournament is not in the required state.');return res.json({data:result});
  });
  return router;
}

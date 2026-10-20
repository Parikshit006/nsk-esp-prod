import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requireAdmin, requireCsrf } from './auth.js';
import {suggestRosterNames,type RosterCandidate} from './ocr-candidates.js';
import type {OcrOutput} from './ocr.js';
import {slotForOcrLine} from './result-layout.js';

export function ocrRouter(pool:Pool){
  const router=Router();
  router.use('/admin/evidence/:id/ocr',requireAdmin(pool));
  router.get('/admin/evidence/:id/ocr',async(req,res)=>{
    if(!z.uuid().safeParse(req.params.id).success)return res.sendStatus(400);
    const found=await pool.query<{id:string;status:string;attempts:number;output:OcrOutput|null;created_at:Date;completed_at:Date|null}>('SELECT id,status,attempts,output,created_at,completed_at FROM ocr_jobs WHERE evidence_id=$1',[req.params.id]);
    const job=found.rows[0];if(!job||job.status!=='Succeeded'||!Array.isArray(job.output?.lines))return res.json({data:job??null});
    const roster=await pool.query<RosterCandidate>("SELECT e.id roster_entry_id,e.registration_id,tm.name team_name,e.ign_raw FROM match_evidence ev JOIN matches m ON m.id=ev.match_id JOIN roster_entries e ON e.tournament_id=m.tournament_id AND e.status='Active' JOIN registrations r ON r.id=e.registration_id AND r.status='Submitted' AND r.approval_status='Approved' AND r.slot_status='Assigned' AND r.payment_status IN ('NotRequired','Verified','Waived') AND NOT r.payment_recheck_required JOIN teams tm ON tm.id=r.team_id JOIN slots s ON s.registration_id=r.id AND s.status='Assigned' WHERE ev.id=$1 ORDER BY tm.name,e.id",[req.params.id]);
    const lines=job.output.layout?.rows.flatMap(row=>row.ocr_lines.map(line=>({...line,placement:row.placement,slot:slotForOcrLine(row,line.box)})))??job.output.lines;
    return res.json({data:{...job,candidates:suggestRosterNames(lines,roster.rows)}});
  });
  router.post('/admin/evidence/:id/ocr',requireCsrf(pool),async(req,res)=>{
    if(!z.uuid().safeParse(req.params.id).success)return res.sendStatus(400);
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(85120492)');
      const eligible=await client.query("SELECT e.id FROM match_evidence e JOIN matches m ON m.id=e.match_id JOIN tournaments t ON t.id=m.tournament_id WHERE e.id=$1 AND e.attempt_id=m.current_attempt_id AND t.status IN ('InProgress','Finalizing')",[req.params.id]);
      if(!eligible.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:{message:'Select evidence from the current attempt of an active event.'}});}
      const existing=await client.query('SELECT id,status FROM ocr_jobs WHERE evidence_id=$1',[req.params.id]);
      if(existing.rowCount){await client.query('COMMIT');return res.json({data:existing.rows[0]});}
      const count=await client.query("SELECT count(*)::int count FROM ocr_jobs WHERE status IN ('Queued','Running')");
      if(count.rows[0].count>=20){await client.query('ROLLBACK');return res.status(429).json({error:{message:'The screenshot queue is full. Try again later.'}});}
      const id=randomUUID();
      await client.query('INSERT INTO ocr_jobs(id,evidence_id,requested_by) VALUES($1,$2,$3)',[id,req.params.id,res.locals.admin.id]);
      await client.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'ocr.requested','ocr_job',$3)",[randomUUID(),res.locals.admin.id,id]);
      await client.query('COMMIT');return res.status(202).json({data:{id,status:'Queued'}});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  return router;
}

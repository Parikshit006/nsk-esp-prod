import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requireAdmin, requireCsrf } from './auth.js';

export function ocrRouter(pool:Pool){
  const router=Router();
  router.use('/admin/evidence/:id/ocr',requireAdmin(pool));
  router.get('/admin/evidence/:id/ocr',async(req,res)=>{
    if(!z.uuid().safeParse(req.params.id).success)return res.sendStatus(400);
    const found=await pool.query('SELECT id,status,attempts,output,created_at,completed_at FROM ocr_jobs WHERE evidence_id=$1',[req.params.id]);
    return res.json({data:found.rows[0]??null});
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

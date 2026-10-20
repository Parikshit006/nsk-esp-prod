import {randomUUID} from 'node:crypto';
import {Router} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
import {requireAdmin,requireCsrf} from './auth.js';

const input=z.object({action:z.enum(['hold','release']),reason:z.string().trim().min(10).max(1000)}).strict();
export function evidenceRetentionRouter(pool:Pool){
  const router=Router();
  router.get('/admin/tournaments/:id/evidence-retention',requireAdmin(pool),async(req,res)=>{
    if(!z.uuid().safeParse(req.params.id).success)return res.sendStatus(400);
    const found=await pool.query('SELECT status,evidence_retention_due_at,evidence_hold_reason FROM tournaments WHERE id=$1',[req.params.id]);
    if(!found.rows[0])return res.sendStatus(404);
    return res.json({data:found.rows[0]});
  });
  router.post('/admin/tournaments/:id/evidence-retention',requireAdmin(pool),requireCsrf(pool),async(req,res)=>{
    if(res.locals.admin.role!=='super_admin')return res.status(403).json({error:{message:'Only a platform administrator can change legal holds.'}});
    const id=z.uuid().safeParse(req.params.id),body=input.safeParse(req.body);
    if(!id.success||!body.success)return res.status(400).json({error:{message:'Provide a valid event, action and reason of at least 10 characters.'}});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const locked=await client.query<{status:string;evidence_retention_due_at:Date|null;evidence_hold_reason:string|null}>('SELECT status,evidence_retention_due_at,evidence_hold_reason FROM tournaments WHERE id=$1 FOR UPDATE',[id.data]);
      const event=locked.rows[0];
      if(!event){await client.query('ROLLBACK');return res.sendStatus(404);}
      if(body.data.action==='hold'&&event.evidence_hold_reason||body.data.action==='release'&&!event.evidence_hold_reason){await client.query('ROLLBACK');return res.status(409).json({error:{message:'The legal hold state changed. Reload the event.'}});}
      const hold=body.data.action==='hold'?body.data.reason:null;
      await client.query('UPDATE tournaments SET evidence_hold_reason=$2 WHERE id=$1',[id.data,hold]);
      await client.query('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),res.locals.admin.id,`evidence.hold_${body.data.action}`,'tournament',id.data,JSON.stringify({reason:body.data.reason,prior_hold_reason:event.evidence_hold_reason})]);
      await client.query('COMMIT');return res.json({data:{status:event.status,evidence_retention_due_at:event.evidence_retention_due_at,evidence_hold_reason:hold}});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  return router;
}

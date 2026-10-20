import {randomUUID} from 'node:crypto';
import {Router} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
import {requireAdmin,requireCsrf} from './auth.js';
import {snapshot} from './result-routes.js';
import {scoringRulesSchema} from '../../../packages/shared/rules.js';
import {notifyTournament} from './notification-routes.js';
const input=z.object({expected_version:z.number().int().positive(),reason:z.string().trim().min(10).max(1000)}).strict();
export function reopenRouter(pool:Pool){const router=Router();
 router.get('/admin/tournaments/:id/finalization-history',requireAdmin(pool),async(req,res)=>{if(!z.uuid().safeParse(req.params.id).success)return res.sendStatus(400);const history=await pool.query('SELECT f.id,f.snapshot_id,f.podium,f.reason,f.completed_at,(f.id=t.current_finalization_id) current FROM tournament_finalizations f JOIN tournaments t ON t.id=f.tournament_id WHERE f.tournament_id=$1 ORDER BY f.completed_at DESC',[req.params.id]);return res.json({data:history.rows});});
 router.post('/admin/tournaments/:id/reopen',requireAdmin(pool),requireCsrf(pool),async(req,res)=>{
   if(res.locals.admin.role!=='super_admin')return res.status(403).json({error:{code:'FORBIDDEN',message:'Only a platform administrator can reopen a completed tournament.'}});
   const id=z.uuid().safeParse(req.params.id),body=input.safeParse(req.body);if(!id.success||!body.success)return res.status(400).json({error:{message:'Provide the current version and a reopening reason.'}});
   const client=await pool.connect();try{await client.query('BEGIN');const found=await client.query<{status:string;version:number;current_finalization_id:string|null}>('SELECT status,version,current_finalization_id FROM tournaments WHERE id=$1 FOR UPDATE',[id.data]);const event=found.rows[0];
     if(!event){await client.query('ROLLBACK');return res.sendStatus(404);}if(event.status!=='Completed'||event.version!==body.data.expected_version||!event.current_finalization_id){await client.query('ROLLBACK');return res.status(409).json({error:{message:'Only the current completed version can be reopened. Reload the event.'}});}
     const rules=await client.query<{config:unknown}>("SELECT config FROM tournament_rulesets WHERE tournament_id=$1 AND status='Frozen' ORDER BY version_no DESC LIMIT 1",[id.data]);if(!rules.rows[0]){await client.query('ROLLBACK');return res.status(409).json({error:{message:'Frozen scoring rules are required for reopening.'}});}
     const reopenId=randomUUID();await client.query('INSERT INTO tournament_reopen_events(id,tournament_id,previous_finalization_id,reason,reopened_by) VALUES($1,$2,$3,$4,$5)',[reopenId,id.data,event.current_finalization_id,body.data.reason,res.locals.admin.id]);
     await client.query("UPDATE tournaments SET status='Finalizing',current_finalization_id=NULL,evidence_retention_due_at=NULL,version=version+1 WHERE id=$1",[id.data]);
     const standing=await snapshot(client,id.data,null,scoringRulesSchema.parse(rules.rows[0].config),null,null,reopenId);
     await client.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'tournament.reopened','tournament',$3,$4)",[randomUUID(),res.locals.admin.id,id.data,JSON.stringify({reason:body.data.reason,previous_finalization_id:event.current_finalization_id,snapshot_id:standing.id})]);
     await notifyTournament(client,id.data,'Final podium reopened for review','The platform administrator reopened the completed event. The previous podium is withdrawn from the current public view while corrections and final review are performed.');
     await client.query('COMMIT');return res.json({data:{id:id.data,status:'Finalizing',version:event.version+1,snapshot_id:standing.id}});
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });return router;
}

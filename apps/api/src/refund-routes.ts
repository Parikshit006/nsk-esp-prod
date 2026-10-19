import {randomUUID} from 'node:crypto';
import {Router} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
import {requireAccount,requireAdmin,requireCsrf} from './auth.js';
import {notifyRegistration} from './notification-routes.js';
const decision=z.object({resolution:z.enum(['Refunded','PartiallyRefunded','NoRefundDue']),amount_minor:z.number().int().min(0),note:z.string().trim().min(10).max(1000)}).strict().superRefine((v,ctx)=>{if(v.resolution==='NoRefundDue'&&v.amount_minor!==0)ctx.addIssue({code:'custom',path:['amount_minor'],message:'No refund due has zero refunded amount.'});if(v.resolution!=='NoRefundDue'&&v.amount_minor===0)ctx.addIssue({code:'custom',path:['amount_minor'],message:'Record a positive refunded amount.'});});
export function refundRouter(pool:Pool){const router=Router();
 router.get('/admin/tournaments/:id/refund-reviews',requireAdmin(pool),async(req,res)=>{if(!z.uuid().safeParse(req.params.id).success)return res.sendStatus(400);const found=await pool.query('SELECT f.*,tm.name team_name FROM refund_reviews f JOIN registrations r ON r.id=f.registration_id JOIN teams tm ON tm.id=r.team_id WHERE f.tournament_id=$1 ORDER BY f.status,f.created_at',[req.params.id]);return res.json({data:found.rows});});
 router.get('/me/refund-reviews',requireAccount(pool),async(_req,res)=>{const found=await pool.query('SELECT f.id,f.tournament_id,f.registration_id,f.status,f.resolution,f.amount_minor,f.note,f.reviewed_at,t.name tournament_name FROM refund_reviews f JOIN registrations r ON r.id=f.registration_id JOIN teams tm ON tm.id=r.team_id JOIN tournaments t ON t.id=f.tournament_id WHERE tm.captain_id=$1 ORDER BY f.created_at DESC',[res.locals.admin.id]);return res.json({data:found.rows});});
 router.post('/admin/refund-reviews/:id/decision',requireAdmin(pool),requireCsrf(pool),async(req,res)=>{
   const id=z.uuid().safeParse(req.params.id),body=decision.safeParse(req.body);if(!id.success||!body.success)return res.status(400).json({error:{message:'Provide a valid refund outcome, amount and note.'}});
   const client=await pool.connect();try{await client.query('BEGIN');const found=await client.query<{registration_id:string;status:string;fee_minor:number;captain_id:string}>("SELECT f.registration_id,f.status,t.fee_minor,tm.captain_id FROM refund_reviews f JOIN tournaments t ON t.id=f.tournament_id JOIN registrations r ON r.id=f.registration_id JOIN teams tm ON tm.id=r.team_id WHERE f.id=$1 FOR UPDATE OF f",[id.data]);const item=found.rows[0];
     if(!item){await client.query('ROLLBACK');return res.sendStatus(404);}if(item.status!=='Pending'||item.captain_id===res.locals.admin.id||body.data.amount_minor>item.fee_minor||(body.data.resolution==='Refunded'&&body.data.amount_minor!==item.fee_minor)||(body.data.resolution==='PartiallyRefunded'&&body.data.amount_minor>=item.fee_minor)){await client.query('ROLLBACK');return res.status(409).json({error:{message:'This review is closed, exceeds the entry fee, or involves your own team.'}});}
     await client.query("UPDATE refund_reviews SET status='Resolved',resolution=$1,amount_minor=$2,note=$3,reviewed_by=$4,reviewed_at=now() WHERE id=$5",[body.data.resolution,body.data.amount_minor,body.data.note,res.locals.admin.id,id.data]);
     await client.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'refund.reviewed','refund_review',$3,$4)",[randomUUID(),res.locals.admin.id,id.data,JSON.stringify(body.data)]);
     await notifyRegistration(client,item.registration_id,'Refund review updated','The organizer recorded an off-platform refund decision. Open your team portal to read the outcome.');
     await client.query('COMMIT');return res.json({data:{id:id.data,status:'Resolved',...body.data}});
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });return router;
}

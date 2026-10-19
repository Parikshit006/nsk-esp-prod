import { Router } from 'express';
import type { Pool,PoolClient } from 'pg';
import { z } from 'zod';
import { requireAccount,requireCsrf } from './auth.js';
export async function notifyTournament(client:PoolClient,eventId:string,title:string,message:string){
  await client.query("INSERT INTO notifications(account_id,tournament_id,title,message) SELECT DISTINCT recipient,$1,$2,$3 FROM (SELECT tm.captain_id recipient FROM registrations r JOIN teams tm ON tm.id=r.team_id WHERE r.tournament_id=$1 AND r.status NOT IN ('Withdrawn','Cancelled') UNION SELECT e.account_id FROM roster_entries e JOIN registrations r ON r.id=e.registration_id WHERE r.tournament_id=$1 AND r.status NOT IN ('Withdrawn','Cancelled') AND e.status='Active' AND e.account_id IS NOT NULL) recipients",[eventId,title,message]);
}
export async function notifyRegistration(client:PoolClient,registrationId:string,title:string,message:string){
  await client.query("INSERT INTO notifications(account_id,tournament_id,title,message) SELECT DISTINCT recipient,tournament_id,$2,$3 FROM (SELECT tm.captain_id recipient,r.tournament_id FROM registrations r JOIN teams tm ON tm.id=r.team_id WHERE r.id=$1 UNION SELECT e.account_id,r.tournament_id FROM roster_entries e JOIN registrations r ON r.id=e.registration_id WHERE r.id=$1 AND e.status='Active' AND e.account_id IS NOT NULL) recipients",[registrationId,title,message]);
}
export function notificationRouter(pool:Pool){const router=Router();
  router.get('/me/notifications',requireAccount(pool),async(_req,res)=>{const found=await pool.query('SELECT n.id,n.tournament_id,n.title,n.message,n.created_at,n.read_at,t.name tournament_name FROM notifications n JOIN tournaments t ON t.id=n.tournament_id WHERE n.account_id=$1 ORDER BY n.created_at DESC,n.id DESC LIMIT 100',[res.locals.admin.id]);return res.json({data:found.rows});});
  router.post('/me/notifications/:id/read',requireAccount(pool),requireCsrf(pool),async(req,res)=>{if(!z.uuid().safeParse(req.params.id).success)return res.sendStatus(400);const found=await pool.query('UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE id=$1 AND account_id=$2 RETURNING id,read_at',[req.params.id,res.locals.admin.id]);if(!found.rowCount)return res.sendStatus(404);return res.json({data:found.rows[0]});});
  return router;
}

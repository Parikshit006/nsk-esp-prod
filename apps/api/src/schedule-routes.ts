import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requireAdmin,requireCsrf } from './auth.js';
import { notifyTournament } from './notification-routes.js';
const schema=z.object({expected_version:z.number().int().positive(),scheduled_at:z.iso.datetime({offset:true}),ends_at:z.iso.datetime({offset:true}),reason:z.string().trim().min(10).max(1000)}).strict();
export function scheduleRouter(pool:Pool){const router=Router();
  router.post('/admin/matches/:id/reschedule',requireAdmin(pool),requireCsrf(pool),async(req,res)=>{
    const id=z.uuid().safeParse(req.params.id),body=schema.safeParse(req.body);if(!id.success||!body.success)return res.status(400).json({error:{message:'Provide valid times with timezone, current version and a reason.'}});
    const client=await pool.connect();try{
      await client.query('BEGIN');
      const found=await client.query<{id:string;tournament_id:string;match_no:number;status:string;version:number;scheduled_at:Date;ends_at:Date;event_status:string;event_start:Date;event_end:Date}>("SELECT m.*,t.status event_status,t.starts_at event_start,t.ends_at event_end FROM matches m JOIN tournaments t ON t.id=m.tournament_id WHERE m.id=$1 FOR UPDATE OF t,m",[id.data]);const match=found.rows[0];
      const fail=async(message:string,status=409)=>{await client.query('ROLLBACK');return res.status(status).json({error:{message,correlation_id:res.locals.correlationId}});};
      if(!match)return fail('Match not found.',404);if(match.version!==body.data.expected_version)return fail('Match changed. Reload before rescheduling.');
      if(!['Scheduled','Ready'].includes(match.status)||!['Draft','Published','RegistrationOpen','RegistrationClosed','InProgress'].includes(match.event_status))return fail('Only a round that has not started can be rescheduled.');
      const start=new Date(body.data.scheduled_at),end=new Date(body.data.ends_at);
      if(start.getTime()<=Date.now()||end<=start||!match.event_start||!match.event_end||start<match.event_start||end>match.event_end)return fail('The new round must be in the future and fit inside the tournament window.');
      const overlap=await client.query("SELECT 1 FROM matches WHERE tournament_id=$1 AND id<>$2 AND status<>'Cancelled' AND scheduled_at<$4 AND ends_at>$3",[match.tournament_id,match.id,start,end]);if(overlap.rowCount)return fail('The new time overlaps another round.');
      const credential=await client.query<{id:string;version_no:number;iv:Buffer;ciphertext:Buffer;auth_tag:Buffer;release_at:Date}>("SELECT * FROM match_credentials WHERE match_id=$1 AND status='Set' FOR UPDATE",[match.id]);
      if(credential.rows[0]){const c=credential.rows[0],release=new Date(c.release_at.getTime()+start.getTime()-match.scheduled_at.getTime());
        await client.query("UPDATE match_credentials SET status='Superseded' WHERE id=$1",[c.id]);
        const latest=await client.query<{n:number}>('SELECT max(version_no)::int n FROM match_credentials WHERE match_id=$1',[match.id]);
        await client.query("INSERT INTO match_credentials(id,match_id,version_no,iv,ciphertext,auth_tag,release_at,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'Set',$8)",[randomUUID(),match.id,latest.rows[0]!.n+1,c.iv,c.ciphertext,c.auth_tag,release,res.locals.admin.id]);
      }
      await client.query("UPDATE matches SET scheduled_at=$1,ends_at=$2,status='Scheduled',version=version+1 WHERE id=$3",[start,end,match.id]);
      await notifyTournament(client,match.tournament_id,`Match ${match.match_no} rescheduled`,`The round now starts at ${start.toISOString()} and ends at ${end.toISOString()}. Any configured room-detail release moved by the same interval. Check the event schedule before joining.`);
      await client.query("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_value,after_value) VALUES($1,$2,'match.rescheduled','match',$3,$4,$5)",[randomUUID(),res.locals.admin.id,match.id,JSON.stringify({scheduled_at:match.scheduled_at,ends_at:match.ends_at}),JSON.stringify({...body.data,status:'Scheduled'})]);
      await client.query('COMMIT');return res.json({data:{id:match.id,status:'Scheduled',version:match.version+1,scheduled_at:start,ends_at:end}});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });return router;
}

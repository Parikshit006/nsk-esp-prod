import {randomUUID} from 'node:crypto';
import {Router} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
import {requireAccount,requireCsrf} from './auth.js';

const profileSchema=z.object({ign_raw:z.string().trim().min(1).max(80),game_uid:z.string().trim().min(1).max(80).nullable()}).strict();

export function gameProfileRouter(pool:Pool){
  const router=Router();
  router.get('/me/game-profile',requireAccount(pool),async(_req,res)=>{
    const found=await pool.query('SELECT ign_raw,game_uid,updated_at FROM game_profiles WHERE account_id=$1',[res.locals.admin.id]);
    return res.json({data:found.rows[0]??null});
  });
  router.put('/me/game-profile',requireAccount(pool),requireCsrf(pool),async(req,res)=>{
    if(!res.locals.admin.email_verified)return res.status(403).json({error:{code:'EMAIL_VERIFICATION_REQUIRED',message:'Verify your email before saving your game profile.',correlation_id:res.locals.correlationId}});
    const parsed=profileSchema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:{code:'VALIDATION_FAILED',message:'Enter an in-game name and an optional game UID.',correlation_id:res.locals.correlationId}});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const before=await client.query('SELECT ign_raw,game_uid FROM game_profiles WHERE account_id=$1 FOR UPDATE',[res.locals.admin.id]);
      const saved=await client.query('INSERT INTO game_profiles(account_id,ign_raw,game_uid) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET ign_raw=excluded.ign_raw,game_uid=excluded.game_uid,updated_at=now() RETURNING ign_raw,game_uid,updated_at',[res.locals.admin.id,parsed.data.ign_raw,parsed.data.game_uid]);
      await client.query('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),res.locals.admin.id,'game_profile.saved','account',res.locals.admin.id,before.rows[0]?JSON.stringify(before.rows[0]):null,JSON.stringify(parsed.data)]);
      await client.query('COMMIT');
      return res.json({data:saved.rows[0]});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  return router;
}

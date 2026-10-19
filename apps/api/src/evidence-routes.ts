import { createHash, randomUUID } from 'node:crypto';
import express, { Router, type Response } from 'express';
import type { Pool } from 'pg';
import sharp from 'sharp';
import { z } from 'zod';
import { requireAdmin, requireCsrf } from './auth.js';

const uuid=z.uuid();
function fail(res:Response,status:number,code:string,message:string){return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId}});}

export function evidenceRouter(pool:Pool){
  const router=Router();
  router.get('/admin/matches/:id/evidence',requireAdmin(pool),async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid match ID.');
    const result=await pool.query('SELECT e.id,e.match_id,e.attempt_id,a.attempt_no,e.sha256,e.mime,e.width,e.height,e.created_at FROM match_evidence e JOIN match_attempts a ON a.id=e.attempt_id WHERE e.match_id=$1 ORDER BY e.created_at,e.id',[id.data]);return res.json({data:result.rows});
  });
  router.get('/admin/evidence/:id/image',requireAdmin(pool),async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid evidence ID.');
    const result=await pool.query<{content:Buffer;mime:string;sha256:string}>('SELECT content,mime,sha256 FROM match_evidence WHERE id=$1',[id.data]);const row=result.rows[0];if(!row)return fail(res,404,'NOT_FOUND','Evidence not found.');
    res.setHeader('Content-Type',row.mime);res.setHeader('Content-Disposition','inline; filename="match-evidence"');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('ETag',`"${row.sha256}"`);return res.send(row.content);
  });
  router.post('/admin/matches/:id/evidence',requireAdmin(pool),requireCsrf(pool),express.raw({type:['image/png','image/jpeg'],limit:'5mb'}),async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid match ID.');
    const content=req.body;if(!Buffer.isBuffer(content)||content.length===0||content.length>5*1024*1024)return fail(res,400,'VALIDATION_FAILED','Upload a PNG or JPEG screenshot up to 5 MB.');
    let format:string|undefined,width:number|undefined,height:number|undefined;try{const metadata=await sharp(content,{failOn:'error',limitInputPixels:100_000_000}).metadata();format=metadata.format;width=metadata.width;height=metadata.height;await sharp(content,{failOn:'error',limitInputPixels:100_000_000}).stats();}catch{return fail(res,400,'VALIDATION_FAILED','Screenshot could not be decoded.');}
    const mime=format==='png'?'image/png':format==='jpeg'?'image/jpeg':null;if(!mime||req.headers['content-type']?.split(';')[0]!==mime||!width||!height||width>10000||height>10000)return fail(res,400,'VALIDATION_FAILED','Upload a valid PNG or JPEG screenshot with matching content type.');
    const digest=createHash('sha256').update(content).digest('hex');const client=await pool.connect();try{await client.query('BEGIN');const match=await client.query<{current_attempt_id:string;status:string}>('SELECT current_attempt_id,status FROM matches WHERE id=$1 FOR UPDATE',[id.data]);if(!match.rows[0]){await client.query('ROLLBACK');return fail(res,404,'NOT_FOUND','Match not found.');}
      const duplicate=await client.query<{id:string;match_id:string;attempt_id:string;sha256:string;mime:string;width:number;height:number}>('SELECT id,match_id,attempt_id,sha256,mime,width,height FROM match_evidence WHERE attempt_id=$1 AND sha256=$2',[match.rows[0].current_attempt_id,digest]);if(duplicate.rows[0]){await client.query('COMMIT');res.setHeader('Idempotency-Replayed','true');return res.status(200).json({data:duplicate.rows[0]});}
      if(!['AwaitingEvidence','UnderReview','Verified','Published'].includes(match.rows[0].status)){await client.query('ROLLBACK');return fail(res,409,'INVALID_TRANSITION','Finish the match before adding result evidence.');}
      const evidenceId=randomUUID();await client.query('INSERT INTO match_evidence(id,match_id,attempt_id,sha256,mime,width,height,content,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[evidenceId,id.data,match.rows[0].current_attempt_id,digest,mime,width,height,content,res.locals.admin.id]);await client.query('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),res.locals.admin.id,'evidence.uploaded','match_evidence',evidenceId,JSON.stringify({match_id:id.data,attempt_id:match.rows[0].current_attempt_id,sha256:digest,mime,width,height})]);await client.query('COMMIT');return res.status(201).json({data:{id:evidenceId,match_id:id.data,attempt_id:match.rows[0].current_attempt_id,sha256:digest,mime,width,height}});
    }catch(error){await client.query('ROLLBACK');if((error as {code?:string}).code==='23505')return fail(res,409,'DUPLICATE','This screenshot was already uploaded for the current attempt.');throw error;}finally{client.release();}
  });
  return router;
}

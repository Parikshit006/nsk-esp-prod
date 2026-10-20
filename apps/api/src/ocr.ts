import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Pool } from 'pg';
import sharp from 'sharp';
import { createWorker, OEM, PSM } from 'tesseract.js';
import {detectResultLayout,extractKillHints,type ResultLayout} from './result-layout.js';

export type OcrOutput={text:string;confidence:number;lines:{text:string;confidence:number;box:{x0:number;y0:number;x1:number;y1:number}}[];layout?:ResultLayout|null;warning:string};
export async function recognizeEvidence(content:Buffer):Promise<OcrOutput>{
  const require=createRequire(import.meta.url);
  const langPath=join(dirname(require.resolve('@tesseract.js-data/eng/package.json')),'4.0.0');
  let initializing=true;
  let initializationTimer:ReturnType<typeof setTimeout>|undefined;
  const creation=createWorker('eng',OEM.LSTM_ONLY,{langPath,cacheMethod:'none',gzip:true,errorHandler:()=>{}});
  void creation.then(worker=>{if(!initializing)void worker.terminate();}).catch(()=>{});
  const worker=await Promise.race([creation,new Promise<never>((_,reject)=>{initializationTimer=setTimeout(()=>reject(new Error('OCR initialization timeout')),15000);})]).catch(error=>{initializing=false;throw error;}).finally(()=>clearTimeout(initializationTimer));
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    return await Promise.race([ (async()=>{
      await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
      const image=await sharp(content,{limitInputPixels:20_000_000}).resize({width:2400,withoutEnlargement:false}).grayscale().normalise().png().toBuffer();
      const {data}=await worker.recognize(image,{}, {text:true,blocks:true});
      const layout=await detectResultLayout(content);
      if(layout){
        const normalized=await sharp(content,{limitInputPixels:20_000_000}).resize(1600,717,{fit:'fill'}).toBuffer();
        for(const row of layout.rows){
          const cropped=await sharp(normalized).extract({left:row.left,top:row.top,width:row.width,height:row.height}).resize({width:row.width*4}).grayscale().normalise().png().toBuffer();
          const recognized=await worker.recognize(cropped,{}, {text:true,blocks:true});
          row.ocr_lines=(recognized.data.blocks??[]).flatMap(block=>block.paragraphs.flatMap(paragraph=>paragraph.lines.map(line=>({text:line.text.trim(),confidence:line.confidence,box:line.bbox})))).filter(line=>line.text).slice(0,24);
          row.kill_hints=extractKillHints(row);
        }
      }
      return {text:data.text.slice(0,30000),confidence:data.confidence,lines:(data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.map(l=>({text:l.text,confidence:l.confidence,box:l.bbox})))).slice(0,500),layout,warning:'Machine reading only. Decorated names, clipped rows and elimination counts can be wrong or missing. Confirm every player, placement and count against the original. Confidence is not measured accuracy.'};
    })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('OCR timeout')),90000);})]);
  }finally{clearTimeout(timer);await worker.terminate();}
}

/** Lease tokens prevent an abandoned worker from overwriting a later attempt. */
export async function runOcrJob(pool:Pool,recognize=recognizeEvidence){
  await pool.query("UPDATE ocr_jobs SET status='Failed',lease_id=NULL,lease_until=NULL,completed_at=now() WHERE status='Running' AND lease_until<now() AND attempts>=3");
  const token=randomUUID();
  const claimed=await pool.query<{id:string;evidence_id:string}>("UPDATE ocr_jobs SET status='Running',attempts=attempts+1,lease_id=$1,lease_until=now()+interval '3 minutes' WHERE id=(SELECT id FROM ocr_jobs WHERE (status='Queued' OR (status='Running' AND lease_until<now())) AND attempts<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,evidence_id",[token]);
  const job=claimed.rows[0];if(!job)return false;
  try{
    const evidence=await pool.query<{content:Buffer|null}>('SELECT content FROM match_evidence WHERE id=$1',[job.evidence_id]);
    if(!evidence.rows[0]?.content)throw new Error('Evidence image expired.');
    const output=await recognize(evidence.rows[0].content);
    await pool.query("UPDATE ocr_jobs SET status='Succeeded',output=$1,completed_at=now(),lease_id=NULL,lease_until=NULL WHERE id=$2 AND lease_id=$3",[JSON.stringify(output),job.id,token]);
  }catch{
    await pool.query("UPDATE ocr_jobs SET status=CASE WHEN attempts<3 THEN 'Queued' ELSE 'Failed' END,completed_at=CASE WHEN attempts>=3 THEN now() ELSE NULL END,lease_id=NULL,lease_until=NULL WHERE id=$1 AND lease_id=$2",[job.id,token]);
  }
  return true;
}
export function startOcrWorker(pool:Pool){
  let stopped=false;let pending:Promise<unknown>=Promise.resolve();
  const tick=()=>{pending=runOcrJob(pool).catch(()=>{}).finally(()=>{if(!stopped)timer=setTimeout(tick,2000);});};
  let timer=setTimeout(tick,1000);
  return async()=>{stopped=true;clearTimeout(timer);await pending;};
}

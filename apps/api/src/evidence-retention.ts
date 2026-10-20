import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';

type Eligible={id:string};
const eligibleSql=`SELECT t.id FROM tournaments t
  WHERE t.status IN ('Completed','Archived','Cancelled')
    AND t.evidence_retention_due_at <= $1 AND t.evidence_hold_reason IS NULL
    AND NOT EXISTS (SELECT 1 FROM refund_reviews r WHERE r.tournament_id=t.id AND r.status='Pending')
    AND NOT EXISTS (SELECT 1 FROM result_disputes d WHERE d.tournament_id=t.id AND d.status='Open')
    AND (EXISTS (SELECT 1 FROM payment_proofs p WHERE p.tournament_id=t.id AND p.content IS NOT NULL)
      OR EXISTS (SELECT 1 FROM match_evidence e JOIN matches m ON m.id=e.match_id WHERE m.tournament_id=t.id AND e.content IS NOT NULL)
      OR EXISTS (SELECT 1 FROM result_dispute_evidence e JOIN result_disputes d ON d.id=e.dispute_id WHERE d.tournament_id=t.id AND e.content IS NOT NULL)
      OR EXISTS (SELECT 1 FROM ocr_jobs o JOIN match_evidence e ON e.id=o.evidence_id JOIN matches m ON m.id=e.match_id WHERE m.tournament_id=t.id AND o.output IS NOT NULL))
  ORDER BY t.evidence_retention_due_at,t.id LIMIT $2`;

export async function previewEvidenceRetention(pool:Pool,at=new Date(),limit=100){
  const result=await pool.query<Eligible>(eligibleSql,[at,limit]);
  return result.rows.map(row=>row.id);
}

/** Clears private image bytes and OCR text. Final results, hashes and review decisions remain. */
export async function purgeExpiredEvidence(pool:Pool,at=new Date(),limit=50){
  const ids=await previewEvidenceRetention(pool,at,limit);
  const report:{tournament_id:string;payment_proofs:number;match_screenshots:number;dispute_screenshots:number;ocr_readings:number}[]=[];
  for(const id of ids){
    const client:PoolClient=await pool.connect();
    try{
      await client.query('BEGIN');
      const locked=await client.query<{id:string}>(`SELECT t.id FROM tournaments t WHERE t.id=$1 AND t.status IN ('Completed','Archived','Cancelled') AND t.evidence_retention_due_at<=$2 AND t.evidence_hold_reason IS NULL
        AND NOT EXISTS (SELECT 1 FROM refund_reviews r WHERE r.tournament_id=t.id AND r.status='Pending')
        AND NOT EXISTS (SELECT 1 FROM result_disputes d WHERE d.tournament_id=t.id AND d.status='Open') FOR UPDATE OF t`,[id,at]);
      if(!locked.rowCount){await client.query('ROLLBACK');continue;}
      await client.query("UPDATE ocr_jobs SET status='Failed',lease_id=NULL,lease_until=NULL,completed_at=$2 WHERE evidence_id IN (SELECT e.id FROM match_evidence e JOIN matches m ON m.id=e.match_id WHERE m.tournament_id=$1) AND status IN ('Queued','Running')",[id,at]);
      const ocr=await client.query("UPDATE ocr_jobs SET output=NULL,purged_at=$2 WHERE evidence_id IN (SELECT e.id FROM match_evidence e JOIN matches m ON m.id=e.match_id WHERE m.tournament_id=$1) AND output IS NOT NULL",[id,at]);
      const payment=await client.query('UPDATE payment_proofs SET content=NULL,purged_at=$2 WHERE tournament_id=$1 AND content IS NOT NULL',[id,at]);
      const match=await client.query('UPDATE match_evidence e SET content=NULL,purged_at=$2 FROM matches m WHERE e.match_id=m.id AND m.tournament_id=$1 AND e.content IS NOT NULL',[id,at]);
      const dispute=await client.query('UPDATE result_dispute_evidence e SET content=NULL,purged_at=$2 FROM result_disputes d WHERE e.dispute_id=d.id AND d.tournament_id=$1 AND e.content IS NOT NULL',[id,at]);
      const counts={tournament_id:id,payment_proofs:payment.rowCount??0,match_screenshots:match.rowCount??0,dispute_screenshots:dispute.rowCount??0,ocr_readings:ocr.rowCount??0};
      if(counts.payment_proofs+counts.match_screenshots+counts.dispute_screenshots+counts.ocr_readings>0){
        await client.query("INSERT INTO audit_events(id,action,entity_type,entity_id,after_value) VALUES($1,'evidence.retention_purged','tournament',$2,$3)",[randomUUID(),id,JSON.stringify(counts)]);
        report.push(counts);
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  return report;
}

export function startEvidenceRetention(pool:Pool,log:(entry:string)=>void){
  let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;let pending:Promise<unknown>=Promise.resolve();
  const tick=()=>{let nextDelay=24*60*60*1000;pending=purgeExpiredEvidence(pool).then(rows=>{if(rows.length)log(JSON.stringify({event:'evidence_retention_purged',tournaments:rows.length}));if(rows.length>=50)nextDelay=60_000;}).catch(()=>log(JSON.stringify({event:'evidence_retention_failed'}))).finally(()=>{if(!stopped)timer=setTimeout(tick,nextDelay);});};
  timer=setTimeout(tick,60_000);
  return async()=>{stopped=true;clearTimeout(timer);await pending;};
}

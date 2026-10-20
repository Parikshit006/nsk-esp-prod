import 'dotenv/config';
import {Pool} from 'pg';
import {previewEvidenceRetention,purgeExpiredEvidence} from './evidence-retention.js';

const source=process.env.DATABASE_URL;
if(!source||!['postgres:','postgresql:'].includes(new URL(source).protocol))throw new Error('Set a PostgreSQL DATABASE_URL.');
const pool=new Pool({connectionString:source,connectionTimeoutMillis:3000,max:5});
try{
  if(process.argv[2]==='--preview'){
    const ids=await previewEvidenceRetention(pool);
    process.stdout.write(`${JSON.stringify({due_tournaments:ids.length,tournament_ids:ids})}\n`);
  }else if(process.argv.length===2){
    const rows=await purgeExpiredEvidence(pool);
    process.stdout.write(`${JSON.stringify({purged_tournaments:rows.length,rows})}\n`);
  }else throw new Error('Use no argument to run or --preview to list due tournaments.');
}finally{await pool.end();}

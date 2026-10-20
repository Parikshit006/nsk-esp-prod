import type {Pool} from 'pg';
import {decryptRoom,encryptRoom} from './credential-crypto.js';

/** Run during a room-write maintenance window; all versions move atomically. */
export async function rotateCredentialKey(pool:Pool,current:Buffer,previous:Buffer){
  if(current.length!==32||previous.length!==32||current.equals(previous))throw new Error('Provide distinct 32-byte current and previous keys.');
  const client=await pool.connect();
  let converted=0,alreadyCurrent=0;
  try{
    await client.query('BEGIN');
    let lastId='00000000-0000-0000-0000-000000000000';
    for(;;){
      const rows=await client.query<{id:string;iv:Buffer;ciphertext:Buffer;auth_tag:Buffer}>("SELECT id,iv,ciphertext,auth_tag FROM match_credentials WHERE id>$1 ORDER BY id LIMIT 100 FOR UPDATE",[lastId]);
      if(!rows.rowCount)break;
      for(const row of rows.rows){
        lastId=row.id;
        try{decryptRoom(current,row);alreadyCurrent++;continue;}catch{/* Try the previous key, or roll back if it cannot decrypt. */}
        const details=decryptRoom(previous,row),encrypted=encryptRoom(current,details);
        await client.query('UPDATE match_credentials SET iv=$1,ciphertext=$2,auth_tag=$3 WHERE id=$4',[encrypted.iv,encrypted.ciphertext,encrypted.auth_tag,row.id]);
        decryptRoom(current,encrypted);
        converted++;
      }
    }
    await client.query('COMMIT');
    return {converted,already_current:alreadyCurrent};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

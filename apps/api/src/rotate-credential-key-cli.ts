import 'dotenv/config';
import {Pool} from 'pg';
import {readConfig} from './config.js';
import {rotateCredentialKey} from './credential-key-rotation.js';

async function main(){
  const config=readConfig(process.env);
  if(!config.CREDENTIAL_ENCRYPTION_KEY||!config.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS)throw new Error('Both current and previous room keys are required.');
  const pool=new Pool({connectionString:config.DATABASE_URL,connectionTimeoutMillis:3000,max:2});
  try{
    const result=await rotateCredentialKey(pool,Buffer.from(config.CREDENTIAL_ENCRYPTION_KEY,'hex'),Buffer.from(config.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS,'hex'));
    process.stdout.write(`Room credential versions converted: ${result.converted}; already current: ${result.already_current}.\n`);
  }finally{await pool.end();}
}
main().catch(()=>{process.stderr.write('Room key rotation failed; transaction rolled back. Check keys and database before retrying.\n');process.exitCode=1;});

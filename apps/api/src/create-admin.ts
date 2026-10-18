import 'dotenv/config';
import { Pool } from 'pg';
import { readConfig } from './config.js';
import { createAdmin } from './auth.js';

async function readSecret():Promise<string> {
  if(!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('An interactive terminal is required to enter the password privately.');
  process.stdout.write('Admin password (at least 12 characters): ');
  process.stdin.setRawMode(true);process.stdin.resume();
  let value='';
  try {
    return await new Promise<string>((resolve,reject)=>{
      const onData=(chunk:Buffer)=>{
        const key=chunk.toString('utf8');
        if(key==='\u0003') {process.stdin.off('data',onData);reject(new Error('Cancelled.'));return;}
        if(key==='\r'||key==='\n') {process.stdin.off('data',onData);process.stdout.write('\n');resolve(value);return;}
        if(key==='\u007f'||key==='\b') {value=value.slice(0,-1);return;}
        if(key.length===1&&key>=' ') value+=key;
      };
      process.stdin.on('data',onData);
    });
  } finally {process.stdin.setRawMode(false);process.stdin.pause();}
}
const email=process.argv[2];
if(!email) throw new Error('Usage: pnpm admin:create email@example.com');
const password=await readSecret();
const config=readConfig(process.env);
const pool=new Pool({connectionString:config.DATABASE_URL});
try {await createAdmin(pool,email,password);process.stdout.write('Administrator created.\n');}
finally {await pool.end();}

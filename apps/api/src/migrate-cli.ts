import 'dotenv/config';
import { Pool } from 'pg';
import { readConfig } from './config.js';
import { migrate } from './migrations.js';
const config=readConfig(process.env);
const pool=new Pool({connectionString:config.DATABASE_URL,connectionTimeoutMillis:3000});
try { await migrate(pool); process.stdout.write('Migrations applied.\n'); } finally { await pool.end(); }

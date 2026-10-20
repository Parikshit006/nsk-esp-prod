import 'dotenv/config';
import { Pool } from 'pg';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { startOcrWorker } from './ocr.js';
import {startRoomReleaseAlerts} from './room-release-alerts.js';
import {startEvidenceRetention} from './evidence-retention.js';
const config=readConfig(process.env);
const pool=new Pool({connectionString:config.DATABASE_URL,connectionTimeoutMillis:3000,statement_timeout:5000,max:10});
pool.on('error',()=>process.stderr.write('Database connection lost.\n'));
const stopOcr=startOcrWorker(pool);
const stopRoomAlerts=startRoomReleaseAlerts(pool);
const stopRetention=startEvidenceRetention(pool,entry=>process.stdout.write(entry+'\n'));
const server=createApp(config,pool,entry=>process.stdout.write(JSON.stringify(entry)+'\n')).listen(config.PORT,()=>process.stdout.write(`API listening on port ${config.PORT}\n`));
for(const signal of ['SIGTERM','SIGINT'] as const) process.on(signal,()=>{
  const timer=setTimeout(()=>process.exit(1),110000); timer.unref();
  server.close(()=>{ void Promise.all([stopOcr(),stopRoomAlerts(),stopRetention()]).then(()=>pool.end()).finally(()=>process.exit(0)); });
});

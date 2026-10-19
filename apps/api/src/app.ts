import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import type { Config } from './config.js';
import { publicConfigSchema } from '../../../packages/shared/contracts.js';
import { authRouter } from './auth.js';
import type { RecoverySender } from './mail.js';
import { rulesRouter } from './rules-routes.js';
import { adminTournamentRouter, publicTournamentRouter } from './tournament-routes.js';
import { participantRouter } from './participant-routes.js';
import { reviewRouter } from './review-routes.js';
import { accessRouter } from './access-routes.js';
import { matchRouter } from './match-routes.js';
import { evidenceRouter } from './evidence-routes.js';
import { resultRouter } from './result-routes.js';
import { paymentRouter } from './payment-routes.js';
import { finalizationRouter } from './finalization-routes.js';
import { disputeRouter } from './dispute-routes.js';
import { ocrRouter } from './ocr-routes.js';
import { notificationRouter } from './notification-routes.js';
import { scheduleRouter } from './schedule-routes.js';
import { refundRouter } from './refund-routes.js';
import { reopenRouter } from './reopen-routes.js';
import { organizerRouter } from './organizer-routes.js';
import { rosterChangeRouter } from './roster-change-routes.js';

export function createApp(config: Config, pool: Pool, log: (entry: object)=>void=()=>{},sendRecovery?:RecoverySender) {
  const app=express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req,res,next)=>{
    res.locals.correlationId=randomUUID();
    res.setHeader('X-Correlation-ID',res.locals.correlationId);
    res.setHeader('Cache-Control','no-store');
    res.on('finish',()=>log({event:'request',method:req.method,status:res.statusCode,correlation_id:res.locals.correlationId}));
    // Do not log URLs, query strings, bodies, cookies or authorization headers.
    const origin=req.headers.origin;
    if(origin && origin!==config.WEB_ORIGIN) { res.status(403).json(failure('FORBIDDEN','This origin is not allowed.',res.locals.correlationId)); return; }
    if(origin) { res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin'); res.setHeader('Access-Control-Allow-Credentials','true'); }
    if(req.method==='OPTIONS') { res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,PUT,OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,X-CSRF-Token,X-Payment-Reference,X-Payment-Amount-Minor,X-Transaction-ID'); res.sendStatus(204); return; }
    next();
  });
  app.use(express.json({limit:'32kb'}));
  app.get('/api/v1/health/live',(_req,res)=>res.json({data:{status:'alive'}}));
  app.get('/api/v1/meta/config',(_req,res)=>res.json({data:publicConfigSchema.parse({timezone:'Asia/Kolkata',uploads_enabled:true,registration_enabled:true,stage:'development'})}));
  app.use('/api/v1/auth',authRouter(config,pool,sendRecovery));
  app.use('/api/v1/admin',organizerRouter(config,pool,sendRecovery));
  app.use('/api/v1',rosterChangeRouter(pool));
  app.use('/api/v1/admin',rulesRouter(pool));
  app.use('/api/v1/admin/tournaments',adminTournamentRouter(pool));
  app.use('/api/v1/admin',reviewRouter(pool));
  app.use('/api/v1/tournaments',publicTournamentRouter(pool));
  app.use('/api/v1',participantRouter(pool));
  app.use('/api/v1',accessRouter(config,pool));
  app.use('/api/v1',matchRouter(pool));
  app.use('/api/v1',evidenceRouter(pool));
  app.use('/api/v1',resultRouter(pool));
  app.use('/api/v1',paymentRouter(pool));
  app.use('/api/v1',finalizationRouter(pool));
  app.use('/api/v1',disputeRouter(pool));
  app.use('/api/v1',ocrRouter(pool));
  app.use('/api/v1',notificationRouter(pool));
  app.use('/api/v1',scheduleRouter(pool));
  app.use('/api/v1',refundRouter(pool));
  app.use('/api/v1',reopenRouter(pool));
  app.get('/api/v1/health/ready',async(req,res)=>{
    const supplied=Buffer.from(req.headers.authorization??'');
    const expected=Buffer.from(`Bearer ${config.READINESS_TOKEN}`);
    if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) { res.status(401).json(failure('UNAUTHENTICATED','Operator authentication is required.',res.locals.correlationId)); return; }
    try {
      const result=await pool.query('SELECT schema_version FROM platform_metadata WHERE singleton=true');
      if(result.rows[0]?.schema_version!==22) throw new Error('Schema not ready');
      res.json({data:{status:'ready',database:'ready',stage:'development'}});
    } catch { res.status(503).json(failure('PROVIDER_UNAVAILABLE','The database is not ready. Check migrations and connectivity.',res.locals.correlationId)); }
  });
  app.use('/api',(_req,res)=>res.status(404).json(failure('NOT_FOUND','This endpoint does not exist.',res.locals.correlationId)));
  if(config.NODE_ENV==='production') {
    app.use(express.static(resolve('apps/web/dist')));
    app.get('/{*path}',(req,res,next)=>{ if(!req.accepts('html')) return next(); res.sendFile(resolve('apps/web/dist/index.html')); });
  }
  app.use((_req,res)=>res.status(404).json(failure('NOT_FOUND','This page does not exist.',res.locals.correlationId)));
  const onError: ErrorRequestHandler=(error,_req,res,_next)=>{
    const malformed=error instanceof SyntaxError && 'body' in error;
    const oversize=error?.type==='entity.too.large';
    res.status(malformed?400:oversize?413:500).json(failure(malformed||oversize?'VALIDATION_FAILED':'INTERNAL', malformed?'The request is not valid JSON.':oversize?'The request is too large.':'We could not complete the request. Use the reference ID when contacting the organizer.',res.locals.correlationId));
  };
  app.use(onError);
  return app;
}
function failure(code:string,message:string,correlation_id:string) { return {error:{code,message,correlation_id}}; }

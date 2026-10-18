import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { draftTournamentSchema, previewScore, ruleTemplateInputSchema, scoringRulesSchema, scoringSampleSchema } from '../../../packages/shared/rules.js';
import { requireAdmin, requireCsrf } from './auth.js';

const uuid=z.uuid();
const applyRulesSchema=z.object({expected_version:z.number().int().positive(),rules:scoringRulesSchema.optional(),template_revision_id:uuid.optional()}).strict().refine(v=>Number(v.rules!==undefined)+Number(v.template_revision_id!==undefined)===1,'Provide rules or a template revision.');
const reviseTemplateSchema=z.object({rules:scoringRulesSchema,expected_revision:z.number().int().positive()}).strict();
const confirmSchema=z.object({expected_version:z.number().int().positive()}).strict();
function fail(res:Response,status:number,code:string,message:string,details?:unknown) {return res.status(status).json({error:{code,message,correlation_id:res.locals.correlationId,...(details?{details}: {})}});}
function invalid(res:Response,parsed:z.ZodSafeParseError<unknown>) {return fail(res,400,'VALIDATION_FAILED','Check the highlighted fields.',parsed.error.issues.map(issue=>({field:issue.path.join('.'),issue:issue.message})));}
async function transaction<T>(pool:Pool,run:(client:PoolClient)=>Promise<T>):Promise<T> {const client=await pool.connect();try{await client.query('BEGIN');const result=await run(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
async function audit(client:PoolClient,actor:string,action:string,kind:string,id:string,before:unknown,after:unknown) {await client.query('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),actor,action,kind,id,before===null?null:JSON.stringify(before),after===null?null:JSON.stringify(after)]);}

export function rulesRouter(pool:Pool) {
  const router=Router();
  router.use(requireAdmin(pool));
  router.use((req,res,next)=>req.method==='GET'?next():requireCsrf(pool)(req,res,next));
  router.get('/rule-templates',async(_req,res)=>{
    const result=await pool.query('SELECT t.id,t.name,r.id revision_id,r.revision,r.config rules,r.created_at FROM rule_templates t JOIN LATERAL (SELECT * FROM rule_template_revisions WHERE template_id=t.id ORDER BY revision DESC LIMIT 1) r ON true ORDER BY t.name');
    res.json({data:result.rows});
  });
  router.post('/rule-templates',async(req,res)=>{
    const parsed=ruleTemplateInputSchema.safeParse(req.body);if(!parsed.success)return invalid(res,parsed);
    const duplicate=await pool.query('SELECT id FROM rule_templates WHERE lower(name)=lower($1)',[parsed.data.name]);
    if(duplicate.rowCount)return fail(res,409,'DUPLICATE','A template with this name already exists.');
    try {
      const data=await transaction(pool,async client=>{
        const id=randomUUID(),revisionId=randomUUID();
        await client.query('INSERT INTO rule_templates(id,name,created_by) VALUES($1,$2,$3)',[id,parsed.data.name,res.locals.admin.id]);
        await client.query('INSERT INTO rule_template_revisions(id,template_id,revision,config,created_by) VALUES($1,$2,1,$3,$4)',[revisionId,id,JSON.stringify(parsed.data.rules),res.locals.admin.id]);
        await audit(client,res.locals.admin.id,'template.created','rule_template',id,null,{name:parsed.data.name,revision:1});
        return {id,name:parsed.data.name,revision_id:revisionId,revision:1,rules:parsed.data.rules};
      });return res.status(201).json({data});
    } catch(error) {if((error as {code?:string}).code==='23505')return fail(res,409,'DUPLICATE','A template with this name already exists.');throw error;}
  });
  router.post('/rule-templates/:id/revisions',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),body=reviseTemplateSchema.safeParse(req.body);if(!id.success||!body.success)return fail(res,400,'VALIDATION_FAILED','Check the template and rules.');
    const data=await transaction(pool,async client=>{
      const template=await client.query('SELECT id,name FROM rule_templates WHERE id=$1 FOR UPDATE',[id.data]);if(!template.rows[0])return null;
      const current=await client.query<{revision:number}>('SELECT revision FROM rule_template_revisions WHERE template_id=$1 ORDER BY revision DESC LIMIT 1',[id.data]);
      if(current.rows[0]?.revision!==body.data.expected_revision)return 'stale' as const;
      const revision=body.data.expected_revision+1,revisionId=randomUUID();
      await client.query('INSERT INTO rule_template_revisions(id,template_id,revision,config,created_by) VALUES($1,$2,$3,$4,$5)',[revisionId,id.data,revision,JSON.stringify(body.data.rules),res.locals.admin.id]);
      await audit(client,res.locals.admin.id,'template.revised','rule_template',id.data,{revision:body.data.expected_revision},{revision});
      return {id:id.data,name:template.rows[0].name,revision_id:revisionId,revision,rules:body.data.rules};
    });
    if(data===null)return fail(res,404,'NOT_FOUND','Template not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','The template changed. Reload and try again.');return res.status(201).json({data});
  });
  router.get('/tournaments',async(_req,res)=>{
    const result=await pool.query("SELECT t.id,t.name,t.capacity,t.timezone,t.status,t.version,r.id ruleset_id,r.version_no rules_version,r.status rules_status FROM tournaments t LEFT JOIN LATERAL (SELECT * FROM tournament_rulesets WHERE tournament_id=t.id ORDER BY version_no DESC LIMIT 1) r ON true ORDER BY t.created_at DESC");
    res.json({data:result.rows});
  });
  router.post('/tournaments',async(req,res)=>{
    const parsed=draftTournamentSchema.safeParse(req.body);if(!parsed.success)return invalid(res,parsed);
    const id=randomUUID();await transaction(pool,async client=>{
      await client.query('INSERT INTO tournaments(id,name,capacity,timezone,created_by) VALUES($1,$2,$3,$4,$5)',[id,parsed.data.name,parsed.data.capacity,parsed.data.timezone,res.locals.admin.id]);
      await audit(client,res.locals.admin.id,'tournament.created','tournament',id,null,parsed.data);
    });return res.status(201).json({data:{id,...parsed.data,status:'Draft',version:1}});
  });
  router.get('/tournaments/:id/rulesets',async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success)return fail(res,400,'VALIDATION_FAILED','Invalid tournament ID.');
    const tournament=await pool.query('SELECT id,name,version FROM tournaments WHERE id=$1',[id.data]);if(!tournament.rows[0])return fail(res,404,'NOT_FOUND','Tournament not found.');
    const rules=await pool.query('SELECT id,version_no,status,config rules,source_template_revision_id,created_at,confirmed_at FROM tournament_rulesets WHERE tournament_id=$1 ORDER BY version_no DESC',[id.data]);
    return res.json({data:{tournament:tournament.rows[0],rulesets:rules.rows}});
  });
  router.post('/tournaments/:id/rulesets',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),body=applyRulesSchema.safeParse(req.body);if(!id.success||!body.success)return fail(res,400,'VALIDATION_FAILED','Check the tournament, rule source and version.');
    const data=await transaction(pool,async client=>{
      const tournament=await client.query<{version:number;status:string}>('SELECT version,status FROM tournaments WHERE id=$1 FOR UPDATE',[id.data]);if(!tournament.rows[0])return null;
      if(tournament.rows[0].version!==body.data.expected_version)return 'stale' as const;
      if(tournament.rows[0].status!=='Draft')return 'locked' as const;
      let rules=body.data.rules;const source=body.data.template_revision_id??null;
      if(source){const found=await client.query<{config:unknown}>('SELECT config FROM rule_template_revisions WHERE id=$1',[source]);if(!found.rows[0])return 'missing-template' as const;rules=scoringRulesSchema.parse(found.rows[0].config);}
      const latest=await client.query<{version_no:number}>('SELECT version_no FROM tournament_rulesets WHERE tournament_id=$1 ORDER BY version_no DESC LIMIT 1',[id.data]);
      const versionNo=(latest.rows[0]?.version_no??0)+1,rulesetId=randomUUID();
      await client.query('INSERT INTO tournament_rulesets(id,tournament_id,version_no,config,status,source_template_revision_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[rulesetId,id.data,versionNo,JSON.stringify(rules),'Draft',source,res.locals.admin.id]);
      await client.query('UPDATE tournaments SET version=version+1 WHERE id=$1',[id.data]);
      await audit(client,res.locals.admin.id,'ruleset.created','tournament_ruleset',rulesetId,null,{tournament_id:id.data,version_no:versionNo,source_template_revision_id:source,rules});
      return {id:rulesetId,tournament_id:id.data,version_no:versionNo,status:'Draft',rules,source_template_revision_id:source,tournament_version:body.data.expected_version+1};
    });
    if(data===null)return fail(res,404,'NOT_FOUND','Tournament not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Tournament changed. Reload and try again.');if(data==='locked')return fail(res,409,'INVALID_TRANSITION','Rules are locked for this tournament.');if(data==='missing-template')return fail(res,404,'NOT_FOUND','Template revision not found.');return res.status(201).json({data});
  });
  router.post('/rulesets/:id/confirm',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),body=confirmSchema.safeParse(req.body);if(!id.success||!body.success)return fail(res,400,'VALIDATION_FAILED','Check the ruleset and version.');
    const data=await transaction(pool,async client=>{
      const rules=await client.query<{tournament_id:string;status:string;config:unknown;version_no:number}>('SELECT tournament_id,status,config,version_no FROM tournament_rulesets WHERE id=$1',[id.data]);if(!rules.rows[0])return null;
      const tournament=await client.query<{version:number;status:string}>('SELECT version,status FROM tournaments WHERE id=$1 FOR UPDATE',[rules.rows[0].tournament_id]);
      if(tournament.rows[0]?.version!==body.data.expected_version)return 'stale' as const;
      const latest=await client.query<{version_no:number}>('SELECT version_no FROM tournament_rulesets WHERE tournament_id=$1 ORDER BY version_no DESC LIMIT 1',[rules.rows[0].tournament_id]);
      if(tournament.rows[0].status!=='Draft'||rules.rows[0].status!=='Draft'||latest.rows[0]?.version_no!==rules.rows[0].version_no)return 'locked' as const;
      scoringRulesSchema.parse(rules.rows[0].config);
      await client.query("UPDATE tournament_rulesets SET status='Confirmed',confirmed_at=now() WHERE id=$1",[id.data]);
      await client.query('UPDATE tournaments SET version=version+1 WHERE id=$1',[rules.rows[0].tournament_id]);
      await audit(client,res.locals.admin.id,'ruleset.confirmed','tournament_ruleset',id.data,{status:'Draft'},{status:'Confirmed'});
      return {id:id.data,status:'Confirmed',tournament_version:body.data.expected_version+1};
    });
    if(data===null)return fail(res,404,'NOT_FOUND','Ruleset not found.');if(data==='stale')return fail(res,409,'STALE_VERSION','Tournament changed. Reload and try again.');if(data==='locked')return fail(res,409,'INVALID_TRANSITION','Only the latest draft ruleset can be confirmed.');return res.json({data});
  });
  router.post('/rulesets/:id/preview',async(req,res)=>{
    const id=uuid.safeParse(req.params.id),sample=scoringSampleSchema.safeParse(req.body);if(!id.success||!sample.success)return fail(res,400,'VALIDATION_FAILED','Check the sample placement, kills and penalty.');
    const found=await pool.query<{config:unknown;version_no:number}>('SELECT config,version_no FROM tournament_rulesets WHERE id=$1',[id.data]);if(!found.rows[0])return fail(res,404,'NOT_FOUND','Ruleset not found.');
    const rules=scoringRulesSchema.parse(found.rows[0].config);
    return res.json({data:{illustrative:true,rules_version:found.rows[0].version_no,...previewScore(rules,sample.data)}});
  });
  return router;
}

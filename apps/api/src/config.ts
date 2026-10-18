import { z } from 'zod';
const databaseUrl = z.string().url().refine(value => ['postgres:', 'postgresql:'].includes(new URL(value).protocol));
const configSchema = z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'),
  PORT:z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN:z.string().url().refine(value => { const u=new URL(value); return ['http:','https:'].includes(u.protocol) && u.origin === value; }),
  DATABASE_URL:databaseUrl,
  READINESS_TOKEN:z.string().min(32).refine(value=>!value.startsWith('REPLACE_'))
}).superRefine((v,ctx)=>{
  if(v.NODE_ENV==='production' && !v.WEB_ORIGIN.startsWith('https://')) ctx.addIssue({code:'custom',path:['WEB_ORIGIN'],message:'HTTPS required'});
});
export type Config = z.infer<typeof configSchema>;
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const parsed=configSchema.safeParse(env);
  if(!parsed.success) throw new Error(`Invalid configuration: ${[...new Set(parsed.error.issues.map(i=>i.path.join('.')))].join(', ')}`);
  return parsed.data;
}

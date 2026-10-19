import { z } from 'zod';
const databaseUrl = z.string().url().refine(value => ['postgres:', 'postgresql:'].includes(new URL(value).protocol));
const configSchema = z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'),
  PORT:z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN:z.string().url().refine(value => { const u=new URL(value); return ['http:','https:'].includes(u.protocol) && u.origin === value; }),
  DATABASE_URL:databaseUrl,
  READINESS_TOKEN:z.string().min(32).refine(value=>!value.startsWith('REPLACE_')),
  CREDENTIAL_ENCRYPTION_KEY:z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
  SMTP_HOST:z.string().min(1).optional(),
  SMTP_PORT:z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER:z.string().min(1).optional(),
  SMTP_PASSWORD:z.string().min(1).optional(),
  SMTP_FROM:z.email().optional(),
  SMTP_SECURE:z.enum(['true','false']).default('false')
}).superRefine((v,ctx)=>{
  if(v.NODE_ENV==='production' && !v.WEB_ORIGIN.startsWith('https://')) ctx.addIssue({code:'custom',path:['WEB_ORIGIN'],message:'HTTPS required'});
  if(v.NODE_ENV==='production' && !v.CREDENTIAL_ENCRYPTION_KEY) ctx.addIssue({code:'custom',path:['CREDENTIAL_ENCRYPTION_KEY'],message:'Required in production'});
  if(v.NODE_ENV==='production' && (!v.SMTP_HOST||!v.SMTP_USER||!v.SMTP_PASSWORD||!v.SMTP_FROM)) ctx.addIssue({code:'custom',path:['SMTP_HOST'],message:'SMTP settings are required in production'});
});
export type Config = z.infer<typeof configSchema>;
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const parsed=configSchema.safeParse(env);
  if(!parsed.success) throw new Error(`Invalid configuration: ${[...new Set(parsed.error.issues.map(i=>i.path.join('.')))].join(', ')}`);
  return parsed.data;
}

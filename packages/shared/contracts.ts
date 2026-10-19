import { z } from 'zod';
export const publicConfigSchema = z.object({
  timezone: z.literal('Asia/Kolkata'),
  uploads_enabled: z.literal(true),
  registration_enabled: z.boolean(),
  stage: z.literal('development')
}).strict();
export type PublicConfig = z.infer<typeof publicConfigSchema>;
export const errorSchema = z.object({ error: z.object({ code:z.string(), message:z.string(), correlation_id:z.string().uuid(), details:z.array(z.object({field:z.string(),issue:z.string()})).optional() }) });
export const apiContracts = [
  { id:'API-190', method:'GET', path:'/api/v1/health/live', policy:'public', writes:false },
  { id:'API-191', method:'GET', path:'/api/v1/health/ready', policy:'operator-token', writes:false },
  { id:'API-194', method:'GET', path:'/api/v1/meta/config', policy:'public', writes:false }
] as const;

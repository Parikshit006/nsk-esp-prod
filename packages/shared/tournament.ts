import { z } from 'zod';
import { draftTournamentSchema } from './rules.js';

const instant=z.iso.datetime({offset:true});
const version=z.number().int().positive();
export const tournamentConfigInputSchema=draftTournamentSchema.extend({
  expected_version:version,
  format:z.string().trim().min(3).max(100),
  team_size:z.number().int().min(1).max(8),
  fee_minor:z.number().int().min(0).max(1_000_000_000),
  currency:z.string().regex(/^[A-Z]{3}$/,'Use an ISO currency code such as INR.'),
  registration_open_at:instant,
  registration_close_at:instant,
  starts_at:instant,
  ends_at:instant,
  rules_text:z.string().trim().min(20).max(10000),
  eligibility_text:z.string().trim().min(5).max(4000),
  payment_instructions:z.string().trim().max(4000),
  payment_proof_max_bytes:z.number().int().min(65536).max(10485760).nullable().optional()
}).strict().superRefine((value,ctx)=>{
  const dates=[value.registration_open_at,value.registration_close_at,value.starts_at,value.ends_at].map(value=>Date.parse(value));
  if(dates.some(Number.isNaN)||!((dates[0]??0)<(dates[1]??0)&&(dates[1]??0)<=(dates[2]??0)&&(dates[2]??0)<(dates[3]??0)))ctx.addIssue({code:'custom',path:['registration_open_at'],message:'Registration must open before it closes; the event must end after it starts.'});
  if(value.fee_minor>0&&!value.payment_instructions)ctx.addIssue({code:'custom',path:['payment_instructions'],message:'Payment instructions are required for a paid tournament.'});
  if(value.fee_minor>0&&!value.payment_proof_max_bytes)ctx.addIssue({code:'custom',path:['payment_proof_max_bytes'],message:'Set a proof upload limit for a paid tournament.'});
});
export const matchInputSchema=z.object({expected_version:version,match_no:z.number().int().min(1).max(1000),map:z.string().trim().min(2).max(80),scheduled_at:instant,ends_at:instant}).strict().refine(value=>Date.parse(value.scheduled_at)<Date.parse(value.ends_at),{path:['ends_at'],message:'Match end must be after start.'});
export const tournamentTransitionSchema=z.object({expected_version:version,action:z.enum(['publish','open_registration','close_registration','cancel','archive']),reason:z.string().trim().min(10).max(1000).optional()}).strict().refine(value=>!['cancel','archive'].includes(value.action)||Boolean(value.reason),{path:['reason'],message:'A reason is required.'});

import { z } from 'zod';

// Decimal strings avoid binary floating point in persisted scoring rules.
export const pointsSchema=z.string().regex(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,3})?$/,'Use a non-negative number with up to three decimal places.');
export const tieBreakSchema=z.enum(['wins','kills','recent_placement','admin_decision']);
export const scoringRulesSchema=z.object({
  points_per_kill:pointsSchema,
  placement_points:z.array(z.object({rank:z.number().int().min(1).max(100),points:pointsSchema}).strict()).min(1).max(100),
  kill_cap:z.number().int().min(0).max(10000).nullable(),
  tie_break_order:z.array(tieBreakSchema).min(1).max(4),
  disqualification_policy:z.enum(['keep_points_exclude_podium','void_all_results','void_from_disqualification']),
  cancelled_match_policy:z.enum(['exclude_all_results','retain_prior_published_results'])
}).strict().superRefine((value,ctx)=>{
  value.placement_points.forEach((row,index)=>{
    if(row.rank!==index+1) ctx.addIssue({code:'custom',path:['placement_points',index,'rank'],message:'Ranks must be consecutive from 1.'});
  });
  if(new Set(value.tie_break_order).size!==value.tie_break_order.length) ctx.addIssue({code:'custom',path:['tie_break_order'],message:'Tie-break fields must be unique.'});
  if(value.tie_break_order.at(-1)!=='admin_decision') ctx.addIssue({code:'custom',path:['tie_break_order'],message:'End with an admin decision for unresolved ties.'});
});
export type ScoringRules=z.infer<typeof scoringRulesSchema>;
export const ruleTemplateInputSchema=z.object({name:z.string().trim().min(3).max(100),rules:scoringRulesSchema}).strict();
export const draftTournamentSchema=z.object({name:z.string().trim().min(3).max(120),capacity:z.number().int().min(2).max(100),timezone:z.string().min(1).max(80).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}},'Use a valid time zone.')}).strict();
export const scoringSampleSchema=z.object({placement:z.number().int().min(1).max(100),player_kills:z.array(z.number().int().min(0).max(10000)).min(1).max(8),penalty:z.string().regex(/^-?(?:0|[1-9]\d{0,5})(?:\.\d{1,3})?$/)}).strict();

function milli(value:string):bigint {
  const negative=value.startsWith('-');
  const [whole='0',fraction='']= (negative?value.slice(1):value).split('.');
  const amount=BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0'));
  return negative?-amount:amount;
}
function display(value:bigint):string {
  const sign=value<0n?'-':'';const positive=value<0n?-value:value;
  return `${sign}${positive/1000n}.${(positive%1000n).toString().padStart(3,'0')}`.replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1');
}
export function previewScore(rules:ScoringRules,sample:z.infer<typeof scoringSampleSchema>) {
  const verifiedKills=sample.player_kills.reduce((sum,kills)=>sum+kills,0);
  const scoredKills=rules.kill_cap===null?verifiedKills:Math.min(verifiedKills,rules.kill_cap);
  const killPoints=BigInt(scoredKills)*milli(rules.points_per_kill);
  const placementPoints=milli(rules.placement_points[sample.placement-1]?.points??'0');
  const penalty=milli(sample.penalty);
  return {verified_kills:verifiedKills,scored_kills:scoredKills,kill_points:display(killPoints),placement_points:display(placementPoints),penalty:display(penalty),match_points:display(killPoints+placementPoints+penalty)};
}

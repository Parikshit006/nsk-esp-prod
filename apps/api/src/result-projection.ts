import { previewScore, scoringRulesSchema } from '../../../packages/shared/rules.js';

export type RawResultRow={registration_id:string;placement:number;player_kills:{roster_entry_id:string;kills:number}[];adjustment:string;match_no:number;slot_no:number;config:unknown};
export type Disqualification={registration_id:string;policy:'keep_points_exclude_podium'|'void_all_results'|'void_from_disqualification';effective_match_no:number|null};
export function projectRows<T extends RawResultRow>(rows:T[],decisions:Disqualification[]){
  const dq=new Map(decisions.map(item=>[item.registration_id,item]));
  const removed=(row:RawResultRow)=>{const decision=dq.get(row.registration_id);return decision?.policy==='void_all_results'||(decision?.policy==='void_from_disqualification'&&row.match_no>=(decision.effective_match_no??Number.MAX_SAFE_INTEGER));};
  const byMatch=new Map<number,RawResultRow[]>();for(const row of rows)byMatch.set(row.match_no,[...(byMatch.get(row.match_no)??[]),row]);
  const projected=[];for(const row of rows){if(removed(row))continue;const earlierRemoved=(byMatch.get(row.match_no)??[]).filter(item=>item.placement<row.placement&&removed(item)).length;const placement=row.placement-earlierRemoved;const rules=scoringRulesSchema.parse(row.config);const score=previewScore(rules,{placement,player_kills:row.player_kills.map(item=>item.kills),penalty:row.adjustment});projected.push({...row,placement,score_breakdown:score,disqualified:dq.has(row.registration_id)});}
  return projected;
}

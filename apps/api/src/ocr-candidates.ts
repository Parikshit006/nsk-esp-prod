import {ignForms} from './ign.js';

export type OcrLine={text:string;confidence:number;placement?:number;slot?:number};
export type RosterCandidate={roster_entry_id:string;registration_id:string;team_name:string;ign_raw:string};

/** Conservative name hints only. OCR lines never become score rows automatically. */
export function suggestRosterNames(lines:OcrLine[],roster:RosterCandidate[]){
  const playerKeys=roster.map(player=>({...player,key:ignForms(player.ign_raw).skeleton_key}));
  const matches=lines.slice(0,500).map((line,index)=>{
    const key=ignForms(line.text).skeleton_key;
    const found=playerKeys.filter(player=>player.key.length>=5&&key.includes(player.key));
    return {line,index,found};
  });
  const countByPlayer=new Map<string,number>();
  for(const item of matches)if(item.found.length===1){const id=item.found[0]!.roster_entry_id;countByPlayer.set(id,(countByPlayer.get(id)??0)+1);}
  const suggestions=matches.filter(item=>item.found.length===1&&countByPlayer.get(item.found[0]!.roster_entry_id)===1).map(item=>({roster_entry_id:item.found[0]!.roster_entry_id,registration_id:item.found[0]!.registration_id,team_name:item.found[0]!.team_name,ign_raw:item.found[0]!.ign_raw,ocr_line:item.line.text,line_index:item.index,ocr_confidence:item.line.confidence,...(item.line.placement?{placement:item.line.placement}:{}) ,...(item.line.slot!==undefined?{slot:item.line.slot}:{})}));
  return {suggestions,ambiguous_lines:matches.filter(item=>item.found.length>1).length,unmatched_roster_players:roster.length-suggestions.length,warning:'Possible roster-name matches only. A name in an OCR line does not verify identity, placement, participation or kills. Compare the original screenshot and confirm every score manually.'};
}

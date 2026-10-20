export type OcrDraftSource={
  output:{layout?:{rows:{placement:number;kill_hints:({kills:number;ocr_confidence:number}|null)[]}[]}|null}|null;
  candidates?:{suggestions:{registration_id:string;roster_entry_id:string;placement?:number;slot?:number}[]};
};
export type EligibleTeam={id:string;team_name?:string;roster:{id:string}[]};

/** Produce tentative fields only where a visible row identifies one eligible team. */
export function buildOcrPrefill(source:OcrDraftSource,teams:EligibleTeam[]){
  const placementByTeam:Record<string,string>={},killsByPlayer:Record<string,string>={};
  const rows=source.output?.layout?.rows??[],suggestions=source.candidates?.suggestions??[];
  const known=new Map(teams.map(team=>[team.id,new Set(team.roster.map(player=>player.id))]));
  const candidates=rows.filter(row=>row.placement>=1&&row.placement<=10).map(row=>{
    const hints=suggestions.filter(item=>item.placement===row.placement&&known.get(item.registration_id)?.has(item.roster_entry_id));
    const teamIds=[...new Set(hints.map(item=>item.registration_id))];
    return {row,hints,teamId:teamIds.length===1?teamIds[0]:null};
  });
  const counts=new Map<string,number>();for(const item of candidates)if(item.teamId)counts.set(item.teamId,(counts.get(item.teamId)??0)+1);
  for(const item of candidates){
    if(!item.teamId||counts.get(item.teamId)!==1)continue;
    placementByTeam[item.teamId]=String(item.row.placement);
    for(let slot=0;slot<Math.min(item.row.kill_hints.length,4);slot++){
      const hint=item.row.kill_hints[slot];if(!hint||hint.ocr_confidence<70)continue;
      const matched=item.hints.filter(player=>player.registration_id===item.teamId&&player.slot===slot);
      if(matched.length===1&&Number.isInteger(hint.kills)&&hint.kills>=0&&hint.kills<=99)killsByPlayer[matched[0]!.roster_entry_id]=String(hint.kills);
    }
  }
  return {placementByTeam,killsByPlayer,visibleRows:candidates.length,matchedTeams:Object.keys(placementByTeam).length,suggestedKills:Object.keys(killsByPlayer).length};
}

/** Explicit row choices take precedence over tentative name matches. Kills are carried only for unchanged name matches. */
export function buildReviewedOcrPrefill(prefill:ReturnType<typeof buildOcrPrefill>,reviewed:Record<number,string>,teams:EligibleTeam[]){
  const validTeams=new Set(teams.map(team=>team.id));
  const selections=Object.entries(reviewed).map(([rank,id])=>({rank:Number(rank),id})).filter(item=>Number.isInteger(item.rank)&&item.rank>=1&&item.rank<=10&&validTeams.has(item.id));
  const chosenTeams=new Set(selections.map(item=>item.id));
  if(chosenTeams.size!==selections.length)return null;
  const chosenRanks=new Set(selections.map(item=>String(item.rank)));
  const placementByTeam:Record<string,string>={};
  for(const [teamId,rank] of Object.entries(prefill.placementByTeam))if(!chosenTeams.has(teamId)&&!chosenRanks.has(rank))placementByTeam[teamId]=rank;
  for(const item of selections)placementByTeam[item.id]=String(item.rank);
  const unchanged=new Set(Object.keys(placementByTeam).filter(teamId=>placementByTeam[teamId]===prefill.placementByTeam[teamId]));
  const killsByPlayer:Record<string,string>={};
  for(const team of teams.filter(item=>unchanged.has(item.id)))for(const player of team.roster){const hint=prefill.killsByPlayer[player.id];if(hint!==undefined)killsByPlayer[player.id]=hint;}
  return {placementByTeam,killsByPlayer,visibleRows:prefill.visibleRows,matchedTeams:Object.keys(placementByTeam).length,suggestedKills:Object.keys(killsByPlayer).length};
}

export function mergeOcrPrefill(currentPlacements:Record<string,string>,currentKills:Record<string,string>,prefill:ReturnType<typeof buildOcrPrefill>,teams:EligibleTeam[]){
  const placements={...currentPlacements},kills={...currentKills},accepted=new Set<string>();
  for(const [teamId,placement] of Object.entries(prefill.placementByTeam)){
    if(placements[teamId]&&placements[teamId]!==placement)continue;
    if(Object.entries(placements).some(([other,value])=>other!==teamId&&value===placement))continue;
    placements[teamId]=placement;accepted.add(teamId);
  }
  for(const team of teams.filter(item=>accepted.has(item.id)))for(const player of team.roster){const suggestion=prefill.killsByPlayer[player.id];if(suggestion!==undefined&&!kills[player.id])kills[player.id]=suggestion;}
  return {placements,kills,addedTeams:accepted.size};
}

export function assignHiddenPlacement(current:Record<string,string>,rank:11|12,teamId:string,teams:EligibleTeam[]){
  const next={...current};for(const [id,value] of Object.entries(next))if(value===String(rank))delete next[id];
  if(teamId){if(!teams.some(team=>team.id===teamId)||current[teamId]&&current[teamId]!==String(rank))return current;next[teamId]=String(rank);}
  return next;
}

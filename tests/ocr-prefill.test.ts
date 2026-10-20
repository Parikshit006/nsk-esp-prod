import {expect,it} from 'vitest';
import {assignHiddenPlacement,buildOcrPrefill,mergeOcrPrefill} from '../apps/web/src/ocr-prefill.js';

it('only prepares identified visible teams and readable kills; hidden and ambiguous rows stay manual',()=>{
  const teams=Array.from({length:12},(_,index)=>({id:`team-${index+1}`,roster:[{id:`player-${index+1}`}] }));
  const rows=Array.from({length:10},(_,index)=>({placement:index+1,kill_hints:[{kills:index,ocr_confidence:90},null,null,null]}));
  const source={output:{layout:{rows}},candidates:{suggestions:[
    {placement:1,slot:0,registration_id:'team-1',roster_entry_id:'player-1'},
    {placement:2,slot:0,registration_id:'team-2',roster_entry_id:'player-2'},
    {placement:3,slot:0,registration_id:'team-2',roster_entry_id:'player-2'},
    {placement:4,slot:0,registration_id:'team-4',roster_entry_id:'player-4'},
    {placement:4,slot:1,registration_id:'team-5',roster_entry_id:'player-5'},
    {placement:10,slot:0,registration_id:'team-10',roster_entry_id:'player-10'},
    {placement:11,slot:0,registration_id:'team-11',roster_entry_id:'player-11'}
  ]}};
  const prepared=buildOcrPrefill(source,teams);
  expect(prepared).toMatchObject({visibleRows:10,matchedTeams:2,suggestedKills:2,placementByTeam:{'team-1':'1','team-10':'10'},killsByPlayer:{'player-1':'0','player-10':'9'}});
  expect(prepared.placementByTeam['team-2']).toBeUndefined();
  expect(prepared.placementByTeam['team-11']).toBeUndefined();
  expect(prepared.placementByTeam['team-12']).toBeUndefined();
});
it('requires distinct manual teams for placements 11 and 12',()=>{
  const teams=[{id:'visible',roster:[]},{id:'hidden-a',roster:[]},{id:'hidden-b',roster:[]}];
  let placements:Record<string,string>={'visible':'1'};
  placements=assignHiddenPlacement(placements,11,'hidden-a',teams);
  placements=assignHiddenPlacement(placements,12,'hidden-b',teams);
  expect(placements).toEqual({visible:'1','hidden-a':'11','hidden-b':'12'});
  expect(assignHiddenPlacement(placements,12,'hidden-a',teams)).toBe(placements);
  expect(assignHiddenPlacement(placements,11,'',teams)).toEqual({visible:'1','hidden-b':'12'});
});
it('preserves organizer edits and does not create duplicate placements while importing OCR fields',()=>{
  const teams=[{id:'team-a',roster:[{id:'player-a'}]},{id:'team-b',roster:[{id:'player-b'}]}];
  const proposal={placementByTeam:{'team-a':'1','team-b':'2'},killsByPlayer:{'player-a':'4','player-b':'5'},visibleRows:10,matchedTeams:2,suggestedKills:2};
  const merged=mergeOcrPrefill({'team-a':'2'},{'player-a':'7'},proposal,teams);
  expect(merged).toMatchObject({placements:{'team-a':'2'},kills:{'player-a':'7'},addedTeams:0});
  const fresh=mergeOcrPrefill({}, {},proposal,teams);
  expect(fresh).toMatchObject({placements:{'team-a':'1','team-b':'2'},kills:{'player-a':'4','player-b':'5'},addedTeams:2});
});

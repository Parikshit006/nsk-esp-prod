import {expect,it} from 'vitest';
import {suggestRosterNames} from '../apps/api/src/ocr-candidates.js';

it('offers only unique long-name hints and leaves ambiguous or short names for manual review',()=>{
  const roster=[
    {roster_entry_id:'a',registration_id:'team-a',team_name:'Alpha',ign_raw:'GJ SENTU !!'},
    {roster_entry_id:'b',registration_id:'team-a',team_name:'Alpha',ign_raw:'VIRAT'},
    {roster_entry_id:'c',registration_id:'team-b',team_name:'Beta',ign_raw:'VIRAT'},
    {roster_entry_id:'d',registration_id:'team-b',team_name:'Beta',ign_raw:'BK**'}
  ];
  const lines=[{text:'GJ SENTU !! 7',confidence:87},{text:'VIRAT 6',confidence:93},{text:'BK** 0',confidence:99}];
  const result=suggestRosterNames(lines,roster);
  expect(result.suggestions).toEqual([{roster_entry_id:'a',registration_id:'team-a',team_name:'Alpha',ign_raw:'GJ SENTU !!',ocr_line:'GJ SENTU !! 7',line_index:0,ocr_confidence:87}]);
  expect(result.ambiguous_lines).toBe(1);
  expect(result.unmatched_roster_players).toBe(3);
  expect(result.warning).toContain('does not verify identity');
});
it('carries visible placement and player slot into a unique roster hint',()=>{
  const result=suggestRosterNames([{text:'PLAYERONE 3 Eliminations',confidence:90,placement:6,slot:2}],[{roster_entry_id:'player-1',registration_id:'team-1',team_name:'Alpha',ign_raw:'PLAYERONE'}]);
  expect(result.suggestions[0]).toMatchObject({placement:6,slot:2,registration_id:'team-1',roster_entry_id:'player-1'});
});

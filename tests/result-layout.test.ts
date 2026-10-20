import {expect,it} from 'vitest';
import sharp from 'sharp';
import {detectResultLayout,extractKillHints} from '../apps/api/src/result-layout.js';

it('creates ten visible review placements only for the supported two-column screenshot layout',async()=>{
  const base={create:{width:1600,height:717,channels:3 as const,background:'#11171d'}};
  const gold=await sharp({create:{width:510,height:220,channels:3,background:'#634505'}}).png().toBuffer();
  const scoreboard=await sharp(base).composite([{input:gold,left:330,top:200}]).png().toBuffer();
  const detected=await detectResultLayout(scoreboard);
  expect(detected?.rows.map(row=>row.placement)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  expect(detected?.cropped_or_hidden_placements).toEqual([11,12]);
  expect(await detectResultLayout(await sharp(base).png().toBuffer())).toBeNull();
});
it('keeps uncertain kills blank and never suggests first-place kills from the gold banner',()=>{
  const row={placement:2,side:'left' as const,left:400,top:275,width:440,height:68,ocr_lines:[
    {text:'2 Eliminations',confidence:92,box:{x0:500,y0:60,x1:800,y1:110}},
    {text:'3 Eliminations',confidence:69,box:{x0:1400,y0:60,x1:1720,y1:110}},
    {text:'1 Eliminations',confidence:81,box:{x0:500,y0:185,x1:800,y1:238}}
  ],kill_hints:[null,null,null,null] as [null,null,null,null]};
  expect(extractKillHints(row).map(hint=>hint?.kills??null)).toEqual([2,null,1,null]);
  expect(extractKillHints({...row,placement:1})).toEqual([null,null,null,null]);
});

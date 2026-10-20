import sharp from 'sharp';

export type KillHint={kills:number;ocr_confidence:number;source_text:string}|null;
export type ResultRegion={placement:number;side:'left'|'right';left:number;top:number;width:number;height:number;ocr_lines:{text:string;confidence:number;box:{x0:number;y0:number;x1:number;y1:number}}[];kill_hints:[KillHint,KillHint,KillHint,KillHint]};
export type ResultLayout={kind:'free-fire-two-column-v1'|'free-fire-two-column-v2';rows:ResultRegion[];cropped_or_hidden_placements:[11,12];warning:string};
export function slotForOcrLine(row:Pick<ResultRegion,'width'|'height'|'side'>,box:{x0:number;y0:number;x1:number;y1:number}){
  const column=box.x1<row.width*4*(row.side==='left'?0.68:0.73)?0:1;
  const vertical=(box.y0+box.y1)/8<row.height/2?0:2;
  return column+vertical;
}

const leftTops=[200,275,350,425,500];
const rightTops=[200,265,330,395,460];
export const visibleResultRegions:Omit<ResultRegion,'ocr_lines'|'kill_hints'>[]=[
  ...leftTops.map((top,index)=>({placement:index+1,side:'left' as const,left:400,top,width:440,height:68})),
  ...rightTops.map((top,index)=>({placement:index+6,side:'right' as const,left:910,top,width:345,height:58}))
];
const wideLeftTops=[165,260,355,450,545];
const wideRightTops=[165,246,328,410,492];
const wideResultRegions:Omit<ResultRegion,'ocr_lines'|'kill_hints'>[]=[
  ...wideLeftTops.map((top,index)=>({placement:index+1,side:'left' as const,left:250,top,width:575,height:78})),
  ...wideRightTops.map((top,index)=>({placement:index+6,side:'right' as const,left:925,top,width:455,height:74}))
];

function averagePixel(data:Buffer,channels:number,x:number,y:number){
  let r=0,g=0,b=0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const i=((y+dy)*1600+x+dx)*channels;r+=data[i]??0;g+=data[i+1]??0;b+=data[i+2]??0;}
  return [r/25,g/25,b/25] as const;
}
export async function detectResultLayout(content:Buffer):Promise<ResultLayout|null>{
  const metadata=await sharp(content,{limitInputPixels:20_000_000}).metadata();
  if(!metadata.width||!metadata.height||metadata.width<1200)return null;
  const aspect=metadata.width/metadata.height;
  if(Math.abs(aspect-1600/717)>0.04&&(aspect<1.92||aspect>2.15))return null;
  const {data,info}=await sharp(content).resize(1600,717,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const oldLayout=Math.abs(aspect-1600/717)<=0.04&&
    [[380,225],[380,300],[380,380]].every(([x,y])=>{const [r,g,b]=averagePixel(data,info.channels,x!,y!);return r>65&&r<145&&g>40&&g<110&&b<40&&r>g;})&&
    [[380,445],[380,525],[865,220],[865,280],[865,345],[865,410],[865,475]].every(([x,y])=>{const [r,g,b]=averagePixel(data,info.channels,x!,y!);return Math.max(r,g,b)<65;});
  const wideLayout=aspect>=1.92&&aspect<=2.15&&
    [[300,180],[300,270],[300,360]].every(([x,y])=>{const [r,g,b]=averagePixel(data,info.channels,x!,y!);return r>65&&r<125&&g>45&&g<100&&b<45&&r>g;})&&
    [[300,460],[300,540]].every(([x,y])=>{const [r,g,b]=averagePixel(data,info.channels,x!,y!);return Math.max(r,g,b)<45;});
  if(!oldLayout&&!wideLayout)return null;
  const regions=oldLayout?visibleResultRegions:wideResultRegions;
  return {kind:oldLayout?'free-fire-two-column-v1':'free-fire-two-column-v2',rows:regions.map(row=>({...row,ocr_lines:[],kill_hints:[null,null,null,null]})),cropped_or_hidden_placements:[11,12],warning:'Placements 1–10 are visible in this recognized layout. Rows 11–12 are cropped or hidden. Player names and kill hints remain unverified until the organizer checks the original screenshot.'};
}

export function extractKillHints(row:ResultRegion):[KillHint,KillHint,KillHint,KillHint]{
  const hints:[KillHint,KillHint,KillHint,KillHint]=[null,null,null,null];
  // The first-place banner produced confident but wrong digits in the supplied samples.
  if(row.placement===1)return hints;
  const conflicting=new Set<number>();
  for(const line of row.ocr_lines){
    if(line.confidence<70)continue;
    const matches=[...line.text.matchAll(/(\d{1,2})\s*Eliminat/gi)];
    if(matches.length!==1)continue;
    const kills=Number(matches[0]![1]);if(kills>99)continue;
    const slot=slotForOcrLine(row,line.box);
    if(conflicting.has(slot))continue;
    if(hints[slot]&&hints[slot].kills!==kills){hints[slot]=null;conflicting.add(slot);continue;}
    hints[slot]={kills,ocr_confidence:line.confidence,source_text:line.text};
  }
  return hints;
}

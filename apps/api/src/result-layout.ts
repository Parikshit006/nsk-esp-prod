import sharp from 'sharp';

export type KillHint={kills:number;ocr_confidence:number;source_text:string}|null;
export type ResultRegion={placement:number;side:'left'|'right';left:number;top:number;width:number;height:number;ocr_lines:{text:string;confidence:number;box:{x0:number;y0:number;x1:number;y1:number}}[];kill_hints:[KillHint,KillHint,KillHint,KillHint]};
export type ResultLayout={kind:'free-fire-two-column-v1';rows:ResultRegion[];cropped_or_hidden_placements:[11,12];warning:string};

const leftTops=[200,275,350,425,500];
const rightTops=[200,265,330,395,460];
export const visibleResultRegions:Omit<ResultRegion,'ocr_lines'|'kill_hints'>[]=[
  ...leftTops.map((top,index)=>({placement:index+1,side:'left' as const,left:400,top,width:440,height:68})),
  ...rightTops.map((top,index)=>({placement:index+6,side:'right' as const,left:910,top,width:345,height:58}))
];

function averagePixel(data:Buffer,channels:number,x:number,y:number){
  let r=0,g=0,b=0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const i=((y+dy)*1600+x+dx)*channels;r+=data[i]??0;g+=data[i+1]??0;b+=data[i+2]??0;}
  return [r/25,g/25,b/25] as const;
}
export async function detectResultLayout(content:Buffer):Promise<ResultLayout|null>{
  const metadata=await sharp(content,{limitInputPixels:20_000_000}).metadata();
  if(!metadata.width||!metadata.height||metadata.width<1200||Math.abs(metadata.width/metadata.height-1600/717)>0.04)return null;
  const {data,info}=await sharp(content).resize(1600,717,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const gold=[[380,225],[380,300],[380,380]].every(([x,y])=>{const [r,g,b]=averagePixel(data,info.channels,x!,y!);return r>65&&r<145&&g>40&&g<110&&b<40&&r>g;});
  const dark=[[380,445],[380,525],[865,220],[865,280],[865,345],[865,410],[865,475]].every(([x,y])=>{const [r,g,b]=averagePixel(data,info.channels,x!,y!);return Math.max(r,g,b)<65;});
  if(!gold||!dark)return null;
  return {kind:'free-fire-two-column-v1',rows:visibleResultRegions.map(row=>({...row,ocr_lines:[],kill_hints:[null,null,null,null]})),cropped_or_hidden_placements:[11,12],warning:'Placements 1–10 are visible in this recognized layout. Rows 11–12 are cropped or hidden. Player names and kill hints remain unverified until the organizer checks the original screenshot.'};
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
    const column=line.box.x1<row.width*4*(row.side==='left'?0.68:0.73)?0:1;
    const vertical=(line.box.y0+line.box.y1)/8<row.height/2?0:2;
    const slot=column+vertical;
    if(conflicting.has(slot))continue;
    if(hints[slot]&&hints[slot].kills!==kills){hints[slot]=null;conflicting.add(slot);continue;}
    hints[slot]={kills,ocr_confidence:line.confidence,source_text:line.text};
  }
  return hints;
}

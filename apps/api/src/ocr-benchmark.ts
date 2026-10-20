import {readFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {recognizeEvidence} from './ocr.js';
import {ignForms} from './ign.js';

type Label={file:string;placements:{rank:number;players:[string|null,number|null,'visible'|'approximate'|'unknown'|'unreadable'][]}[]};
const corpus=JSON.parse(await readFile(resolve('refs/results/result-labels.json'),'utf8')) as {images:Label[]};
const results=[];
for(const image of corpus.images){
  if(basename(image.file)!==image.file)throw new Error('Corpus image must be a filename in refs/results.');
  const bytes=await readFile(resolve('refs/results',image.file));
  const output=await recognizeEvidence(bytes);
  const lines=output.lines.map(line=>ignForms(line.text).skeleton_key).filter(Boolean);
  const visible=[...new Set(image.placements.flatMap(place=>place.players.filter(([name,,certainty])=>name&&certainty==='visible').map(([name])=>name!)))];
  const found=visible.filter(name=>lines.some(line=>line.includes(ignForms(name).skeleton_key)));
  const targetedLines=(output.layout?.rows??[]).flatMap(row=>row.ocr_lines.map(line=>ignForms(line.text).skeleton_key));
  const targetedFound=visible.filter(name=>targetedLines.some(line=>line.includes(ignForms(name).skeleton_key)));
  const knownKillCells=image.placements.flatMap(place=>place.players).filter(([,kills])=>kills!==null).length;
  const visibleRankLabels=image.placements.filter(place=>place.rank<=10).length;
  let killHints=0,correctKillHints=0,incorrectKillHints=0;const incorrectExamples:{rank:number;slot:number;expected:number;actual:number;confidence:number;source:string}[]=[];
  for(const placement of image.placements.filter(place=>place.rank<=10)){
    const row=output.layout?.rows.find(item=>item.placement===placement.rank);
    placement.players.forEach(([,expected],index)=>{const hint=row?.kill_hints[index];if(expected===null||!hint)return;const actual=hint.kills;killHints++;if(actual===expected)correctKillHints++;else{incorrectKillHints++;incorrectExamples.push({rank:placement.rank,slot:index,expected,actual,confidence:hint.ocr_confidence,source:hint.source_text});}});
  }
  results.push({image:image.file,layout_detected:output.layout?.kind??null,visible_rank_labels:visibleRankLabels,review_slots_created:output.layout?.rows.length??0,visible_name_labels:visible.length,whole_image_name_line_hits:found.length,targeted_name_line_hits:targetedFound.length,targeted_name_line_coverage:visible.length?Number((targetedFound.length/visible.length).toFixed(3)):null,known_kill_cells:knownKillCells,structured_kill_hints:killHints,correct_kill_hints:correctKillHints,incorrect_kill_hints:incorrectKillHints,incorrect_examples:incorrectExamples,ocr_confidence_not_accuracy:output.confidence});
}
process.stdout.write(`${JSON.stringify({warning:'Review slots are inferred from a validated screenshot layout, not proof of team identity or OCR rank accuracy. Kill hints are measured only where the user supplied a known count, and are never official. Name-line coverage is not player matching. Approximate name and cropped labels are excluded. Official scores still require manual confirmation.',results})}\n`);

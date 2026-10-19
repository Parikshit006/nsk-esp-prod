import {readFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {recognizeEvidence} from './ocr.js';
import {ignForms} from './ign.js';

type Label={file:string;placements:{rank:number;players:[string|null,number|null,'visible'|'approximate'|'unknown'|'unreadable'][]}[]};
const corpus=JSON.parse(await readFile(resolve('refs/result-labels.json'),'utf8')) as {images:Label[]};
const results=[];
for(const image of corpus.images){
  if(basename(image.file)!==image.file)throw new Error('Corpus image must be a filename in refs.');
  const bytes=await readFile(resolve('refs',image.file));
  const output=await recognizeEvidence(bytes);
  const lines=output.lines.map(line=>ignForms(line.text).skeleton_key).filter(Boolean);
  const visible=[...new Set(image.placements.flatMap(place=>place.players.filter(([name,,certainty])=>name&&certainty==='visible').map(([name])=>name!)))];
  const found=visible.filter(name=>lines.some(line=>line.includes(ignForms(name).skeleton_key)));
  const knownKillCells=image.placements.flatMap(place=>place.players).filter(([,kills])=>kills!==null).length;
  results.push({image:image.file,visible_name_labels:visible.length,visible_name_line_hits:found.length,visible_name_line_coverage:visible.length?Number((found.length/visible.length).toFixed(3)):null,known_kill_cells:knownKillCells,structured_kill_cells_measured:0,ocr_confidence_not_accuracy:output.confidence});
}
process.stdout.write(`${JSON.stringify({warning:'Line-level token coverage is a diagnostic, not player identity, placement or kill accuracy. Approximate and cropped labels are excluded from the name measure. Official scores still require manual confirmation.',results})}\n`);

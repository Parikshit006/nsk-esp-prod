import { expect, it } from 'vitest';
import sharp from 'sharp';
import { recognizeEvidence } from '../apps/api/src/ocr.js';

it('reads a known local image with the bundled language model',async()=>{
  const image=await sharp(Buffer.from('<svg width="1200" height="250"><rect width="1200" height="250" fill="white"/><text x="60" y="150" font-family="Arial" font-size="80" fill="black">ALPHA 12345</text></svg>')).png().toBuffer();
  const result=await recognizeEvidence(image);
  expect(result.text).toContain('ALPHA');expect(result.text).toContain('12345');
  expect(result.lines.length).toBeGreaterThan(0);expect(result.warning).toContain('not measured accuracy');
},120000);

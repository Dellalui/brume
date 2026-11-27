import assert from 'node:assert/strict';
import {buildVisionOutline} from '../dist/combat-vision-outline.mjs';
import {playerBarLayout} from '../dist/canvas-hud.mjs';
const flat=buildVisionOutline({x:10,y:10,range:12,angle:180},()=>0);
assert(flat.positions.length>0);
assert.equal(flat.positions.length,flat.accents.length*6);
assert(flat.samples<350);
const stepped=buildVisionOutline({x:10,y:10,range:24},x=>x>10?2:0);
for(let i=0;i<stepped.positions.length;i+=6)assert.equal(stepped.positions[i+1],stepped.positions[i+4]);
assert.equal(buildVisionOutline({x:10,y:10},()=>undefined).positions.length,0);
for(const w of [320,600,1280]){const r=playerBarLayout(w,720);assert(r.x>=0);assert(r.x+r.w<=w);assert(r.y+r.h<=720);assert.equal(r.w,9*r.slot+8*r.gap+2*r.pad)}
console.log('PASS: cached outline geometry, terrain steps, bounded sampling and player HUD layout');

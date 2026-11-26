import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NPC_PRESETS,applyNpcPreset,clearNpcPreset,ensureNpcPreset,currentNpcPreset,npcImageURL,npcFrameId} from '../dist/npc-presets.mjs';
import {viewerFrame,viewerImage} from '../dist/world.mjs';
assert.equal(NPC_PRESETS.length,6);
const seen=new Set();
for(const p of NPC_PRESETS){
 const o={id:'test',type:'npc',x:0,y:0,w:1,d:1,facing:0};
 assert(applyNpcPreset(o,p.id));
 assert.equal(currentNpcPreset(o),p.id);
 assert.equal(o.frameCount,16);
 for(let i=0;i<16;i++){
  const id=npcFrameId(p.id,i),a=i*Math.PI/8,viewer={x:.5+Math.sin(a)*5,y:.5-Math.cos(a)*5};
  assert.equal(o.frames[i],id);
  assert.equal(viewerFrame(o,viewer),i);
  assert.equal(viewerImage(o,viewer),id);
  assert(fs.statSync(new URL(npcImageURL(id))).size>100);
  seen.add(id);
 }
 assert.equal(currentNpcPreset(JSON.parse(JSON.stringify(o))),p.id);
 clearNpcPreset(o);assert.equal(o.frameCount,1);assert(!ensureNpcPreset(o));
}
assert.equal(seen.size,96);
const custom={id:'custom',type:'npc',imageId:'own-photo',frameCount:1,frames:{}};
assert(!ensureNpcPreset(custom));assert.equal(custom.imageId,'own-photo');
assert(!ensureNpcPreset({type:'hero',id:'h'}));
const choices=new Set();
for(let i=0;i<60;i++){const o={type:'npc',id:'npc-'+i};assert(ensureNpcPreset(o));choices.add(o.npcPreset);assert(!ensureNpcPreset(o));}
assert.equal(choices.size,6);
assert.equal(npcImageURL('preset:npc:../bad:00'),null);
assert.equal(npcImageURL('preset:npc:guard:16'),null);
console.log('PASS: six presets, 96 asset references, all directions, stable variety, custom images preserved.');

import assert from 'node:assert/strict';
import {createSpriteResidency} from '../dist/sprite-residency.mjs';
let jobs=new Map(),seq=0,uploads=0;globalThis.requestIdleCallback=cb=>{jobs.set(++seq,cb);return seq};globalThis.cancelIdleCallback=id=>jobs.delete(id);
const images=new Map(Array.from({length:16},(_,i)=>[i,{width:192,height:256}])),textures=new Map();
const r=createSpriteResidency(textures,im=>{const t={dispose(){}};textures.set(im,t);return t},{initTexture(){uploads++}});
const map={buildRevision:0},actors=[{imageId:0,frames:Object.fromEntries(Array.from({length:16},(_,i)=>[i,i]))}];
r.prepare(map,actors,images);r.schedule();for(let i=0;i<16;i++){const [id,cb]=jobs.entries().next().value;jobs.delete(id);cb({timeRemaining:()=>10});assert.equal(uploads,i+1)}
for(let i=0;i<300;i++){r.prepare(map,actors,images);r.trim(new Set());r.schedule()}
assert.equal(uploads,16);assert.equal(jobs.size,0);assert.equal(r.stats().spriteEvictions,0);r.dispose();console.log('PASS: directional residency and bounded idle uploads');

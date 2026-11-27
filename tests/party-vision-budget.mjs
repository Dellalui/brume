import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {createPartyVisionCache} from '../dist/party-vision.mjs';
const m=W.newMap('vision','Vision',48,48);W.prepareBlocks(m);
const actors=Array.from({length:8},(_,i)=>W.newObject('hero',8+i*3,15,'a'+i));
for(const a of actors)a.vision.far=16;
m.objects=actors;m.fog.push('8,14');
const cache=createPartyVisionCache(),lights=W.buildLights(m);
const nonempty=r=>[...r.individual].filter(([,tiles])=>tiles.size).map(([id])=>id);
function drain(cache,lights,epoch,first){
 let result=first,passes=0;
 while(!result||result.pending){
  assert(++passes<1000,'scan must finish');
  result=cache.collect(m,actors,lights,epoch,{maxRays:96});
  assert(result.rays<=96,'budget must hold within an observer');
  assert(result.rays>0||!result.pending,'pending scan must make progress');
 }
 return result;
}
// A zero time budget advances one ray, not one entire observer.
let result=cache.collect(m,actors,lights,0,{budgetMs:0});
assert.equal(result.rays,1);assert.equal(result.recomputed,0);
assert.equal(nonempty(result).length,1);assert(result.pending);
result=drain(cache,lights,0,result);
assert.deepEqual(result.sight,createPartyVisionCache().collect(m,actors,lights,0).sight);
// Compare the optimized angular/ring enumeration to independent real rays.
const first=actors[0],expected=new Map();
for(let x=0;x<m.width;x++)for(let y=0;y<m.height;y++){
 const v=W.perception(m,first,x,y,lights);
 if(v.detail>0||v.haze>0)expected.set(W.cellKey(x,y),{detail:v.detail,haze:v.haze});
}
assert.deepEqual(createPartyVisionCache().collect(m,[first],lights,0).sight,expected);
result=cache.collect(m,actors,W.buildLights(m),0);
assert.equal(result.rays,0,'equivalent light objects must reuse cache');
assert.equal(result.recomputed,0);
const old0=result.individual.get('a0'),old1=result.individual.get('a1');
actors[0].x+=1;actors[1].x+=1;
result=cache.collect(m,actors,lights,0,{budgetMs:0});
assert(result.pending);assert.equal(result.rays,1);
assert.notEqual(result.individual.get('a0'),old0);assert.notEqual(result.individual.get('a1'),old1);
assert.equal(result.individual.get('a0').size+result.individual.get('a1').size,1,'invalidated observers cannot contribute stale tiles');
result=drain(cache,lights,0,result);
assert.deepEqual(result.sight,createPartyVisionCache().collect(m,actors,lights,0).sight);
m.objects.push(W.newObject('light',12,15,'lamp'));
const changedLights=W.buildLights(m);
result=cache.collect(m,actors,changedLights,1,{budgetMs:0});assert(result.pending);assert.equal(nonempty(result).length,1);
const firstId=nonempty(result)[0];
result=cache.collect(m,actors,changedLights,2,{budgetMs:0});
assert.equal(nonempty(result).length,1);
assert.notEqual(nonempty(result)[0],firstId,'repeated invalidation must not starve other observers');
// Deterministic clock: enforce time budget independent of runner speed.
let tick=0;
const timed=createPartyVisionCache(()=>{tick++;return {detail:1,haze:0,allowed:true}},()=>tick);
const timedResult=timed.collect(m,actors,changedLights,0,{budgetMs:2,maxRays:96});
assert.equal(timedResult.rays,2);assert.equal(timedResult.ms,2);assert(timedResult.pending);
console.log('PASS: per-ray time/count budgets, full-result equivalence, real cone enumeration, equivalent-light reuse, stale-vision exclusion and fairness.');

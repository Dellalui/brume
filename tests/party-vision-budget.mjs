import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {createPartyVisionCache} from '../dist/party-vision.mjs';
const m=W.newMap('vision','Vision',48,48);W.prepareBlocks(m);
const actors=Array.from({length:8},(_,i)=>W.newObject('hero',8+i*3,15,'a'+i));m.objects=actors;
const cache=createPartyVisionCache(),lights=W.buildLights(m);let result;
for(let i=0;i<8;i++){result=cache.collect(m,actors,lights,0,{budgetMs:0});assert.equal(result.recomputed,1);assert.equal(result.individual.size,i+1);assert.equal(result.pending,i<7)}
assert.deepEqual(result.sight,createPartyVisionCache().collect(m,actors,lights,0).sight);
assert.equal(cache.collect(m,actors,W.buildLights(m),0).recomputed,0,'equivalent light object does not flush caches');
actors[0].x+=1;actors[1].x+=1;result=cache.collect(m,actors,lights,0,{budgetMs:0});assert(result.pending);assert(!result.individual.has('a1'),'deferred invalid observers never reveal stale tiles');assert.equal(result.recomputed,1);
result=cache.collect(m,actors,lights,0,{budgetMs:0});assert(!result.pending);assert.deepEqual(result.sight,createPartyVisionCache().collect(m,actors,lights,0).sight);
const movedLight=W.newObject('light',12,15,'lamp');m.objects.push(movedLight);result=cache.collect(m,actors,W.buildLights(m),1,{budgetMs:0});assert.equal(result.individual.size,1);assert(result.pending);
const firstId=[...result.individual.keys()][0];result=cache.collect(m,actors,W.buildLights(m),2,{budgetMs:0});assert.notEqual([...result.individual.keys()][0],firstId,'frequent invalidations must not starve the same observers');
console.log('PASS: bounded observers per frame, equivalent-light reuse, stale-vision exclusion and full-result equivalence.');

import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {treeExtent} from '../dist/unified-trees.mjs';
import {planTreePlanting,treePlantingPlan} from '../dist/tree-neighbors.mjs';
import {treeConstructionBoxes,boxIntersects} from '../dist/tree-construction-collision.mjs';
import {placementError,blockObject} from '../dist/construction.mjs';
const map=W.newMap('edge','Tree anchor',32,32);W.prepareBlocks(map);
const graph=[[0,0,.5,.16,-1,'round'],[0,0,1.5,.14,0,'round'],[-1,0,2,.09,1,'round'],[-2,0,2.5,.05,2,'taper'],[1,0,2,.09,1,'round'],[2,0,2.5,.05,4,'taper']];
function tree(x,y,g=graph){const e=treeExtent(g);return {...W.newObject('tree',0,0,'new'),...e,x:x-e.w/2,y:y-e.d/2,baseZ:0,treeGraph:g,treeConfig:{adaptCrowns:true}}}
const edge=tree(.5,8.5);
assert(W.bounds(edge).x<0);assert(W.validObject(map,edge));
assert(W.plantingFootprint(edge).every(p=>Math.hypot(p.x-.5,p.y-8.5)<=edge.trunkRadius+.000001));
const fitted=planTreePlanting(map,edge);
assert.equal(treePlantingPlan(fitted).error,'');assert.deepEqual(fitted.treeGraph,graph);assert.equal(placementError(map,[fitted]),'');
assert(!W.validObject(map,tree(-.5,8.5)));
assert(!W.validObject(map,tree(32.5,8.5)));
map.chunks=['0,0'];map.buildRevision=1;
const chunkEdge=tree(15.5,8.5);assert(W.validObject(map,chunkEdge));assert(!W.validObject(map,tree(16.5,8.5)));
const nearChunk=planTreePlanting(map,chunkEdge);assert.equal(treePlantingPlan(nearChunk).error,'');assert.equal(placementError(map,[nearChunk]),'');
const log=tree(.5,8.5,[[0,0,.4,.35,-1,'broken'],[-2,0,.4,.30,0,'broken']]);
assert(!W.isUprightTree(log));assert(!W.validObject(map,log));assert.equal(W.plantingFootprint(log).length,4);
const block=blockObject('stone',-1,8,0,1,1,1,0,'block');assert(!W.validObject(map,block));
// An active obstacle still counts, even though empty space outside
// the terrain no longer rejects a crown.
const wall=blockObject('stone',2,8,1,1,1,3,0,'wall');map.objects=[wall];map.buildRevision=2;
const adapted=planTreePlanting(map,edge);const plan=treePlantingPlan(adapted);
assert.equal(plan.error,'');assert(plan.adapted);
assert(treeConstructionBoxes(adapted,0).every(b=>!boxIntersects(b,wall)));assert.equal(placementError(map,[adapted]),'');
console.log('PASS: trunk-only planting footprint, map and chunk edges, retained physical obstacle checks and log limits.');

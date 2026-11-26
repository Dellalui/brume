import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {blockObject} from '../dist/construction.mjs';
import {movementTarget,stepAltitude} from '../dist/movement-target.mjs';
const make=()=>{const m=W.newMap('ledge','Ledge',24,24);W.prepareBlocks(m);return m};
for(const placed of [false,true]){
 const m=make();const actor={...W.newObject('hero',10,10,'a'),voxelZ:1};m.objects=[actor];
 if(placed)m.objects.push(blockObject('stone',10,10,0,1,1,1,0,'step'));else W.setBlock(m,10,10,0,'stone');
 for(let z=0;z<5;z++)W.setBlock(m,10,9,z,'stone');
 const from={x:10,y:10,z:1},to={x:11,y:10,z:0};
 assert(W.stepFree(m,from,to,actor),'can descend from supporting block');
 assert(W.stepFree(m,to,from,{...actor,voxelZ:0,x:11}),'can ascend one block');
 assert(W.findPath(m,actor,to).length>=2);
 assert.deepEqual(movementTarget(m,actor,{x:11,y:10.5,z:.7,normal:{x:1,y:0,z:0}}),to);
 assert.equal(movementTarget(m,actor,{x:10.5,y:9.5,z:5,normal:{x:0,y:0,z:1}}).z,5);
 assert.equal(W.findPath(m,actor,{x:10,y:9,z:5}).length,0,'isolated tall roof is not reachable');
 W.setBlock(m,11,10,0,'stone');W.setBlock(m,11,10,1,'stone');assert(!W.stepFree(m,from,{x:11,y:10,z:2},actor)||W.findPath(m,actor,{x:11,y:10,z:0}).length===0);
}
assert.equal(stepAltitude({z:0},{z:1},.3),1);assert.equal(stepAltitude({z:1},{z:0},.6),1);assert.equal(stepAltitude({z:1},{z:0},1),0);
console.log('PASS: voxel and placed ledges, wall targets, unreachable roof, step animation.');

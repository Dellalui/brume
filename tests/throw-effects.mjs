import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import * as T from '../dist/vendor/three.module.min.js';
import {blockObject} from '../dist/construction.mjs';
import {PRESETS,THROW_ITEMS,throwConfig,planImpact,applyImpact,applyImpactBatch,createThrowQueue,flightTrail,MAX_REMOVALS} from '../dist/throw-effects.mjs';
import {createEffects} from '../dist/effects.mjs';
import {createThrowVisuals} from '../dist/throw-visuals.mjs';
import {canvasStub,fixture} from '../test-support/three-fixture.mjs';
const map=W.newMap('blast','Blast',4096,4096);W.prepareBlocks(map);
map.groups.push({id:'safe',locked:true});
W.setBlock(map,2000,2000,0,'stone',.5);W.setBlock(map,2000,2000,.5,'stone',.5);W.setBlock(map,2001,2000,0,'stone');W.setBlock(map,3000,3000,0,'stone');map.blockGroups={'2000,2000,0.5':'safe'};
map.objects=[blockObject('glass',2000,2001,0,1,1,1,.3,'glass'),{...blockObject('stone',2001,2001,0,1,1,1,0,'locked'),locked:true},{...blockObject('stone',2002,2000,0,1,1,1,0,'group'),group:'safe'},W.newObject('npc',2000,2000,'npc')];
const at={x:2000.5,y:2000.5,z:.5},before=JSON.stringify(map),plan=planImpact(map,at,{power:3},W);assert.equal(JSON.stringify(map),before);assert(plan.protectedCount>=3);assert.equal(plan.voxels.length,2);assert.equal(plan.objects.length,1);
assert(applyImpact(map,plan,W)>=3);assert.equal(W.blockAt(map,2000,2000,.5),'stone');assert.equal(W.blockAt(map,3000,3000,0),'stone');assert(map.objects.some(o=>o.id==='npc'));assert(map.objects.some(o=>o.id==='locked'));assert(map.objects.some(o=>o.id==='group'));assert.equal(W.groundAt(map,2000,2000),0);
assert.equal(planImpact(map,at,{power:6,destroy:false},W).voxels.length,0);
assert.equal(throwConfig({power:999}).radius,6);
assert.equal(PRESETS.length,24);assert.equal(THROW_ITEMS.length,24);
const dense=W.newMap('dense','Dense',32,32);W.prepareBlocks(dense);for(let x=9;x<=21;x++)for(let y=9;y<=21;y++)for(let z=0;z<12;z++)W.setBlock(dense,x,y,z,'glass');
const large=planImpact(dense,{x:16,y:16,z:6},{power:6},W);assert(large.limited);assert.equal(large.voxels.length+large.ground.length+large.objects.length,MAX_REMOVALS);
const crater=W.newMap('crater','Crater',32,32);W.prepareBlocks(crater);
const center={x:16.5,y:16.5,z:0};
W.setBlock(crater,16,16,0,'obsidian');W.setBlock(crater,17,16,0,'glass');
const craterPlan=planImpact(crater,center,{power:3},W);
assert(craterPlan.ground.length>0);assert(craterPlan.resistedCount>0);
assert.equal(W.groundAt(crater,16,16),0);
applyImpact(crater,craterPlan,W);
assert(W.groundAt(crater,16,16)<0);assert.equal(W.blockAt(crater,16,16,0),'obsidian');assert.equal(W.blockAt(crater,17,16,0),null);
assert.equal(W.groundAt(crater,0,0),0);
assert.equal(planImpact(crater,center,{power:6,destroy:false},W).ground.length,0);
// Simultaneous blasts keep the original sequential damage rules and
// trigger exactly one editor transaction for the entire frame.
const batchMap=W.newMap('batch','Batch',32,32);W.prepareBlocks(batchMap);
for(let x=10;x<20;x++)for(let y=10;y<20;y++)W.setBlock(batchMap,x,y,0,'glass');
const sequential=structuredClone(batchMap),hits=[{point:{x:15,y:15,z:0},item:{power:3}},{point:{x:16,y:15,z:0},item:{power:4}},{point:{x:16,y:15,z:0},item:{destroy:false}}];
let expected=0;for(const {point,item}of hits)expected+=applyImpact(sequential,planImpact(sequential,point,item,W),W);
let snapshots=0;const combined=applyImpactBatch(batchMap,hits,W,()=>snapshots++);
assert.equal(snapshots,1);assert.equal(combined.count,expected);assert.deepEqual(batchMap,sequential);
assert.equal(applyImpactBatch(batchMap,[hits[2]],W,()=>snapshots++).changed,false);assert.equal(snapshots,1);
let impacts=0;const queue=createThrowQueue(),from={x:2000,y:2000,z:5};
assert(!queue.launch(map,false,from,at,{},W,0));for(let i=0;i<40;i++)assert(queue.launch(map,true,from,at,{power:2},W,0));assert.equal(queue.size,40);
assert(queue.advance(map,true,50,()=>impacts++).every(p=>p.phase==='flight'&&p.trail.length===24));assert.equal(impacts,0);assert(queue.advance(map,true,500,()=>impacts++).every(p=>p.phase==='impact'));assert.equal(impacts,40);queue.advance(map,true,1000,()=>impacts++);assert.equal(impacts,40);assert.equal(queue.advance(map,true,3600,()=>impacts++).length,0);
queue.launch(map,true,from,at,{},W,3700);assert.equal(queue.advance({...map},true,4200,()=>impacts++).length,0);assert.equal(impacts,40);
const deferred=createThrowQueue();deferred.launch(map,true,from,at,{power:2},W,0);
const lazy=deferred.advance(map,true,50,()=>{}, {deferTrails:true})[0];
assert.equal(lazy.trail,undefined,'renderer computes trails only after culling');
const buffer=flightTrail(lazy.flightFrom,lazy.flightTo,lazy.flightProgress),first=buffer[0],copy=structuredClone(buffer);
assert.equal(flightTrail(lazy.flightFrom,lazy.flightTo,lazy.flightProgress,buffer),buffer);
assert.equal(buffer[0],first);assert.deepEqual(buffer,copy);
assert.deepEqual(buffer,flightTrail(from,at,lazy.flightProgress));
// Exercise the vendored Quarks burst generators with real Three scene objects.
const fx=createEffects(()=>canvasStub(128,128)),visuals=createThrowVisuals(fx),scene=new T.Scene(),camera=new T.PerspectiveCamera();scene.add(visuals.group);camera.position.set(at.x+8,at.z+6,at.y+12);camera.lookAt(at.x,at.z+1,at.y);
for(const preset of PRESETS.slice(0,9)){
 const config=throwConfig({preset:preset.id,power:2});
 assert(visuals.update([{id:preset.id,config,position:at,tail:at,phase:'flight',age:0}],0,camera,'low'));
 for(let i=0;i<5;i++)assert(visuals.update([{id:preset.id,config,position:at,tail:at,phase:'impact',age:i*.033}],i*.033,camera,'low'));
 assert.equal(visuals.group.children.length,1);assert(!visuals.update([],2,camera,'low'));assert.equal(visuals.group.children.length,0);
}
visuals.dispose();fx.dispose();
console.log('PASS: nine one-shot Quarks presets, locked half-voxels and objects, bounded damage, large sparse map, mode guards, timed single impact and cleanup.');

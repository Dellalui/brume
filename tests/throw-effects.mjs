import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import * as T from '../dist/vendor/three.module.min.js';
import {blockObject} from '../dist/construction.mjs';
import {PRESETS,THROW_ITEMS,throwConfig,planImpact,applyImpact,createThrowQueue,MAX_REMOVALS} from '../dist/throw-effects.mjs';
import {createEffects} from '../dist/effects.mjs';
import {createThrowVisuals} from '../dist/throw-visuals.mjs';
import {canvasStub,fixture} from '../test-support/three-fixture.mjs';
const map=W.newMap('blast','Blast',4096,4096);W.prepareBlocks(map);
map.groups.push({id:'safe',locked:true});
W.setBlock(map,2000,2000,0,'stone',.5);W.setBlock(map,2000,2000,.5,'stone',.5);W.setBlock(map,2001,2000,0,'stone');W.setBlock(map,3000,3000,0,'stone');map.blockGroups={'2000,2000,0.5':'safe'};
map.objects=[blockObject('glass',2000,2001,0,1,1,1,.3,'glass'),{...blockObject('stone',2001,2001,0,1,1,1,0,'locked'),locked:true},{...blockObject('stone',2002,2000,0,1,1,1,0,'group'),group:'safe'},W.newObject('npc',2000,2000,'npc')];
const at={x:2000.5,y:2000.5,z:.5},before=JSON.stringify(map),plan=planImpact(map,at,{power:3},W);assert.equal(JSON.stringify(map),before);assert.equal(plan.protectedCount,3);assert.equal(plan.voxels.length,2);assert.equal(plan.objects.length,1);
assert.equal(applyImpact(map,plan,W),3);assert.equal(W.blockAt(map,2000,2000,.5),'stone');assert.equal(W.blockAt(map,3000,3000,0),'stone');assert(map.objects.some(o=>o.id==='npc'));assert(map.objects.some(o=>o.id==='locked'));assert(map.objects.some(o=>o.id==='group'));assert.equal(W.groundAt(map,2000,2000),0);
assert.equal(planImpact(map,at,{power:6,destroy:false},W).voxels.length,0);
assert.equal(throwConfig({power:999}).radius,6);
assert.equal(PRESETS.length,24);assert.equal(THROW_ITEMS.length,24);
const dense=W.newMap('dense','Dense',32,32);W.prepareBlocks(dense);for(let x=9;x<=21;x++)for(let y=9;y<=21;y++)for(let z=0;z<12;z++)W.setBlock(dense,x,y,z,'stone');
const large=planImpact(dense,{x:16,y:16,z:6},{power:6},W);assert(large.limited);assert.equal(large.voxels.length,MAX_REMOVALS);
let impacts=0;const queue=createThrowQueue(),from={x:2000,y:2000,z:5};
assert(!queue.launch(map,false,from,at,{},W,0));for(let i=0;i<40;i++)assert(queue.launch(map,true,from,at,{power:2},W,0));assert.equal(queue.size,40);
assert(queue.advance(map,true,50,()=>impacts++).every(p=>p.phase==='flight'));assert.equal(impacts,0);assert(queue.advance(map,true,500,()=>impacts++).every(p=>p.phase==='impact'));assert.equal(impacts,40);queue.advance(map,true,1000,()=>impacts++);assert.equal(impacts,40);assert.equal(queue.advance(map,true,3600,()=>impacts++).length,0);
queue.launch(map,true,from,at,{},W,3700);assert.equal(queue.advance({...map},true,4200,()=>impacts++).length,0);assert.equal(impacts,40);
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

import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {blockObject} from '../dist/construction.mjs';
import {excavate} from '../dist/creative-tools.mjs';
import {createReliefStream} from '../dist/relief-stream.mjs';
import {fixture} from '../test-support/three-fixture.mjs';
const map=W.newMap('remove','Manual removal',160,96);W.prepareBlocks(map);
map.lighting.bounce=false;map.blockLighting={quality:2,radius:5,power:1};
for(let x=20;x<128;x++)for(let y=28;y<38;y++)for(let z=0;z<3;z++)W.setBlock(map,x,y,z,'stone');
W.setBlock(map,79,39,3,'glowstone',.5);
W.setBlock(map,80,39,3,'stone');
W.setBlock(map,80,40,3,'glowstone');
W.setBlock(map,96,45,2,'stone'); // Only entry of this column.
W.digGround(map,100,50,.5);
map.objects.push(blockObject('glowstone',80,33,3,1,1,1,0,'lamp'),blockObject('glowstone',85.2,40,2,1,1,.5,.3,'rotated'));
Object.assign(map.camera,{mode:'fly',fly:{x:76,y:12,z:36},angle:0});
class WorkerStub{messages=[];postMessage(m){this.messages.push(m)}terminate(){}}
const worker=new WorkerStub();
const {r}=fixture(undefined,{reliefWorkerFactory:()=>worker});
const opts={map,mode:'mj',building:true,selection:null,images:new Map(),lights:W.buildLights(map),vision:new Set(),explored:new Set(),terrainEpoch:1,path:[]};
const snapshot=renderer=>renderer.debug().reliefGroup.children.filter(m=>m.userData.reliefBatch&&!m.userData.cutOverlay).sort((a,b)=>a.userData.reliefBatch.localeCompare(b.userData.reliefBatch)).map(m=>[m.userData.reliefBatch,m.count,Array.from(m.instanceMatrix.array.slice(0,m.count*16)),m.userData.blocks.map(b=>[b.id??null,b.x,b.y,b.z,b.h])]);
function parity(){
 const {r:fresh}=fixture();fresh.render(opts);assert.deepEqual(snapshot(r),snapshot(fresh),'manual removal is immediately identical to a full geometry rebuild');
 assert.deepEqual(r.debug().occlusion,fresh.debug().occlusion,'local occlusion matches full rebuild');
 assert.equal(r.stats().pointIllumination+r.stats().spatialLightSources,fresh.stats().pointIllumination+fresh.stats().spatialLightSources,'no stale or lost emitter');
 fresh.dispose();
}
r.render(opts);parity();
const initial=r.stats(),ground=r.debug().groundBatch,remote=r.debug().reliefGroup.children.find(m=>m.userData.reliefBatch?.includes('|6,1|'));
function remove(changes,mutate){
 const token=r.beginRemovalEdit(map,opts.terrainEpoch);assert(token);
 mutate();map.buildRevision=(map.buildRevision||0)+1;opts.terrainEpoch++;opts.lights=W.buildLights(map);
 assert(r.finishRemovalEdit(map,opts.terrainEpoch,token,changes));r.render(opts);parity();
}
for(const id of ['lamp','rotated']){
 remove({voxels:[],objects:[id],ground:0,groundColumns:[]},()=>{map.objects=map.objects.filter(o=>o.id!==id)});
 assert(!r.debug().pointLights.some(l=>l.visible&&l.userData.sourceId===id),'removed native lamp turns off immediately');
}
for(const [x,y,z]of [[79,39,3],[80,39,3],[80,40,3],[96,45,2]]){
 remove({voxels:[x+','+y+','+z],objects:[],ground:0,groundColumns:[]},()=>assert(W.setBlock(map,x,y,z,null)));
}
const after=r.stats();assert.equal(after.occlusionIndexBuilds,initial.occlusionIndexBuilds);assert.equal(after.occlusionRemovalUpdates,initial.occlusionRemovalUpdates+6);assert(after.reliefSectorHits>initial.reliefSectorHits);assert.equal(after.terrainBuilds,initial.terrainBuilds);assert.equal(r.debug().groundBatch,ground);if(remote)assert(r.debug().reliefGroup.children.includes(remote));assert.equal(worker.messages.length,0,'manual removal never waits for the impact geometry worker');
remove({voxels:[],objects:[],ground:1,groundColumns:['100,50']},()=>assert(excavate(map,100,50,-1)));
assert.equal(W.groundAt(map,100,50),-1);
assert.equal(r.stats().occlusionIndexBuilds,initial.occlusionIndexBuilds);
// A deep side cut inserts new upper soil blocks; the removal-only cache
// must reject it and use the normal exact rebuild.
const token=r.beginRemovalEdit(map,opts.terrainEpoch);assert(token);assert(excavate(map,110,50,-4));map.buildRevision++;opts.terrainEpoch++;opts.lights=W.buildLights(map);
assert(!r.finishRemovalEdit(map,opts.terrainEpoch,token,{voxels:[],objects:[],ground:1,groundColumns:['110,50']}));r.render(opts);parity();assert(r.stats().occlusionIndexBuilds>initial.occlusionIndexBuilds);
r.dispose();
// Exercise the column index separately, including the last voxel in a sector.
const small=W.newMap('stream','Stream',64,64);W.prepareBlocks(small);W.setBlock(small,15,15,0,'stone');W.setBlock(small,16,16,0,'glowstone');small.objects.push(blockObject('stone',20,20,1,1,1,1,0,'p'));
const stream=createReliefStream(),window=[0,0,64,64],empty={cells:[],irregular:[]};
let scope=stream(small,null,1,window,W,empty);const untouched=scope.columns.find(([k])=>k==='15,15');
W.setBlock(small,16,16,0,null);small.objects=[];small.buildRevision=1;
scope=stream(small,null,2,window,W,empty,{manualRemoval:true,map:small,from:1,to:2,changes:{voxels:['16,16,0'],objects:['p'],ground:0}});
assert.equal(scope.columns.length,1);assert.equal(scope.columns[0],untouched,'unmodified column descriptor retained');assert.equal(scope.objects.length,0);assert(!scope.occlusionKey.includes('1,1'));
console.log('PASS: immediate manual block/light removal, sector and ground reuse, boundary and half/rotated blocks, light removal, shallow excavation and conservative deep-cut fallback.');

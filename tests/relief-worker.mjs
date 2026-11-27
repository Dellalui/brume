import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {blockObject} from '../dist/construction.mjs';
import {applyImpactBatch} from '../dist/throw-effects.mjs';
import {buildReliefWorkerResult} from '../dist/relief-worker.mjs';
import {createReliefWorkerClient} from '../dist/relief-worker-client.mjs';
import {fixture} from '../test-support/three-fixture.mjs';
// Controllable worker transport uses the real worker computation with
// structured clone + transfer. No timing-dependent sleeps.
class ManualWorker{
 messages=[];postMessage(m){this.messages.push(structuredClone(m))}
 complete(){const m=this.messages.shift(),{results,transfer}=buildReliefWorkerResult(m.payload);this.onmessage({data:structuredClone({id:m.id,results},{transfer})})}
 terminate(){this.messages=[]}
}
const manual=new ManualWorker(),client=createReliefWorkerClient(()=>manual),seen=[];
client.submit({test:1},()=>seen.push(1));client.submit({test:2},()=>seen.push(2));client.submit({test:3},()=>seen.push(3));
assert.equal(manual.messages.length,1);
let m=manual.messages.shift();manual.onmessage({data:{id:m.id,results:[]}});assert.equal(manual.messages.length,1);m=manual.messages.shift();assert.equal(m.payload.test,3);manual.onmessage({data:{id:m.id,results:[]}});assert.deepEqual(seen,[3]);client.dispose();
const map=W.newMap('async','Async relief',160,96);W.prepareBlocks(map);map.objects=[];
for(let x=20;x<128;x++)for(let y=28;y<38;y++)for(let z=0;z<4;z++)W.setBlock(map,x,y,z,'stone');
W.setBlock(map,47,31,4,'glass',.5);map.objects.push(blockObject('stone',47.5,31,4,3,1,1,0,'wide'));
Object.assign(map.camera,{mode:'fly',fly:{x:76,y:12,z:36},angle:0});
const worker=new ManualWorker();let wakes=0;
const {r}=fixture(undefined,{reliefWorkerFactory:()=>worker}),opts={map,mode:'mj',building:true,selection:null,images:new Map(),lights:W.buildLights(map),vision:new Set(),explored:new Set(),terrainEpoch:1,path:[],onAssetReady:()=>wakes++};
const snapshot=renderer=>renderer.debug().reliefGroup.children.filter(m=>m.userData.reliefBatch&&!m.userData.cutOverlay).sort((a,b)=>a.userData.reliefBatch.localeCompare(b.userData.reliefBatch)).map(m=>[m.userData.reliefBatch,m.count,Array.from(m.instanceMatrix.array.slice(0,m.count*16)),m.userData.blocks.map(b=>[b.id??null,b.x,b.y,b.z,b.h]),m.boundingSphere.center.toArray(),m.boundingSphere.radius]);
const compare=()=>{const {r:fresh}=fixture(undefined,{reliefWorkerFactory:()=>null});fresh.render(opts);assert.deepEqual(snapshot(r),snapshot(fresh),'async matrices, bounds and source metadata match exact fresh renderer');fresh.dispose()};
function hit(x,y,z,power){
 let token;const result=applyImpactBatch(map,[{point:{x,y,z},item:{power}}],W,()=>token=r.beginImpactEdit(map,opts.terrainEpoch));assert(result.changed);
 map.buildRevision=(map.buildRevision||0)+1;opts.terrainEpoch++;assert(r.finishImpactEdit(map,opts.terrainEpoch,token,result.changes));r.render(opts);
}
r.render(opts);const before=snapshot(r),initial=r.stats();
hit(32,32,3,4);assert.equal(worker.messages.length,1);assert.deepEqual(snapshot(r),before,'render continues with previous solid sector while worker runs');assert.equal(r.stats().reliefBuilds,initial.reliefBuilds);
hit(48,32,2,4);hit(32,32,0,3);assert.equal(worker.messages.length,1,'only one worker job in flight');
worker.complete();assert.equal(worker.messages.length,1);r.render(opts);assert.deepEqual(snapshot(r),before,'stale result never published');
worker.complete();assert(wakes>0);r.render(opts);
for(let i=0;i<100&&r.stats().reliefUploadPending;i++)r.render(opts);
assert.equal(r.stats().reliefUploadPending,0);compare();assert(r.stats().reliefSectorHits>initial.reliefSectorHits);assert.equal(r.stats().reliefWorkerCompleted,2);assert(r.stats().reliefWorkerDropped>=2);
// An ordinary edit while an impact job is pending must invalidate it.
hit(55,32,2,3);assert.equal(worker.messages.length,1);W.setBlock(map,100,32,3,'stone',.5);opts.terrainEpoch++;r.render(opts);compare();worker.complete();r.render(opts);compare();
r.dispose();console.log('PASS: asynchronous sector preparation, transferable matrices, exact bounds and geometry, coalesced impacts, stale result rejection and synchronous fallback.');

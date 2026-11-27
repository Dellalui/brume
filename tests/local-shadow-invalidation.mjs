import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import * as W from '../dist/world.mjs';
import {createLocalShadowQueue} from '../dist/shadow-system.mjs';
import {buildReliefWorkerResult} from '../dist/relief-worker.mjs';
import {applyImpactBatch} from '../dist/throw-effects.mjs';
import {fixture} from '../test-support/three-fixture.mjs';
const sun=new T.DirectionalLight(),near=new T.PointLight('#ffffff',1,12),far=new T.PointLight('#ffffff',1,10);
sun.castShadow=near.castShadow=far.castShadow=true;near.position.set(10,3,10);far.position.set(100,3,100);
const q=createLocalShadowQueue(),bounds=[new T.Sphere(new T.Vector3(10,3,10),5)];
q.mark(bounds,sun,[near,far],0);assert.equal(q.size,2);assert.equal(q.take(4,true),null,'do not rebuild shadows during a mesh upload burst');
q.mark(bounds,sun,[near,far],10);assert.equal(q.size,2);assert.equal(q.take(24,true),sun,'bounded wait even during continuous uploads');assert.equal(q.take(25,false),near);
q.mark(bounds,sun,[near,far],26);assert.equal(q.take(30,false),null,'repeated hits coalesced within shadow interval');assert.equal(q.take(56,false),sun);assert.equal(q.take(57,false),near);assert.equal(q.size,0);
q.mark(bounds,sun,[near,far],58);near.castShadow=false;q.satisfy(sun,58);assert.equal(q.take(100),null);assert.equal(q.size,0);
class WorkerStub{
 messages=[];postMessage(m){this.messages.push(structuredClone(m))}
 complete(){const m=this.messages.shift(),{results,transfer}=buildReliefWorkerResult(m.payload);this.onmessage({data:structuredClone({id:m.id,results},{transfer})})}
 terminate(){this.messages=[]}
}
const map=W.newMap('shadow-impacts','Local impact shadows',160,96);W.prepareBlocks(map);
for(let x=20;x<100;x++)for(let y=28;y<38;y++)for(let z=0;z<4;z++)W.setBlock(map,x,y,z,'stone');
Object.assign(map.camera,{mode:'fly',fly:{x:65,y:12,z:36},angle:0});
map.lighting.bounce=false;map.blockLighting={quality:2};const worker=new WorkerStub();let now=0;
const {r,gpu}=fixture(undefined,{reliefWorkerFactory:()=>worker,shadowClock:()=>now});
const opts={map,mode:'mj',building:true,selection:null,images:new Map(),lights:{...W.buildLights(map),sources:[{owner:'near',x:32,y:32,z:4,radius:10,power:1,color:'#ffffff'},{owner:'far',x:100,y:32,z:4,radius:8,power:1,color:'#ffffff'}]},vision:new Set(),explored:new Set(),terrainEpoch:1,path:[]};
r.render(opts);const solar=r.debug().scene.children.find(o=>o.isDirectionalLight&&o.castShadow),lights=r.debug().pointLights.filter(l=>l.castShadow),local=lights.find(l=>l.position.x===32),remote=lights.find(l=>l.position.x===100);
assert(solar&&local&&remote);const reset=()=>{gpu.shadowMap.needsUpdate=false;solar.shadow.needsUpdate=false;for(const l of lights)l.shadow.needsUpdate=false};reset();
let token;const blast=applyImpactBatch(map,[{point:{x:32,y:32,z:2},item:{power:4}}],W,()=>token=r.beginImpactEdit(map,opts.terrainEpoch));assert(blast.changed);
map.buildRevision=(map.buildRevision||0)+1;opts.terrainEpoch++;assert(r.finishImpactEdit(map,opts.terrainEpoch,token,blast.changes));
r.render(opts);assert.equal(worker.messages.length,1);worker.complete();
let sunUpdates=0,pointUpdates=0;
for(let i=0;i<32;i++){reset();now+=4;r.render(opts);assert(!remote.shadow.needsUpdate,'unaffected point shadow remains cached');if(solar.shadow.needsUpdate)sunUpdates++;if(local.shadow.needsUpdate)pointUpdates++;assert(!(solar.shadow.needsUpdate&&local.shadow.needsUpdate),'one local shadow refresh per frame')}
assert(sunUpdates>0&&pointUpdates>0,'affected shadows eventually updated');assert.equal(r.stats().localShadowPending,0);assert.equal(r.stats().reliefUploadPending,0);
assert.equal(local.shadow.mapSize.x,256);assert.equal(solar.shadow.mapSize.x,2048);r.dispose();
console.log('PASS: spatially invalidated impact shadows, bounded coalescing, separate upload/refresh and unchanged shadow quality.');

import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {blockObject} from '../dist/construction.mjs';
import {applyImpactBatch} from '../dist/throw-effects.mjs';
import {fixture} from '../test-support/three-fixture.mjs';
const map=W.newMap('relief-impact','Relief impact',160,96);W.prepareBlocks(map);map.objects=[];
for(let x=20;x<128;x++)for(let y=28;y<38;y++)for(let z=0;z<4;z++)W.setBlock(map,x,y,z,'stone');
map.objects.push(blockObject('glass',32,32,4,2,1,1,.3,'glass'),blockObject('stone',47.5,31,4,3,1,1,0,'wide'));
W.setBlock(map,95,35,4,'glass');W.setBlock(map,96,35,4,'glass');W.digGround(map,100,30,.5);
Object.assign(map.camera,{mode:'fly',fly:{x:76,y:12,z:36},angle:0});
const {r}=fixture(),opts={map,mode:'mj',building:true,selection:null,images:new Map(),lights:W.buildLights(map),vision:new Set(),explored:new Set(),terrainEpoch:1,path:[]};
const meshes=renderer=>new Map(renderer.debug().reliefGroup.children.filter(m=>m.userData.reliefBatch&&!m.userData.cutOverlay).map(m=>[m.userData.reliefBatch,m]));
const snapshot=renderer=>[...meshes(renderer)].sort(([a],[b])=>a.localeCompare(b)).map(([k,m])=>[k,m.count,Array.from(m.instanceMatrix.array.slice(0,m.count*16)),m.userData.blocks.map(b=>[b.id??null,b.x,b.y,b.z,b.h])]);
const earth=renderer=>renderer.debug().reliefGroup.children.filter(m=>m.userData.earth&&!m.userData.cutOverlay);
const check=()=>{const {r:fresh}=fixture();fresh.render(opts);assert.deepEqual(snapshot(r),snapshot(fresh),'local plans match complete fresh renderer');assert.deepEqual(earth(r).flatMap(m=>Array.from(m.instanceMatrix.array.slice(0,m.count*16))).sort((a,b)=>a-b),earth(fresh).flatMap(m=>Array.from(m.instanceMatrix.array.slice(0,m.count*16))).sort((a,b)=>a-b));fresh.dispose()};
r.render(opts);const initial=r.stats(),before=meshes(r),remoteEarth=earth(r).find(m=>m.count>0);assert(remoteEarth);check();
function hit(point,power){
 let token;const result=applyImpactBatch(map,[{point,item:{power}}],W,()=>token=r.beginImpactEdit(map,opts.terrainEpoch));assert(result.changed);
 map.buildRevision=(map.buildRevision||0)+1;opts.terrainEpoch++;assert(r.finishImpactEdit(map,opts.terrainEpoch,token,result.changes));r.render(opts);check();return result;
}
hit({x:32,y:32,z:3},4);const after=r.stats();assert(after.reliefSectorHits>initial.reliefSectorHits,'remote CPU face plans reused');assert(after.reliefSectorBuilds-initial.reliefSectorBuilds<initial.reliefSectorBuilds);
assert([...before].some(([k,m])=>k.includes('6,2')&&meshes(r).get(k)===m),'remote mesh preserved');assert(earth(r).includes(remoteEarth),'unmodified excavation wall preserved');
hit({x:48,y:32,z:2},4);hit({x:32,y:32,z:0},3);
map.camera.fly.x=100;r.render(opts);check();
W.setBlock(map,100,32,3,'wood');opts.terrainEpoch++;r.render(opts);check();
r.dispose();console.log('PASS: local relief face plans, exact instance data after repeated impacts, excavations, translation and untracked edits.');

import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {createRenderRegion} from '../dist/render-region.mjs';
import {fixture} from '../test-support/three-fixture.mjs';
const map=W.newMap('spin','Rapid camera',320,256);W.prepareBlocks(map);map.objects=[];
Object.assign(map.camera,{mode:'fly',fly:{x:160,y:12,z:128},angle:0});
const cam={position:{x:160,z:128},isPerspectiveCamera:true},first=createRenderRegion(cam,map);
for(let i=0;i<72;i++){map.camera.angle=i*Math.PI/7;assert.equal(createRenderRegion(cam,map),first,'pure rotation must not change the streaming region')}
assert(first.chunks.size<150);
cam.position.x=159;assert.equal(createRenderRegion(cam,map),first,'sub-sector jitter does not invalidate the resident region');
cam.position.x=280;assert.notEqual(createRenderRegion(cam,map),first,'translation still streams new sectors');
for(const [cx,cy]of [[100,128],[220,128],[160,68],[160,188]])for(let x=cx;x<cx+5;x++)for(let y=cy;y<cy+5;y++)for(let z=0;z<3;z++)W.setBlock(map,x,y,z,'stone');
W.setBlock(map,162,130,0,'lava');
const {r,gpu}=fixture();const opts={map,mode:'mj',selection:null,images:new Map(),lights:W.buildLights(map),vision:new Set(),explored:new Set(),terrainEpoch:1,path:[]};
r.render(opts);const initial=r.stats(),ground=r.debug().groundBatch,liquids=r.debug().reliefGroup.children.filter(m=>m.userData.liquidSurface);
assert(liquids.length>0);
for(let i=0;i<36;i++){
 map.camera.angle=i*Math.PI/5;map.camera.tilt=Math.sin(i*.3)*.8;
 gpu.shadowMap.needsUpdate=false;r.render(opts);const now=r.stats();
 assert.equal(now.reliefBuilds,initial.reliefBuilds);
 assert.equal(now.occlusionBuilds,initial.occlusionBuilds);
 assert.equal(now.terrainBuilds,initial.terrainBuilds);
 assert.equal(now.liquidBuilds,initial.liquidBuilds);
 assert.equal(r.debug().groundBatch,ground);
 assert.deepEqual(r.debug().reliefGroup.children.filter(m=>m.userData.liquidSurface),liquids);
 assert(Number.isFinite(now.phaseMs.relief));
}
map.camera.fly.x=220;r.render(opts);assert(r.stats().reliefBuilds>=initial.reliefBuilds);
r.dispose();
console.log('PASS: repeated rapid yaw/pitch, stable residency and relief, bounded ground, translation and phase diagnostics.');

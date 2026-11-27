import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import * as T from '../dist/vendor/three.module.min.js';
import {blockObject} from '../dist/construction.mjs';
import {fixture} from '../test-support/three-fixture.mjs';
const map=W.newMap('aim','Aim',64,64);W.prepareBlocks(map);
map.objects=[blockObject('stone',31,30,0,1,1,2,0,'placed')];
W.setBlock(map,30,30,0,'stone');
const {r,canvas}=fixture();Object.assign(map.camera,{mode:'fly',fly:{x:30.5,y:8,z:30.5},angle:0,tilt:.995});
const opts={map,mode:'mj',building:true,selection:null,images:new Map(),lights:W.buildLights(map),vision:new Set(),explored:new Set(),terrainEpoch:1,path:[]};
r.render(opts);
const x=canvas.width/2,y=canvas.height/2;
const target=r.world(x,y);assert(Number.isFinite(target.z),'unlimited ray hits ground or block');
assert.equal(r.world(x,y,1).z,undefined,'distant surface cannot be selected');
assert.deepEqual(r.world(x,y),target,'short query does not leak ray range');
for(const reach of [3,12,32])for(const dx of [-80,0,80])for(const dy of [-40,0,40]){
 const px=x+dx,py=y+dy,point=r.world(px,py,reach),id=r.pick(px,py,null,true,reach);
 assert.deepEqual(r.aimAt(px,py,reach),{point,id},'shared aim matches independently calculated point and ID');
}
let rays=0;const meshes=r.debug().reliefGroup.children.filter(m=>m.visible&&!m.userData.cutOverlay);
for(const m of meshes){const cast=m.raycast;m.raycast=function(...args){rays++;return cast.apply(this,args)}}
r.world(x,y,12);r.pick(x,y,null,true,12);const separate=rays;rays=0;r.aimAt(x,y,12);assert(rays<separate,'shared aim casts against terrain fewer times');
r.dispose();console.log('PASS: limited construction reach, shared aim parity, no duplicate relief query and range restoration.');

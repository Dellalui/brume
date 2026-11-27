import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import * as W from '../dist/world.mjs';
import {perspectiveCamera,cameraBoxEntry,sweepCameraMotion} from '../dist/navigation.mjs';
const make=()=>{const map=W.newMap('camera','Camera',24,24);W.prepareBlocks(map);const actor={...W.newObject('hero',10,10,'hero'),voxelZ:0};map.objects=[actor];Object.assign(map.camera,{mode:'third',angle:-Math.PI/4,tilt:.3,distance:5,scout:{x:0,y:0,z:0}});return {map,actor}};
let {map,actor}=make();
// Camera looks towards the actor, with the boom pointing towards +Z.
for(let y=0;y<6;y++)W.setBlock(map,10,11,y,'stone');
let camera=perspectiveCamera(map,actor,1600,900);
const wall={x:10.5,y:0,z:11.5,w:1,h:6,d:1};
const outside=c=>assert.equal(cameraBoxEntry(c.position,c.position,wall,.04),Infinity,'camera does not intersect solid wall');
outside(camera);assert(camera.position.z<11);
// A tiny advance from the player camera must not teleport the focal point through the wall.
for(let z=0;z<=3;z+=.075){map.camera.scout={x:0,y:0,z};camera=perspectiveCamera(map,actor,1600,900);outside(camera);assert(camera.position.z<11,'scout cannot cross wall');assert(camera.position.toArray().every(Number.isFinite));}
// Glass is physically solid even though vision rays pass through it.
for(let y=0;y<6;y++)W.setBlock(map,10,11,y,'glass');
camera=perspectiveCamera(map,actor,1600,900);outside(camera);assert(camera.position.z<11);
// Placed/scaled construction blocks, including rotated walls, use real volume.
({map,actor}=make());map.objects.push({...W.newObject('block',10,11,'wall'),material:'stone',baseZ:0,w:1,d:1,height:6,facing:Math.PI/4});map.camera.scout.z=2;camera=perspectiveCamera(map,actor,1600,900);assert.equal(cameraBoxEntry(camera.position,camera.position,{...wall,angle:Math.PI/4},.04),Infinity);
// The camera treats opaque lava flow as an obstruction but does not change actor movement or saves.
({map,actor}=make());const flows={cells:[{kind:'lava',source:false,x:10,y:11,z:0,h:3,renderH:3}]};map.camera.scout.z=2;camera=perspectiveCamera(map,actor,1600,900,{liquids:flows});assert(camera.position.z<11||camera.position.y>=3.04);assert.equal(cameraBoxEntry(camera.position,camera.position,{...wall,h:3},.04),Infinity);
// Ceiling prevents an emergency overhead boom from clipping through it.
({map,actor}=make());for(let x=9;x<=11;x++)for(let z=9;z<=11;z++){W.setBlock(map,x,z,2,'stone');if(x!==10||z!==10)for(let y=0;y<2;y++)W.setBlock(map,x,z,y,'stone');}
camera=perspectiveCamera(map,actor,1600,900);assert(camera.position.y<2);assert(camera.position.x>10&&camera.position.x<11&&camera.position.z>10&&camera.position.z<11);
// A single large fly input must not tunnel through a wall; water is still passable.
({map,actor}=make());W.setBlock(map,10,11,1,'stone');let from={x:10.5,y:1.5,z:10.5},to={x:10.5,y:1.5,z:13};let clipped=sweepCameraMotion(map,from,to);assert(clipped.z<11&&clipped.z>10.5);W.setBlock(map,10,11,1,'water');assert.deepEqual(sweepCameraMotion(map,from,to),to);
// MJ flight must not snag on the artificial safety skins of adjacent
// ceiling/floor voxels, including seams in half-height roofs.
({map,actor}=make());
for(let x=8;x<=16;x++)for(let z=8;z<=16;z++)W.setBlock(map,x,z,2,'stone');
const close=(a,b,message)=>assert(Math.abs(a.x-b.x)<1e-6&&Math.abs(a.y-b.y)<1e-6&&Math.abs(a.z-b.z)<1e-6,message);
for(const y of [1.82,1.95,2,3,3.05,3.18,3.22]){
 const a={x:10.5,y,z:10.5},b={x:14.5,y,z:13.5};
 close(sweepCameraMotion(map,a,b),b,'MJ glides along ceiling or roof at height '+y);
 close(sweepCameraMotion(map,b,a),a,'reverse direction glides over the same seams');
}
// Near-contact exemptions must never allow crossing the actual solid.
for(const [y,target]of [[3.05,1.5],[1.95,3.5]]){
 const a={x:10.5,y,z:10.5};
 const result=sweepCameraMotion(map,a,{...a,y:target});
 assert(y>3?result.y>=3:result.y<=2,'vertical motion cannot penetrate the ceiling');
}
W.setBlock(map,12,10,3,'stone');
const roofStart={x:10.5,y:3.05,z:10.5},roofEnd={x:14.5,y:3.05,z:10.5};
assert(sweepCameraMotion(map,roofStart,roofEnd).x<12,'wall standing on roof still blocks forward flight');
W.setBlock(map,12,10,3,null);
for(let x=8;x<=16;x++)for(let z=8;z<=16;z++)W.setBlock(map,x,z,2,'stone',.5);
for(const y of [2.5,2.55,1.95]){
 const a={x:10.5,y,z:10.5},b={x:14.5,y,z:13.5};close(sweepCameraMotion(map,a,b),b,'half-height roof seam');
}
// The same contact rule applies to consecutive placed blocks.
({map,actor}=make());for(let x=8;x<=15;x++)map.objects.push({...W.newObject('block',x,10,'roof-'+x),material:'stone',baseZ:2,w:1,d:1,height:1});
for(const y of [1.95,3.05]){
 const a={x:9.5,y,z:10.5},b={x:14.5,y,z:10.5};close(sweepCameraMotion(map,a,b),b,'placed ceiling seam');
}
// Free MJ flight is still independently positionable (construction mode).
Object.assign(map.camera,{mode:'fly',fly:{x:12,y:-4,z:12}});assert.equal(perspectiveCamera(map,actor,1200,800).position.y,-4);
console.log('PASS: swept camera clearance, scout offset, glass, rotated block, lava, low ceiling and fly movement.');

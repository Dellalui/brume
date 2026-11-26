import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import * as W from '../dist/world.mjs';
import {renderer} from '../dist/scene.mjs';
import {lightingAnchor,selectSceneLights} from '../dist/shadow-system.mjs';
import {createRenderRegion} from '../dist/render-region.mjs';
function canvasStub(w=1280,h=850){const ctx=new Proxy({measureText:s=>({width:s.length*6}),createRadialGradient:()=>({addColorStop(){}})},{get(o,k){return o[k]||(()=>{})},set(o,k,v){o[k]=v;return true}});return {width:w,height:h,style:{},getContext:()=>ctx,getBoundingClientRect:()=>({width:w,height:h}),parentElement:{append(){}},remove(){}}}
const canvas=canvasStub(),gpu={shadowMap:{},setClearColor(){},setPixelRatio(){},setSize(){},render(s,c){s.updateMatrixWorld(true);c.updateMatrixWorld(true)},dispose(){}};
const r=renderer(canvas,{createRenderer:()=>gpu,createCanvas:()=>canvasStub(300,150)});
const map=W.newMap('shadows','Shadows',32,24);W.prepareBlocks(map);
const npc=W.newObject('npc',16,12,'npc'),left=W.newObject('light',8,12,'left'),right=W.newObject('light',24,12,'right');
npc.frameCount=4;npc.frames={0:'front',1:'right',2:'back',3:'left'};npc.imageId='front';map.objects=[npc,left,right];
const images=new Map(Object.values(npc.frames).map((id,i)=>[id,{width:100+i*10,height:200}]));
const opts={map,mode:'mj',selection:npc.id,images,lights:W.buildLights(map),vision:new Set(),explored:new Set(),terrainEpoch:1};
function cameraAt(x,y,z,angle){Object.assign(map.camera,{mode:'fly',fly:{x,y,z},angle,tilt:.4});r.render(opts)}
function actor(){return r.debug().cache.get(npc.id).root}
function shadowMatrix(){return actor().userData.shadowVolume.matrixWorld.elements.slice()}
const eq=(a,b,msg)=>assert(a.every((v,i)=>Math.abs(v-b[i])<1e-7),msg);
const lightPosition=()=>r.debug().pointLights.find(l=>l.castShadow)?.position.toArray();
cameraAt(16.5,4,3,0);
const original=shadowMatrix(),light=lightPosition(),firstSprite=actor().userData.sprite.material.map;
assert(actor().userData.shadowVolume.castShadow);
assert(!actor().userData.sprite.castShadow);
assert(!actor().userData.shadowVolume.material.colorWrite&&!actor().userData.shadowVolume.material.depthWrite);
assert(!actor().userData.shadowVolume.userData.pickable);
const contact=actor().children.find(c=>c.userData.contact);
assert(!contact.castShadow&&!contact.material.depthWrite);
assert(contact.material.map.image.data[3]===0,'contact shadow must fade to transparent');
for(const [x,y,z,a] of [[24,4,12.5,1.5],[16.5,18,21,3],[2,5,12.5,4.5],[16.5,25,12.5,5]]){
 cameraAt(x,y,z,a);eq(shadowMatrix(),original,'camera movement, pitch and yaw cannot change shadow volume');eq(lightPosition(),light,'camera cannot switch point-shadow owner on a small map');
 assert(!actor().userData.sprite.castShadow);
}
assert.notEqual(actor().userData.sprite.material.map,firstSprite,'directional appearance can change independently');
npc.x+=1;gpu.shadowMap.needsUpdate=false;r.render(opts);assert(gpu.shadowMap.needsUpdate,'moving a billboard updates its world shadow');assert.notDeepEqual(shadowMatrix(),original);
npc.shadow=false;r.render(opts);assert(!actor().userData.shadowVolume.castShadow);assert(!actor().children.find(c=>c.userData.contact).visible);
npc.shadow=true;npc.visible=false;r.render(opts);assert(!actor().visible&&!actor().userData.shadowVolume.castShadow);
npc.visible=true;npc.flat=true;r.render(opts);assert(!actor().userData.shadowVolume&&!actor().userData.sprite.castShadow);
npc.flat=false;npc.tokenFixed=true;r.render(opts);assert(actor().userData.shadowVolume.castShadow);const fixed=shadowMatrix();cameraAt(4,3,4,1);eq(shadowMatrix(),fixed,'fixed token shadow also remains stable');
map.environment={enabled:true,syncLight:true,hour:12};r.render(opts);const sun=r.debug().scene.children.find(x=>x.isDirectionalLight&&x.castShadow);assert(sun);
const direction=sun.position.clone().sub(sun.target.position).normalize();assert(direction.distanceTo(r.debug().environment.uniforms.sunDirection.value)<1e-6,'shadow sun and visible sun agree');
map.environment.hour=0;r.render(opts);assert(!sun.castShadow&&sun.intensity===0,'no sunlight shadow at midnight');
const farMap=W.newMap('big','Big',512,512);const c=new T.PerspectiveCamera();c.position.set(121,6,135);const anchor=lightingAnchor(farMap,c);c.rotation.y=2;c.position.set(126,7,139);assert.deepEqual(lightingAnchor(farMap,c),anchor);
const lights=W.buildLights(map).sources;assert.deepEqual(selectSceneLights(lights,{x:16,y:12}),selectSceneLights([...lights].reverse(),{x:16,y:12}));
const whole=createRenderRegion(c,map);assert.equal(whole.chunks.size,4);assert(whole.contains(1,1)&&whole.contains(31,23));
r.dispose();console.log('PASS: stable world-space actor shadows, independent visual frames, soft contact shadows, movement, visibility, stable lights, solar direction and map streaming.');

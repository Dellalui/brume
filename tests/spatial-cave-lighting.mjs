import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import * as W from '../dist/world.mjs';
import {DETAIL_LIGHTS,buildSpatialLightGrid,createSpatialLights,injectSpatialLighting} from '../dist/spatial-lights.mjs';
import {injectEmitterShadow} from '../dist/emitter-shadow.mjs';
import {pointShadowResolution} from '../dist/shadow-system.mjs';
import {fixture} from '../test-support/three-fixture.mjs';
const make=(i,x=i*8,y=10,z=3)=>({sourceId:'l'+i,x,y,z,radius:5,power:1,color:'#ffffff'});
const scattered=Array.from({length:40},(_,i)=>make(i));
const grid=buildSpatialLightGrid(scattered);
assert.equal(grid.sources,40);assert(grid.occupied>40);assert.equal(grid.overflow,0);
function entry(g,p){const [x,y,z]=p.map((v,i)=>Math.floor((v-g.origin[i])/g.cell)),[nx,ny,nz]=g.dimensions;assert(x>=0&&x<nx&&y>=0&&y<ny&&z>=0&&z<nz);return ((z*ny+y)*nx+x)*8}
for(const s of scattered){const at=entry(grid,[s.x,s.z,s.y]),offset=grid.data[at],n=grid.data[at+1];assert(n>0);let found=false;for(let i=0;i<n;i++){const j=(offset+i*2)*4;if(grid.data[j]===s.x&&grid.data[j+1]===s.z&&grid.data[j+2]===s.y)found=true}assert(found,'every spatially separated lamp is represented')}
const dense=buildSpatialLightGrid(Array.from({length:40},(_,i)=>make(i,10,10,3)));
const at=entry(dense,[10,3,10]);assert.equal(dense.data[at+1],DETAIL_LIGHTS);assert(dense.data[at+4]>0,'dense overflow contributes instead of switching off');
const manager=createSpatialLights();assert(manager.update(scattered,scattered.slice(0,8)));assert.equal(manager.stats().spatialLightSources,32);assert(!manager.update(scattered,scattered.slice(0,8)));assert(!manager.update([...scattered],scattered.slice(0,8)));assert(manager.update(scattered,scattered.slice(1,9)));manager.dispose();
assert.equal(pointShadowResolution(37),128);assert.equal(pointShadowResolution(30,128),128);assert.equal(pointShadowResolution(27,128),256);
const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
injectSpatialLighting(shader,{});assert(shader.vertexShader.includes('brumeGridWorld ='));assert(shader.fragmentShader.includes('reflectedLight.directDiffuse += brumeGridIrradiance'));
const shadow={uniforms:{},vertexShader:T.ShaderLib.distanceRGBA.vertexShader,fragmentShader:T.ShaderLib.distanceRGBA.fragmentShader};
injectEmitterShadow(shadow,new T.Vector3(.5,.5,.5));assert(shadow.vertexShader.includes('modelMatrix * instanceMatrix'));assert(shadow.fragmentShader.includes('if(brumeSelfEmitter>0.5) discard'));
const map=W.newMap('omni','Omni cave',64,64);W.prepareBlocks(map);map.lighting.bounce=false;map.blockLighting={quality:2,radius:5,power:1};
for(let i=0;i<12;i++)W.setBlock(map,8+i*4,20,2,'glowstone');
Object.assign(map.camera,{mode:'fly',fly:{x:20,y:3,z:30},angle:0});
const lights=W.buildLights(map);assert.equal(lights.sources.filter(s=>s.block).length,12);assert(lights.sources.every(s=>s.renderPosition));
const {r}=fixture(),opts={map,mode:'mj',building:true,images:new Map(),lights,vision:new Set(),explored:new Set(),terrainEpoch:1,path:[]};
r.render(opts);assert.equal(r.stats().pointIllumination,8);assert.equal(r.stats().spatialLightSources,4);assert.equal(r.stats().pointShadows,4);
for(const l of r.debug().pointLights.filter(l=>l.visible)){assert.equal(l.position.y,2.5);assert.equal(l.position.z,20.5);assert.equal(l.position.x%1,.5)}
const emissive=r.debug().reliefGroup.children.filter(m=>m.userData.reliefBatch?.startsWith('glowstone|'));assert(emissive.length&&emissive.every(m=>m.customDistanceMaterial?.isMeshDistanceMaterial));
const before=r.stats().spatialLightRebuilds;map.camera.angle+=Math.PI;r.render(opts);assert.equal(r.stats().spatialLightRebuilds,before,'turning does not rebuild lighting grid');
map.lighting.shadows=false;r.render(opts);assert.equal(r.stats().pointShadows,0);assert.equal(r.stats().pointIllumination+r.stats().spatialLightSources,12);
r.dispose();console.log('PASS: omnidirectional emitter centers, per-instance self-shadow exemption, spatial overflow lighting, distance shadow LOD and stable rotation.');

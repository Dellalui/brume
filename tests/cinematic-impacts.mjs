import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {createThrowVisuals} from '../dist/throw-visuals.mjs';
import {createEffects} from '../dist/effects.mjs';
import {PRESETS,throwConfig,IMPACT_MS} from '../dist/throw-effects.mjs';
import {canvasStub} from '../test-support/three-fixture.mjs';
assert.equal(IMPACT_MS,3000);
const factory=createEffects(()=>canvasStub(128,128)),visuals=createThrowVisuals(factory),scene=new T.Scene(),camera=new T.PerspectiveCamera();
scene.add(visuals.group);camera.position.set(8,6,12);camera.lookAt(0,1.8,0);
let cases=0;
for(const quality of ['low','balanced','high'])for(const preset of PRESETS){
 const config=throwConfig({preset:preset.id,power:6}),position={x:0,y:0,z:.12},tail={x:1,y:1,z:1},p={id:preset.id,config,position,tail,phase:'flight',age:0};
 assert(visuals.update([p],0,camera,quality));
 const root=visuals.group.children[0],initial=visuals.stats().instances;
 assert(initial<=({low:29,balanced:48,high:67}[quality]));
 assert(root.getObjectByName('Projectile trail').visible);
 p.phase='impact';
 for(let i=0;i<=180;i++){
  p.age=i/60;assert(visuals.update([p],p.age,camera,quality));assert.equal(visuals.group.children[0],root);assert.equal(visuals.stats().instances,initial);
  root.traverse(o=>{if(o.isInstancedMesh)assert(o.instanceMatrix.array.every(Number.isFinite))});
  if(i===6){assert.equal(root.getObjectByName('Impact flash').visible,preset.id!=='dust');assert(root.getObjectByName('Shockwave').visible);if(preset.id==='storm')assert(root.getObjectByName('Décharges ramifiées'));if(preset.id==='arcane')assert(root.getObjectByName('Arcane column').visible)}
  if(i===40)assert(root.getObjectByName('Residual smoke').visible);
  if(i===170){assert(!root.getObjectByName('Shockwave').visible);assert(!root.getObjectByName('3D fragments').visible)}
 }
 assert(!visuals.update([],4,camera,quality));assert.equal(visuals.stats().active,0);cases++;
}
assert.equal(cases,18);visuals.dispose();factory.dispose();
console.log('PASS: all six staged impact animations in three quality levels, finite instance matrices, fixed allocation budget, persistent smoke and cleanup.');

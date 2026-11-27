import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {createThrowVisuals} from '../dist/throw-visuals.mjs';
import {impactEnvelope} from '../dist/impact-bodies.mjs';
import {createEffects} from '../dist/effects.mjs';
import {PRESETS,throwConfig,IMPACT_MS} from '../dist/throw-effects.mjs';
import {canvasStub} from '../test-support/three-fixture.mjs';
assert.equal(IMPACT_MS,3000);
assert.equal(throwConfig({power:3,visualScale:99,visualQuality:'high'}).radius,3);
assert.equal(throwConfig({power:3,visualScale:99,visualQuality:'high'}).visualScale,2);
assert.equal(throwConfig({power:3,visualScale:-99}).visualScale,.75);
assert.equal(throwConfig({visualQuality:'invalid'}).visualQuality,'auto');
const factory=createEffects(()=>canvasStub(128,128)),visuals=createThrowVisuals(factory),scene=new T.Scene(),camera=new T.PerspectiveCamera();
scene.add(visuals.group);camera.position.set(8,6,12);camera.lookAt(0,1.8,0);
let cases=0;
for(const quality of ['low','balanced','high'])for(const preset of PRESETS.slice(0,9)){
 const config=throwConfig({preset:preset.id,power:6}),position={x:0,y:0,z:.12},tail={x:1,y:1,z:1},p={id:preset.id,config,position,tail,phase:'flight',age:0};
 assert(visuals.update([p],0,camera,quality));
 const root=visuals.group.children[0],initial=visuals.stats().instances;
 assert.equal(initial,24,'only flight trail allocated before impact');
 assert(root.getObjectByName('Projectile trail').visible);assert(!root.getObjectByName('Corps 3D procédural'),'flight does not construct impact body');
 p.phase='impact';visuals.update([p],0,camera,quality);const body=root.getObjectByName('Corps 3D procédural'),core=body.getObjectByName('Noyau turbulent 3D'),front=body.getObjectByName('Front de pression 3D'),impactInstances=visuals.stats().instances;assert(core.material.isShaderMaterial&&front.material.isShaderMaterial);assert(!root.getObjectByName('Projectile trail'));
 for(let i=0;i<180;i++){
  p.age=i/60;assert(visuals.update([p],p.age,camera,quality));assert.equal(visuals.group.children[0],root);assert.equal(visuals.stats().instances,impactInstances);
  root.traverse(o=>{if(o.isInstancedMesh)assert(o.instanceMatrix.array.every(Number.isFinite))});
  if(i===6){assert(body.visible&&core.visible);assert.equal(front.visible,preset.id!=='dust');assert(core.scale.x>0&&core.material.uniforms.fade.value>0);assert.equal(root.getObjectByName('Impact flash').visible,preset.id!=='dust');assert(root.getObjectByName('Shockwave').visible);if(preset.id==='storm')assert(root.getObjectByName('Décharges ramifiées'));if(preset.id==='arcane')assert(root.getObjectByName('Arcane column').visible)}
  if(i===40)assert(root.getObjectByName('Residual smoke').visible);
  if(i===170){assert(!core.visible&&!front.visible);assert(!root.getObjectByName('Shockwave').visible);assert(!root.getObjectByName('3D fragments').visible)}
 }
 assert(!visuals.update([],4,camera,quality));assert.equal(visuals.stats().active,0);cases++;
}
assert.equal(cases,27);
const p={id:'override',config:throwConfig({preset:'fire',power:3,visualScale:2,visualQuality:'high'}),position:{x:0,y:0,z:0},tail:{x:0,y:0,z:0},phase:'impact',age:.2};
visuals.update([p],.2,camera,'low');assert.equal(visuals.stats().instances,60);
const core=visuals.group.children[0].getObjectByName('Noyau turbulent 3D');assert.equal(core.scale.x,impactEnvelope('fire',.2,6).width);assert.equal(p.config.radius,3);
visuals.dispose();factory.dispose();
console.log('PASS: all nine staged impact animations in three quality levels, finite instance matrices, fixed allocation budget, persistent smoke and cleanup.');

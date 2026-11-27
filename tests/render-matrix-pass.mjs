import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import * as W from '../dist/world.mjs';
import {fixture} from '../test-support/three-fixture.mjs';
// The actual WebGLRenderer (and fixture) update matrices in render(). Brume
// must not force a second traversal of the same hierarchy before that call.
const {r,gpu}=fixture();
const map=W.newMap('matrix-pass','Matrix pass',48,48);W.prepareBlocks(map);
const hero=W.newObject('hero',20,20,'hero');hero.voxelZ=0;map.objects=[hero,W.newObject('tree',23,23,'tree')];
W.setBlock(map,22,20,0,'stone');
const opts={map,mode:'mj',selection:hero.id,images:new Map(),lights:W.buildLights(map),vision:new Set(),explored:new Set(),terrainEpoch:1,path:[]};
Object.assign(map.camera,{followId:hero.id,fly:{x:24,y:8,z:24}});
const scene=r.debug().scene,update=scene.updateMatrixWorld;
let passes=0;scene.updateMatrixWorld=function(force){passes++;return update.call(this,force)};
for(const mode of ['fly','third','first','tactical','fly']){
 map.camera.mode=mode;hero.x+=.25;hero.facing+=.15;const last=passes,draws=gpu.calls;
 r.render(opts);
 assert.equal(gpu.calls,draws+1);
 assert.equal(passes,last+1,'one scene-wide matrix pass per ordinary render');
 const root=r.debug().cache.get(hero.id).root;
 assert.equal(root.matrixWorld.elements[12],W.center(hero).x);
 assert.equal(root.matrixWorld.elements[14],W.center(hero).y);
 scene.traverse(o=>{
  if(!o.matrixWorldAutoUpdate)return;
  const expected=o.parent?new T.Matrix4().multiplyMatrices(o.parent.matrixWorld,o.matrix):o.matrix;
  assert.deepEqual(o.matrixWorld.elements,expected.elements,'world transform remains current');
 });
}
r.dispose();
console.log('PASS: single matrix traversal with current transforms across camera modes.');

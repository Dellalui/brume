import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {accelerateInstancePicking,buildRayBuckets,rayCandidates} from '../dist/instance-picking.mjs';
const geometry=new T.BoxGeometry(1,1,1),material=new T.MeshBasicMaterial(),original=new T.InstancedMesh(geometry,material,4096),fast=new T.InstancedMesh(geometry,material,4096),matrix=new T.Matrix4();
const bounds=[];
for(let x=0;x<64;x++)for(let z=0;z<64;z++){
 const i=x*64+z;matrix.makeTranslation(x+.5,.5,z+.5);original.setMatrixAt(i,matrix);fast.setMatrixAt(i,matrix);bounds.push({min:[x,0,z],max:[x+1,1,z+1]});
}
fast.computeBoundingSphere();accelerateInstancePicking(fast);
let matrixReads=0;const getMatrixAt=fast.getMatrixAt;fast.getMatrixAt=function(...args){matrixReads++;return getMatrixAt.apply(this,args)};
const miss=new T.Raycaster(new T.Vector3(32.5,100,32.5),new T.Vector3(0,1,0));
assert.equal(miss.intersectObject(fast,false).length,0);assert.equal(matrixReads,0,'cold offscreen ray does not build instance index');
miss.set(new T.Vector3(32.5,100,32.5),new T.Vector3(0,-1,0));miss.far=1;assert.equal(miss.intersectObject(fast,false).length,0);assert.equal(matrixReads,0,'short ray rejects distant mesh before indexing');
assert.deepEqual(rayCandidates(buildRayBuckets(bounds),bounds,[32.5,8,32.5],[0,-1,0]),[32*64+32]);
const ray=new T.Raycaster(),key=h=>[h.instanceId,Math.round(h.distance*1e6),...h.face.normal.toArray()];
function compare(o,d){
 ray.set(new T.Vector3(...o),new T.Vector3(...d).normalize());
 const a=ray.intersectObject(original,false).map(key).sort(),b=ray.intersectObject(fast,false).map(key).sort();assert.deepEqual(b,a);
}
for(const [o,d]of [[[32.5,8,32.5],[0,-1,0]],[[1.4,8,4.2],[.6,-.4,.8]],[[0,.5,0],[1,0,1]],[[100,4,100],[0,-1,0]],[[32,5,32],[0,-1,0]]])compare(o,d);
matrix.makeRotationY(.7).setPosition(32.5,2.5,32.5);for(const m of [original,fast]){m.setMatrixAt(2080,matrix);m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere()}
compare([32.5,8,32.5],[0,-1,0]);
for(const m of [original,fast]){m.position.set(3,0,2);m.updateMatrixWorld(true)}
compare([35.5,8,34.5],[0,-1,0]);
original.dispose();fast.dispose();geometry.dispose();material.dispose();
console.log('PASS: exact Three raycast parity, instance transforms, cache invalidation and 4096-to-1 broad phase.');

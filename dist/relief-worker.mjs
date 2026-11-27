import * as T from './vendor/three.module.min.js';
import {buildReliefSector} from './relief-sector-plans.mjs';
// No WebGL context is created. The worker prepares CPU-side matrices and
// bounding spheres; transferred arrays are then consumed by the renderer.
const dummy=new T.Object3D(),matrix=new T.Matrix4(),baseSphere=new T.Sphere(new T.Vector3(),Math.sqrt(.75)),part=new T.Sphere();
function pack(plan){
 const matrices=new Float32Array(plan.cells.length*16),sphere=new T.Sphere().makeEmpty();
 for(let i=0;i<plan.cells.length;i++){
  const b=plan.cells[i];dummy.position.set(b.x+.5,b.z+b.h/2,b.y+.5);dummy.scale.set(b.w||1,b.h,b.d||1);dummy.rotation.y=-(b.angle||0);dummy.updateMatrix();
  matrices.set(dummy.matrix.elements,i*16);matrix.fromArray(matrices,i*16);sphere.union(part.copy(baseSphere).applyMatrix4(matrix));
 }
 plan.matrices=matrices;plan.sphere=[sphere.center.x,sphere.center.y,sphere.center.z,sphere.radius];return matrices.buffer;
}
export function buildReliefWorkerResult(payload){
 const {map,origin,size,cut,slice,mode,large,tasks,imageIds}=payload,chunks=payload.region?new Set(payload.region.chunks):null;
 const region=chunks?{cell:(x,y)=>chunks.has(Math.floor(x/16)+','+Math.floor(y/16))}:null;
 const images=new Map(imageIds.map(id=>[id,true])),groupsById=new Map(map.groups.map(g=>[g.id,g])),results=[],transfer=[];
 for(const task of tasks){
  const occ={hiddenObjects:new Set(task.hiddenObjects),hiddenVoxels:new Set(task.hiddenVoxels),fullUnits:new Set(task.fullUnits)};
  const entry=buildReliefSector(task.src,{map,occ,region,origin,size,cut,slice,mode,large,images,groupsById});
  for(const plan of entry.plans)transfer.push(pack(plan));
  results.push({key:task.key,entry});
 }
 return {results,transfer};
}
if(typeof self!=='undefined'&&typeof self.postMessage==='function'&&typeof document==='undefined'){
 self.onmessage=({data})=>{try{const {results,transfer}=buildReliefWorkerResult(data.payload);self.postMessage({id:data.id,results},transfer)}catch(error){self.postMessage({id:data.id,error:String(error)})}};
}

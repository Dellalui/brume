import * as T from './vendor/three.module.min.js';
export function buildRayBuckets(bounds,cellSize=4){
 const bins=new Map();
 for(let i=0;i<bounds.length;i++){
  const b=bounds[i],key=b.min.map((v,j)=>Math.floor((v+b.max[j])/(2*cellSize))).join(',');
  let bin=bins.get(key);
  if(!bin){bin={min:[...b.min],max:[...b.max],entries:[]};bins.set(key,bin)}
  for(let j=0;j<3;j++){bin.min[j]=Math.min(bin.min[j],b.min[j]);bin.max[j]=Math.max(bin.max[j],b.max[j])}
  bin.entries.push(i);
 }
 return [...bins.values()];
}
export function rayBoxDistance(origin,direction,min,max){
 let lo=0,hi=Infinity;
 for(let i=0;i<3;i++){
  const d=direction[i],p=origin[i];
  if(Math.abs(d)<1e-12){if(p<min[i]-1e-9||p>max[i]+1e-9)return Infinity;continue}
  let a=(min[i]-p)/d,b=(max[i]-p)/d;if(a>b)[a,b]=[b,a];
  lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi+1e-9<lo)return Infinity;
 }
 return lo;
}
export function rayCandidates(bins,bounds,origin,direction,maxDistance=Infinity){
 const candidates=[];
 for(const bin of bins){
  const entry=rayBoxDistance(origin,direction,bin.min,bin.max);if(!Number.isFinite(entry)||entry>maxDistance)continue;
  for(const i of bin.entries){const b=bounds[i];const d=rayBoxDistance(origin,direction,b.min,b.max);if(Number.isFinite(d)&&d<=maxDistance)candidates.push(i)}
 }
 return candidates;
}
// Preserve exact per-triangle raycasting, normal and instance ID.
export function accelerateInstancePicking(mesh,threshold=48){
 const original=mesh.raycast,instance=new T.Matrix4(),inverse=new T.Matrix4(),box=new T.Box3(),localRay=new T.Ray(),sphere=new T.Sphere(),localEnd=new T.Vector3(),proxy=new T.Mesh(),hits=[];
 let index=null;
 function rebuild(){
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  const bounds=[];
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,instance);box.copy(mesh.geometry.boundingBox).applyMatrix4(instance);bounds.push({min:box.min.toArray(),max:box.max.toArray()})}
  index={geometry:mesh.geometry,version:mesh.instanceMatrix.version,count:mesh.count,bounds,bins:buildRayBuckets(bounds)};
 }
 mesh.raycast=function(raycaster,intersections){
  if(!mesh.material||mesh.morphTexture)return original.call(mesh,raycaster,intersections);
  // Match Three's enclosing-sphere broad phase BEFORE constructing a cold
  // per-instance index. Looking at the sky or away from a chunk must not
  // walk thousands of instance transforms just to reject the ray.
  if(mesh.boundingSphere===null)mesh.computeBoundingSphere();
  sphere.copy(mesh.boundingSphere).applyMatrix4(mesh.matrixWorld);
  if(!raycaster.ray.intersectsSphere(sphere)||raycaster.ray.origin.distanceTo(sphere.center)-sphere.radius>raycaster.far)return;
  if(mesh.count<threshold)return original.call(mesh,raycaster,intersections);
  if(!index||index.geometry!==mesh.geometry||index.version!==mesh.instanceMatrix.version||index.count!==mesh.count)rebuild();
  inverse.copy(mesh.matrixWorld).invert();localRay.copy(raycaster.ray).applyMatrix4(inverse);
  const localFar=Number.isFinite(raycaster.far)?localRay.origin.distanceTo(raycaster.ray.at(raycaster.far,localEnd).applyMatrix4(inverse))+1e-7:Infinity;
  const candidates=rayCandidates(index.bins,index.bounds,localRay.origin.toArray(),localRay.direction.toArray(),localFar);
  proxy.geometry=mesh.geometry;proxy.material=mesh.material;
  for(const i of candidates){
   mesh.getMatrixAt(i,instance);proxy.matrixWorld.multiplyMatrices(mesh.matrixWorld,instance);hits.length=0;proxy.raycast(raycaster,hits);
   for(const hit of hits){hit.instanceId=i;hit.object=mesh;intersections.push(hit)}
  }
 };
 return mesh;
}

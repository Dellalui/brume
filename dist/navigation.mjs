import {hasBlockForm,formCollisionBoxes} from './block-forms.mjs';
import * as T from './vendor/three.module.min.js';
import * as W from './world.mjs';
export function cameraAxes(angle,tilt){let pitch=Math.asin(W.clamp(tilt,-.995,.995)),fx=(Math.cos(angle)+Math.sin(angle))/Math.SQRT2,fz=(Math.cos(angle)-Math.sin(angle))/Math.SQRT2;return{forward:new T.Vector3(-fx*Math.cos(pitch),-Math.sin(pitch),-fz*Math.cos(pitch)),right:new T.Vector3(fz,0,-fx)}}
const EPS=1e-6;
// Sweep a conservative camera volume, not an infinitely thin visibility ray.
// Box coordinates: x/z centre, y base, w/d horizontal sizes, h height.
export function cameraBoxEntry(a,b,box,radius=0){
 if(Math.max(a.y,b.y)<=box.y-radius+EPS||Math.min(a.y,b.y)>=box.y+box.h+radius-EPS)return Infinity;
 // Reject distant boxes before allocating local-space arrays. The rotated
 // bound is deliberately conservative, including the expanded safety radius.
 const angle=box.angle||0,ex=angle?(box.w+box.d)/2+2*radius:box.w/2+radius,ez=angle?ex:box.d/2+radius;
 if(Math.max(a.x,b.x)<box.x-ex-EPS||Math.min(a.x,b.x)>box.x+ex+EPS||Math.max(a.z,b.z)<box.z-ez-EPS||Math.min(a.z,b.z)>box.z+ez+EPS)return Infinity;
 const c=box.c??Math.cos(angle),s=box.s??Math.sin(angle);
 const local=p=>[(p.x-box.x)*c+(p.z-box.z)*s,p.y-box.y,-(p.x-box.x)*s+(p.z-box.z)*c];
 const p=local(a),q=local(b),lo=[-box.w/2-radius,-radius,-box.d/2-radius],hi=[box.w/2+radius,box.h+radius,box.d/2+radius];
 let enter=0,exit=1;
 for(let i=0;i<3;i++){
  const v=q[i]-p[i];
  if(Math.abs(v)<EPS){if(p[i]<=lo[i]+EPS||p[i]>=hi[i]-EPS)return Infinity;continue}
  let t0=(lo[i]-p[i])/v,t1=(hi[i]-p[i])/v;if(t0>t1)[t0,t1]=[t1,t0];
  enter=Math.max(enter,t0);exit=Math.min(exit,t1);if(exit<=enter+EPS)return Infinity;
 }
 return enter;
}
function clearPoint(p,boxes,r){return !boxes.some(b=>cameraBoxEntry(p,p,b,r)===0)}
function clipFraction(a,b,boxes,r,slideContacts=false){
 let t=1;const length=a.distanceTo(b);if(length<EPS)return 1;
 for(const box of boxes){
  const hit=cameraBoxEntry(a,b,box,r);if(hit>=t)continue;
  // When already touching the safety margin, allow motion away from it,
  // but never allow that exemption to carry the camera through a solid.
  // MJ may enter the safety skin of an adjacent box while gliding along
   // a continuous surface. Still require a clear sweep of the real solid
   // and a separating axis that is stationary or moving outward.
   if((hit===0||slideContacts)&&cameraBoxEntry(a,b,box,0)===Infinity){
   if(!slideContacts&&hit===0&&cameraBoxEntry(b,b,box,r)===Infinity)continue;
   const c=box.c??Math.cos(box.angle||0),s=box.s??Math.sin(box.angle||0),p=[(a.x-box.x)*c+(a.z-box.z)*s,a.y-box.y,-(a.x-box.x)*s+(a.z-box.z)*c],q=[(b.x-box.x)*c+(b.z-box.z)*s,b.y-box.y,-(b.x-box.x)*s+(b.z-box.z)*c];
   const lo=[-box.w/2,0,-box.d/2],hi=[box.w/2,box.h,box.d/2];
   if(!slideContacts){if(p.some((v,i)=>v<=lo[i]&&q[i]<=v||v>=hi[i]&&q[i]>=v))continue}
   else if(p.some((v,i)=>{
    // Only a genuinely separating axis can waive the expanded radius.
    // A stationary horizontal coordinate exactly on a voxel seam is
    // NOT free space: adjacent columns can occupy both sides of it.
    // Preserve roof/floor skimming at their exact horizontal surface.
    if(i===1)return v<=lo[i]+EPS&&q[i]<=v+EPS||v>=hi[i]-EPS&&q[i]>=v-EPS;
    return v<lo[i]-EPS&&q[i]<=v+EPS||v>hi[i]+EPS&&q[i]>=v-EPS||
      v<=lo[i]&&q[i]<v-EPS||v>=hi[i]&&q[i]>v+EPS;
   }))continue;
  }
  t=hit;
 }
 return Math.max(0,t===1?1:t-.025/length);
}
// Reuse exact integer terrain windows while the camera or player moves inside
// them. Dynamic objects and derived lava remain live; only voxel boxes cache.
const terrainWindows=new WeakMap(),lastFlyPose=new WeakMap();
function appendBox(boxes,x,y,z,w,h,d,angle=0,ground=false){
 if([x,y,z,w,h,d,angle].every(Number.isFinite)&&w>0&&h>0&&d>0)boxes.push({x,y,z,w,h,d,angle,c:Math.cos(angle),s:Math.sin(angle),ground});
}
function terrainBoxes(map,x0,x1,z0,z1){
 const left=Math.max(0,Math.floor(x0)),right=Math.min(map.width,Math.ceil(x1)),top=Math.max(0,Math.floor(z0)),bottom=Math.min(map.height,Math.ceil(z1));
 const key=[left,right,top,bottom].join(',');
 let entry=terrainWindows.get(map);
 const cacheable=!!map.blocks&&Number.isFinite(map.blockRevision);
 if(cacheable&&(!entry||entry.blocks!==map.blocks||entry.ground!==map.ground||entry.heights!==map.blockHeights||entry.chunks!==map.chunks||entry.chunkCount!==map.chunks.length||entry.revision!==map.blockRevision||entry.build!==map.buildRevision||entry.width!==map.width||entry.height!==map.height)){
  entry={blocks:map.blocks,ground:map.ground,heights:map.blockHeights,chunks:map.chunks,chunkCount:map.chunks.length,revision:map.blockRevision,build:map.buildRevision,width:map.width,height:map.height,windows:new Map()};
  terrainWindows.set(map,entry);
 }
 if(cacheable&&entry.windows.has(key)){const boxes=entry.windows.get(key);entry.windows.delete(key);entry.windows.set(key,boxes);return boxes}
 const boxes=[];
 for(let z=top;z<bottom;z++)for(let x=left;x<right;x++){
  if(!W.activeCell(map,x,z))continue;
  const ground=map.blocks?W.groundAt(map,x,z):W.terrainHeight(map,x,z);
  appendBox(boxes,x+.5,-200,z+.5,1,ground+200,1,0,true);
  for(const [base,kind] of Object.entries(map.blocks?.[x+','+z]||{}))if(W.BLOCKS[kind]?.solid||kind==='lava')appendBox(boxes,x+.5,+base,z+.5,1,W.blockSize(map,x,z,+base),1);
 }
 // Small LRU: the cache cannot grow with the number of explored sectors.
 if(cacheable&&boxes.length<=8192){entry.windows.set(key,boxes);if(entry.windows.size>4)entry.windows.delete(entry.windows.keys().next().value)}
 return boxes;
}
export function boxesNear(map,origin,range,ignore,liquids=null,player=false){
 const x0=origin.x-range,x1=origin.x+range,z0=origin.z-range,z1=origin.z+range;
 const boxes=terrainBoxes(map,x0,x1,z0,z1).slice();
 const add=(...args)=>appendBox(boxes,...args);
 const groups=new Map((map.groups||[]).map(g=>[g.id,g.visible!==false]));
 for(const o of map.objects||[]){
  if(o.id===ignore||!player&&(o.visible===false||groups.get(o.group)===false||W.character(o))||W.isDoor(o)&&o.open)continue;
  if(o.type==='block'?!(W.BLOCKS[o.material||'stone']?.solid||!player&&o.material==='lava'):!(o.blocking||player&&W.character(o)||!player&&o.blocksSight))continue;
  const b=W.collisionBounds(o);if(b.x+b.w<x0||b.x>x1||b.y+b.h<z0||b.y>z1)continue;
  const p=W.center(o),y=W.elevation(o,map),h=player&&W.character(o)?(o.bodyHeight||o.height||1.8):(o.height||1)*(o.scale||1);
  if(W.isSegment(o))add(p.x,y,p.y,Math.max(.01,Math.hypot(o.x2-o.x,o.y2-o.y)),h,.16,Math.atan2(o.y2-o.y,o.x2-o.x));
  else if(player&&W.character(o)){const radius=Math.max(.24,Math.min(.45,(o.w||1)*.29));add(p.x,y,p.y,radius*2,h,radius*2)}
  else if(o.type==='tree')add(p.x,y,p.y,(o.trunkRadius||.13)*2,h,(o.trunkRadius||.13)*2);
   else if(hasBlockForm(o)){for(const part of formCollisionBoxes(o,y)){const c=W.center(part);add(c.x,part.baseZ,c.y,part.w,part.height,part.d,part.facing||0)}}
  else add(p.x,y,p.y,o.w||1,h,o.d||1,o.facing||0);
 }
 // A camera should not enter an opaque lava surface, including derived flow.
 // This is camera-only collision; water and actor movement remain unchanged.
 for(const b of liquids?.cells||[])if(b.kind==='lava'&&!b.source&&b.x+1>=x0&&b.x<=x1&&b.y+1>=z0&&b.y<=z1)add(b.x+.5,b.z,b.y+.5,1,b.renderH||b.h,1);
 return boxes;
}
// An exact grid seam can be interior to the union of several boxes even
// though no individual open box contains its center. Check this exceptional
// case only at integer cell boundaries; normal movement stays on the fast path.
function flyEmbedded(a,boxes){
 if(!clearPoint(a,boxes,0))return true;
 if(Math.abs(a.x-Math.round(a.x))>EPS*2&&Math.abs(a.z-Math.round(a.z))>EPS*2)return false;
 const e=EPS*4;
 for(const dx of [-e,e])for(const dz of [-e,e])if(clearPoint(new T.Vector3(a.x+dx,a.y,a.z+dz),boxes,0))return false;
 return true;
}
export function sweepCameraMotion(map,from,to,liquids=null){
 const a=new T.Vector3(from.x,from.y,from.z),b=new T.Vector3(to.x,to.y,to.z);
 if(![...a.toArray(),...b.toArray()].every(Number.isFinite))return {...from};
 if(a.distanceTo(b)>30)b.sub(a).setLength(30).add(a);
 const delta=b.clone().sub(a),radius=.19,boxes=boxesNear(map,a,delta.length()+3,null,liquids);
 const commit=p=>{lastFlyPose.set(map,p.clone());return {x:p.x,y:p.y,z:p.z}};
 // Recover an invalid pose from a terrain edit, recenter, or older save.
 // Prefer the former clear side, never use the underside of implicit soil.
 if(flyEmbedded(a,boxes)){
  const candidates=[],margin=radius+.03,old=lastFlyPose.get(map);
  const prior=old&&old.distanceTo(a)<=4&&old.distanceTo(a)>EPS&&clearPoint(old,boxes,radius)?old:null;
  const contact=boxes.filter(box=>cameraBoxEntry(a,a,box,EPS*4)===0);
  const soil=contact.some(box=>box.ground&&a.y<box.y+box.h-EPS);
  const add=p=>{if((soil?p.distanceTo(a)<=24&&p.y>=a.y-EPS:p.distanceTo(a)<=4)&&clearPoint(p,boxes,radius))candidates.push(p)};
  for(const box of contact){
   const c=box.c??Math.cos(box.angle||0),s=box.s??Math.sin(box.angle||0),u=(a.x-box.x)*c+(a.z-box.z)*s,v=-(a.x-box.x)*s+(a.z-box.z)*c;
   const exits=[[-box.w/2-margin,a.y,v],[box.w/2+margin,a.y,v],[u,a.y,-box.d/2-margin],[u,a.y,box.d/2+margin],[u,box.y+box.h+margin,v]];
   if(!box.ground)exits.push([u,box.y-margin,v]);
   for(const [x,y,z]of exits)add(new T.Vector3(box.x+x*c-z*s,y,box.z+x*s+z*c));
  }
  // A stack of adjacent blocks may cover the first candidate. Consider
  // exposed vertical faces within the local recovery radius, not just
  // the block containing the camera.
  const verticalEnd=new T.Vector3(a.x,a.y+(soil?24:4),a.z);
  for(const box of boxes)if(cameraBoxEntry(a,verticalEnd,box,radius)!==Infinity)add(new T.Vector3(a.x,box.y+box.h+margin,a.z));
  if(prior&&(!soil||prior.y>=a.y-EPS))add(prior);
  candidates.sort((p,q)=>{
   if(soil){const vertical=v=>Math.hypot(v.x-a.x,v.z-a.z)<EPS?0:1;return vertical(p)-vertical(q)||p.distanceToSquared(a)-q.distanceToSquared(a)}
   if(prior)return p.distanceToSquared(prior)-q.distanceToSquared(prior)||p.distanceToSquared(a)-q.distanceToSquared(a);
   // With no trustworthy previous side, a horizontal/downward input
   // must not default to dropping the camera below the floor.
   if(delta.y<=EPS){const lower=v=>v.y<a.y-EPS?1:0;const order=lower(p)-lower(q);if(order)return order}
   return p.distanceToSquared(a)-q.distanceToSquared(a);
  });
  if(candidates.length)a.copy(candidates[0]);
  else {const target=a.clone().add(delta);if((!soil||target.y>=a.y)&&clearPoint(target,boxes,radius))return commit(target);return {...from}}
 }
 // Sweep each axis in short increments; keep the free components and
 // never permit a vertical input to descend along the seam of two solids.
 const count=Math.max(1,Math.ceil(delta.length()/.25)),step=delta.clone().multiplyScalar(1/count);
 for(let i=0;i<count;i++)for(const axis of ['x','z','y']){if(Math.abs(step[axis])<EPS)continue;const end=a.clone();end[axis]+=step[axis];a.lerp(end,clipFraction(a,end,boxes,radius,true))}
 return commit(a);
}
export function perspectiveCamera(map,actor,width,height,{liquids=null}={}){
 const c=map.camera,angle=Number.isFinite(c.angle)?c.angle:0,tilt=Number.isFinite(c.tilt)?c.tilt:.5,axes=cameraAxes(angle,c.mode==='third'?W.clamp(tilt,.08,.96):tilt),camera=new T.PerspectiveCamera(c.mode==='first'?78:c.mode==='fly'?75:48,width/Math.max(1,height),.05,180);
 if(c.mode==='fly'){let p=c.fly||{x:map.width/2,y:10,z:map.height/2};camera.position.set(p.x,p.y,p.z);camera.lookAt(camera.position.clone().add(axes.forward))}
 else if(c.mode==='first'){
  if(!actor)return null;
  const p=W.center(actor);camera.near=.025;camera.position.set(p.x,W.elevation(actor,map)+Math.min(W.eyeHeight(actor),c.firstEye??Infinity),p.y);camera.lookAt(camera.position.clone().add(axes.forward));
 }
 else{
  if(!actor)return null;
  const p=W.center(actor),eye=new T.Vector3(p.x,W.elevation(actor,map)+Math.min(3.5,Math.max(1.3,W.eyeHeight(actor)*.85)),p.y),distance=W.clamp(c.distance||5,1.5,14),boxes=boxesNear(map,eye,distance+9,actor.id,liquids);
  let radius=Math.max(.19,Math.min(.45,camera.near*Math.hypot(1,Math.tan(camera.fov*Math.PI/360)*camera.aspect,Math.tan(camera.fov*Math.PI/360))+.06));
  // Tight corridors may need a shorter near plane, never a camera inside a wall.
  if(!clearPoint(eye,boxes,radius)){camera.near=.015;radius=.065}
  const offset=new T.Vector3(Number(c.scout?.x)||0,W.clamp(Number(c.scout?.y)||0,-1,3),Number(c.scout?.z)||0);const planar=Math.hypot(offset.x,offset.z);if(planar>6){offset.x*=6/planar;offset.z*=6/planar}
  const requested=eye.clone().add(offset),target=eye.clone().lerp(requested,clipFraction(eye,requested,boxes,radius));
  const boom=(at,direction,max)=>{const end=at.clone().addScaledVector(direction,-max);return max*clipFraction(at,end,boxes,radius)};
  function orbit(at){let direction=axes.forward,allowed=boom(at,direction,distance);if(allowed<1.25)for(const pitch of [.65,.82,.95,.995]){const candidate=cameraAxes(angle,pitch).forward,room=boom(at,candidate,Math.min(distance,2.5));if(room>allowed){direction=candidate;allowed=room}if(allowed>=1.25)break}return {at,direction,allowed}}
  let chosen=orbit(target);if(chosen.allowed<1.25&&target.distanceTo(eye)>.01){const reset=orbit(eye);if(reset.allowed>chosen.allowed)chosen=reset}
  if(chosen.allowed<.48){camera.near=.015;camera.position.copy(eye);camera.lookAt(eye.clone().add(axes.forward));camera.userData.closeView=true}
  else {camera.position.copy(chosen.at).addScaledVector(chosen.direction,-chosen.allowed);camera.lookAt(chosen.at)}
 }
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return camera;
}

import * as T from './vendor/three.module.min.js';
import * as W from './world.mjs';
export function cameraAxes(angle,tilt){let pitch=Math.asin(W.clamp(tilt,-.995,.995)),fx=(Math.cos(angle)+Math.sin(angle))/Math.SQRT2,fz=(Math.cos(angle)-Math.sin(angle))/Math.SQRT2;return{forward:new T.Vector3(-fx*Math.cos(pitch),-Math.sin(pitch),-fz*Math.cos(pitch)),right:new T.Vector3(fz,0,-fx)}}
const EPS=1e-6;
// Sweep a conservative camera volume, not an infinitely thin visibility ray.
// Box coordinates: x/z centre, y base, w/d horizontal sizes, h height.
export function cameraBoxEntry(a,b,box,radius=0){
 if(Math.max(a.y,b.y)<=box.y-radius+EPS||Math.min(a.y,b.y)>=box.y+box.h+radius-EPS)return Infinity;
 const c=Math.cos(box.angle||0),s=Math.sin(box.angle||0);
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
function clipFraction(a,b,boxes,r){
 let t=1;const length=a.distanceTo(b);if(length<EPS)return 1;
 for(const box of boxes){
  const hit=cameraBoxEntry(a,b,box,r);if(hit>=t)continue;
  // When already touching the safety margin, allow motion away from it,
  // but never allow that exemption to carry the camera through a solid.
  if(hit===0&&cameraBoxEntry(a,b,box,0)===Infinity){
   if(cameraBoxEntry(b,b,box,r)===Infinity)continue;
   const c=Math.cos(box.angle||0),s=Math.sin(box.angle||0),p=[(a.x-box.x)*c+(a.z-box.z)*s,a.y-box.y,-(a.x-box.x)*s+(a.z-box.z)*c],q=[(b.x-box.x)*c+(b.z-box.z)*s,b.y-box.y,-(b.x-box.x)*s+(b.z-box.z)*c];
   const lo=[-box.w/2,-0,-box.d/2],hi=[box.w/2,box.h,box.d/2];
   if(p.some((v,i)=>v<=lo[i]&&q[i]<=v||v>=hi[i]&&q[i]>=v))continue;
  }
  t=hit;
 }
 return Math.max(0,t===1?1:t-.025/length);
}
function boxesNear(map,origin,range,ignore,liquids){
 const boxes=[],x0=origin.x-range,x1=origin.x+range,z0=origin.z-range,z1=origin.z+range;
 const add=(x,y,z,w,h,d,angle=0)=>{if([x,y,z,w,h,d,angle].every(Number.isFinite)&&w>0&&h>0&&d>0)boxes.push({x,y,z,w,h,d,angle})};
 for(let z=Math.max(0,Math.floor(z0));z<Math.min(map.height,Math.ceil(z1));z++)for(let x=Math.max(0,Math.floor(x0));x<Math.min(map.width,Math.ceil(x1));x++){
  if(!W.activeCell(map,x,z))continue;
  const ground=map.blocks?W.groundAt(map,x,z):W.terrainHeight(map,x,z);add(x+.5,-200,z+.5,1,ground+200,1);
  for(const [base,kind] of Object.entries(map.blocks?.[x+','+z]||{}))if(W.BLOCKS[kind]?.solid||kind==='lava')add(x+.5,+base,z+.5,1,W.blockSize(map,x,z,+base),1);
 }
 const groups=new Map((map.groups||[]).map(g=>[g.id,g.visible!==false]));
 for(const o of map.objects||[]){
  if(o.id===ignore||o.visible===false||groups.get(o.group)===false||W.character(o)||W.isDoor(o)&&o.open)continue;
  if(o.type==='block'?!(W.BLOCKS[o.material||'stone']?.solid||o.material==='lava'):!(o.blocking||o.blocksSight))continue;
  const b=W.collisionBounds(o);if(b.x+b.w<x0||b.x>x1||b.y+b.h<z0||b.y>z1)continue;
  const p=W.center(o),y=W.elevation(o,map),h=(o.height||1)*(o.scale||1);
  if(W.isSegment(o))add(p.x,y,p.y,Math.max(.01,Math.hypot(o.x2-o.x,o.y2-o.y)),h,.16,Math.atan2(o.y2-o.y,o.x2-o.x));
  else if(o.type==='tree')add(p.x,y,p.y,(o.trunkRadius||.13)*2,h,(o.trunkRadius||.13)*2);
  else add(p.x,y,p.y,o.w||1,h,o.d||1,o.facing||0);
 }
 // A camera should not enter an opaque lava surface, including derived flow.
 // This is camera-only collision; water and actor movement remain unchanged.
 for(const b of liquids?.cells||[])if(b.kind==='lava'&&!b.source&&b.x+1>=x0&&b.x<=x1&&b.y+1>=z0&&b.y<=z1)add(b.x+.5,b.z,b.y+.5,1,b.renderH||b.h,1);
 return boxes;
}
export function sweepCameraMotion(map,from,to,liquids=null){
 const a=new T.Vector3(from.x,from.y,from.z),b=new T.Vector3(to.x,to.y,to.z);
 if(![...a.toArray(),...b.toArray()].every(Number.isFinite))return {...from};
 if(a.distanceTo(b)>30)b.sub(a).setLength(30).add(a);
 const range=a.distanceTo(b)+1,boxes=boxesNear(map,a,range,null,liquids),r=.19;
 // A previously embedded free camera can escape; it must not get trapped.
 const usable=boxes.filter(box=>cameraBoxEntry(a,a,box,0)!==0);
 const result=a.clone().lerp(b,clipFraction(a,b,usable,r));
 return {x:result.x,y:result.y,z:result.z};
}
export function perspectiveCamera(map,actor,width,height,{liquids=null}={}){
 const c=map.camera,angle=Number.isFinite(c.angle)?c.angle:0,tilt=Number.isFinite(c.tilt)?c.tilt:.5,axes=cameraAxes(angle,c.mode==='third'?W.clamp(tilt,.08,.96):tilt),camera=new T.PerspectiveCamera(c.mode==='fly'?75:48,width/Math.max(1,height),.05,180);
 if(c.mode==='fly'){let p=c.fly||{x:map.width/2,y:10,z:map.height/2};camera.position.set(p.x,p.y,p.z);camera.lookAt(camera.position.clone().add(axes.forward))}
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

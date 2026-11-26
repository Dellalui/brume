import * as T from './vendor/three.module.min.js';
import * as W from './world.mjs';
export function cameraAxes(angle,tilt){let pitch=Math.asin(W.clamp(tilt,-.995,.995)),fx=(Math.cos(angle)+Math.sin(angle))/Math.SQRT2,fz=(Math.cos(angle)-Math.sin(angle))/Math.SQRT2;return{forward:new T.Vector3(-fx*Math.cos(pitch),-Math.sin(pitch),-fz*Math.cos(pitch)),right:new T.Vector3(fz,0,-fx)}}
export function perspectiveCamera(map,actor,width,height){
 const c=map.camera,angle=Number.isFinite(c.angle)?c.angle:0,tilt=Number.isFinite(c.tilt)?c.tilt:.5,axes=cameraAxes(angle,c.mode==='third'?W.clamp(tilt,.08,.96):tilt),camera=new T.PerspectiveCamera(c.mode==='fly'?75:48,width/Math.max(1,height),.05,180);
 if(c.mode==='fly'){let p=c.fly||{x:map.width/2,y:10,z:map.height/2};camera.position.set(p.x,p.y,p.z);camera.lookAt(camera.position.clone().add(axes.forward))}
 else{
  if(!actor)return null;
  let p=W.center(actor),target=new T.Vector3(p.x,W.elevation(actor,map)+Math.min(3.5,Math.max(1.3,W.eyeHeight(actor)*.85)),p.y),distance=W.clamp(c.distance||5,1.5,14);
  if(c.scout)target.add(new T.Vector3(c.scout.x||0,c.scout.y||0,c.scout.z||0));
  const obstacles=map.objects.filter(o=>o.blocksSight&&o.id!==actor.id&&!((o.type==='door'||o.type==='build_door')&&o.open));
  function clearance(direction,max){for(let d=.15;d<=max+.15;d+=.15){let q=target.clone().addScaledVector(direction,-Math.min(d,max));if(!W.terrainLineClear(map,{x:target.x,y:target.z},{x:q.x,y:q.z},target.y,q.y)||W.sightHit(map,{x:target.x,y:target.z},{x:q.x,y:q.z},obstacles,actor.id,target.y,q.y))return Math.max(.08,d-.22)}return max}
  let direction=axes.forward,allowed=clearance(direction,distance);
  // A nearby wall must not force the camera into that wall. Lift the boom first.
  if(allowed<1.25){for(let pitch of [.65,.82,.95,.995]){let candidate=cameraAxes(angle,pitch).forward,room=clearance(candidate,Math.min(distance,2.5));if(room>allowed){direction=candidate;allowed=room}if(allowed>=1.25)break}}
  camera.position.copy(target).addScaledVector(direction,-allowed);camera.lookAt(target);
 }
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return camera;
}

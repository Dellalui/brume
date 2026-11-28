// Transient presentation only. No world mutation, physics or camera saves.
const num=(v,d,lo,hi)=>v!==null&&v!==''&&Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):d;
export function feedbackSettings(v={}){
 return {shakeEnabled:v?.shakeEnabled===true,shakeIntensity:num(v?.shakeIntensity,1.2,0,5),shakeDuration:num(v?.shakeDuration,.7,.05,4),shakeRange:num(v?.shakeRange,32,1,160),shakeFrequency:num(v?.shakeFrequency,14,1,30),soundEnabled:v?.soundEnabled!==false,soundVolume:num(v?.soundVolume,.85,0,1),soundRange:num(v?.soundRange,48,1,160),flightSound:v?.flightSound!==false};
}
export function audioPreferences(v={}){
 return {sound:v?.sound!==false,volume:num(v?.volume,.55,0,1),ambience:v?.ambience!==false,shake:v?.shake!==false};
}
// Game coordinates are x/y horizontal and z vertical, Three uses x/z.
export function listenerPose(camera){
 if(!camera?.position||!camera.matrixWorld?.elements)return null;
 const p=camera.position,m=camera.matrixWorld.elements;
 return {x:p.x,y:p.z,z:p.y,rx:m[0],ry:m[2],rz:m[1]};
}
export function spatialSound(point,listener,range){
 if(!point||!listener||![point.x,point.y,point.z,listener.x,listener.y,listener.z,range].every(Number.isFinite)||range<=0)return {gain:0,pan:0};
 const dx=point.x-listener.x,dy=point.y-listener.y,dz=point.z-listener.z,d=Math.hypot(dx,dy,dz);
 return {gain:Math.max(0,1-d/range)**1.5,pan:d>.001?Math.max(-1,Math.min(1,(dx*(listener.rx||0)+dy*(listener.ry||0)+dz*(listener.rz||0))/d)):0};
}
export const MAX_SHAKES=12,MAX_SHAKE_RADIANS=5*Math.PI/180;
export function createCameraShake(){
 let impulses=[],serial=0;
 function add(event,listener,now){
  const cfg=feedbackSettings(event.config),age=Math.max(0,event.age||0),strength=Math.max(0,Math.min(2,event.config?.strength??1));
  if(!cfg.shakeEnabled||!cfg.shakeIntensity||!strength||age>=cfg.shakeDuration||!spatialSound(event.position,listener,cfg.shakeRange).gain)return false;
  impulses=impulses.filter(i=>now<i.end);
  const start=now-age*1000,i={point:{...event.position},start,end:start+cfg.shakeDuration*1000,duration:cfg.shakeDuration,range:cfg.shakeRange,frequency:cfg.shakeFrequency,amplitude:cfg.shakeIntensity*Math.PI/180*Math.min(1.5,strength),seed:++serial*2.399963};
  if(impulses.length>=MAX_SHAKES){
   const weight=p=>p.amplitude*spatialSound(p.point,listener,p.range).gain*Math.max(0,1-(now-p.start)/(p.duration*1000));
   let weakest=0;for(let n=1;n<impulses.length;n++)if(weight(impulses[n])<weight(impulses[weakest]))weakest=n;
   if(weight(i)<weight(impulses[weakest]))return false;impulses.splice(weakest,1);
  }
  impulses.push(i);return true;
 }
 function sample(listener,now){
  if(!impulses.length)return null;
  impulses=impulses.filter(i=>now<i.end);if(!impulses.length)return null;
  let x=0,y=0,z=0;
  for(const i of impulses){
   const t=Math.max(0,(now-i.start)/1000),envelope=(1-t/i.duration)**2,a=i.amplitude*envelope*spatialSound(i.point,listener,i.range).gain,w=t*i.frequency*Math.PI*2;
   x+=a*(.65*Math.sin(w+i.seed)+.35*Math.sin(w*.57+i.seed*2));
   y+=a*(.6*Math.sin(w*.83+i.seed+1.3)+.4*Math.sin(w*1.31+i.seed));
   z+=a*.38*Math.sin(w*.73+i.seed+2.1);
  }
  const length=Math.hypot(x,y,z),k=length>MAX_SHAKE_RADIANS?MAX_SHAKE_RADIANS/length:1;
  return {x:x*k,y:y*k,z:z*k};
 }
 return {add,sample,clear(){impulses=[]},get size(){return impulses.length}};
}
// Only the final presentation pass sees the angular shake. The base
// quaternion/matrices are restored even when WebGL rendering throws.
export function withCameraShake(camera,offset,draw){
 if(!offset||!camera?.isPerspectiveCamera||!Math.hypot(offset.x,offset.y,offset.z))return draw();
 const base=camera.quaternion.clone();
 try{camera.rotateX(offset.x);camera.rotateY(offset.y);camera.rotateZ(offset.z);camera.updateMatrixWorld(true);return draw()}
 finally{camera.quaternion.copy(base);camera.updateMatrixWorld(true)}
}

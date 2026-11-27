// Shared light settings and source shape; independent from WebGL and UI.
export const lightKind=light=>!light||light.enabled===false?'off':light.kind==='flashlight'?'flashlight':'lantern';
const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function carriedSettings(light){
 const kind=lightKind(light);return {kind,radius:clamp(finite(light?.radius,5),1,25),power:clamp(finite(light?.power,.8),0,3),color:light?.color||'#ffda9e',angle:clamp(finite(light?.angle,60),15,120)};
}
export function nextCarriedLight(light){
 if(!light)return null;
 const kind=lightKind(light);
 return {...light,kind:kind==='lantern'?'flashlight':kind==='off'?'lantern':light.kind||'flashlight',enabled:kind!=='flashlight'};
}
export function makeCarriedSource(light,owner,position,heading=0,pitch=0){
 const s=carriedSettings(light);if(s.kind==='off'||s.power<=0)return null;
 return {...position,owner,radius:s.radius,power:s.power,color:s.color,kind:s.kind,heading, pitch,angle:s.angle,carried:true,secondary:false,block:false};
}
// The tabletop perception model uses horizontal beam direction. Actual
// first-person light uses the camera's full 3D direction in the renderer.
export function beamFactor(source,point){
 if(source.kind!=='flashlight')return 1;
 const dx=point.x-source.x,dy=point.y-source.y,d=Math.hypot(dx,dy);
 if(d<.001)return 1;
 const dot=(dx*Math.sin(source.heading||0)-dy*Math.cos(source.heading||0))/d,edge=Math.cos((source.angle||60)*Math.PI/360),inner=Math.cos((source.angle||60)*Math.PI/360*.7);
 const t=clamp((dot-edge)/Math.max(.001,inner-edge),0,1);return t*t*(3-2*t);
}

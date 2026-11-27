import * as W from './world.mjs';
// Camera convention matches navigation.cameraAxes and world.bearing.
export const playerCameraMode=(map,view)=>view==='selected'&&!map.combat?.active?'first':'third';
export const headingFromCamera=angle=>W.mod(-angle-Math.PI/4,W.TAU);
export const cameraFromHeading=heading=>W.mod(-heading-Math.PI/4,W.TAU);
export const explorationRadius=actor=>W.clamp(Number(actor.vision?.far)||64,12,96);
export function visionStatus(actor,point){const p=W.center(actor),distance=Math.hypot(point.x-p.x,point.y-p.y),range=actor.vision?.range||12;return{distance,range,outside:distance>range+.001}}
import {boxesNear} from './navigation.mjs';
export function createPlayerMotion(){return {id:null,vy:0,grounded:false,crouched:false,jumpHeld:false}}
export function walkPlayer(map,actor,angle,forward,side,dt,speed=3.5,state=createPlayerMotion(),input={}){
 if(!actor||actor.locked||map.groups?.find(g=>g.id===actor.group)?.locked||map.combat?.active)return false;
 if(state.id!==actor.id){Object.assign(state,createPlayerMotion(),{id:actor.id})}
 dt=Math.min(.05,Math.max(0,dt));const p=W.center(actor),base=actor.voxelZ??W.terrainSurface(actor,map),height=actor.bodyHeight||actor.height||1.8,r=Math.min(.45,Math.max(.23,(actor.w||1)*.28));
 const boxes=boxesNear(map,{x:p.x,y:base,z:p.y},Math.max(2,r+1),actor.id,null,true);for(const b of boxes){b.c=Math.cos(b.angle||0);b.s=Math.sin(b.angle||0)}
 let x=p.x,y=p.y,z=base;
 // Horizontal margin only; vertical body span is checked explicitly.
 const free=(x,y,z,h)=>W.activeCell(map,x-r,y-r)&&W.activeCell(map,x+r,y+r)&&W.activeCell(map,x-r,y+r)&&W.activeCell(map,x+r,y-r)&&!boxes.some(b=>{if(z+h<=b.y+.001||z>=b.y+b.h-.001)return false;const c=b.c,s=b.s,u=(x-b.x)*c+(y-b.z)*s,v=-(x-b.x)*s+(y-b.z)*c;return Math.abs(u)<b.w/2+r-.001&&Math.abs(v)<b.d/2+r-.001});
 state.crouched=!!input.crouch||!free(x,y,z,height);
 const h=state.crouched?height*.68:height;
 const supported=(x,y,z)=>!free(x,y,z-.06,h);
 state.grounded=supported(x,y,z);
 if(input.jump&&!state.jumpHeld&&state.grounded&&!state.crouched){state.vy=6.4;state.grounded=false}
 state.jumpHeld=!!input.jump;
 const len=Math.hypot(forward,side),heading=headingFromCamera(angle),v=speed*(state.crouched?.35:input.sprint?1.55:1);
 const dx=len?(Math.sin(heading)*forward+Math.cos(heading)*side)/len*v*dt:0,dy=len?(-Math.cos(heading)*forward+Math.sin(heading)*side)/len*v*dt:0;
 function horizontal(nx,ny){if(free(nx,ny,z,h)){if(state.crouched&&state.grounded&&!supported(nx,ny,z))return; x=nx;y=ny;return}if(state.grounded&&!state.crouched&&free(nx,ny,z+.5,h)&&supported(nx,ny,z+.5)){x=nx;y=ny;z+=.5}}
 horizontal(x+dx,y);horizontal(x,y+dy);
 state.vy=Math.max(-18,state.vy-18*dt);
 const dz=state.vy*dt,steps=Math.max(1,Math.ceil(Math.abs(dz)/.04));
 for(let i=0;i<steps;i++){const nz=z+dz/steps;if(free(x,y,nz,h)){z=nz;continue}let lo=0,hi=1;for(let j=0;j<10;j++){const mid=(lo+hi)/2;if(free(x,y,z+dz/steps*mid,h))lo=mid;else hi=mid}z+=dz/steps*lo;state.vy=0;break}
 state.grounded=supported(x,y,z);if(state.grounded&&state.vy<0)state.vy=0;
 const changed=Math.abs(x-p.x)+Math.abs(y-p.y)+Math.abs(z-base)>1e-5;
 actor.x=x-(actor.w||1)/2;actor.y=y-(actor.d||1)/2;actor.voxelZ=z;return changed;
}

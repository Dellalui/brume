import * as W from './world.mjs';
// Camera convention matches navigation.cameraAxes and world.bearing.
export const playerCameraMode=(map,view)=>view==='selected'&&!map.combat?.active?'first':'third';
export const headingFromCamera=angle=>W.mod(-angle-Math.PI/4,W.TAU);
export const cameraFromHeading=heading=>W.mod(-heading-Math.PI/4,W.TAU);
export const explorationRadius=actor=>W.clamp(Number(actor.vision?.far)||64,12,96);
export function visionStatus(actor,point){const p=W.center(actor),distance=Math.hypot(point.x-p.x,point.y-p.y),range=actor.vision?.range||12;return{distance,range,outside:distance>range+.001}}
export function walkPlayer(map,actor,angle,forward,side,dt,speed=3.5){
 if(!actor||actor.locked||map.groups?.find(g=>g.id===actor.group)?.locked||map.combat?.active)return false;
 const length=Math.hypot(forward,side);if(!length)return false;
 const heading=headingFromCamera(angle),dx=(Math.sin(heading)*forward+Math.cos(heading)*side)/length,dy=(-Math.cos(heading)*forward+Math.sin(heading)*side)/length;
 const distance=Math.min(.18,Math.max(0,dt)*speed),obs=W.obstacles(map,'blocking',W.levelOf(actor));
 function attempt(x,y){
  const z=actor.voxelZ??W.terrainSurface(actor,map),cx=Math.floor(x),cy=Math.floor(y);
  const nz=map.blocks?W.surfaceNear(map,cx,cy,z,.5,actor.bodyHeight||1.6):W.terrainHeight(map,cx,cy);
  if(nz===undefined||Math.abs(nz-z)>.5)return false;
  const next={...actor,x,y,voxelZ:nz};
  if(!W.validObject(map,next)||!W.stepFree(map,{x:actor.x,y:actor.y,z},{x,y,z:nz},next,obs))return false;
  if(map.objects.some(o=>o.id!==actor.id&&W.character(o)&&W.levelOf(o)===W.levelOf(actor)&&Math.abs(W.elevation(o,map)-W.elevation(next,map))<1&&Math.hypot(W.center(o).x-W.center(next).x,W.center(o).y-W.center(next).y)<.55))return false;
  actor.x=x;actor.y=y;if(map.blocks)actor.voxelZ=nz;return true;
 }
 const x=actor.x+dx*distance,y=actor.y+dy*distance;
 return attempt(x,y)||(Math.abs(dx)>1e-6&&attempt(x,actor.y))||(Math.abs(dy)>1e-6&&attempt(actor.x,y));
}

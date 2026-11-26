import * as W from './world.mjs';
// A click on the side of a block means the accessible cell in front of it,
// never an arbitrary roof picked from the height of the mouse hit.
export function movementTarget(map,actor,hit){
 if(!hit||![hit.x,hit.y].every(Number.isFinite)||!actor)return null;
 const n=hit.normal,side=!!n&&Math.abs(n.z||0)<.5&&Math.hypot(n.x||0,n.y||0)>.2;
 let x=Math.floor(hit.x+(side?(n.x||0)*.035:0)),y=Math.floor(hit.y+(side?(n.y||0)*.035:0));
 if(!side&&n?.z>.5&&hit.block){x=hit.block.x;y=hit.block.y}
 if(!W.activeCell(map,x,y))return null;
 if(!map.blocks)return {x,y};
 const height=actor.bodyHeight||1.6,ref=side?(actor.voxelZ??W.terrainSurface(actor,map)):(hit.z??W.groundAt(map,x,y));
 const z=W.surfaceNear(map,x,y,ref,side?1:.11,height);
 return z===undefined?null:{x,y,z};
}
// Lift before crossing an ascending step; descend after leaving its edge.
// Actual movement remains governed by the collision-checked path.
export function stepAltitude(from,to,t){
 const delta=to.z-from.z;
 const u=delta>0?Math.min(1,t/.30):delta<0?Math.max(0,(t-.70)/.30):t;
 const smooth=u*u*(3-2*u);
 return from.z+delta*smooth;
}

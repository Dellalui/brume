// Shared doorway geometry. The open leaf and the empty doorway are both
// valid interaction targets; only the closed doorway blocks passage.
export const DOOR_REACH=2.5;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function doorSlabs(map,o,W){
 const segment=o.type==='door',p=W.center(o),w=segment?Math.hypot(o.x2-o.x,o.y2-o.y):(o.w||1),d=segment?.16:Math.max(.06,o.d||.15),angle=segment?Math.atan2(o.y2-o.y,o.x2-o.x):(o.facing||0),z=W.elevation(o,map),h=(o.height||1.6);
 const closed={...p,z,w:Math.max(.01,w),d,h,angle};
 if(!o.open)return [closed];
 const c=Math.cos(angle),s=Math.sin(angle),hinge=-w/2+(segment?0:.06),length=Math.max(.01,w-(segment?0:.12));
 const leaf={x:p.x+hinge*c-length*s/2,y:p.y+hinge*s+length*c/2,z,w:length,d,h,angle:angle+Math.PI/2};
 return [closed,leaf];
}
function local(p,b){const c=Math.cos(b.angle),s=Math.sin(b.angle),x=p.x-b.x,y=p.y-b.y;return{x:x*c+y*s,y:-x*s+y*c,z:p.z-b.z}}
function nearestPoint(p,b){
 const q=local(p,b),x=clamp(q.x,-b.w/2,b.w/2),y=clamp(q.y,-b.d/2,b.d/2),z=clamp(q.z,0,b.h),c=Math.cos(b.angle),s=Math.sin(b.angle);
 return {x:b.x+x*c-y*s,y:b.y+x*s+y*c,z:b.z+z};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function eyePoint(map,actor,W){const p=W.center(actor),eye=map.camera?.mode==='first'?Math.min(W.eyeHeight(actor),map.camera.firstEye??Infinity):W.eyeHeight(actor);return {...p,z:W.elevation(actor,map)+eye}}
function visibleDoor(map,o,a,W){
 return W.isDoor(o)&&!o.secret&&o.visible!==false&&(o.opacity??1)>.03&&W.levelOf(o)===W.levelOf(a)&&!map.groups?.some(g=>g.id===o.group&&g.visible===false)&&!map.fog?.includes(W.cellKey(W.center(o).x,W.center(o).y));
}
export function doorRayDistance(origin,direction,b){
 const a=local(origin,b),c=Math.cos(b.angle),s=Math.sin(b.angle),v=[direction.x*c+direction.y*s,-direction.x*s+direction.y*c,direction.z],p=[a.x,a.y,a.z],min=[-b.w/2,-b.d/2,0],max=[b.w/2,b.d/2,b.h];
 let lo=0,hi=Infinity;
 for(let i=0;i<3;i++){if(Math.abs(v[i])<1e-9){if(p[i]<min[i]||p[i]>max[i])return Infinity;continue}let x=(min[i]-p[i])/v[i],y=(max[i]-p[i])/v[i];lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));if(hi<lo)return Infinity}
 return lo;
}
export function aimedDoor(map,actor,ray,W){
 if(!actor||!ray)return null;const eye=eyePoint(map,actor,W);let nearest=null;
 for(const o of map.objects){if(!visibleDoor(map,o,actor,W))continue;
  for(const b of doorSlabs(map,o,W)){
   if(distance(eye,nearestPoint(eye,b))>DOOR_REACH+.001)continue;
   const t=doorRayDistance(ray.origin,ray.direction,b);if(!Number.isFinite(t)||nearest&&nearest.distance<=t)continue;
   nearest={door:o,distance:t};
  }
 }
 return nearest;
}
export function doorAccess(map,o,actor,W){
 if(!actor||actor.locked||!map.objects.includes(o)||!visibleDoor(map,o,actor,W))return 'Porte inaccessible.';
 const eye=eyePoint(map,actor,W),walls=W.obstacles(map,'blocksSight',W.levelOf(actor)).filter(w=>w.id!==o.id);
 let inRange=false;
 for(const b of doorSlabs(map,o,W)){
  const p=nearestPoint(eye,b),d=distance(eye,p);if(d>DOOR_REACH+.001)continue;inRange=true;
  // Stop just outside the target surface to avoid testing the solid itself.
  const n=Math.min(.025,d/2)/Math.max(d,1e-8),target={x:p.x+(eye.x-p.x)*n,y:p.y+(eye.y-p.y)*n,z:p.z+(eye.z-p.z)*n};
  if(W.terrainLineClear(map,eye,target,eye.z,target.z)&&!W.sightHit(map,eye,target,walls,actor.id,eye.z,target.z))return '';
 }
 return inRange?'Un obstacle bloque l’accès à la porte.':'Approchez-vous de la porte.';
}
export function doorwayOccupied(map,o,W){
 const b=doorSlabs(map,o,W)[0],touch=(p,r,h)=>{if(p.z+h<=b.z+.001||p.z>=b.z+b.h-.001)return false;const q=local(p,b);return Math.hypot(Math.max(0,Math.abs(q.x)-b.w/2),Math.max(0,Math.abs(q.y)-b.d/2))<r-.001};
 for(const a of map.objects){if(!W.character(a)||W.levelOf(a)!==W.levelOf(o))continue;
  const foot=W.elevation(a,map),height=a.bodyHeight||a.height||1.8;
  if(a.occupancy){for(const cell of W.actorCells(a)){const lift=cell.kind===2?Math.min(a.underClearance??2.5,height):0;if(height>lift&&touch({x:a.x+cell.x+.5,y:a.y+cell.y+.5,z:foot+lift},Math.SQRT1_2,height-lift))return true}}
  else if(touch({...W.center(a),z:foot},Math.max(.24,Math.min(.45,(a.w||1)*.29)),height))return true;
 }
 return false;
}

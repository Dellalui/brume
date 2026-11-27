import {PRESETS,throwConfig} from './throw-effects.mjs';
const number=(v,d,lo,hi)=>v!==null&&v!==''&&Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):d;
export function activationSettings(raw={}){
 raw=raw&&typeof raw==='object'?raw:{};
 return {enabled:raw.enabled===true,name:String(raw.name||'Activer le bloc').slice(0,60),kind:['explosion','recoil','both'].includes(raw.kind)?raw.kind:'explosion',delay:number(raw.delay,2,0,3600),reach:number(raw.reach,3,1,6),radius:number(raw.radius,4,1,12),push:number(raw.push,3,0,8),once:raw.once!==false,used:raw.used===true,recipeId:typeof raw.recipeId==='string'?raw.recipeId:'builtin:blast',recipe:raw.recipe&&typeof raw.recipe==='object'?raw.recipe:null};
}
export const activationLibrary=world=>[...PRESETS.map(p=>({id:'builtin:'+p.id,name:p.name,item:{preset:p.id,name:p.name,layers:p.layers}})),...(Array.isArray(world?.throwPresets)?world.throwPresets:[]).filter(p=>p&&typeof p.id==='string'&&Array.isArray(p.layers)).map(p=>({id:'saved:'+p.id,name:p.name+' · enregistré',item:{...p.settings,preset:'blast',name:p.name,layers:p.layers}}))];
export function chooseActivationRecipe(id,world){
 const preset=activationLibrary(world).find(p=>p.id===id);if(!preset)return null;
 const cfg=throwConfig(preset.item);
 return {recipeId:id,recipe:{preset:cfg.id,name:cfg.name,power:cfg.power,destroy:cfg.destroy,visualScale:cfg.visualScale,visualQuality:cfg.visualQuality,layers:cfg.layers.map(l=>({...l}))}};
}
export function activationRecipe(settings,world){
 const s=activationSettings(settings);
 return s.kind==='recoil'?{preset:'shockwave',power:Math.min(6,Math.max(1,Math.round(s.radius))),destroy:false}:s.recipe||chooseActivationRecipe(s.recipeId,world)?.recipe||{preset:'blast'};
}
export function blockRef(point){
 if(point?.placedBlock?.type==='block')return {kind:'object',id:point.placedBlock.id};
 if(point?.block&&[point.block.x,point.block.y,point.block.z].every(Number.isFinite))return {kind:'voxel',...point.block};
 return null;
}
export const activationKey=ref=>ref?.kind==='object'?'object:'+ref.id:ref?.kind==='voxel'?'voxel:'+ref.x+','+ref.y+','+ref.z:null;
export function resolveActivationBlock(map,ref,W){
 if(!ref)return null;
 if(ref.kind==='object'){
  const object=map.objects.find(o=>o.id===ref.id&&o.type==='block');if(!object)return null;
  const p=W.center(object);return {ref,key:activationKey(ref),object,material:object.material,point:{...p,z:W.elevation(object,map)+(object.height||1)/2},raw:object.activation,group:object.group,level:W.levelOf(object)};
 }
 if(ref.kind!=='voxel'||![ref.x,ref.y,ref.z].every(Number.isFinite)||!Number.isInteger(ref.x)||!Number.isInteger(ref.y)||!W.activeCell(map,ref.x,ref.y))return null;
 const {x,y,z}=ref,column=x+','+y,cell=column+','+z,material=map.blocks?.[column]?.[z];if(!material)return null;
 return {ref,key:activationKey(ref),material,point:{x:x+.5,y:y+.5,z:z+W.blockSize(map,x,y,z)/2},raw:map.blockActivations?.[cell],group:map.blockGroups?.[cell],level:0};
}
export function setActivation(map,ref,settings,W){
 const block=resolveActivationBlock(map,ref,W);if(!block)return false;
 const value=activationSettings(settings);
 if(block.object)block.object.activation=value;
 else{map.blockActivations??={};map.blockActivations[ref.x+','+ref.y+','+ref.z]=value}
 return true;
}
// Use the exact surface hit by the camera, not the center of a solid block.
export function canActivateBlock(map,ref,hit,actor,W){
 const b=resolveActivationBlock(map,ref,W);if(!b||!actor||actor.locked)return 'Aucun bloc activable visé.';
 const s=activationSettings(b.raw);
 if(!s.enabled)return 'Ce bloc n’est pas activable.';
 if(s.used)return 'Ce bloc doit être réarmé par le MJ.';
 if(b.object?.secret||b.object?.visible===false||map.groups?.some(g=>g.id===b.group&&g.visible===false)||b.level!==W.levelOf(actor))return 'Bloc inaccessible.';
 if(![hit?.x,hit?.y,hit?.z].every(Number.isFinite))return 'Visez le bloc.';
 const p=W.center(actor),eye=W.elevation(actor,map)+W.eyeHeight(actor),n=hit.normal||{},target={x:hit.x+(n.x||0)*.025,y:hit.y+(n.y||0)*.025},z=hit.z+(n.z||0)*.025;
 if(Math.hypot(target.x-p.x,target.y-p.y,z-eye)>s.reach+.001)return 'Approchez-vous du bloc ('+s.reach+' cases).';
 if(map.fog?.includes(W.cellKey(b.point.x,b.point.y))||!W.terrainLineClear(map,p,target,eye,z)||W.sightHit(map,p,target,W.obstacles(map,'blocksSight',b.level).filter(o=>o.id!==b.object?.id),actor.id,eye,z))return 'Le bloc est derrière un obstacle.';
 return '';
}
// Timers use a monotonic clock and do not keep requestAnimationFrame alive.
// Each entry is bound to its actual block and its configuration instance.
export function createActivationQueue(){
 let pending=[];
 const stillValid=(p,W)=>{const b=resolveActivationBlock(p.map,p.ref,W);return b&&b.raw===p.raw&&b.object===p.object&&b.material===p.material&&activationSettings(b.raw).enabled&&!activationSettings(b.raw).used?b:null};
 return {arm(map,ref,now,W){
  if(!Number.isFinite(now))return false;
  pending=pending.filter(p=>p.map===map&&stillValid(p,W));
  const b=resolveActivationBlock(map,ref,W),s=activationSettings(b?.raw);
  if(!b||!s.enabled||s.used||pending.length>=16||pending.some(p=>p.key===b.key))return false;
  pending.push({map,ref:{...ref},key:b.key,raw:b.raw,object:b.object,material:b.material,at:now+s.delay*1000});return true;
 },advance(map,now,W,fire){
  const due=pending.filter(p=>p.map===map&&p.at<=now);pending=pending.filter(p=>p.map===map&&p.at>now&&stillValid(p,W));
  for(const p of due){const b=stillValid(p,W);if(b)fire(b,activationSettings(b.raw))}
 },next(map){return pending.reduce((n,p)=>p.map===map?Math.min(n,p.at):n,Infinity)},has(map,ref){return pending.some(p=>p.map===map&&p.key===activationKey(ref))},clear(){pending=[]}};
}
// Recoil is a bounded fictional gameplay displacement. Every small step is
// validated with the same terrain/actor collision routines as tactical walking.
export function applyRecoil(map,origin,settings,W){
 const s=activationSettings(settings);if(s.push<=0)return 0;
 let moved=0;
 const locked=new Set((map.groups||[]).filter(g=>g.locked||g.protected).map(g=>g.id));
 for(const a of map.objects.filter(W.character)){
  if(a.locked||a.protected||locked.has(a.group))continue;
  const p=W.center(a),foot=a.voxelZ??W.terrainSurface(a,map),h=a.bodyHeight||a.height||1.8,dx=p.x-origin.x,dy=p.y-origin.y,horizontal=Math.hypot(dx,dy),distance=Math.hypot(horizontal,W.elevation(a,map)+h/2-origin.z);
  if(distance>=s.radius)continue;
  const travel=s.push*(1-distance/s.radius),ux=horizontal>.0001?dx/horizontal:Math.sin(a.facing||0),uy=horizontal>.0001?dy/horizontal:-Math.cos(a.facing||0);
  const steps=Math.max(1,Math.ceil(travel/.2)),stride=travel/steps;
  let x=a.x,y=a.y,z=foot;
  const obstacles=W.obstacles(map,'blocking',W.levelOf(a)),represented=new Set(obstacles.map(o=>o.id));
  for(const other of map.objects)if(W.character(other)&&other.id!==a.id&&!represented.has(other.id)&&W.levelOf(other)===W.levelOf(a))obstacles.push(...W.actorVolumes(other,map));
  for(let i=0;i<steps;i++){
   const nx=x+ux*stride,ny=y+uy*stride,nz=map.blocks?W.surfaceNear(map,nx,ny,z,.5,h):z;
   if(nz===undefined||!W.validObject(map,{...a,x:nx,y:ny})||!W.stepFree(map,{x,y,z},{x:nx,y:ny,z:nz},a,obstacles))break;
   x=nx;y=ny;z=nz;
  }
  if(Math.hypot(x-a.x,y-a.y)>.001){a.x=x;a.y=y;if(map.blocks)a.voxelZ=z;moved++}
 }
 return moved;
}

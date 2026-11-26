// Fictional construction-mode projectiles. No per-frame physics or world mutation.
export const PRESETS=Object.freeze([{"id":"blast","name":"Explosion classique","color":"#ffb25c","symbol":"✹"},{"id":"fire","name":"Explosion de feu","color":"#ff6230","symbol":"✦"},{"id":"ice","name":"Explosion de givre","color":"#9cdeff","symbol":"❋"},{"id":"storm","name":"Décharge de foudre","color":"#d6edff","symbol":"ϟ"},{"id":"arcane","name":"Explosion arcanique","color":"#c08aff","symbol":"✧"},{"id":"dust","name":"Impact de poussière","color":"#c2a581","symbol":"◉"}].map(Object.freeze));
export const MAX_RADIUS=6,MAX_REMOVALS=512,MAX_THROWS=3,IMPACT_MS=3000;
export function throwConfig(item){
 const preset=PRESETS.find(p=>p.id===item?.preset)||PRESETS[0];
 const power=Number.isFinite(Number(item?.power))?Math.max(1,Math.min(MAX_RADIUS,Math.round(Number(item.power)))):3;
 const visualScale=Number.isFinite(Number(item?.visualScale))?Math.max(.75,Math.min(2,Number(item.visualScale))):1.25;
 return {...preset,power,radius:power,destroy:item?.destroy!==false,visualScale,visualQuality:item?.visualQuality==='high'?'high':'auto'};
}
export function distanceToBox(point,x,y,z,w,d,h,angle=0){
 const dx=point.x-x-w/2,dy=point.y-y-d/2,c=Math.cos(angle),s=Math.sin(angle);
 const lx=dx*c+dy*s,ly=-dx*s+dy*c;
 return Math.hypot(Math.max(0,Math.abs(lx)-w/2),Math.max(0,Math.abs(ly)-d/2),Math.max(z-point.z,point.z-z-h,0));
}
export function validImpact(map,point,W){
 return !!point&&[point.x,point.y,point.z].every(Number.isFinite)&&point.z>=-16.01&&point.z<=32.01&&W.activeCell(map,point.x,point.y);
}
export function planImpact(map,point,item,W){
 const cfg=throwConfig(item),plan={voxels:[],objects:[],protectedCount:0,limited:false};
 if(!cfg.destroy||!validImpact(map,point,W))return plan;
 const lockedGroups=new Set((map.groups||[]).filter(g=>g.locked||g.protected).map(g=>g.id)),candidates=[],r=cfg.radius;
 const xmin=Math.max(0,Math.floor(point.x-r)),xmax=Math.min(map.width-1,Math.floor(point.x+r)),ymin=Math.max(0,Math.floor(point.y-r)),ymax=Math.min(map.height-1,Math.floor(point.y+r));
 for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
  if(!W.activeCell(map,x,y))continue;
  for(const [base,material]of Object.entries(map.blocks?.[x+','+y]||{})){
   const z=Number(base);if(!Number.isFinite(z)||!W.BLOCKS[material])continue;
   const distance=distanceToBox(point,x,y,z,1,1,W.blockSize(map,x,y,z));
   if(distance>r)continue;
   const key=x+','+y+','+z;
   if(lockedGroups.has(map.blockGroups?.[key])){plan.protectedCount++;continue}
   candidates.push({kind:'voxel',x,y,z,key,distance,material});
  }
 }
 for(const o of map.objects||[]){
  if(o.type!=='block')continue;
  const w=o.w??1,d=o.d??1,h=o.height??1,z=W.elevation(o,map);
  if(![o.x,o.y,z,w,d,h].every(Number.isFinite)||Math.min(w,d,h)<=0)continue;
  const distance=distanceToBox(point,o.x,o.y,z,w,d,h,o.facing||0);
  if(distance>r)continue;
  if(o.locked||o.protected||lockedGroups.has(o.group)){plan.protectedCount++;continue}
  candidates.push({kind:'object',id:o.id,distance});
 }
 candidates.sort((a,b)=>a.distance-b.distance);
 plan.limited=candidates.length>MAX_REMOVALS;
 for(const b of candidates.slice(0,MAX_REMOVALS))(b.kind==='voxel'?plan.voxels:plan.objects).push(b);
 return plan;
}
export function applyImpact(map,plan,W){
 let count=0;
 // Check protection again when committing; a locked group never loses a block.
 const locks=new Set((map.groups||[]).filter(g=>g.locked||g.protected).map(g=>g.id));
 for(const b of plan.voxels){
  if(locks.has(map.blockGroups?.[b.key])||map.blocks?.[b.x+','+b.y]?.[b.z]!==b.material)continue;
  if(W.setBlock(map,b.x,b.y,b.z,null)){if(map.blockGroups)delete map.blockGroups[b.key];count++}
 }
 const ids=new Set(plan.objects.map(o=>o.id));
 if(ids.size){const before=map.objects.length;map.objects=map.objects.filter(o=>!ids.has(o.id)||o.type!=='block'||o.locked||o.protected||locks.has(o.group));count+=before-map.objects.length}
 return count;
}
export function flightPosition(from,to,t){
 t=Math.max(0,Math.min(1,t));const arc=Math.sin(t*Math.PI)*.28;
 return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t+arc};
}
export function createThrowQueue(){
 let items=[],serial=0;
 return {
  launch(map,enabled,from,to,item,W,now){
   if(!enabled||!validImpact(map,to,W)||![from?.x,from?.y,from?.z,now].every(Number.isFinite)||items.length>=MAX_THROWS)return false;
   const distance=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
   const duration=Math.max(140,Math.min(450,distance*34));
   items.push({id:'throw-'+(++serial),map,from:{...from},to:{x:to.x,y:to.y,z:to.z},config:throwConfig(item),started:now,duration,impactAt:null});return true;
  },
  advance(map,enabled,now,onImpact){
   if(!enabled){items=[];return []}
   items=items.filter(p=>p.map===map&&(p.impactAt===null||now-p.impactAt<IMPACT_MS));
   for(const p of items)if(p.impactAt===null&&now>=p.started+p.duration){p.impactAt=now;onImpact(p.to,{preset:p.config.id,power:p.config.power,destroy:p.config.destroy})}
   return items.map(p=>({id:p.id,config:p.config,position:p.impactAt===null?flightPosition(p.from,p.to,(now-p.started)/p.duration):p.to,tail:p.impactAt===null?flightPosition(p.from,p.to,(now-p.started)/p.duration-.15):p.to,phase:p.impactAt===null?'flight':'impact',age:p.impactAt===null?0:(now-p.impactAt)/1000}));
  },
  clear(){items=[]},get size(){return items.length}
 };
}
export const THROW_ITEMS=PRESETS.map(p=>({kind:'throw',preset:p.id,name:p.name,power:3,destroy:true}));

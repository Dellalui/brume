// Fictional construction-mode projectiles. No per-frame physics or world mutation.
import {RECIPE_PRESETS,normalizeLayers,recipeDuration} from './effect-recipes.mjs';
export const PRESETS=RECIPE_PRESETS;
export const MAX_RADIUS=6,MAX_REMOVALS=512,IMPACT_MS=3000;
export function throwConfig(item){
 const preset=PRESETS.find(p=>p.id===item?.preset)||PRESETS[0];
 const power=Number.isFinite(Number(item?.power))?Math.max(1,Math.min(MAX_RADIUS,Math.round(Number(item.power)))):3;
 const visualScale=Number.isFinite(Number(item?.visualScale))?Math.max(.75,Math.min(2,Number(item.visualScale))):1.25;
 const range=Number.isFinite(Number(item?.range))?Math.max(0,Number(item.range)):48;
 const speed=Number.isFinite(Number(item?.speed))?Math.max(.1,Math.min(300,Number(item.speed))):30;
 const layers=normalizeLayers(item?.layers??preset.layers);
 return {...preset,name:String(item?.name||preset.name),power,radius:power,destroy:item?.destroy!==false,visualScale,range,speed,layers,duration:recipeDuration(layers),visualQuality:item?.visualQuality==='high'?'high':'auto'};
}
export function throwDistance(from,to){return Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)}
export function inThrowRange(from,to,item){const range=throwConfig(item).range;return range===0||throwDistance(from,to)<=range+1e-6}
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
   if(!enabled||!validImpact(map,to,W)||![from?.x,from?.y,from?.z,now].every(Number.isFinite)||!inThrowRange(from,to,item))return false;
   const config=throwConfig(item),duration=Math.max(16,throwDistance(from,to)/config.speed*1000);
   items.push({id:'throw-'+(++serial),map,from:{...from},to:{x:to.x,y:to.y,z:to.z},config,started:now,duration,impactAt:null});return true;
  },
  advance(map,enabled,now,onImpact){
   if(!enabled){items=[];return []}
   items=items.filter(p=>p.map===map);
   const visible=[];
   for(const p of items){
    if(p.impactAt===null&&now>=p.started+p.duration){p.impactAt=p.started+p.duration;onImpact(p.to,{preset:p.config.id,power:p.config.power,destroy:p.config.destroy})}
    if(p.impactAt===null){visible.push({id:p.id,config:p.config,position:flightPosition(p.from,p.to,(now-p.started)/p.duration),tail:flightPosition(p.from,p.to,(now-p.started)/p.duration-.15),phase:'flight',age:0});continue}
    const age=(now-p.impactAt)/1000;
    for(const layer of p.config.layers){const elapsed=age-layer.delay;if(!layer.enabled||elapsed<0||elapsed>=layer.duration)continue;visible.push({id:p.id+':'+layer.id,config:{...p.config,id:layer.kind,color:layer.color,shape:layer.shape,strength:layer.strength,radius:p.config.radius*layer.size,duration:layer.duration},position:p.to,tail:p.to,phase:'impact',age:elapsed})}
   }
   items=items.filter(p=>p.impactAt===null||now-p.impactAt<p.config.duration*1000);
   return visible;
  },
  clear(){items=[]},get size(){return items.length}
 };
}
export const THROW_ITEMS=PRESETS.map(p=>({kind:'throw',preset:p.id,name:p.name,power:3,destroy:true}));

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
// Gameplay resistance in arbitrary power units; no real-world explosive model.
export const MATERIAL_HARDNESS=Object.freeze({grass:.6,dirt:.6,sand:.35,gravel:.8,clay:.9,snow:.25,mud:.4,stone:1.5,cobble:1.4,granite:2.8,marble:2.2,slate:1.8,coal:1.6,iron:3,copper:2.4,gold:2,crystal:2.5,oak:1.2,pinewood:1,birchwood:1,planks:.8,darkplanks:.8,paleplanks:.8,brick:1.6,stonebrick:2,sandstone:1.1,tile:.9,leaves:.2,darkleaves:.2,hay:.2,cactus:.5,ice:.7,glass:.35,water:.15,lava:.15,basalt:3,infernal:2.5,ash:.3,magma:2,obsidian:5,soul:.6,hellbrick:2.5,glowstone:1.2});
export function materialHardness(material){return MATERIAL_HARDNESS[material]??1.2}
function canBreak(power,distance,material){return power-distance>=materialHardness(material)}
function groundProtection(map,locks){
 const columns=new Set(),objects=(map.objects||[]).filter(o=>o.type==='block'&&(o.locked||o.protected||locks.has(o.group))),memo=new Map();
 if(locks.size)for(const [k,id]of Object.entries(map.blockGroups||{})){if(!locks.has(id))continue;const first=k.indexOf(','),second=k.indexOf(',',first+1);if(first>=0&&second>first)columns.add(k.slice(0,second))}
 return (x,y)=>{const k=x+','+y;if(columns.has(k))return true;if(!objects.length)return false;if(!memo.has(k))memo.set(k,objects.some(o=>distanceToBox({x:x+.5,y:y+.5,z:0},o.x,o.y,0,o.w??1,o.d??1,1,o.facing||0)===0));return memo.get(k)};
}
export function planImpact(map,point,item,W){
 const cfg=throwConfig(item),plan={voxels:[],objects:[],ground:[],protectedCount:0,resistedCount:0,limited:false};
 if(!cfg.destroy||!validImpact(map,point,W))return plan;
 const lockedGroups=new Set((map.groups||[]).filter(g=>g.locked||g.protected).map(g=>g.id)),candidates=[],r=cfg.radius;
 const protectedGround=groundProtection(map,lockedGroups);
 const xmin=Math.max(0,Math.floor(point.x-r)),xmax=Math.min(map.width-1,Math.floor(point.x+r)),ymin=Math.max(0,Math.floor(point.y-r)),ymax=Math.min(map.height-1,Math.floor(point.y+r));
 for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
  if(!W.activeCell(map,x,y))continue;
  const ground=W.groundAt(map,x,y);
  if(ground> -16){
   const distance=distanceToBox(point,x,y,ground-1,1,1,1);
   if(distance<=r){
    if(protectedGround(x,y))plan.protectedCount++;
    else {
     for(let z=ground;z> -16;z-=.5){
      const d=distanceToBox(point,x,y,z-.5,1,1,.5);
      if(!canBreak(cfg.power,d,'dirt'))break;
      candidates.push({kind:'ground',x,y,z,distance:d});
     }
    }
   }
  }
  for(const [base,material]of Object.entries(map.blocks?.[x+','+y]||{})){
   const z=Number(base);if(!Number.isFinite(z)||!W.BLOCKS[material])continue;
   const distance=distanceToBox(point,x,y,z,1,1,W.blockSize(map,x,y,z));
   if(distance>r)continue;
   const key=x+','+y+','+z;
   if(lockedGroups.has(map.blockGroups?.[key])){plan.protectedCount++;continue}
   if(!canBreak(cfg.power,distance,material)){plan.resistedCount++;continue}
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
  if(!canBreak(cfg.power,distance,o.material)){plan.resistedCount++;continue}
  candidates.push({kind:'object',id:o.id,distance});
 }
 candidates.sort((a,b)=>a.distance-b.distance||(b.z??0)-(a.z??0));
 plan.limited=candidates.length>MAX_REMOVALS;
 for(const b of candidates.slice(0,MAX_REMOVALS))(b.kind==='voxel'?plan.voxels:b.kind==='ground'?plan.ground:plan.objects).push(b);
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
 const protectedGround=plan.ground?.length?groundProtection(map,locks):null;
 for(const b of (plan.ground||[]).slice().sort((a,b)=>b.z-a.z)){
  if(protectedGround(b.x,b.y)||W.groundAt(map,b.x,b.y)!==b.z)continue;
  if(W.digGround(map,b.x,b.y,.5))count++;
 }
 const ids=new Set(plan.objects.map(o=>o.id));
 if(ids.size){const before=map.objects.length;map.objects=map.objects.filter(o=>!ids.has(o.id)||o.type!=='block'||o.locked||o.protected||locks.has(o.group));count+=before-map.objects.length}
 return count;
}
export function flightPosition(from,to,t){
 t=Math.max(0,Math.min(1,t));const arc=Math.sin(t*Math.PI)*.28;
 return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t+arc};
}
export function flightTrail(from,to,t){
 const distance=throwDistance(from,to),span=Math.min(1,5/Math.max(.001,distance));
 return Array.from({length:24},(_,i)=>flightPosition(from,to,t-span*(i+1)/24));
}
export function createThrowQueue(namespace='throw'){
 let items=[],serial=0;
 return {
  launch(map,enabled,from,to,item,W,now){
   if(!enabled||!validImpact(map,to,W)||![from?.x,from?.y,from?.z,now].every(Number.isFinite)||!inThrowRange(from,to,item))return false;
   const config=throwConfig(item),duration=Math.max(16,throwDistance(from,to)/config.speed*1000);
   items.push({id:namespace+'-'+(++serial),map,from:{...from},to:{x:to.x,y:to.y,z:to.z},config,started:now,duration,impactAt:null});return true;
  },
  impact(map,point,item,W,now,level=map.editLevel||0){
   if(!validImpact(map,point,W)||!Number.isFinite(now)||items.length>=32)return false;
   const config=throwConfig(item);items.push({id:namespace+'-'+(++serial),map,to:{x:point.x,y:point.y,z:point.z},config,level,impactAt:now,started:now,duration:0});return true;
  },
  advance(map,enabled,now,onImpact){
   if(!enabled){items=[];return []}
   items=items.filter(p=>p.map===map);
   const visible=[];
   for(const p of items){
    if(p.impactAt===null&&now>=p.started+p.duration){p.impactAt=p.started+p.duration;onImpact(p.to,{preset:p.config.id,power:p.config.power,destroy:p.config.destroy})}
    if(p.impactAt===null){visible.push({id:p.id,config:p.config,position:flightPosition(p.from,p.to,(now-p.started)/p.duration),tail:flightPosition(p.from,p.to,(now-p.started)/p.duration-.15),trail:flightTrail(p.from,p.to,(now-p.started)/p.duration),phase:'flight',age:0});continue}
    const age=(now-p.impactAt)/1000;
    for(const layer of p.config.layers){const elapsed=age-layer.delay;if(!layer.enabled||elapsed<0||elapsed>=layer.duration)continue;visible.push({id:p.id+':'+layer.id,config:{...p.config,id:layer.kind,color:layer.color,shape:layer.shape,strength:layer.strength,radius:p.config.radius*layer.size,duration:layer.duration},position:p.to,tail:p.to,level:p.level,phase:'impact',age:elapsed})}
   }
   items=items.filter(p=>p.impactAt===null||now-p.impactAt<p.config.duration*1000);
   return visible;
  },
  clear(){items=[]},get size(){return items.length}
 };
}
// Construction previews and actual gameplay impacts have different lifetimes
// and permissions. Never hide a real block activation in player mode.
export function renderableImpacts(opts){
 const construction=opts.building&&opts.mode==='mj'?(opts.thrownEffects||[]):[];
 const blocks=(opts.blockEffects||[]).filter(p=>(p.level??0)===(opts.map.editLevel||0)&&(opts.mode==='mj'||!opts.map.fog?.includes(Math.floor(p.position.x)+','+Math.floor(p.position.y))));
 return construction.length&&blocks.length?[...construction,...blocks]:construction.length?construction:blocks;
}
export const THROW_ITEMS=PRESETS.map(p=>({kind:'throw',preset:p.id,name:p.name,power:3,destroy:true}));

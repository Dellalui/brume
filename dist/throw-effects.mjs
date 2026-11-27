// Fictional construction-mode projectiles. Continuous collision with live world geometry.
import {RECIPE_PRESETS,normalizeLayers,recipeDuration,SHAPES} from './effect-recipes.mjs';
import {shotDistance,traceProjectile} from './projectile-collision.mjs';
export const PRESETS=RECIPE_PRESETS;
export const FLIGHT_STYLES=Object.freeze([['orb','Orbe et traînée'],['ribbon','Traînée lumineuse continue'],['beads','Chapelet de boules'],['bare','Boule seule']]);
export const MAX_RADIUS=6,MAX_REMOVALS=512,IMPACT_MS=3000;
export function throwConfig(item){
 const preset=PRESETS.find(p=>p.id===item?.preset)||PRESETS[0];
 const power=Number.isFinite(Number(item?.power))?Math.max(1,Math.min(MAX_RADIUS,Math.round(Number(item.power)))):3;
 const visualScale=Number.isFinite(Number(item?.visualScale))?Math.max(.75,Math.min(2,Number(item.visualScale))):1.25;
 const range=Number.isFinite(Number(item?.range))?Math.max(0,Number(item.range)):48;
 const speed=Number.isFinite(Number(item?.speed))?Math.max(.1,Math.min(300,Number(item.speed))):30;
 const layers=normalizeLayers(item?.layers??preset.layers);
 const flightStyle=FLIGHT_STYLES.some(([id])=>id===item?.flightStyle)?item.flightStyle:'orb',flightColor=/^#[0-9a-f]{6}$/i.test(item?.flightColor||'')?item.flightColor:layers.find(l=>l.enabled)?.color||preset.color;
 const trailLength=Number.isFinite(Number(item?.trailLength))?Math.max(0,Math.min(24,Number(item.trailLength))):5,flightSize=Number.isFinite(Number(item?.flightSize))?Math.max(.25,Math.min(3,Number(item.flightSize))):1;
 const damageShape=SHAPES.some(s=>s.id===item?.damageShape)?item.damageShape:layers.find(l=>l.enabled)?.shape||'sphere';
 return {...preset,name:String(item?.name||preset.name),power,radius:power,damageShape,flightStyle,flightColor,trailLength,flightSize,destroy:item?.destroy!==false,visualScale,range,speed,layers,duration:recipeDuration(layers),visualQuality:item?.visualQuality==='high'?'high':'auto'};
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
// Game-space volumes, independent of visualScale and secondary VFX layers.
const EPS=1e-7,BIN=8;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
function boxInfo(point,x,y,z,w,d,h,angle=0){
 const c=angle?Math.cos(angle):1,s=angle?Math.sin(angle):0,cx=x+w/2,cy=y+d/2;
 const dx=point.x-cx,dy=point.y-cy,lx=dx*c+dy*s,ly=-dx*s+dy*c;
 const qx=Math.max(0,Math.abs(lx)-w/2),qy=Math.max(0,Math.abs(ly)-d/2),qz=Math.max(z-point.z,point.z-z-h,0);
 return {x,y,z,w,d,h,c,s,cx,cy,lx,ly,qx,qy,qz,dx,dy};
}
function volumeDistance(point,b,shape,r){
 const {qx,qy,qz,lx,ly,c,s,dx,dy,w,d,z,h}=b,lo=z-point.z,hi=lo+h;
 if(shape==='sphere'){const squared=qx*qx+qy*qy+qz*qz;return squared>r*r?Infinity:Math.sqrt(squared)}
 const horizontal2=qx*qx+qy*qy;
 if(shape==='cube'){
  const ac=Math.abs(c),as=Math.abs(s),sum=ac+as;
  return Math.max(0,Math.abs(dx)-(w*ac+d*as)/2,Math.abs(dy)-(w*as+d*ac)/2,qx/sum,qy/sum,qz);
 }
 if(horizontal2>r*r)return Infinity;
 const horizontal=Math.sqrt(horizontal2);
 if(shape==='dome')return hi<=EPS?Infinity:Math.hypot(horizontal,Math.max(0,lo));
 if(shape==='column')return Math.max(horizontal/.65,qz);
 if(shape==='cone')return Math.max(qz,2*horizontal+Math.max(-r,lo),0);
 if(shape==='disc'||shape==='ring'){
  const halfHeight=Math.max(.25,r*.15);
  if(qz>=halfHeight)return Infinity;
  if(shape==='ring'&&Math.hypot(Math.abs(lx)+w/2,Math.abs(ly)+d/2)<=r*.55)return Infinity;
  return Math.max(horizontal,qz/Math.max(.15,halfHeight/r));
 }
 return Math.hypot(horizontal,qz);
}
export function impactVolumeDistance(point,shape,r,x,y,z,w=1,d=1,h=1,angle=0){
 return volumeDistance(point,boxInfo(point,x,y,z,w,d,h,angle),shape,r);
}
// One sparse XY index for the whole batch. Keep original object order for
// stable tie breaking, including large rotated placed blocks at bin edges.
function impactIndex(map,W){
 const locks=new Set((map.groups||[]).filter(g=>g.locked||g.protected).map(g=>g.id)),bins=new Map(),removed=new Set(),protectedColumns=new Set();
 if(locks.size)for(const [key,id]of Object.entries(map.blockGroups||{}))if(locks.has(id)){const end=key.lastIndexOf(',');if(end>0)protectedColumns.add(key.slice(0,end))}
 let order=0;
 for(const o of map.objects||[]){
  if(o.type!=='block')continue;
  const b=W.bounds(o);if(![b.x,b.y,b.w,b.h].every(Number.isFinite))continue;
  const entry={o,b,order:order++};
  for(let y=Math.max(0,Math.floor(b.y/BIN));y<=Math.min(Math.ceil(map.height/BIN)-1,Math.floor((b.y+b.h)/BIN));y++)
   for(let x=Math.max(0,Math.floor(b.x/BIN));x<=Math.min(Math.ceil(map.width/BIN)-1,Math.floor((b.x+b.w)/BIN));x++){const k=x+','+y;let list=bins.get(k);if(!list)bins.set(k,list=[]);list.push(entry)}
 }
 function query(x0,y0,x1,y1){
  const found=new Set();
  for(let y=Math.floor(y0/BIN);y<=Math.floor(y1/BIN);y++)for(let x=Math.floor(x0/BIN);x<=Math.floor(x1/BIN);x++)
   for(const entry of bins.get(x+','+y)||[]){const {o,b}=entry;if(!removed.has(o.id)&&b.x<=x1&&b.x+b.w>=x0&&b.y<=y1&&b.y+b.h>=y0)found.add(entry)}
  return [...found].sort((a,b)=>a.order-b.order);
 }
 const locked=o=>o.locked||o.protected||locks.has(o.group);
 function groundLocked(x,y){
  if(protectedColumns.has(x+','+y))return true;
  const point={x:x+.5,y:y+.5,z:0};
  return query(point.x,point.y,point.x,point.y).some(({o})=>locked(o)&&distanceToBox(point,o.x,o.y,0,o.w??1,o.d??1,1,o.facing||0)===0);
 }
 return {locks,removed,query,locked,groundLocked};
}
// Cache occupancy only in columns visited by this small game-effect volume.
// The DDA traverses crossed XY cells, including half-height voxel intervals;
// a solid object contributes once, not once per crossed cell. These are
// arbitrary gameplay attenuation units, not physical blast simulation.
function createImpactSampler(map,point,W,index,placed){
 const columns=new Map(),placedColumns=new Map();
 const sourceContains=b=>b.qx<=EPS&&b.qy<=EPS&&b.qz<=EPS;
 const records=(x,y)=>{
  const k=x+','+y;if(columns.has(k))return columns.get(k);
  const list=[];
  for(const [base,material]of Object.entries(map.blocks?.[k]||{})){
   const z=Number(base);if(!Number.isFinite(z)||!W.BLOCKS[material])continue;
   const id=k+','+z,h=W.blockSize(map,x,y,z),b=boxInfo(point,x,y,z,1,1,h);
   list.push({id,x,y,z,h,material,b,locked:index.locks.has(map.blockGroups?.[id]),solid:W.BLOCKS[material].solid!==false,source:sourceContains(b),loss:materialHardness(material)*.35});
  }
  columns.set(k,list);return list;
 };
 function objectsAt(x,y){
  const k=x+','+y;if(!placedColumns.has(k))placedColumns.set(k,placed.filter(v=>v.bounds.x<x+1+EPS&&v.bounds.x+v.bounds.w>x-EPS&&v.bounds.y<y+1+EPS&&v.bounds.y+v.bounds.h>y-EPS));return placedColumns.get(k);
 }
 function crossesPlaced(v,dx,dy,dz){
  const b=v.b,velX=dx*b.c+dy*b.s,velY=-dx*b.s+dy*b.c;
  let lo=EPS,hi=1-EPS;
  for(const [p,d,min,max]of [[b.lx,velX,-b.w/2,b.w/2],[b.ly,velY,-b.d/2,b.d/2],[point.z,dz,b.z,b.z+b.h]]){
   if(Math.abs(d)<EPS){if(p<=min+EPS||p>=max-EPS)return false;continue}
   const a=(min-p)/d,c=(max-p)/d;lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));if(hi-lo<=EPS)return false;
  }
  return true;
 }
 function shielded(target,maxLoss){
  const dx=target.tx-point.x,dy=target.ty-point.y,dz=target.tz-point.z;
  if(Math.abs(dx)+Math.abs(dy)+Math.abs(dz)<EPS)return false;
  let x=Math.floor(point.x),y=Math.floor(point.y),t=0,loss=0;
  const sx=Math.sign(dx),sy=Math.sign(dy),stepX=dx?1/Math.abs(dx):Infinity,stepY=dy?1/Math.abs(dy):Infinity;
  let nextX=dx?((dx>0?x+1:x)-point.x)/dx:Infinity,nextY=dy?((dy>0?y+1:y)-point.y)/dy:Infinity;
  const seen=placed.length?new Set():null,limit=Math.abs(Math.floor(target.tx)-x)+Math.abs(Math.floor(target.ty)-y)+3;
  for(let n=0;n<limit;n++){
   const end=Math.min(1,nextX,nextY),a=Math.max(t,EPS),b=Math.min(end,1-EPS);
   if(b>a+EPS){
    const za=point.z+dz*a,zb=point.z+dz*b,low=Math.min(za,zb),high=Math.max(za,zb);
    for(const v of records(x,y)){
     if(v.source||v.id===target.voxelId||!v.solid||low>=v.z+v.h-EPS||high<=v.z+EPS)continue;
     if(v.locked)return true;loss+=v.loss;if(loss>maxLoss+EPS)return true;
    }
    if(seen)for(const v of objectsAt(x,y)){
     if(v.source||v.id===target.objectId||!v.solid||seen.has(v.id))continue;
     seen.add(v.id);if(!crossesPlaced(v,dx,dy,dz))continue;
     if(v.locked)return true;loss+=v.loss;if(loss>maxLoss+EPS)return true;
    }
   }
   if(end>=1-EPS)return false;
   const crossX=nextX<=end+EPS,crossY=nextY<=end+EPS;
   if(crossX){x+=sx;nextX+=stepX}if(crossY){y+=sy;nextY+=stepY}t=end;
  }
  return false;
 }
 return {records,shielded};
}
export function planImpact(map,point,item,W,shared=null){
 const cfg=throwConfig(item),plan={voxels:[],objects:[],ground:[],protectedCount:0,resistedCount:0,limited:false};
 if(!cfg.destroy||!validImpact(map,point,W))return plan;
 const index=shared||impactIndex(map,W),candidates=[],r=cfg.radius,shape=cfg.damageShape;
 const xmin=Math.max(0,Math.floor(point.x-r)),xmax=Math.min(map.width-1,Math.floor(point.x+r)),ymin=Math.max(0,Math.floor(point.y-r)),ymax=Math.min(map.height-1,Math.floor(point.y+r));
 const placed=[];
 for(const {o,b:bounds}of index.query(xmin,ymin,xmax+1,ymax+1)){
  const w=o.w??1,d=o.d??1,h=o.height??1,z=W.elevation(o,map);
  if(![o.x,o.y,z,w,d,h].every(Number.isFinite)||Math.min(w,d,h)<=0)continue;
  const b=boxInfo(point,o.x,o.y,z,w,d,h,o.facing||0);
  placed.push({o,id:o.id,b,bounds,locked:index.locked(o),source:b.qx<=EPS&&b.qy<=EPS&&b.qz<=EPS,solid:W.BLOCKS[o.material]?.solid!==false,loss:materialHardness(o.material)*.35});
 }
 const sampler=createImpactSampler(map,point,W,index,placed);
 function candidate(entry,material,distance,locked,tx,ty,tz){
  if(distance>r)return;
  if(locked){plan.protectedCount++;return}
  const remaining=cfg.power-distance-materialHardness(material);
  if(remaining<0){plan.resistedCount++;return}
  candidates.push({...entry,distance,remaining,tx,ty,tz});
 }
 for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
  if(!W.activeCell(map,x,y))continue;
  // Reject whole columns outside the shape's horizontal footprint.
  const hx=Math.max(x-point.x,point.x-x-1,0),hy=Math.max(y-point.y,point.y-y-1,0);
  if(shape==='cube'?Math.max(hx,hy)>r:hx*hx+hy*hy>r*r)continue;
  const ground=W.groundAt(map,x,y);
  if(ground>-16){
   const first=impactVolumeDistance(point,shape,r,x,y,ground-.5,1,1,.5);
   if(first<=r){
    if(index.groundLocked(x,y))plan.protectedCount++;
    else for(let z=ground;z>-16;z-=.5){
     const distance=impactVolumeDistance(point,shape,r,x,y,z-.5,1,1,.5),remaining=cfg.power-distance-materialHardness('dirt');
     if(remaining<0)break;
     const target={kind:'ground',x,y,z,distance,remaining,tx:x+.5,ty:y+.5,tz:z-.25};
     if(sampler.shielded(target,remaining)){plan.resistedCount++;break}
     candidates.push(target);
    }
   }
  }
  for(const v of sampler.records(x,y)){
   const distance=volumeDistance(point,v.b,shape,r);
   candidate({kind:'voxel',x,y,z:v.z,key:v.id,material:v.material,voxelId:v.id},v.material,distance,v.locked,x+.5,y+.5,v.z+v.h/2);
  }
 }
 for(const v of placed){
  const {o,b}=v,distance=volumeDistance(point,b,shape,r);
  if(distance>r)continue;
  // For a large placed block use its closest interior point, not a remote
  // center outside the local impact volume.
  const px=clamp(b.lx,-b.w/2+Math.min(.0001,b.w/4),b.w/2-Math.min(.0001,b.w/4)),py=clamp(b.ly,-b.d/2+Math.min(.0001,b.d/4),b.d/2-Math.min(.0001,b.d/4));
  candidate({kind:'object',id:o.id,objectId:o.id},o.material,distance,v.locked,b.cx+px*b.c-py*b.s,b.cy+px*b.s+py*b.c,clamp(point.z,b.z+Math.min(.0001,b.h/4),b.z+b.h-Math.min(.0001,b.h/4)));
 }
 candidates.sort((a,b)=>a.distance-b.distance||(b.z??0)-(a.z??0));
 let accepted=0;
 for(const b of candidates){
  if(b.kind!=='ground'&&sampler.shielded(b,b.remaining)){plan.resistedCount++;continue}
  if(accepted===MAX_REMOVALS){plan.limited=true;break}
  accepted++;const {remaining,tx,ty,tz,voxelId,objectId,...hit}=b;
  (b.kind==='voxel'?plan.voxels:b.kind==='ground'?plan.ground:plan.objects).push(hit);
 }
 return plan;
}
export function applyImpact(map,plan,W,changes=null,shared=null){
 let count=0;
 const locks=shared?.locks||new Set((map.groups||[]).filter(g=>g.locked||g.protected).map(g=>g.id));
 // Exact base keys were already validated during planning. Delete them
 // directly, preserving all ancillary metadata and the per-removal revision.
 const touched=new Map();
 for(const b of plan.voxels){
  const key=b.x+','+b.y,column=map.blocks?.[key];
  if(!column||column[b.z]!==b.material||locks.has(map.blockGroups?.[b.key]))continue;
  if(!touched.has(key))touched.set(key,W.activeCell(map,b.x,b.y));
  if(!touched.get(key)||!Number.isFinite(b.z)||b.z< -16||b.z>=32)continue;
  delete column[b.z];if(map.blockGroups)delete map.blockGroups[b.key];if(map.blockHeights)delete map.blockHeights[b.key];if(map.blockActivations)delete map.blockActivations[b.key];
  changes?.voxels.push(b.key);count++;
 }
 for(const [key,active]of touched)if(active&&map.blocks[key]&&!Object.keys(map.blocks[key]).length)delete map.blocks[key];
 if(count)map.blockRevision=(map.blockRevision||0)+count;
 const index=shared||(plan.ground?.length?impactIndex(map,W):null),groundByColumn=new Map();
 for(const b of plan.ground||[]){const k=b.x+','+b.y;if(!groundByColumn.has(k))groundByColumn.set(k,[]);groundByColumn.get(k).push(b)}
 for(const [key,items]of groundByColumn){
  const {x,y}=items[0];if(!W.activeCell(map,x,y)||index.groundLocked(x,y))continue;
  let z=W.groundAt(map,x,y),n=0;
  for(const b of items.sort((a,b)=>b.z-a.z))if(b.z===z&&z>-16){z=Math.max(-16,z-.5);n++}
  if(n){map.ground??={};map.ground[key]=z;map.blockRevision=(map.blockRevision||0)+n;count+=n;if(changes){changes.ground+=n;for(let i=0;i<n;i++)changes.groundColumns?.push(key)}}
 }
 const ids=new Set(plan.objects.map(o=>o.id));
 if(ids.size){const before=map.objects.length;map.objects=map.objects.filter(o=>{const keep=!ids.has(o.id)||o.type!=='block'||o.locked||o.protected||locks.has(o.group);if(!keep){changes?.objects.push(o.id);shared?.removed.add(o.id)}return keep});count+=before-map.objects.length}
 return count;
}
// Preserve impact order and the per-impact removal/protection rules while
// letting the editor commit one transaction for simultaneous hits.
export function applyImpactBatch(map,impacts,W,beforeChange=()=>{},metrics=null){
 let changed=false,count=0,protectedCount=0,resistedCount=0,limited=0,destructive=0;const changes={voxels:[],objects:[],ground:0,groundColumns:[]};let index=null;
 for(const {point,item} of impacts){
  if(item.destroy===false)continue;
  destructive++;const t=metrics?performance.now():0;index??=impactIndex(map,W);const plan=planImpact(map,point,item,W,index);if(metrics)metrics['calcul dégâts']=(metrics['calcul dégâts']||0)+performance.now()-t;
  if(plan.voxels.length||plan.objects.length||plan.ground.length){
   if(!changed){beforeChange();changed=true}
   const t=metrics?performance.now():0;count+=applyImpact(map,plan,W,changes,index);if(metrics)metrics['coupe blocs']=(metrics['coupe blocs']||0)+performance.now()-t;
  }
  protectedCount+=plan.protectedCount;resistedCount+=plan.resistedCount;limited+=Number(plan.limited);
 }
 return {changed,count,protectedCount,resistedCount,limited,destructive,changes};
}
function impactLayers(config){
 return config.layers.filter(l=>l.enabled).map(layer=>({id:layer.id,delay:layer.delay,duration:layer.duration,config:{...config,id:layer.kind,color:layer.color,shape:layer.shape,strength:layer.strength,radius:config.radius*layer.size,duration:layer.duration}}));
}
export function flightPosition(from,to,t,out={},linear=false){
 t=Math.max(0,Math.min(1,t));const arc=linear?0:Math.sin(t*Math.PI)*.28;
 out.x=from.x+(to.x-from.x)*t;out.y=from.y+(to.y-from.y)*t;out.z=from.z+(to.z-from.z)*t+arc;return out;
}
export function flightTrail(from,to,t,out=[],{linear=false,length=5}={}){
 const distance=throwDistance(from,to),span=Math.min(linear?Math.max(0,t):1,length/Math.max(.001,distance));
 for(let i=0;i<24;i++)out[i]=flightPosition(from,to,t-span*(i+1)/24,out[i],linear);out.length=24;return out;
}
export function createThrowQueue(namespace='throw'){
 let items=[],serial=0;
 const pointAt=(p,d)=>({x:p.from.x+p.direction.x*d,y:p.from.y+p.direction.y*d,z:p.from.z+p.direction.z*d});
 const notify=(p,onImpact)=>onImpact(p.to,{preset:p.config.id,power:p.config.power,destroy:p.config.destroy,damageShape:p.config.damageShape});
 return {
  fire(map,enabled,from,direction,item,W,now){
   if(!enabled||![from?.x,from?.y,from?.z,direction?.x,direction?.y,direction?.z,now].every(Number.isFinite))return false;
   const length=Math.hypot(direction.x,direction.y,direction.z);if(length<1e-8)return false;
   const dir={x:direction.x/length,y:direction.y/length,z:direction.z/length},config=throwConfig(item),maximum=shotDistance(map,from,dir,config.range);
   const p={id:namespace+'-'+(++serial),map,from:{...from},direction:dir,W,maximum,travel:0,config,layers:impactLayers(config),started:now,impactAt:null};
   p.to=pointAt(p,maximum);p.duration=maximum/config.speed*1000;items.push(p);return true;
  },
  // Retain the explicit A-to-B recipe API for scripted effects and callers.
  launch(map,enabled,from,to,item,W,now){
   if(!enabled||!validImpact(map,to,W)||![from?.x,from?.y,from?.z,now].every(Number.isFinite))return false;
   const config=throwConfig(item),distance=throwDistance(from,to);if(config.range!==0&&distance>config.range+1e-6)return false;const duration=Math.max(16,distance/config.speed*1000);
   items.push({id:namespace+'-'+(++serial),map,from:{...from},to:{x:to.x,y:to.y,z:to.z},config,layers:impactLayers(config),started:now,duration,impactAt:null});return true;
  },
  impact(map,point,item,W,now,level=map.editLevel||0){
   if(!validImpact(map,point,W)||!Number.isFinite(now)||items.length>=32)return false;
   const config=throwConfig(item);items.push({id:namespace+'-'+(++serial),map,to:{x:point.x,y:point.y,z:point.z},config,layers:impactLayers(config),level,impactAt:now,started:now,duration:0});return true;
  },
  advance(map,enabled,now,onImpact,{deferTrails=false}={}){
   if(!enabled){items=[];return []}
   items=items.filter(p=>p.map===map);
   const visible=[];
   for(const p of items){
    if(p.impactAt===null&&p.direction){
     const next=Math.min(p.maximum,Math.max(p.travel,(now-p.started)*p.config.speed/1000));
     if(next>p.travel){
      const hit=traceProjectile(map,pointAt(p,p.travel),pointAt(p,next),p.W);
      if(hit&&validImpact(map,hit.point,p.W)){p.travel+=(next-p.travel)*hit.t;p.to=hit.point;p.impactAt=p.started+p.travel/p.config.speed*1000;notify(p,onImpact)}
      else p.travel=next;
     }
     if(p.impactAt===null&&p.travel>=p.maximum){p.missed=true;continue}
    }else if(p.impactAt===null&&now>=p.started+p.duration){p.impactAt=p.started+p.duration;notify(p,onImpact)}
    if(p.impactAt===null){
     const linear=!!p.direction,t=linear?p.travel/p.maximum:(now-p.started)/p.duration,tailT=linear?t-p.config.trailLength/p.maximum:t-p.config.trailLength/Math.max(.001,throwDistance(p.from,p.to));
     const flight={id:p.id,config:p.config,position:flightPosition(p.from,p.to,t,{},linear),tail:flightPosition(p.from,p.to,tailT,{},linear),phase:'flight',age:0};
     if(deferTrails){flight.flightFrom=p.from;flight.flightTo=p.to;flight.flightProgress=t;flight.flightLinear=linear}
     else flight.trail=flightTrail(p.from,p.to,t,[],{linear,length:p.config.trailLength});
     visible.push(flight);continue;
    }
    const age=(now-p.impactAt)/1000;
    for(const layer of p.layers){const elapsed=age-layer.delay;if(elapsed<0||elapsed>=layer.duration)continue;visible.push({id:p.id+':'+layer.id,config:layer.config,position:p.to,tail:p.to,level:p.level,phase:'impact',age:elapsed})}
   }
   items=items.filter(p=>!p.missed&&(p.impactAt===null||now-p.impactAt<p.config.duration*1000));
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

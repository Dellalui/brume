import * as W from './world.mjs';
export const LIQUID_RANGE=Object.freeze({"water":7,"lava":3});
export const MAX_FLOW_CELLS=12000;
const EPS=0.000001,SIDES=[[1,0],[-1,0],[0,1],[0,-1]];
export const isLiquid=k=>k==='water'||k==='lava';
const col=(x,y)=>x+','+y,slot=(x,y,z)=>x+','+y+','+Math.round(z*2),aligned=n=>Math.abs(n-Math.round(n))<EPS;
export function deriveLiquids(map,W,mode='mj',limit=MAX_FLOW_CELLS){
 const sources=[],irregular=[],flows=new Map(),slots=new Map(),sourceSlots=new Map(),columns=new Map(),bins=new Map(),groups=new Map((map.groups||[]).map(g=>[g.id,g.visible!==false]));
 const chunks=new Set(map.chunks||[]),active=(x,y)=>x>=0&&y>=0&&x<map.width&&y<map.height&&chunks.has(Math.floor(x/16)+','+Math.floor(y/16));
 const visible=(id,secret=false)=>groups.get(id)!==false&&(!secret||mode==='mj');
 const record=(x,y,z,h,kind,object=null)=>{if(!active(x,y))return;const s={x,y,z,h,kind,source:true,remaining:LIQUID_RANGE[kind]+1,object};sources.push(s);for(let t=z;t<z+h-EPS;t+=.5)sourceSlots.set(slot(x,y,t),s)};
 for(const [k,column] of Object.entries(map.blocks||{})){
  const [x,y]=k.split(',').map(Number);
  for(const [base,kind] of Object.entries(column)){
   const z=Number(base);
   if(isLiquid(kind)&&visible(map.blockGroups?.[k+','+base]))record(x,y,z,W.blockSize(map,x,y,z),kind);
  }
 }
 // Exact grid-aligned creative blocks participate in the same flow model.
 // Off-grid or rotated sources keep their editable shape instead of being
 // silently snapped or replacing solid geometry.
 for(const o of map.objects||[]){
  if(o.visible===false||o.open&&W.isDoor?.(o))continue;
  const liquid=o.type==='block'&&isLiquid(o.material),structural=o.type==='block'||o.type==='build_door'||W.isSegment(o);
  if(!structural)continue;
  const b=W.bounds(o),z=W.elevation(o,map),h=o.height||1;
  if(![b.x,b.y,b.w,b.h,z,h].every(Number.isFinite)||h<=0)continue;
  const bounds={x0:b.x,y0:b.y,x1:b.x+b.w,y1:b.y+b.h,z,h};
  // Broad footprint bins keep collision queries local. Rotated walls use
  // conservative bounds, preferring a dry edge over water inside a wall.
  for(let by=Math.max(0,Math.floor(b.y/4));by<=Math.min(Math.ceil(map.height/4)-1,Math.floor((b.y+b.h-EPS)/4));by++)
   for(let bx=Math.max(0,Math.floor(b.x/4));bx<=Math.min(Math.ceil(map.width/4)-1,Math.floor((b.x+b.w-EPS)/4));bx++){
    const k=col(bx,by);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(bounds);
   }
  if(!liquid||!visible(o.group,o.secret))continue;
  if(aligned(b.x)&&aligned(b.y)&&aligned(b.w)&&aligned(b.h)&&aligned(z*2)&&aligned(h*2)&&aligned((o.facing||0)/(Math.PI/2))){
   for(let y=Math.round(b.y);y<Math.round(b.y+b.h);y++)for(let x=Math.round(b.x);x<Math.round(b.x+b.w);x++)
    for(let base=z;base<z+h-EPS;base+=1)record(x,y,base,Math.min(1,z+h-base),o.material,o);
  }else irregular.push({x:o.x,y:o.y,z,h,kind:o.material,w:o.w,d:o.d,angle:o.facing||0,source:true,object:o});
 }
 const queue=sources.sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x||a.kind.localeCompare(b.kind)).slice();
 const empty=(x,y,z)=>{
  if(!active(x,y)||z< -16-EPS||z+.5>32+EPS||z<W.groundAt(map,x,y)-EPS)return false;
  const k=col(x,y);
  if(!columns.has(k)){
   const spans=Object.entries(map.blocks?.[k]||{}).filter(([,kind])=>W.BLOCKS[kind]).map(([base])=>[+base,+base+W.blockSize(map,x,y,+base)]);
   for(const b of bins.get(col(Math.floor(x/4),Math.floor(y/4)))||[])if(x+1>b.x0+EPS&&x<b.x1-EPS&&y+1>b.y0+EPS&&y<b.y1-EPS)spans.push([b.z,b.z+b.h]);
   columns.set(k,spans);
  }
  return !columns.get(k).some(([lo,hi])=>z<hi-EPS&&z+.5>lo+EPS)&&!slots.has(slot(x,y,z));
 };
 function strengthen(b,remaining,falling){
  const changed=remaining>b.remaining||falling&&!b.falling;
  if(changed){b.remaining=Math.max(b.remaining,remaining);b.falling||=falling;queue.push(b)}
 }
 function add(x,y,z,kind,remaining,falling,h=1){
  const k=slot(x,y,z),old=slots.get(k);
  if(old){if(old.kind!==kind||Math.abs(old.z-z)>EPS)return false;strengthen(old,remaining,falling);return true}
  if(flows.size>=limit||!empty(x,y,z))return false;
  h=h===1&&empty(x,y,z+.5)?1:.5;
  const b={x,y,z,h,kind,remaining,falling,source:false};
  flows.set(k,b);for(let t=z;t<z+h-EPS;t+=.5)slots.set(slot(x,y,t),b);queue.push(b);return true;
 }
 for(let i=0;i<queue.length&&i<sources.length+limit*8;i++){
  const b=queue[i],{x,y,z,kind,remaining}=b,below=slot(x,y,z-.5),existing=slots.get(below);
  if(sourceSlots.get(below)?.kind===kind)continue;
  if(existing?.kind===kind){strengthen(existing,remaining,true);continue}
  if(empty(x,y,z-.5)){
   const full=empty(x,y,z-1);
   if(add(x,y,z-(full?1:.5),kind,remaining,true,full?1:.5))continue;
  }
  if(remaining<=1)continue;
  for(const [dx,dy] of SIDES)add(x+dx,y+dy,z,kind,remaining-1,false);
 }
 const cells=[...sources,...flows.values()];
 for(const b of cells){
  const above=slot(b.x,b.y,b.z+b.h);
  b.renderH=sourceSlots.get(above)?.kind===b.kind||slots.get(above)?.kind===b.kind||b.falling?b.h:Math.min(b.h,b.source?b.h*.88:Math.max(.10,.88*b.remaining/(LIQUID_RANGE[b.kind]+1)));
 }
 return {cells,irregular,generated:flows.size,limited:flows.size>=limit};
}
export function liquidMeshData(result,include=()=>true,slice=32){
 const cells=result.cells.filter(b=>b.z<slice),columns=new Map(),batches=new Map();
 for(const b of cells){const k=b.kind+'|'+col(b.x,b.y);if(!columns.has(k))columns.set(k,[]);columns.get(k).push(b)}
 const get=(b,x,y)=>columns.get(b.kind+'|'+col(x,y))||[];
 const near=(a,b)=>Math.abs(a-b)<EPS;
 function subtract(spans,lo,hi){const out=[];for(const [a,b] of spans){if(hi<=a+EPS||lo>=b-EPS){out.push([a,b]);continue}if(lo>a+EPS)out.push([a,lo]);if(hi<b-EPS)out.push([hi,b])}return out}
 function face(b,points){
  const k=b.kind+'|'+Math.floor(b.x/16)+','+Math.floor(b.y/16);
  if(!batches.has(k))batches.set(k,{kind:b.kind,positions:[]});
  const p=batches.get(k).positions;
  for(const i of [0,1,2,0,2,3])p.push(...points[i]);
 }
 function emit(b,neighbours,transform=(x,z,y)=>[x,z,y]){
  const lo=b.z,hi=lo+b.renderH,x=b.x,y=b.y,x1=x+(b.w||1),y1=y+(b.d||1),own=neighbours(0,0);
  const f=points=>face(b,points.map(p=>transform(...p)));
  if(!own.some(n=>n!==b&&near(n.z,hi)))f([[x,hi,y],[x,hi,y1],[x1,hi,y1],[x1,hi,y]]);
  if(!own.some(n=>n!==b&&near(n.z+n.renderH,lo)))f([[x,lo,y1],[x,lo,y],[x1,lo,y],[x1,lo,y1]]);
  for(const [dx,dy] of SIDES){
   let spans=[[lo,hi]];
   for(const n of neighbours(dx,dy))spans=subtract(spans,n.z,n.z+n.renderH);
   for(const [a,c] of spans){
    if(c-a<EPS)continue;
    if(dx===1)f([[x1,a,y],[x1,c,y],[x1,c,y1],[x1,a,y1]]);
    else if(dx===-1)f([[x,a,y1],[x,c,y1],[x,c,y],[x,a,y]]);
    else if(dy===1)f([[x1,a,y1],[x1,c,y1],[x,c,y1],[x,a,y1]]);
    else f([[x,a,y],[x,c,y],[x1,c,y],[x1,a,y]]);
   }
  }
 }
 for(const b of cells)if(include(b))emit(b,(dx,dy)=>get(b,b.x+dx,b.y+dy));
 for(const o of result.irregular)if(o.z<slice&&include(o)){
  const b={...o,renderH:o.h*.88},cx=b.x+b.w/2,cy=b.y+b.d/2,c=Math.cos(b.angle),s=Math.sin(b.angle);
  emit(b,()=>[],(x,z,y)=>[cx+(x-cx)*c-(y-cy)*s,z,cy+(x-cx)*s+(y-cy)*c]);
 }
 return [...batches.values()];
}
export function createLiquidCache(){
 const cache=new WeakMap();
 return (map,W,mode)=>{
  const key=JSON.stringify([mode,map.width,map.height,map.blockRevision,map.buildRevision,map.groups?.map(g=>[g.id,g.visible]),map.chunks]);
  let c=cache.get(map);
  if(c?.key===key)return c.result;
  const result=deriveLiquids(map,W,mode);cache.set(map,{key,result});return result;
 };
}

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
// Smooth only the render mesh; the source/flow simulation remains grid-based.
const CORNERS=[[0,0],[0,1],[1,1],[1,0]];
export function liquidSurfaceProfiles(cells){
 const columns=new Map(),lookup=new Map(),profiles=new Map(),normalSums=new Map();
 const cellKey=(b,x=b.x,y=b.y)=>`${b.kind}|${x},${y},${b.z},${b.h}`;
 for(const b of cells){
  const k=b.kind+'|'+col(b.x,b.y);if(!columns.has(k))columns.set(k,[]);
  columns.get(k).push(b);lookup.set(cellKey(b),b);
 }
 const at=(b,x=b.x,y=b.y)=>columns.get(b.kind+'|'+col(x,y))||[];
 const covered=b=>at(b).some(n=>n!==b&&Math.abs(n.z-(b.z+b.h))<EPS);
 const locked=new Set(cells.filter(b=>b.falling||covered(b)||b.renderH>=b.h-EPS));
 const cornerCache=new Map();
 function corner(b,vx,vy){
  const cacheKey=`${b.kind}|${vx},${vy},${b.z},${b.h}`;
  if(!cornerCache.has(cacheKey)){
   const candidates=[];
   for(const x of [vx-1,vx])for(const y of [vy-1,vy]){
    const c=lookup.get(cellKey(b,x,y));if(c)candidates.push(c);
   }
   // At a diagonal contact only, the two isolated pools must not blend.
   const unseen=new Set(candidates),values=new Map();
   while(unseen.size){
    const first=unseen.values().next().value,component=[first];unseen.delete(first);
    for(let i=0;i<component.length;i++)for(const c of [...unseen]){
     if(Math.abs(c.x-component[i].x)+Math.abs(c.y-component[i].y)===1){component.push(c);unseen.delete(c)}
    }
    const fixed=component.some(c=>locked.has(c));
    let height=component.reduce((s,c)=>s+c.renderH,0)/component.length;
    if(fixed)height=b.h;
    else if(component.every(c=>!c.source)&&height<.32&&component.length<4)height*=.60+.10*component.length;
    height=Math.min(b.h,Math.max(.035,height));
    const id=cacheKey+'|'+first.x+','+first.y;
    for(const c of component)values.set(c,{height:b.z+height,id});
   }
   cornerCache.set(cacheKey,values);
  }
  return cornerCache.get(cacheKey).get(b)||{height:b.z+b.renderH,id:cacheKey};
 }
 function cross(a,b,c){
  const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
  return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 }
 for(const b of cells){
  const corners=CORNERS.map(([dx,dy])=>corner(b,b.x+dx,b.y+dy));
  const p=corners.map((c,i)=>[b.x+CORNERS[i][0],c.height,b.y+CORNERS[i][1]]);
  const top=!covered(b);
  profiles.set(b,{b,p,corners,top});
  if(top)for(const indices of [[0,1,2],[0,2,3]]){
   const n=cross(...indices.map(i=>p[i]));
   for(const i of indices){const id=corners[i].id,v=normalSums.get(id)||[0,0,0];normalSums.set(id,v.map((x,j)=>x+n[j]));}
  }
 }
 function normal(id){const n=normalSums.get(id)||[0,1,0],length=Math.hypot(...n)||1;return n.map(x=>x/length)}
 return {profiles,at,normal};
}
export function liquidMeshData(result,include=()=>true,slice=32){
 const cells=result.cells.filter(b=>b.z<slice),batches=new Map();
 const {profiles,at,normal}=liquidSurfaceProfiles(cells);
 const length=v=>Math.hypot(...v),cross=(a,b,c)=>{const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]};
 function triangle(b,p,ns){
  const n=cross(...p),l=length(n);if(l<EPS)return;
  const k=b.kind+'|'+Math.floor(b.x/16)+','+Math.floor(b.y/16);
  if(!batches.has(k))batches.set(k,{kind:b.kind,positions:[],normals:[]});
  const batch=batches.get(k),flat=n.map(x=>x/l);
  for(let i=0;i<3;i++){batch.positions.push(...p[i]);batch.normals.push(...(ns?.[i]||flat))}
 }
 function quad(b,p,ns){for(const indices of [[0,1,2],[0,2,3]])triangle(b,indices.map(i=>p[i]),ns&&indices.map(i=>ns[i]))}
 const flat=y=>[y,y],value=(l,t)=>l[0]+(l[1]-l[0])*t;
 // For side profiles, split only where two edge lines intersect. Emit the
 // vertical intervals not covered by the neighbouring liquid. This handles
 // waterfalls, half-height sources and unequal corner heights without cracks.
 function side(b,a,c,neighbours){
  const floor=flat(b.z),top=[a[1],c[1]],covers=[];
  const low=b.z,high=Math.max(...top);
  for(const {base,edge}of neighbours)if(base<high-EPS&&Math.max(...edge)>low+EPS)covers.push([flat(base),edge]);
  const lines=[floor,top,...covers.flat()],cuts=[0,1];
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
   const u=lines[i],v=lines[j],d=(u[1]-u[0])-(v[1]-v[0]);
   if(Math.abs(d)<EPS)continue;
   const t=(v[0]-u[0])/d;if(t>EPS&&t<1-EPS)cuts.push(t);
  }
  cuts.sort((u,v)=>u-v);
  const point=(t,y)=>[a[0]+(c[0]-a[0])*t,y,a[2]+(c[2]-a[2])*t];
  for(let i=1;i<cuts.length;i++){
   const u=cuts[i-1],v=cuts[i];if(v-u<EPS)continue;
   const mid=(u+v)/2,sorted=[...lines].sort((l,r)=>value(l,mid)-value(r,mid));
   for(let j=1;j<sorted.length;j++){
    const lo=sorted[j-1],hi=sorted[j],l=value(lo,mid),h=value(hi,mid);
    if(h-l<EPS)continue;const test=(l+h)/2;
    if(test<value(floor,mid)||test>value(top,mid)||covers.some(([a,c])=>test>value(a,mid)-EPS&&test<value(c,mid)+EPS))continue;
    quad(b,[point(u,value(lo,u)),point(u,value(hi,u)),point(v,value(hi,v)),point(v,value(lo,v))]);
   }
  }
 }
 // Each entry lists the current edge and the opposing neighbour edge in
 // the same horizontal direction, retaining outward winding.
 const edges=[
  {dx:1,dy:0,i:3,j:2,ni:0,nj:1},
  {dx:-1,dy:0,i:1,j:0,ni:2,nj:3},
  {dx:0,dy:1,i:2,j:1,ni:3,nj:0},
  {dx:0,dy:-1,i:0,j:3,ni:1,nj:2}
 ];
 for(const b of cells){
  if(!include(b))continue;
  const {p,corners,top}=profiles.get(b);
  if(top)quad(b,p,corners.map(c=>normal(c.id)));
  const under=at(b).some(n=>n!==b&&profiles.get(n).p.every(p=>Math.abs(p[1]-b.z)<EPS));
  if(!under)quad(b,[p[1],p[0],p[3],p[2]].map(q=>[q[0],b.z,q[2]]));
  for(const {dx,dy,i,j,ni,nj} of edges){
   const neighbours=at(b,b.x+dx,b.y+dy).map(n=>({base:n.z,edge:[profiles.get(n).p[ni][1],profiles.get(n).p[nj][1]]}));
   side(b,p[i],p[j],neighbours);
  }
 }
 // Arbitrarily rotated or scaled sources keep their explicit footprint.
 for(const b of result.irregular||[])if(b.z<slice&&include(b)){
  const x=b.x,y=b.y,z=b.z,h=b.h*.88,x1=x+b.w,y1=y+b.d,cx=(x+x1)/2,cy=(y+y1)/2,c=Math.cos(b.angle||0),s=Math.sin(b.angle||0);
  const p=[[x,z+h,y],[x,z+h,y1],[x1,z+h,y1],[x1,z+h,y]],q=p.map(v=>[v[0],z,v[2]]);
  const rotate=([x,z,y])=>[cx+(x-cx)*c-(y-cy)*s,z,cy+(x-cx)*s+(y-cy)*c];
  quad(b,p.map(rotate));quad(b,[q[1],q[0],q[3],q[2]].map(rotate));
  for(const {i,j}of edges)quad(b,[q[i],p[i],p[j],q[j]].map(rotate));
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

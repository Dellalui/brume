// Continuous collision for fictional VFX projectiles, using live world data.
// A segment traverses only crossed XY columns and nearby static colliders;
// no dependency on visible chunks, rendered geometry, or the camera.
const EPS=1e-8,BIN=4,indices=new WeakMap();
function interval(p,d,min,max,lo,hi){
 if(Math.abs(d)<EPS)return p>=min&&p<=max?[lo,hi]:null;
 const a=(min-p)/d,b=(max-p)/d;
 lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
 return hi>=lo?[lo,hi]:null;
}
function worldInterval(map,from,d,maximum){
 let t=[0,maximum];
 for(const [k,min,max]of [['x',0,map.width],['y',0,map.height],['z',-16,32]]){
  t=interval(from[k],d[k],min,max,...t);if(!t)return null;
 }
 return t;
}
export function shotDistance(map,from,d,range){
 if(range>0)return range;
 const t=worldInterval(map,from,d,Infinity);
 // Unlimited means throughout the playable world, not an immortal particle
 // in empty space. A ray aimed away from the map still visibly launches.
 return t?Math.max(.01,t[1]+.01):48;
}
function colliderIndex(map,W){
 let index=indices.get(map);
 if(index&&index.objects===map.objects&&index.length===map.objects.length&&index.revision===map.buildRevision)return index;
 const bins=new Map();
 for(const o of map.objects){
  if(W.character(o))continue;
  const b=W.collisionBounds(o);if(![b.x,b.y,b.w,b.h].every(Number.isFinite))continue;
  for(let y=Math.max(0,Math.floor(b.y/BIN));y<=Math.min(Math.ceil(map.height/BIN)-1,Math.floor((b.y+b.h)/BIN));y++)
   for(let x=Math.max(0,Math.floor(b.x/BIN));x<=Math.min(Math.ceil(map.width/BIN)-1,Math.floor((b.x+b.w)/BIN));x++){const k=x+','+y;let list=bins.get(k);if(!list)bins.set(k,list=[]);list.push(o)}
 }
 index={objects:map.objects,length:map.objects.length,revision:map.buildRevision,bins,groups:new Map(map.groups.map(g=>[g.id,g]))};indices.set(map,index);return index;
}
function verticalEntry(z,d,min,max,lo,hi){
 if(Math.abs(d)<EPS)return z>min+EPS&&z<max-EPS?lo:Infinity;
 const a=(min-z)/d,b=(max-z)/d,enter=Math.max(lo,Math.min(a,b)),exit=Math.min(hi,Math.max(a,b));
 // Touching the entry at the end of a segment counts; moving away from
 // a face or grazing an edge does not.
 return enter<=hi+EPS&&exit>=enter-EPS&&Math.max(a,b)>enter+EPS?enter:Infinity;
}
function objectEntry(o,map,W,from,d,max){
 if(o.visible===false||W.isDoor(o)&&o.open)return Infinity;
 if(o.type==='block'?!W.BLOCKS[o.material||'stone']?.solid:!(o.blocking||o.blocksSight))return Infinity;
 const center=W.center(o),z=W.elevation(o,map),h=(o.height||1)*(o.scale||1);
 let w=o.w||1,depth=o.d||1,angle=o.facing||0;
 if(W.isSegment(o)){w=Math.max(.01,Math.hypot(o.x2-o.x,o.y2-o.y));depth=.16;angle=Math.atan2(o.y2-o.y,o.x2-o.x)}
 else if(o.type==='tree'){w=depth=(o.trunkRadius||.13)*2;angle=0}
 if(![center.x,center.y,z,h,w,depth,angle].every(Number.isFinite)||Math.min(h,w,depth)<=0)return Infinity;
 const c=Math.cos(angle),s=Math.sin(angle),px=from.x-center.x,py=from.y-center.y;
 let lo=0,hi=max,leave=Infinity;
 for(const [p,v,min,end]of [[px*c+py*s,d.x*c+d.y*s,-w/2,w/2],[-px*s+py*c,-d.x*s+d.y*c,-depth/2,depth/2],[from.z,d.z,z,z+h]]){
  if(Math.abs(v)<EPS){if(p<=min+EPS||p>=end-EPS)return Infinity;continue}
  const a=(min-p)/v,b=(end-p)/v;lo=Math.max(lo,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));hi=Math.min(hi,Math.max(a,b));if(hi<lo-EPS)return Infinity;
 }
 return leave>lo+EPS?lo:Infinity;
}
export function traceProjectile(map,from,to,W){
 const d={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z};
 if(Math.abs(d.x)+Math.abs(d.y)+Math.abs(d.z)<EPS)return null;
 const clipped=worldInterval(map,from,d,1);if(!clipped)return null;
 const [start,finish]=clipped;if(finish-start<EPS)return null;
 // Bias only cell selection at the entry boundary. Keep exact hit time.
 const probe=Math.min(finish,start+EPS),px=from.x+d.x*probe,py=from.y+d.y*probe;
 let x=Math.floor(Math.max(0,Math.min(map.width-EPS,px))),y=Math.floor(Math.max(0,Math.min(map.height-EPS,py))),t=start;
 const sx=Math.sign(d.x),sy=Math.sign(d.y),dx=d.x?1/Math.abs(d.x):Infinity,dy=d.y?1/Math.abs(d.y):Infinity;
 let nx=d.x?((d.x>0?x+1:x)-from.x)/d.x:Infinity,ny=d.y?((d.y>0?y+1:y)-from.y)/d.y:Infinity;
 const index=colliderIndex(map,W),seen=new Set();let best=Infinity,hitKind=null,hitId=null,hitCell=null;
 const record=(u,kind,id,cx,cy)=>{if(u<best&&u>=start-EPS&&u<=finish+EPS){best=u;hitKind=kind;hitId=id;hitCell=[cx,cy]}};
 const limit=Math.ceil(Math.abs(d.x)*(finish-start))+Math.ceil(Math.abs(d.y)*(finish-start))+4;
 for(let n=0;n<limit;n++){
  const end=Math.min(finish,nx,ny);
  if(end>=t-EPS&&W.activeCell(map,x,y)){
   const ground=W.groundAt(map,x,y);
   if(ground> -16)record(verticalEntry(from.z,d.z,-16,ground,t,end),'ground',null,x,y);
   for(const [base,material]of Object.entries(map.blocks?.[x+','+y]||{})){
    if(!W.BLOCKS[material]?.solid)continue;
    const z=Number(base),h=W.blockSize(map,x,y,z);
    record(verticalEntry(from.z,d.z,z,z+h,t,end),'voxel',x+','+y+','+z,x,y);
   }
   for(const o of index.bins.get(Math.floor(x/BIN)+','+Math.floor(y/BIN))||[]){
    if(seen.has(o)||index.groups.get(o.group)?.visible===false)continue;seen.add(o);
    const u=objectEntry(o,map,W,from,d,finish);
    if(Number.isFinite(u)){const hx=from.x+d.x*Math.min(1,u+EPS),hy=from.y+d.y*Math.min(1,u+EPS);if(W.activeCell(map,hx,hy))record(u,'object',o.id,Math.floor(hx),Math.floor(hy))}
   }
  }
  if(best<=end+EPS||end>=finish-EPS)break;
  const cx=nx<=end+EPS,cy=ny<=end+EPS;
  if(cx){x+=sx;nx+=dx}if(cy){y+=sy;ny+=dy}t=end;
 }
 if(!Number.isFinite(best))return null;
 const point={x:from.x+d.x*best,y:from.y+d.y*best,z:from.z+d.z*best};
 // At an outer map/chunk edge, keep the impact inside the actual hit cell.
 if(!W.activeCell(map,point.x,point.y)&&hitCell){point.x=Math.max(hitCell[0]+EPS,Math.min(hitCell[0]+1-EPS,point.x));point.y=Math.max(hitCell[1]+EPS,Math.min(hitCell[1]+1-EPS,point.y))}
 return {point,t:Math.max(0,Math.min(1,best)),kind:hitKind,id:hitId};
}

// Streaming scope is deliberately independent of player perception. Keep the
// nearby disk and recently viewed sectors resident; Three still frustum-culls
// meshes and the tactical visibility shader remains authoritative.
const regionCache=new WeakMap(),CHUNK=16,MAX_EXTRA=96;
export function createRenderRegion(camera,map){
 const origin={x:Math.floor(camera.position.x/CHUNK)*CHUNK+8,y:Math.floor(camera.position.z/CHUNK)*CHUNK+8},a=Math.round((map.camera.angle||0)/(Math.PI/12))*Math.PI/12;
 const fx=-(Math.cos(a)+Math.sin(a))/Math.SQRT2,fy=-(Math.cos(a)-Math.sin(a))/Math.SQRT2,far=map.renderSettings?.far??80,near=Math.min(far,48),cone=Math.cos((map.renderSettings?.cone??110)*Math.PI/360);
 const small=Math.max(map.width,map.height)<=64,scope=[map.width,map.height,far,cone].join('|');
 const cacheKey=[scope,small?0:origin.x,small?0:origin.y,small?0:a].join('|'),old=regionCache.get(map);if(old?.key===cacheKey)return old.region;
 const visible=(x,y,r=0)=>{if(small)return x+r>=0&&y+r>=0&&x-r<=map.width&&y-r<=map.height;const dx=x-origin.x,dy=y-origin.y,d=Math.hypot(dx,dy);return d<=near+r||d<=far+r&&((dx*fx+dy*fy)/Math.max(d,.001)>=cone-r/Math.max(d,1))};
 const left=small?0:Math.max(0,Math.floor((origin.x-far)/CHUNK)),right=small?Math.ceil(map.width/CHUNK)-1:Math.min(Math.ceil(map.width/CHUNK)-1,Math.floor((origin.x+far)/CHUNK)),top=small?0:Math.max(0,Math.floor((origin.y-far)/CHUNK)),bottom=small?Math.ceil(map.height/CHUNK)-1:Math.min(Math.ceil(map.height/CHUNK)-1,Math.floor((origin.y+far)/CHUNK));
 const chunks=new Set(),retained=[];
 for(let cy=top;cy<=bottom;cy++)for(let cx=left;cx<=right;cx++){
  const k=cx+','+cy,x=cx*CHUNK+8,y=cy*CHUNK+8;
  if(visible(x,y,12))chunks.add(k);
  else if(old?.scope===scope&&old.region.chunks.has(k)&&Math.hypot(x-origin.x,y-origin.y)<=far+12)retained.push({k,d:(x-origin.x)**2+(y-origin.y)**2});
 }
 // Evict by distance, never merely because the player looked away.
 retained.sort((a,b)=>a.d-b.d||a.k.localeCompare(b.k));
 const activeCount=chunks.size,residentLimit=Math.max(activeCount,48,Math.ceil(96*(far/80)**2));
 for(const {k} of retained.slice(0,Math.min(MAX_EXTRA,residentLimit-activeCount)))chunks.add(k);
 const cell=(x,y)=>chunks.has(Math.floor(x/CHUNK)+','+Math.floor(y/CHUNK));
 const contains=(x,y,r=0)=>{
  if(visible(x,y,r)||cell(x,y))return true;
  if(r<=0)return false;
  for(let cy=Math.max(top,Math.floor((y-r)/CHUNK));cy<=Math.min(bottom,Math.floor((y+r)/CHUNK));cy++)for(let cx=Math.max(left,Math.floor((x-r)/CHUNK));cx<=Math.min(right,Math.floor((x+r)/CHUNK));cx++)if(chunks.has(cx+','+cy))return true;
  return false;
 };
 const object=o=>{const w=o.w||1,d=o.d||1;return contains(o.x+w/2,o.y+d/2,Math.hypot(w,d)/2+(o.light?.radius||o.effect?.size||0))};
 const region={key:small?'whole-map':[...chunks].sort().join(';'),contains,cell,object,origin,chunks,resident:chunks.size-activeCount,residentLimit,bounds:small?{x0:0,y0:0,x1:map.width,y1:map.height}:{x0:Math.max(0,origin.x-far-16),y0:Math.max(0,origin.y-far-16),x1:Math.min(map.width,origin.x+far+16),y1:Math.min(map.height,origin.y+far+16)}};
 regionCache.set(map,{key:cacheKey,scope,region});return region;
}

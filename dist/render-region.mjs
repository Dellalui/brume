// A turn is not a streaming event. Maintain one bounded, omnidirectional
// working set around the camera. Three's actual frustum still culls the
// resident meshes; player perception remains authoritative in the shaders.
const regionCache=new WeakMap(),CHUNK=16,HYSTERESIS=4;
export function createRenderRegion(camera,map){
 const small=Math.max(map.width,map.height)<=64,far=map.renderSettings?.far??80,scope=[map.width,map.height,far].join('|'),old=regionCache.get(map);
 const snapped={x:Math.floor(camera.position.x/CHUNK)*CHUNK+8,y:Math.floor(camera.position.z/CHUNK)*CHUNK+8};
 const previous=old?.scope===scope?old.region.origin:null;
 const origin=previous&&Math.abs(camera.position.x-previous.x)<=8+HYSTERESIS&&Math.abs(camera.position.z-previous.y)<=8+HYSTERESIS?previous:snapped;
 const cacheKey=[scope,small?0:origin.x,small?0:origin.y].join('|');
 if(old?.key===cacheKey)return old.region;
 // Preserve the configured far distance, plus a small guard band for
 // sub-sector motion. The previous directional cone is no longer a
 // residency rule: turning never creates/disposes static geometry.
 const reach=far+HYSTERESIS;
 const visible=(x,y,r=0)=>small?x+r>=0&&y+r>=0&&x-r<=map.width&&y-r<=map.height:Math.hypot(x-origin.x,y-origin.y)<=reach+r;
 const left=small?0:Math.max(0,Math.floor((origin.x-reach)/CHUNK)),right=small?Math.ceil(map.width/CHUNK)-1:Math.min(Math.ceil(map.width/CHUNK)-1,Math.floor((origin.x+reach)/CHUNK)),top=small?0:Math.max(0,Math.floor((origin.y-reach)/CHUNK)),bottom=small?Math.ceil(map.height/CHUNK)-1:Math.min(Math.ceil(map.height/CHUNK)-1,Math.floor((origin.y+reach)/CHUNK));
 const chunks=new Set();
 for(let cy=top;cy<=bottom;cy++)for(let cx=left;cx<=right;cx++)if(visible(cx*CHUNK+8,cy*CHUNK+8,12))chunks.add(cx+','+cy);
 const cell=(x,y)=>chunks.has(Math.floor(x/CHUNK)+','+Math.floor(y/CHUNK));
 const contains=(x,y,r=0)=>{
  if(visible(x,y,r)||cell(x,y))return true;
  if(r<=0)return false;
  for(let cy=Math.max(top,Math.floor((y-r)/CHUNK));cy<=Math.min(bottom,Math.floor((y+r)/CHUNK));cy++)for(let cx=Math.max(left,Math.floor((x-r)/CHUNK));cx<=Math.min(right,Math.floor((x+r)/CHUNK));cx++)if(chunks.has(cx+','+cy))return true;
  return false;
 };
 const object=o=>{const w=o.w||1,d=o.d||1;return contains(o.x+w/2,o.y+d/2,Math.hypot(w,d)/2+(o.light?.radius||o.effect?.size||0))};
 const prefetch=[];if(!small){for(let cy=Math.max(0,top-1);cy<=Math.min(Math.ceil(map.height/16)-1,bottom+1);cy++)for(let cx=Math.max(0,left-1);cx<=Math.min(Math.ceil(map.width/16)-1,right+1);cx++){const id=cx+','+cy;if(chunks.has(id))continue;const d=(cx*16+8-origin.x)**2+(cy*16+8-origin.y)**2;if(d<=(reach+24)**2)prefetch.push({id,d})}prefetch.sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id))}
 const region={prefetch:prefetch.slice(0,24).map(p=>p.id),key:small?'whole-map':[...chunks].sort().join(';'),contains,cell,object,origin,chunks,resident:chunks.size,residentLimit:chunks.size,bounds:small?{x0:0,y0:0,x1:map.width,y1:map.height}:{x0:Math.max(0,origin.x-reach-16),y0:Math.max(0,origin.y-reach-16),x1:Math.min(map.width,origin.x+reach+16),y1:Math.min(map.height,origin.y+reach+16)}};
 regionCache.set(map,{key:cacheKey,scope,region});return region;
}

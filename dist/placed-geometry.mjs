// Spatial queries for scaled/rotated building blocks; independent from rendering.
const indices=new WeakMap();
export function containsBlock(o,x,y,padding=0){let a=-(o.facing||0),dx=x-(o.x+o.w/2),dy=y-(o.y+o.d/2),u=dx*Math.cos(a)-dy*Math.sin(a),v=dx*Math.sin(a)+dy*Math.cos(a);return Math.abs(u)<o.w/2+padding-1e-7&&Math.abs(v)<o.d/2+padding-1e-7}
export function nearbyBlocks(map,x,y){
 let entry=indices.get(map);if(!entry||entry.objects!==map.objects||entry.length!==map.objects?.length||entry.revision!==map.buildRevision){
  const bins=new Map();for(const o of map.objects||[]){if(o.type!=='block')continue;let c=Math.abs(Math.cos(o.facing||0)),s=Math.abs(Math.sin(o.facing||0)),w=c*o.w+s*o.d,d=s*o.w+c*o.d,cx=o.x+o.w/2,cy=o.y+o.d/2;
   for(let x=Math.floor((cx-w/2)/4);x<=Math.floor((cx+w/2)/4);x++)for(let y=Math.floor((cy-d/2)/4);y<=Math.floor((cy+d/2)/4);y++){const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(o)}
  }
  entry={objects:map.objects,length:map.objects?.length,revision:map.buildRevision,bins};indices.set(map,entry);
 }
 return entry.bins.get(Math.floor(x/4)+','+Math.floor(y/4))||[];
}
export function blockTops(map,x,y){return nearbyBlocks(map,Math.floor(x)+.5,Math.floor(y)+.5).filter(o=>o.blocking!==false&&containsBlock(o,Math.floor(x)+.5,Math.floor(y)+.5)).map(o=>Math.round(((o.baseZ||0)+o.height)*1e6)/1e6)}
export function placedBodyClear(map,x,y,z,height){return !nearbyBlocks(map,x+.5,y+.5).some(o=>o.blocking!==false&&containsBlock(o,x+.5,y+.5)&&(o.baseZ||0)<z+height-.001&&(o.baseZ||0)+o.height>z+.001)}
export function placedRayClear(map,a,b,z0,z1){
 const seen=new Set();
 for(let bx=Math.floor(Math.min(a.x,b.x)/4);bx<=Math.floor(Math.max(a.x,b.x)/4);bx++)for(let by=Math.floor(Math.min(a.y,b.y)/4);by<=Math.floor(Math.max(a.y,b.y)/4);by++)for(const o of nearbyBlocks(map,bx*4+.5,by*4+.5)){
  if(seen.has(o)||!o.blocksSight)continue;seen.add(o);let angle=-(o.facing||0),c=Math.cos(angle),s=Math.sin(angle),cx=o.x+o.w/2,cy=o.y+o.d/2;
  const from=[(a.x-cx)*c-(a.y-cy)*s,(a.x-cx)*s+(a.y-cy)*c,z0],to=[(b.x-cx)*c-(b.y-cy)*s,(b.x-cx)*s+(b.y-cy)*c,z1],min=[-o.w/2,-o.d/2,o.baseZ||0],max=[o.w/2,o.d/2,(o.baseZ||0)+o.height];let lo=1e-6,hi=1-1e-6;
  for(let axis=0;axis<3;axis++){let delta=to[axis]-from[axis];if(Math.abs(delta)<1e-10){if(from[axis]<=min[axis]+1e-6||from[axis]>=max[axis]-1e-6){hi=-1;break}}else{let x=(min[axis]-from[axis])/delta,y=(max[axis]-from[axis])/delta;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y))}}
  if(hi>lo+1e-6)return false;
 }
 return true;
}

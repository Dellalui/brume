// Light arrays are immutable snapshots produced by buildLights. Spatial
// indexing keeps identical source order and only removes impossible candidates.
const cache=new WeakMap(),SIZE=8;
export function lightCandidates(sources,x,y){
 if(sources.length<12)return sources;
 let entry=cache.get(sources);
 if(!entry||entry.length!==sources.length){
  const bins=new Map();let fallback=false;
  for(const s of sources){
   if(![s.x,s.y,s.radius].every(Number.isFinite)){fallback=true;break}
   if(s.radius<=0)continue;
   const x0=Math.floor((s.x-s.radius)/SIZE),x1=Math.floor((s.x+s.radius)/SIZE),y0=Math.floor((s.y-s.radius)/SIZE),y1=Math.floor((s.y+s.radius)/SIZE);
   // Avoid building a huge index for an exceptional world-sized light.
   if((x1-x0+1)*(y1-y0+1)>256){fallback=true;break}
   for(let by=y0;by<=y1;by++)for(let bx=x0;bx<=x1;bx++){
    const k=bx+','+by;let list=bins.get(k);if(!list){list=[];bins.set(k,list)}list.push(s);
   }
  }
  entry={length:sources.length,bins,fallback};cache.set(sources,entry);
 }
 return entry.fallback?sources:entry.bins.get(Math.floor(x/SIZE)+','+Math.floor(y/SIZE))||[];
}

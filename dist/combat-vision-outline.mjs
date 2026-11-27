// Bounded, terrain-following arc and rails. No filled mesh or per-cell vision scan.
export function buildVisionOutline({x,y,heading=0,range=12,angle=180},surface){
 const positions=[],accents=[],r=Math.max(.1,Math.min(96,Number(range)||12)),half=Math.max(0,Math.min(360,Number(angle)||180))*Math.PI/360;
 const cache=new Map();
 function height(x,y){const k=Math.floor(x)+','+Math.floor(y);if(!cache.has(k))cache.set(k,surface(Math.floor(x)+.5,Math.floor(y)+.5));return cache.get(k)}
 // One horizontal segment per small step. A discontinuous cliff never
 // produces a long diagonal floating above or cutting through the terrain.
 function segment(a,b,accent=false){
  const len=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.min(96,Math.ceil(len/.45)));
  for(let i=0;i<steps;i++){
   const t0=i/steps,t1=(i+1)/steps,ax=a.x+(b.x-a.x)*t0,ay=a.y+(b.y-a.y)*t0,bx=a.x+(b.x-a.x)*t1,by=a.y+(b.y-a.y)*t1;
   const z=height((ax+bx)/2,(ay+by)/2);if(!Number.isFinite(z))continue;
   // Split at the exact crossed cell edge, so the line follows voxel steps.
   const ts=[0,1];
   for(const [u,v] of [[ax,bx],[ay,by]])if(Math.floor(u)!==Math.floor(v)&&Math.abs(v-u)>1e-9){const t=(Math.max(Math.floor(u),Math.floor(v))-u)/(v-u);if(t>1e-6&&t<1-1e-6)ts.push(t)}
   ts.sort((a,b)=>a-b);
   for(let j=1;j<ts.length;j++){const lo=ts[j-1],hi=ts[j],mid=(lo+hi)/2;if(hi-lo<1e-6)continue;const h=height(ax+(bx-ax)*mid,ay+(by-ay)*mid);if(!Number.isFinite(h))continue;
    positions.push(ax+(bx-ax)*lo,h+.065,ay+(by-ay)*lo,ax+(bx-ax)*hi,h+.065,ay+(by-ay)*hi);accents.push(accent);
   }
  }
 }
 const polar=(a,d)=>({x:x+Math.sin(a)*d,y:y-Math.cos(a)*d});
 // Dashed outer arc; the fixed cap bounds work independently of map area.
 const n=Math.max(8,Math.min(64,Math.ceil(2*half*r/1.15)));
 for(let i=0;i<n;i++){
  const a=heading-half+2*half*i/n,b=heading-half+2*half*(i+.72)/n;
  segment(polar(a,r),polar(b,r),i%4===0);
 }
 if(half<Math.PI-.001)for(const a of [heading-half,heading+half]){
  // Fine side rails with a gap near the character.
  segment(polar(a,Math.min(.85,r*.12)),polar(a,r),false);
  segment(polar(a,r-.28),polar(a,r+.15),true);
 }
 // Small compass ticks and an unmistakable forward chevron.
 for(const a of [heading-half*.5,heading,heading+half*.5])segment(polar(a,Math.max(0,r-.35)),polar(a,r+.08),true);
 const tip=polar(heading,Math.min(1.55,r*.75)),left=polar(heading-.32,Math.min(1.05,r*.5)),right=polar(heading+.32,Math.min(1.05,r*.5));
 segment(left,tip,true);segment(tip,right,true);
 return{positions,accents,samples:cache.size};
}

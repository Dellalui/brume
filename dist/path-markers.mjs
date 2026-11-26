// Pure, world-space route marker layout. Null points split visibility runs.
const EPS=0.00001;
export function routeMarkers(points){
 const valid=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
 const dashes=[],stride=Math.max(1,Math.ceil(points.length/1600));
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(!valid(a)||!valid(b)||i%stride!==0)continue;
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d<EPS)continue;
  const ux=dx/d,uy=dy/d;
  // Never draw a diagonal ribbon through a stair riser or a solid ledge.
  if(Math.abs(b.z-a.z)>.04){
   if(i>1)dashes.push({x:a.x,y:a.y,z:a.z,ux,uy,length:0});
   if(i<points.length-1)dashes.push({x:b.x,y:b.y,z:b.z,ux,uy,length:0});
   continue;
  }
  // Round individual dashes instead of rounding the path itself across walls.
  const start=i===1?.43:.11,end=d-(i===points.length-1?.36:.11),available=end-start;
  if(available<.04)continue;
  const count=Math.max(1,Math.round(available/.39)),spacing=available/count;
  for(let j=0;j<count;j++){
   const t=start+spacing*(j+.5);
   dashes.push({x:a.x+ux*t,y:a.y+uy*t,z:a.z+(b.z-a.z)*t/d,ux,uy,length:Math.max(0,Math.min(.24,spacing-.14))});
  }
 }
 return {dashes,target:points.length>1&&valid(points.at(-1))?points.at(-1):null};
}
export function routeMarkerGeometry(layout){
 const border=[],ink=[];
 function disk(out,x,y,z,r,inner=0,n=24){
  for(let i=0;i<n;i++){
   const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;
   const p=[x+Math.cos(a)*r,z,y+Math.sin(a)*r],q=[x+Math.cos(b)*r,z,y+Math.sin(b)*r];
   if(inner<=0){out.push(x,z,y,...q,...p);continue}
   const u=[x+Math.cos(a)*inner,z,y+Math.sin(a)*inner],v=[x+Math.cos(b)*inner,z,y+Math.sin(b)*inner];
   out.push(...u,...q,...p,...u,...v,...q);
  }
 }
 function capsule(out,d,r,offset){
  if(d.length<EPS){disk(out,d.x,d.y,d.z+offset,r,0,12);return}
  const {x,y,z,ux,uy,length}=d,h=length/2,points=[],angle=Math.atan2(uy,ux);
  for(let i=0;i<=8;i++){const a=angle-Math.PI/2+i*Math.PI/8;points.push([x+ux*h+Math.cos(a)*r,z+offset,y+uy*h+Math.sin(a)*r])}
  for(let i=0;i<=8;i++){const a=angle+Math.PI/2+i*Math.PI/8;points.push([x-ux*h+Math.cos(a)*r,z+offset,y-uy*h+Math.sin(a)*r])}
  for(let i=0;i<points.length;i++)out.push(x,z+offset,y,...points[(i+1)%points.length],...points[i]);
 }
 for(const d of layout.dashes){capsule(border,d,.085,.035);capsule(ink,d,.052,.041)}
 if(layout.target){
  const {x,y,z}=layout.target;
  disk(border,x,y,z+.035,.305,.18,40);disk(ink,x,y,z+.041,.278,.208,40);
  disk(border,x,y,z+.035,.105,0,24);disk(ink,x,y,z+.041,.072,0,24);
 }
 return {border,ink};
}

// Terrain-aware roots: the crown is unchanged, roots are rebuilt once when
// planting. Tagged root nodes can descend below the trunk's local origin.
import * as W from './world.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),round=x=>Math.round(x*10000)/10000;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const lerp=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
export function splitTreeRoots(graph){
 if(!graph?.length||graph[0][5]==='broken')return {graph,paths:[]};
 const root=graph[0],owner=new Map(),paths=new Map();
 for(let i=1;i<graph.length;i++){
  const n=graph[i],parent=n[4];
  const first=parent===0&&(n[6]==='root'||Math.abs(n[2]-root[2])<=.22&&Math.hypot(n[0]-root[0],n[1]-root[1])>.2);
  const id=first?i:owner.get(parent);
  if(id===undefined)continue;owner.set(i,id);
  if(!paths.has(id))paths.set(id,[]);paths.get(id).push(n);
 }
 if(!owner.size)return {graph,paths:[]};
 const keep=[],ids=new Map();
 for(let i=0;i<graph.length;i++){if(owner.has(i))continue;const n=graph[i].slice();if(i)n[4]=ids.get(n[4]);ids.set(i,keep.length);keep.push(n)}
 return {graph:keep,paths:[...paths.values()]};
}
export function rootSurface(map,x,y,near,maxStep=1.25){
 if(!W.activeCell(map,x,y))return null;
 const ground=W.groundAt(map,x,y),column=map.blocks?.[W.cellKey(x,y)]||{},tops=[ground];
 for(const [base,mat] of Object.entries(column))if(W.BLOCKS[mat]?.solid)tops.push(+base+W.blockSize(map,x,y,+base));
 // No jumping to the roof of a tall wall or crossing a sealed overhang.
 return tops.filter(z=>Math.abs(z-near)<=maxStep+.001&&z>=-16&&z<=31.8&&![.015,.08,.18].some(d=>W.BLOCKS[W.blockAt(map,x,y,z+d)]?.solid)).sort((a,b)=>Math.abs(a-near)-Math.abs(b-near)||b-a)[0]??null;
}
function air(map,p){
 const [x,y,z]=p;
 return W.activeCell(map,x,y)&&z>=W.groundAt(map,x,y)-.001&&z<=32&&!W.BLOCKS[W.blockAt(map,x,y,z+.001)]?.solid;
}
// Collision with constructed objects remains conservative. Terrain itself
// is tested along the centerline, permitting shallow contact/embedding of
// bark into soil or the edge of a supporting voxel, never a buried center.
function edgeClear(map,a,b,r,blocked){
 const l=distance(a,b),steps=Math.max(1,Math.ceil(l/.075));
 for(let i=0;i<=steps;i++)if(!air(map,lerp(a,b,i/steps)))return false;
 const pad=r+.08+.08*l,x=Math.min(a[0],b[0])-pad,y=Math.min(a[1],b[1])-pad,z=Math.max(-16,Math.min(a[2],b[2])-pad);
 return !blocked({x,y,w:Math.abs(a[0]-b[0])+2*pad,d:Math.abs(a[1]-b[1])+2*pad,baseZ:z,height:Math.max(a[2],b[2])+pad-z});
}
function boundary(a,b){
 const key=W.cellKey(a[0],a[1]);let lo=0,hi=1;
 for(let i=0;i<16;i++){const t=(lo+hi)/2,p=lerp(a,b,t);if(W.cellKey(p[0],p[1])===key)lo=t;else hi=t}
 return lerp(a,b,(lo+hi)/2);
}
// Generate an explicit bend on the lower side of a voxel step. Two
// successive vertical levels can therefore remain connected without a
// diagonal segment cutting straight through the higher block.
function route(map,a,b,oldTop,newTop,r){
 if(Math.abs(oldTop-newTop)<.001)return [b];
 if(W.cellKey(a[0],a[1])===W.cellKey(b[0],b[1]))return null;
 const cross=boundary(a,b),l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.12)return null;
 const ux=(b[0]-a[0])/l,uy=(b[1]-a[1])/l,side=newTop>oldTop?-1:1,pad=Math.min(.22,Math.max(.075,r+.035)),x=cross[0]+ux*pad*side,y=cross[1]+uy*pad*side;
 if(W.cellKey(x,y)!==W.cellKey(...(side<0?a:b)))return null;
 const z0=oldTop+Math.max(.025,r*.55),z1=newTop+Math.max(.025,r*.55);
 return [[x,y,z0],[x,y,z1],b];
}
export function fitTreeRoots(map,tree,paths,blocked=()=>false){
 const g=tree.treeGraph.map(n=>n.slice()),root=g[0],c=W.center(tree),z=W.elevation(tree,map),angle=tree.facing||0,co=Math.cos(angle),si=Math.sin(angle);
 const world=n=>[c.x+n[0]*co-n[1]*si,c.y+n[0]*si+n[1]*co,z+n[2]],local=p=>[(p[0]-c.x)*co+(p[1]-c.y)*si,(p[1]-c.y)*co-(p[0]-c.x)*si,p[2]-z].map(round);
 const anchor=world(root),baseTop=rootSurface(map,anchor[0],anchor[1],z,.12);
 // An elevated decorative tree without actual ground should not grow
 // hanging surface roots. Keep its crown and leave the roots absent.
 if(baseTop===null||!paths.length)return g;
 const flare=clamp(Number(tree.treeConfig?.rootFlare??.5)||0,0,1);
 // The old 96-node crown budget stays intact. At most 24 extra control
 // points are available for precise bends at voxel steps.
 const limit=Math.min(120,96+24),used=[];
 for(let i=0;i<paths.length;i++){
  const path=paths[i],first=world(path[0]),dx=first[0]-anchor[0],dy=first[1]-anchor[1],mag=Math.hypot(dx,dy);if(mag<.12)continue;
  const heading=Math.atan2(dy,dx),last=world(path.at(-1)),reach=clamp(Math.hypot(last[0]-anchor[0],last[1]-anchor[1])*(.9+.3*flare),.75,4.3);
  const startR=Math.max(.035,Math.min(root[3]*.62,path[0][3]*(.90+.20*flare)));
  const quota=Math.min(9,Math.max(1,Math.floor((limit-g.length)/(paths.length-i))));
  let prev=anchor,top=baseTop,parent=0,travel=0,dir=heading,added=0;
  while(added<quota&&travel<reach-.11){
   let best=null;
   for(const step of [Math.min(.70,reach-travel),Math.min(.44,reach-travel),Math.min(.27,reach-travel)]){
    if(step<.13)continue;
    for(const offset of [0,.24,-.24,.50,-.50,.82,-.82,1.08,-1.08]){
     const a=dir+offset,progress=clamp((travel+step)/reach,0,1),r=round(Math.max(.013,startR*(1-progress*.91)));
     const x=prev[0]+Math.cos(a)*step,y=prev[1]+Math.sin(a)*step;
     // Roots grow away from the trunk; no loops or backtracking.
     if(Math.hypot(x-anchor[0],y-anchor[1])<Math.hypot(prev[0]-anchor[0],prev[1]-anchor[1])+.035)continue;
     const nextTop=rootSurface(map,x,y,top);if(nextTop===null||nextTop<z-3||nextTop>z+3)continue;
     const q=[x,y,nextTop+Math.max(.022,r*.48)],routePoints=route(map,prev,q,top,nextTop,r);
     if(!routePoints)continue;
     let p=prev,ok=true;const points=[];
     for(const v of routePoints){
      if(distance(p,v)<=.115)continue;
      if(!edgeClear(map,p,v,Math.max(r,parent===0?r*1.18:g[parent][3]),blocked)){ok=false;break}
      points.push(v);p=v;
     }
     if(!ok||!points.length||distance(p,q)>.116||points.length>quota-added)continue;
     // Reject intersections with independent root runs (their shared
     // attachment at the trunk is intentional).
     if(travel>.4&&used.some(v=>distance(v,q)<r+.09))continue;
     best={points,q,r,top:nextTop,dir:a,step};break;
    }
    if(best)break;
   }
   if(!best)break;
   for(const p of best.points){
    const r=best.r;g.push([...local(p),r,parent,'round','root']);parent=g.length-1;added++;used.push(p);
   }
   prev=best.points.at(-1);top=best.top;travel+=best.step;dir=best.dir;
  }
  if(parent!==0){
   const n=g[parent],p=g[n[4]],radius=round(Math.max(.013,Math.min(n[3],p[3]*.24)));
   n[3]=radius;n[5]='taper';
   // Lower the final thin node into contact with the surface, without
   // adding an unchecked extension beyond the validated growth path.
   const end=world(n),from=world(p),surface=rootSurface(map,end[0],end[1],top,.12);
   if(surface!==null){
    const candidate=[end[0],end[1],surface+Math.max(.006,radius*.42)];
    if(distance(from,candidate)>.115&&edgeClear(map,from,candidate,Math.max(p[6]==='root'?p[3]:radius*1.18,radius),blocked))n.splice(0,3,...local(candidate));
   }
  }
 }
 return g;
}

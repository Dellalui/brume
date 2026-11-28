// Conservative construction hitboxes, independent of rendering. A tree keeps
// its unified mesh and does not acquire separate visible objects or rigid bodies.
// One cuboid per growth edge, plus root and terminal volumes.
import {validTreeGraph} from './unified-trees.mjs';
const graphCache=new WeakMap(),objectCache=new WeakMap();
const extent=(a,b,r)=>[Math.min(a[0],b[0])-r,Math.min(a[1],b[1])-r,Math.max(0,Math.min(a[2],b[2])-r),Math.max(a[0],b[0])+r,Math.max(a[1],b[1])+r,Math.max(a[2],b[2])+r];
function localBoxes(graph){
 if(graphCache.has(graph))return graphCache.get(graph);
 const boxes=[],parents=new Set(graph.slice(1).map(n=>n[4])),root=graph[0];
 boxes.push(extent([root[0],root[1],0],root,Math.min(.55,root[3]*1.22)+.08));
 for(let i=1;i<graph.length;i++){
  const n=graph[i],p=graph[n[4]],d=Math.hypot(n[0]-p[0],n[1]-p[1],n[2]-p[2]);
  // Hermite interpolation can bow outside a straight chord. The margin
  // covers its bounded tangents without reserving the entire crown.
  const margin=.20*d+.035;
  boxes.push(extent(p,n,Math.max(p[3],n[3])+margin));
  if(!parents.has(i)&&n[5]!=='broken'){
   const length=n[5]==='taper'?Math.max(.12,Math.min(.38,n[3]*2.6)):Math.max(.035,Math.min(.13,n[3]*.6));
   const tip=n.slice(0,3).map((x,k)=>x+(x-p[k])/Math.max(.001,d)*length);tip[2]=Math.max(.018,tip[2]);boxes.push(extent(n,tip,n[3]+.08));
  }
 }
 graphCache.set(graph,boxes);return boxes;
}
export function treeConstructionBoxes(o,z){
 if(o?.type!=='tree'||o.blocking===false||!Number.isFinite(z))return [];
 const key=[o.x,o.y,o.w,o.d,o.height,o.facing,o.trunkRadius,z].join(','),cached=objectCache.get(o);
 if(cached?.key===key&&cached.graph===o.treeGraph)return cached.boxes;
 const r=Math.max(.06,Number(o.trunkRadius)||.13),local=validTreeGraph(o.treeGraph)?localBoxes(o.treeGraph):[[-r,-r,0,r,r,Math.max(.1,o.height||3)]];
 const cx=o.x+(o.w||1)/2,cy=o.y+(o.d||1)/2,a=o.facing||0,c=Math.cos(a),s=Math.sin(a);
 const boxes=local.map(([x0,y0,z0,x1,y1,z1])=>{
  const corners=[[x0,y0],[x0,y1],[x1,y0],[x1,y1]].map(([x,y])=>[cx+x*c-y*s,cy+x*s+y*c]);
  const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);
  return {type:'block',id:o.id,x,y,w:Math.max(...xs)-x,d:Math.max(...ys)-y,baseZ:z+z0,height:z1-z0,facing:0,blocking:true};
 });
 objectCache.set(o,{key,graph:o.treeGraph,boxes});return boxes;
}
export function boxIntersects(a,b){
 const eps=.0001;
 return a.x+a.w>b.x+eps&&b.x+b.w>a.x+eps&&a.y+a.d>b.y+eps&&b.y+b.d>a.y+eps&&a.baseZ+a.height>b.baseZ+eps&&b.baseZ+b.height>a.baseZ+eps;
}
export function treeBlocksVoxel(o,z,x,y,baseZ,height=1){
 if(o?.type!=='tree'||o.blocking===false)return false;
 const cx=o.x+(o.w||1)/2,cy=o.y+(o.d||1)/2,reach=Math.hypot(o.w||1,o.d||1)/2+.6;
 if(x+1<=cx-reach||x>=cx+reach||y+1<=cy-reach||y>=cy+reach||baseZ+height<=z||baseZ>=z+(o.height||1)+.6)return false;
 return treeConstructionBoxes(o,z).some(b=>boxIntersects(b,{x,y,w:1,d:1,baseZ,height}));
}

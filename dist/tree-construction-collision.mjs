// Conservative construction hitboxes, independent of rendering. A tree keeps
// its unified mesh and does not acquire separate visible objects or rigid bodies.
// One cuboid per growth edge, plus root and terminal volumes.
import {validTreeGraph,treeTipEnd} from './unified-trees.mjs';
const graphCache=new WeakMap(),objectCache=new WeakMap();
const extent=(a,b,r)=>[Math.min(a[0],b[0])-r,Math.min(a[1],b[1])-r,Math.max(0,Math.min(a[2],b[2])-r),Math.max(a[0],b[0])+r,Math.max(a[1],b[1])+r,Math.max(a[2],b[2])+r];
function localSegments(graph){
 if(graphCache.has(graph))return graphCache.get(graph);
 const parts=[],parents=new Set(graph.slice(1).map(n=>n[4])),root=graph[0];
 parts.push([[root[0],root[1],0],root,Math.min(.55,root[3]*1.22)+.08]);
 for(let i=1;i<graph.length;i++){
  const n=graph[i],p=graph[n[4]],d=Math.hypot(n[0]-p[0],n[1]-p[1],n[2]-p[2]),margin=.20*d+.035;
  parts.push([p,n,Math.max(p[3],n[3])+margin]);
  if(!parents.has(i)){
   const tip=treeTipEnd(n,p);if(tip)parts.push([n,tip.point,n[3]+.08]);
  }
 }
 graphCache.set(graph,parts);return parts;
}
export function treeConstructionBoxes(o,z){
 if(o?.type!=='tree'||o.blocking===false||!Number.isFinite(z))return [];
 const key=[o.x,o.y,o.w,o.d,o.height,o.facing,o.trunkRadius,z].join(','),cached=objectCache.get(o);
 if(cached?.key===key&&cached.graph===o.treeGraph)return cached.boxes;
 const r=Math.max(.06,Number(o.trunkRadius)||.13),parts=validTreeGraph(o.treeGraph)?localSegments(o.treeGraph):[[[0,0,0],[0,0,Math.max(.1,o.height||3)],r]];
 const cx=o.x+(o.w||1)/2,cy=o.y+(o.d||1)/2,a=o.facing||0,c=Math.cos(a),s=Math.sin(a),world=p=>[cx+p[0]*c-p[1]*s,cy+p[0]*s+p[1]*c,p[2]];
 // Rotate the actual edge first, not its bounding box. This avoids giant
 // diagonal hitboxes when the randomly rotated tree is planted.
 const boxes=parts.map(([a,b,r])=>{const [x,y,z0,x1,y1,z1]=extent(world(a),world(b),r);return {type:'block',id:o.id,x,y,w:x1-x,d:y1-y,baseZ:z+z0,height:z1-z0,facing:0,blocking:true}});
 objectCache.set(o,{key,graph:o.treeGraph,boxes});return boxes;
}
export function rayTreeBox(o,z,ray,max=Infinity){
 if(!ray)return null;let nearest=null,best=max;
 const {origin,direction}=ray;
 for(const b of treeConstructionBoxes(o,z)){
  let lo=0,hi=best;for(const [a,min,max]of [['x',b.x,b.x+b.w],['y',b.y,b.y+b.d],['z',b.baseZ,b.baseZ+b.height]]){
   const v=direction[a],p=origin[a];if(Math.abs(v)<1e-8){if(p<min||p>max){lo=Infinity;break}}else{const x=(min-p)/v,y=(max-p)/v;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));if(lo>hi)break}
  }
  if(lo<=hi&&lo<best){best=lo;nearest=b}
 }
 return nearest;
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

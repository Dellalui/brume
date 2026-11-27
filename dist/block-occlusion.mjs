import * as W from './world.mjs';
const EPS=1e-6,BUCKET=4;
const key=(x,y,z)=>`${x},${y},${z}`;
// Conservative face coverage: partial seams, glass and rotated pieces never hide neighbours.
function covered(a,b,c,d,rects){
 if(!rects.length)return false;if(rects.some(r=>r[0]<=a+EPS&&r[1]>=b-EPS&&r[2]<=c+EPS&&r[3]>=d-EPS))return true;
 const cuts=[a,b,...rects.flatMap(r=>[Math.max(a,r[0]),Math.min(b,r[1])])].sort((x,y)=>x-y);
 for(let i=1;i<cuts.length;i++){
  if(cuts[i]-cuts[i-1]<EPS)continue;
  const x=(cuts[i]+cuts[i-1])/2,spans=rects.filter(r=>r[0]<=x&&r[1]>=x).map(r=>[Math.max(c,r[2]),Math.min(d,r[3])]).sort((r,s)=>r[0]-s[0]);let end=c;
  for(const [low,high]of spans){if(low>end+EPS)return false;end=Math.max(end,high);if(end>=d-EPS)break}
  if(end<d-EPS)return false;
 }
 return true;
}
const SECTOR=16,sector=(x,y)=>Math.floor(x/SECTOR)+','+Math.floor(y/SECTOR);
const append=(map,k,value)=>{let list=map.get(k);if(!list)map.set(k,list=[]);list.push(value)};
function prepareBlockOcclusion(map,{region=null,slice=32,mode='mj',columns=Object.entries(map.blocks||{}),objects=map.objects}={}){
 const boxes=[],grid=new Map(),partialGrid=new Map(),unitOwners=new Map(),groups=new Map(map.groups.map(g=>[g.id,g]));
 const add=b=>{
  b.unit=b.min.every((v,i)=>Math.abs(v-Math.round(v))<EPS&&Math.abs(b.max[i]-v-1)<EPS)?b.min.map(Math.round):null;
  b.sector=sector(b.min[0],b.min[1]);boxes.push(b);
  if(b.opaque&&b.unit){b.unitKey=key(...b.unit);append(unitOwners,b.unitKey,b)}
 };
 for(const [column,entries]of columns){
  const [x,y]=column.split(',').map(Number);if(region&&!region.cell(x,y)||!W.activeCell(map,x,y))continue;
  for(const [base,kind]of Object.entries(entries)){const z=+base,h=W.blockSize(map,x,y,z),id=key(x,y,z),def=W.BLOCKS[kind];if(!def||z>=slice||groups.get(map.blockGroups?.[id])?.visible===false)continue;add({id,voxel:true,min:[x,y,z],max:[x+1,y+1,z+h],opaque:def.opaque&&def.opacity===1,canHide:true})}
 }
 for(const o of objects){
  if(o.type!=='block'||o.visible===false||groups.get(o.group)?.visible===false||mode!=='mj'&&o.secret||region&&!region.object(o))continue;
  const turn=(o.facing||0)/(Math.PI/2);if(Math.abs(turn-Math.round(turn))>EPS)continue;
  const b=W.bounds(o),z=W.elevation(o,map),def=W.BLOCKS[o.material||'stone'];if(z>=slice)continue;
  add({id:o.id,min:[b.x,b.y,z],max:[b.x+b.w,b.y+b.h,z+o.height],opaque:!!def?.opaque&&def.opacity===1&&(o.opacity??1)===1&&!o.imageId,canHide:!o.effect?.kind&&!o.aura?.enabled});
 }
 // Full cubes need only unit membership when there are no partial targets.
 // Build the expensive broad-phase grids once per world revision, not per view.
 const needsGrid=boxes.some(b=>!b.unit&&b.canHide);
 for(const b of boxes)if(b.opaque&&(needsGrid||!b.unit)){
  for(let x=Math.floor(b.min[0]/BUCKET);x<=Math.floor((b.max[0]-EPS)/BUCKET);x++)
   for(let y=Math.floor(b.min[1]/BUCKET);y<=Math.floor((b.max[1]-EPS)/BUCKET);y++)
    for(let z=Math.floor(b.min[2]/BUCKET);z<=Math.floor((b.max[2]-EPS)/BUCKET);z++){
     const k=key(x,y,z);if(needsGrid)append(grid,k,b);if(!b.unit)append(partialGrid,k,b);
    }
 }
 function hidden(box,active,hasUnit){
  if(!box.canHide)return false;
  for(let axis=0;axis<3;axis++)for(let side=0;side<2;side++){
   if(box.unit){const n=[...box.unit];n[axis]+=side?1:-1;if(hasUnit(key(...n)))continue;if(!partialGrid.size)return false}
   const u=(axis+1)%3,v=(axis+2)%3,candidates=box.unit?partialGrid:grid;
   const min=[...box.min],max=[...box.max],at=side?box.max[axis]:box.min[axis];min[axis]=at-EPS;max[axis]=at+EPS;
   const found=new Set(),rects=[];
   for(let x=Math.floor(min[0]/BUCKET);x<=Math.floor(max[0]/BUCKET);x++)
    for(let y=Math.floor(min[1]/BUCKET);y<=Math.floor(max[1]/BUCKET);y++)
     for(let z=Math.floor(min[2]/BUCKET);z<=Math.floor(max[2]/BUCKET);z++)
      for(const b of candidates.get(key(x,y,z))||[]){
       if(b===box||found.has(b)||!active(b)||b.min[axis]>at+EPS||b.max[axis]<at-EPS||!(side?b.max[axis]>at+EPS:b.min[axis]<at-EPS))continue;
       if(b.max[u]<=box.min[u]+EPS||b.min[u]>=box.max[u]-EPS||b.max[v]<=box.min[v]+EPS||b.min[v]>=box.max[v]-EPS)continue;
       found.add(b);rects.push([b.min[u],b.max[u],b.min[v],b.max[v]]);
      }
   if(!covered(box.min[u],box.max[u],box.min[v],box.max[v],rects))return false;
  }
  return true;
 }
 return {boxes,unitOwners,hidden};
}
// Reference implementation for callers and exact-parity tests.
export function buildBlockOcclusion(map,options={}){
 const index=prepareBlockOcclusion(map,options),fullUnits=new Set(index.unitOwners.keys()),hiddenObjects=new Set(),hiddenVoxels=new Set();
 for(const box of index.boxes)if(index.hidden(box,()=>true,k=>fullUnits.has(k)))(box.voxel?hiddenVoxels:hiddenObjects).add(box.id);
 return {hiddenObjects,hiddenVoxels,fullUnits,candidates:index.boxes.length};
}
function forSectors(x0,y0,x1,y1,fn){
 for(let y=Math.floor(y0/SECTOR);y<=Math.floor(y1/SECTOR);y++)for(let x=Math.floor(x0/SECTOR);x<=Math.floor(x1/SECTOR);x++)fn(x+','+y);
}
// Cache exact results per occupied sector and local residency signature.
// The one-cell halo includes all possible adjacent unit faces; arbitrary
// placed volumes are indexed into every sector that their bounds overlap.
export function createChunkOcclusionCache(){
 let state=null,indexBuilds=0,chunkBuilds=0,chunkHits=0;
 function prepare(map,slice,mode,epoch){
  const revision=JSON.stringify([map.width,map.height,map.blockRevision,map.buildRevision,epoch,slice,mode,map.groups.map(g=>[g.id,g.visible]),map.chunks.length]);
  if(state&&state.map===map&&state.revision===revision&&state.chunks===map.chunks&&state.blocks===map.blocks&&state.objects===map.objects)return state;
  const index=prepareBlockOcclusion(map,{slice,mode}),groups=new Map(),voxelSectors=new Set(),placedById=new Map(),placedSpatial=new Map();
  for(const box of index.boxes){
   let g=groups.get(box.sector);if(!g)groups.set(box.sector,g={boxes:[],min:[Infinity,Infinity],max:[-Infinity,-Infinity],variants:new Map()});
   g.boxes.push(box);for(let a=0;a<2;a++){g.min[a]=Math.min(g.min[a],box.min[a]);g.max[a]=Math.max(g.max[a],box.max[a])}
   if(box.voxel)voxelSectors.add(box.sector);
   else{placedById.set(box.id,box);forSectors(box.min[0]-EPS,box.min[1]-EPS,box.max[0]+EPS,box.max[1]+EPS,k=>append(placedSpatial,k,box))}
  }
  for(const g of groups.values()){
   const voxels=[],placed=new Set(),x0=g.min[0]-1-EPS,y0=g.min[1]-1-EPS,x1=g.max[0]+1+EPS,y1=g.max[1]+1+EPS;
   forSectors(x0,y0,x1,y1,k=>{
    if(voxelSectors.has(k))voxels.push(k);
    for(const box of placedSpatial.get(k)||[])if(box.min[0]<=x1&&box.max[0]>=x0&&box.min[1]<=y1&&box.max[1]>=y0)placed.add(box);
   });
   g.voxelDeps=voxels;g.placedDeps=[...placed];
  }
  indexBuilds++;
  return state={map,revision,chunks:map.chunks,blocks:map.blocks,objects:map.objects,index,groups,placedById};
 }
 function collect(map,{region=null,objects=map.objects,slice=32,mode='mj',epoch=0}={}){
  const s=prepare(map,slice,mode,epoch),activeObjects=new Set(objects.map(o=>o.id)),activeVoxel=k=>!region||region.chunks.has(k),active=b=>b.voxel?activeVoxel(b.sector):activeObjects.has(b.id);
  const hasUnit=k=>s.index.unitOwners.get(k)?.some(active)??false;
  const wanted=region?new Set(region.chunks):new Set(s.groups.keys());
  for(const id of activeObjects){const b=s.placedById.get(id);if(b)wanted.add(b.sector)}
  const hiddenObjects=new Set(),hiddenVoxels=new Set(),fullUnits=new Set();let candidates=0;
  for(const id of wanted){
   const g=s.groups.get(id);if(!g)continue;
   const signature=g.voxelDeps.map(k=>activeVoxel(k)?'1':'0').join('')+'|'+g.placedDeps.map(b=>active(b)?'1':'0').join('');
   let result=g.variants.get(signature);
   if(result){chunkHits++;g.variants.delete(signature);g.variants.set(signature,result)}
   else{
    chunkBuilds++;result={hiddenObjects:[],hiddenVoxels:[],fullUnits:[],candidates:0};
    for(const box of g.boxes)if(active(box)){
     result.candidates++;if(box.unitKey!==undefined)result.fullUnits.push(box.unitKey);
     if(s.index.hidden(box,active,hasUnit))(box.voxel?result.hiddenVoxels:result.hiddenObjects).push(box.id);
    }
    g.variants.set(signature,result);
    if(g.variants.size>4)g.variants.delete(g.variants.keys().next().value);
   }
   candidates+=result.candidates;
   for(const k of result.fullUnits)fullUnits.add(k);
   for(const k of result.hiddenObjects)hiddenObjects.add(k);
   for(const k of result.hiddenVoxels)hiddenVoxels.add(k);
  }
  return {hiddenObjects,hiddenVoxels,fullUnits,candidates};
 }
 return {collect,stats:()=>({occlusionIndexBuilds:indexBuilds,occlusionChunkBuilds:chunkBuilds,occlusionChunkHits:chunkHits}),reset(){state=null}};
}

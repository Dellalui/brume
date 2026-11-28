import * as W from './world.mjs';
import {hasBlockForm} from './block-forms.mjs';
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
  if(o.type!=='block'||hasBlockForm(o)||o.visible===false||groups.get(o.group)?.visible===false||mode!=='mj'&&o.secret||region&&!region.object(o))continue;
  const turn=(o.facing||0)/(Math.PI/2);if(Math.abs(turn-Math.round(turn))>EPS)continue;
  const b=W.bounds(o),z=W.elevation(o,map),def=W.BLOCKS[o.material||'stone'];if(z>=slice)continue;
  add({id:o.id,min:[b.x,b.y,z],max:[b.x+b.w,b.y+b.h,z+o.height],opaque:!!def?.opaque&&def.opacity===1&&(o.opacity??1)===1&&!o.imageId,canHide:!o.effect?.kind&&!o.aura?.enabled});
 }
 const detach=(map,k,b)=>{const list=map.get(k);if(!list)return;const i=list.indexOf(b);if(i>=0)list.splice(i,1);if(!list.length)map.delete(k)};
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
 // Deletion cannot introduce a new partial target, so the original grid
 // configuration remains valid. Remove every reference to an actual hit.
 function remove(b){
  if(b.unitKey!==undefined)detach(unitOwners,b.unitKey,b);
  if(b.opaque&&(needsGrid||!b.unit)){
   for(let x=Math.floor(b.min[0]/BUCKET);x<=Math.floor((b.max[0]-EPS)/BUCKET);x++)
    for(let y=Math.floor(b.min[1]/BUCKET);y<=Math.floor((b.max[1]-EPS)/BUCKET);y++)
     for(let z=Math.floor(b.min[2]/BUCKET);z<=Math.floor((b.max[2]-EPS)/BUCKET);z++){
      const k=key(x,y,z);if(needsGrid)detach(grid,k,b);if(!b.unit)detach(partialGrid,k,b);
     }
  }
 }
 // A known append can reuse the existing occupancy grids. If the first
 // partial target needs the full broad phase, fall back to a fresh index.
 function canInsert(b){return needsGrid||!!b.unit||!b.canHide}
 function insert(b){
  if(b.unitKey!==undefined)append(unitOwners,b.unitKey,b);
  if(b.opaque&&(needsGrid||!b.unit)){
   for(let x=Math.floor(b.min[0]/BUCKET);x<=Math.floor((b.max[0]-EPS)/BUCKET);x++)
    for(let y=Math.floor(b.min[1]/BUCKET);y<=Math.floor((b.max[1]-EPS)/BUCKET);y++)
     for(let z=Math.floor(b.min[2]/BUCKET);z<=Math.floor((b.max[2]-EPS)/BUCKET);z++){
      const k=key(x,y,z);if(needsGrid)append(grid,k,b);if(!b.unit)append(partialGrid,k,b);
     }
  }
 }
 return {boxes,unitOwners,hidden,remove,canInsert,insert};
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
 let state=null,activeSectors=new Map(),indexBuilds=0,chunkBuilds=0,chunkHits=0,removalUpdates=0,removedBoxes=0,invalidatedChunks=0,placementUpdates=0,addedBoxes=0,dependencyRefreshes=0;
 const context=map=>JSON.stringify([map.width,map.height,map.groups.map(g=>[g.id,g.visible]),map.chunks.length]);
 const revisionOf=(map,slice,mode,epoch)=>JSON.stringify([map.blockRevision,map.buildRevision,epoch,slice,mode,context(map)]);
 const matches=(s,map,slice,mode,epoch)=>s&&s.map===map&&s.revision===revisionOf(map,slice,mode,epoch)&&s.chunks===map.chunks&&s.blocks===map.blocks&&s.objects===map.objects;
 function prepare(map,slice,mode,epoch){
  const revision=revisionOf(map,slice,mode,epoch);
  if(matches(state,map,slice,mode,epoch))return state;
  const index=prepareBlockOcclusion(map,{slice,mode}),groups=new Map(),voxelSectors=new Set(),voxelById=new Map(),placedById=new Map(),placedSpatial=new Map(),voxelDependents=new Map(),placedDependents=new Map();
  for(const box of index.boxes){
   let g=groups.get(box.sector);if(!g)groups.set(box.sector,g={boxes:[],min:[Infinity,Infinity],max:[-Infinity,-Infinity],variants:new Map(),renderSectors:new Set()});
   g.boxes.push(box);g.renderSectors.add(sector((box.min[0]+box.max[0])/2,(box.min[1]+box.max[1])/2));for(let a=0;a<2;a++){g.min[a]=Math.min(g.min[a],box.min[a]);g.max[a]=Math.max(g.max[a],box.max[a])}
   if(box.voxel){voxelSectors.add(box.sector);voxelById.set(box.id,box)}
   else{placedById.set(box.id,box);forSectors(box.min[0]-EPS,box.min[1]-EPS,box.max[0]+EPS,box.max[1]+EPS,k=>append(placedSpatial,k,box))}
  }
  for(const g of groups.values()){
   const voxels=[],placed=new Set(),x0=g.min[0]-1-EPS,y0=g.min[1]-1-EPS,x1=g.max[0]+1+EPS,y1=g.max[1]+1+EPS;
   forSectors(x0,y0,x1,y1,k=>{
    if(voxelSectors.has(k))voxels.push(k);
    for(const box of placedSpatial.get(k)||[])if(box.min[0]<=x1&&box.max[0]>=x0&&box.min[1]<=y1&&box.max[1]>=y0)placed.add(box);
   });
   g.voxelDeps=voxels;g.placedDeps=[...placed];for(const k of voxels)append(voxelDependents,k,g);for(const box of placed)append(placedDependents,box.id,g);
  }
  indexBuilds++;
  index.boxes.length=0; // groups own the live boxes; do not retain removed geometry globally
  return state={map,revision,slice,mode,chunks:map.chunks,blocks:map.blocks,objects:map.objects,index,groups,voxelById,placedById,voxelSectors,placedSpatial,voxelDependents,placedDependents,fixedElevation:map.objects.every(o=>o.type!=='block'||Number.isFinite(o.baseZ))};
 }
 function collect(map,{region=null,objects=map.objects,slice=32,mode='mj',epoch=0}={}){
  const s=prepare(map,slice,mode,epoch),activeObjects=new Set(objects.map(o=>o.id)),activeVoxel=k=>!region||region.chunks.has(k),active=b=>b.voxel?activeVoxel(b.sector):activeObjects.has(b.id);
  const hasUnit=k=>s.index.unitOwners.get(k)?.some(active)??false;
  const wanted=region?new Set(region.chunks):new Set(s.groups.keys());
  for(const id of activeObjects){const b=s.placedById.get(id);if(b)wanted.add(b.sector)}
  const hiddenObjects=new Set(),hiddenVoxels=new Set(),fullUnits=new Set();let candidates=0;activeSectors=new Map();
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
   activeSectors.set(id,result);candidates+=result.candidates;
   for(const k of result.fullUnits)fullUnits.add(k);
   for(const k of result.hiddenObjects)hiddenObjects.add(k);
   for(const k of result.hiddenVoxels)hiddenVoxels.add(k);
  }
  return {hiddenObjects,hiddenVoxels,fullUnits,candidates};
 }
 // Only the explicit destructive-impact transaction can use this fast
 // path. Other editing, undo, group changes and dynamic-elevation placed
 // objects retain the conservative complete rebuild.
 function beginRemoval(map,epoch){
  const s=state;if(!s?.fixedElevation||!matches(s,map,s.slice,s.mode,epoch))return null;
  return {state:s,map,epoch,context:context(map),blockRevision:map.blockRevision||0,buildRevision:map.buildRevision||0,objectCount:map.objects.length};
 }
 function finishRemoval(map,epoch,token,changes,onDirty){
  if(!token||token.state!==state||token.map!==map||!changes||changes.addedVoxels?.length)return false;
  const s=state;
  if(map.chunks!==s.chunks||map.blocks!==s.blocks||context(map)!==token.context||
     epoch!==token.epoch+1||(map.buildRevision||0)!==token.buildRevision+1||
     (map.blockRevision||0)!==token.blockRevision+changes.voxels.length+changes.ground||
     map.objects.length!==token.objectCount-changes.objects.length)return false;
  const dirty=new Set(),removedByGroup=new Map();
  const erase=(box,dependents)=>{
   if(!box)return;
   s.index.remove(box);removedBoxes++;
   const g=s.groups.get(box.sector);if(g){let set=removedByGroup.get(g);if(!set)removedByGroup.set(g,set=new Set());set.add(box);dirty.add(g)}
   for(const d of dependents||[])dirty.add(d);
  };
  for(const id of changes.voxels){
   const box=s.voxelById.get(id);if(!box)continue;
   erase(box,s.voxelDependents.get(box.sector));s.voxelById.delete(id);
  }
  for(const id of changes.objects){
   const box=s.placedById.get(id);erase(box,s.placedDependents.get(id));s.placedById.delete(id);
   if(box)forSectors(box.min[0]-EPS,box.min[1]-EPS,box.max[0]+EPS,box.max[1]+EPS,k=>{const list=s.placedSpatial.get(k);if(!list)return;const i=list.indexOf(box);if(i>=0)list.splice(i,1);if(!list.length)s.placedSpatial.delete(k)});
  }
  for(const [g,set]of removedByGroup)g.boxes=g.boxes.filter(b=>!set.has(b));
  for(const g of dirty)g.variants.clear();
  // Dependency bounds are conservative supersets after a deletion. Keeping
  // them avoids rebuilding the entire spatial graph and remains exact.
  s.objects=map.objects;s.revision=revisionOf(map,s.slice,s.mode,epoch);
  removalUpdates++;invalidatedChunks+=dirty.size;if(onDirty){const sectors=new Set();for(const g of dirty)for(const id of g.renderSectors)sectors.add(id);onDirty(sectors)}return true;
 }
 // The construction stroke supplies the exact appended objects. No
 // voxel/ground/group mutation, dynamic elevation, or unrelated edit is
 // admitted. Dirty only groups whose dependency membership changed.
 function finishPlacement(map,epoch,token,added,onDirty){
  if(!token||token.state!==state||token.map!==map||!Array.isArray(added)||!added.length)return false;
  const s=state;
  if(map.objects!==s.objects||map.chunks!==s.chunks||map.blocks!==s.blocks||context(map)!==token.context||
     epoch!==token.epoch+1||(map.buildRevision||0)!==token.buildRevision+1||
     (map.blockRevision||0)!==token.blockRevision||map.objects.length!==token.objectCount+added.length||
     added.some((o,i)=>map.objects[token.objectCount+i]!==o||o.type!=='block'||!Number.isFinite(o.baseZ)||s.placedById.has(o.id)))return false;
  const boxes=prepareBlockOcclusion(map,{slice:s.slice,mode:s.mode,columns:[],objects:added}).boxes;
  if(boxes.some(b=>!s.index.canInsert(b)))return false;
  const dirty=new Set(),sectors=new Set(added.map(o=>sector(o.x+o.w/2,o.y+o.d/2)));
  for(const box of boxes){
   s.index.insert(box);s.placedById.set(box.id,box);addedBoxes++;
   forSectors(box.min[0]-EPS,box.min[1]-EPS,box.max[0]+EPS,box.max[1]+EPS,k=>append(s.placedSpatial,k,box));
   let g=s.groups.get(box.sector);
   if(!g)s.groups.set(box.sector,g={boxes:[],min:[Infinity,Infinity],max:[-Infinity,-Infinity],variants:new Map(),renderSectors:new Set(),voxelDeps:[],placedDeps:[]});
   g.boxes.push(box);g.renderSectors.add(sector((box.min[0]+box.max[0])/2,(box.min[1]+box.max[1])/2));
   for(let a=0;a<2;a++){g.min[a]=Math.min(g.min[a],box.min[a]);g.max[a]=Math.max(g.max[a],box.max[a])}
   dirty.add(g);
  }
  // Refresh only dependency groups whose one-cell halo intersects an
  // appended opaque/partial volume, or whose own bounds just grew.
  // Non-box forms never enter the occlusion grid, so they need no graph scan.
  const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  const unlink=(index,key,g)=>{const list=index.get(key);if(!list)return;const i=list.indexOf(g);if(i>=0)list.splice(i,1);if(!list.length)index.delete(key)};
  if(boxes.length)for(const g of s.groups.values()){
   const x0=g.min[0]-1-EPS,y0=g.min[1]-1-EPS,x1=g.max[0]+1+EPS,y1=g.max[1]+1+EPS;
   if(!dirty.has(g)&&!boxes.some(b=>b.min[0]<=x1&&b.max[0]>=x0&&b.min[1]<=y1&&b.max[1]>=y0))continue;
   dependencyRefreshes++;
   const voxels=[],placed=new Set();
   forSectors(x0,y0,x1,y1,k=>{
    if(s.voxelSectors.has(k))voxels.push(k);
    for(const box of s.placedSpatial.get(k)||[])if(box.min[0]<=x1&&box.max[0]>=x0&&box.min[1]<=y1&&box.max[1]>=y0)placed.add(box);
   });
   const list=[...placed];if(!equal(g.voxelDeps,voxels)||!equal(g.placedDeps,list))dirty.add(g);
   for(const k of g.voxelDeps)unlink(s.voxelDependents,k,g);for(const box of g.placedDeps)unlink(s.placedDependents,box.id,g);
   g.voxelDeps=voxels;g.placedDeps=list;for(const k of voxels)append(s.voxelDependents,k,g);for(const box of list)append(s.placedDependents,box.id,g);
  }
  for(const g of dirty){g.variants.clear();for(const id of g.renderSectors)sectors.add(id)}
  s.revision=revisionOf(map,s.slice,s.mode,epoch);placementUpdates++;invalidatedChunks+=dirty.size;onDirty?.(sectors);return true;
 }
 return {collect,beginRemoval,finishRemoval,finishPlacement,sectorResults:()=>activeSectors,stats:()=>({occlusionIndexBuilds:indexBuilds,occlusionChunkBuilds:chunkBuilds,occlusionChunkHits:chunkHits,occlusionRemovalUpdates:removalUpdates,occlusionRemovedBoxes:removedBoxes,occlusionPlacementUpdates:placementUpdates,occlusionAddedBoxes:addedBoxes,occlusionInvalidatedChunks:invalidatedChunks,occlusionDependencyRefreshes:dependencyRefreshes}),reset(){state=null;activeSectors=new Map()}};
}

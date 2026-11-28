// CPU-only descriptors for sparse 16-cell sectors. A camera turn should not
// scan the entire world or invalidate a mesh merely because empty sectors enter.
const chunk=(x,y)=>Math.floor(x/16)+','+Math.floor(y/16);
export function createReliefStream(){
 let index=null,scope=null;
 return (map,region,epoch,window,W,liquids,edit=null)=>{
  const key=JSON.stringify([map.blockRevision,map.buildRevision,epoch,map.width,map.height,map.chunks.length]);
  if(index&&edit?.placementOnly&&edit.map===map&&edit.from===index.epoch&&edit.to===epoch&&index.map===map&&index.chunks===map.chunks&&index.blocks===map.blocks&&index.ground===map.ground&&index.objects===map.objects){
   index.key=key;index.epoch=epoch;index.placed.push(...edit.addedObjects);scope=null;
  }
  // The manual edit was checked against the occlusion revision before
  // publication. Retain the column index on a pure voxel/object removal.
  // Ground cuts use the normal index path until their ground data is patched.
  if(index&&edit?.manualRemoval&&!edit.changes.ground&&edit.map===map&&edit.from===index.epoch&&edit.to===epoch&&index.map===map&&index.chunks===map.chunks&&index.blocks===map.blocks&&index.ground===map.ground){
   const removed=new Set(edit.changes.objects);
   if(removed.size)index.placed=index.placed.filter(o=>!removed.has(o.id));
   const changedColumns=new Set(edit.changes.voxels.map(id=>id.split(',').slice(0,2).join(',')));
   for(const k of changedColumns){
    const [x,y]=k.split(',').map(Number),id=chunk(x,y),list=index.columns.get(id);
    if(!list)continue;
    const at=list.findIndex(e=>e[0]===k);if(at<0)continue;
    if(map.blocks[k])list[at]=[k,map.blocks[k]];
    else{list.splice(at,1);if(!list.length)index.columns.delete(id)}
   }
   index.objects=map.objects;index.key=key;index.epoch=epoch;scope=null;
  }
  if(!index||index.map!==map||index.key!==key||index.chunks!==map.chunks||index.blocks!==map.blocks||index.ground!==map.ground||index.objects!==map.objects){
   const columns=new Map(),ground=new Map();
   for(const [k,column]of Object.entries(map.blocks||{})){
    const [x,y]=k.split(',').map(Number),id=chunk(x,y);
    if(!columns.has(id))columns.set(id,[]);columns.get(id).push([k,column]);
   }
   for(const [k,low]of Object.entries(map.ground||{})){
    const [x,y]=k.split(',').map(Number),id=chunk(x,y);
    if(!ground.has(id))ground.set(id,[]);ground.get(id).push([k,low]);
   }
   index={map,key,epoch,chunks:map.chunks,blocks:map.blocks,ground:map.ground,objects:map.objects,columns,earth:ground,placed:map.objects.filter(o=>o.type==='block')};scope=null;
  }
  const [x0,y0,x1,y1]=window,windowKey=window.join(',');
  if(scope?.region===region&&scope.windowKey===windowKey&&scope.liquids===liquids)return scope;
  const inWindow=(x,y)=>x>=x0&&x<x1&&y>=y0&&y<y1;
  const sectorIds=region?[...region.chunks].filter(id=>index.columns.has(id)).sort():[...index.columns.keys()].sort();
  const columns=sectorIds.flatMap(id=>index.columns.get(id));
  const blockInRegion=o=>{
   if(!region)return true;const b=W.bounds(o);
   for(let y=Math.floor(b.y/16);y<=Math.floor((b.y+b.h)/16);y++)for(let x=Math.floor(b.x/16);x<=Math.floor((b.x+b.w)/16);x++)if(region.chunks.has(x+','+y))return true;
   return false;
  };
  const objects=index.placed.filter(blockInRegion);
  const visibleColumns=columns.filter(([k])=>{const [x,y]=k.split(',').map(Number);return inWindow(x,y)});
  const visibleObjects=objects.filter(o=>{const b=W.bounds(o);return !(b.x+b.w<x0||b.y+b.h<y0||b.x>x1||b.y>y1)});
  const earth=[];
  for(let cy=Math.floor(y0/16);cy<Math.ceil(y1/16);cy++)for(let cx=Math.floor(x0/16);cx<Math.ceil(x1/16);cx++)for(const e of index.earth.get(cx+','+cy)||[]){const [x,y]=e[0].split(',').map(Number);if(inWindow(x,y))earth.push(e)}
  // Liquid profiles use the complete source result, but only included cells
  // are meshed. An empty sector changing residency cannot affect that mesh.
  const includeLiquid=b=>b.object?(!region||region.object(b.object)):(!region||region.cell(b.x,b.y))&&inWindow(b.x,b.y);
  const liquidIds=[];
  if(liquids){let i=0;for(const b of liquids.cells){if(includeLiquid(b))liquidIds.push(i);i++}for(const b of liquids.irregular||[]){if(includeLiquid(b))liquidIds.push(i);i++}}
  const occlusionKey=JSON.stringify([sectorIds,objects.map(o=>o.id)]);
  const reliefKey=JSON.stringify([visibleColumns.length===columns.length?'all':visibleColumns.map(e=>e[0]),visibleObjects.map(o=>o.id),earth.map(e=>e[0]),liquidIds]);
  return scope={region,windowKey,liquids,columns,objects,visibleColumns,visibleObjects,earth,includeLiquid,liquidKey:JSON.stringify(liquidIds),occlusionKey,reliefKey};
 };
}

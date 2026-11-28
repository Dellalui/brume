import * as W from './world.mjs';
import {hasBlockForm} from './block-forms.mjs';
import {reliefPlan,reliefSignature} from './relief-batches.mjs';
import {isLiquid} from './liquid-flow.mjs';
const sector=(x,y)=>Math.floor(x/16)+','+Math.floor(y/16);
const SPECIAL=['water','lava','glass','ice'],special=new Set(SPECIAL),EMPTY=[];
const opaque=k=>W.BLOCKS[k]?.opaque&&W.BLOCKS[k]?.opacity===1;
function add(groups,kind,cell){let cells=groups.get(kind);if(!cells)groups.set(kind,cells=[]);cells.push(cell)}
// The exact same sector builder runs on the main thread and in the worker.
export function buildReliefSector(src,args){
 const {map,occ,region,origin,size,cut,slice,mode,large,images,groupsById}=args;
 const inWindow=(x,y)=>x>=origin.x&&y>=origin.y&&x<origin.x+size.x&&y<origin.y+size.y;
   const cells=new Map(),earth=[];
   for(const [key,low]of src.earth){
    const [x,y]=key.split(',').map(Number);
    if(!W.activeCell(map,x,y)||!inWindow(x,y))continue;
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const high=W.groundAt(map,x+dx,y+dy);if(high>low)earth.push({x:x+.5+dx*.5,y:y+.5+dy*.5,z:(low+high)/2,h:high-low,dx,dy})}
   }
   for(const [key,column]of src.columns){
    const [x,y]=key.split(',').map(Number);if(region&&!region.cell(x,y)||!inWindow(x,y)||!W.activeCell(map,x,y))continue;
    for(const [base,kind]of Object.entries(column)){
     const z=+base,id=key+','+z;
     if(z>=slice||!W.BLOCKS[kind]||groupsById.get(map.blockGroups?.[id])?.visible===false||occ.hiddenVoxels.has(id))continue;
     add(cells,kind,{x,y,z,h:W.blockSize(map,x,y,z)});
    }
   }
   for(const o of src.objects){
    if(occ.hiddenObjects.has(o.id)||o.type!=='block'||hasBlockForm(o)||(!isLiquid(o.material)&&images.get(o.imageId))||o.visible===false||groupsById.get(o.group)?.visible===false||mode!=='mj'&&o.secret)continue;
    const z=W.elevation(o,map);if(z>=slice)continue;
    const b=W.bounds(o);if(b.x+b.w<origin.x||b.y+b.h<origin.y||b.x>origin.x+size.x||b.y>origin.y+size.y)continue;
    add(cells,o.material||'stone',{id:o.id,object:o,x:o.x+o.w/2-.5,y:o.y+o.d/2-.5,z,h:o.height,w:o.w,d:o.d,angle:o.facing||0});
   }
   const solid=new Map([...cells].filter(([kind])=>!special.has(kind)));
   const plans=large?reliefPlan(solid,occ.fullUnits||new Set(),cut,opaque,true).map(plan=>({...plan,signature:reliefSignature(plan.cells)})):null;
 return {cells,earth,plans};
}
// Retain the actual CPU face plans, not just the GPU instance buffers.
// Only a verified destructive transaction may reuse plans across revisions.
export function createReliefSectorPlans(){
 let state=null,builds=0,hits=0;
 function prepare(opts,scope,occ,region,origin,size,cut,edit,imageKey){
  const map=opts.map,epoch=opts.terrainEpoch,slice=opts.blockSlice??32;
  // New and legacy maps may omit revision counters. Impact tokens use zero
  // for missing counters, so compare and store the same canonical values.
  const blockRevision=map.blockRevision||0,buildRevision=map.buildRevision||0;
  const context=JSON.stringify([region?.key??null,origin.x,origin.y,size.x,size.y,cut,slice,opts.mode,map.width,map.height,imageKey,map.groups.map(g=>[g.id,g.visible])]);
  const useLocal=state&&state.map===map&&state.context===context&&edit?.map===map&&edit.from===state.epoch&&edit.to===epoch&&edit.blockRevision===blockRevision&&edit.buildRevision===buildRevision&&edit.previousBlockRevision===state.blockRevision&&edit.previousBuildRevision===state.buildRevision;
  const dirty=new Set(useLocal?edit.sectors:[]);
  if(useLocal){
   for(const id of edit.changes.voxels){const [x,y]=id.split(',').map(Number);dirty.add(sector(x,y))}
   for(const id of edit.changes.objects){const k=state.objectSectors.get(id);if(k!==undefined)dirty.add(k)}
   for(const col of edit.changes.groundColumns||[]){const [x,y]=col.split(',').map(Number);for(const [dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])dirty.add(sector(x+dx,y+dy))}
  }
  const entries=new Map(),sources=new Map(),objectSectors=new Map(),objectOrder=new Map(),groupsById=new Map(map.groups.map(g=>[g.id,g]));
  function source(k){
   let src=sources.get(k);if(!src){src={columns:[],objects:[],earth:[]};sources.set(k,src)}return src;
  }
  const collect=(k,field,value)=>{const src=source(k);if(!useLocal||dirty.has(k)||!state.entries.has(k))src[field].push(value)};
  for(const e of scope.visibleColumns){const [x,y]=e[0].split(',').map(Number);collect(sector(x,y),'columns',e)}
  let order=0;for(const o of scope.visibleObjects){const k=sector(o.x+o.w/2,o.y+o.d/2);objectSectors.set(o.id,k);objectOrder.set(o.id,order++);collect(k,'objects',o)}
  for(const e of scope.earth){const [x,y]=e[0].split(',').map(Number);collect(sector(x,y),'earth',e)}
  const large=true;
  const pending=[];let reused=0;
  for(const [k,src]of sources){
   const prior=useLocal&&!dirty.has(k)?state.entries.get(k):null;
   if(prior){entries.set(k,prior);reused++;continue}
   entries.set(k,null);pending.push({key:k,src});
  }
  return {base:state,map,epoch,blockRevision,buildRevision,context,entries,objectSectors,objectOrder,large,useLocal:!!useLocal,reused,pending,args:{map,occ,region,origin:{x:origin.x,y:origin.y},size:{x:size.x,y:size.y},cut,slice,mode:opts.mode,large,images:opts.images,groupsById}};
 }
 function finish(job,results){
  if(job.base!==state||results.length!==job.pending.length)throw Error('Outdated relief sector result');
  const {map,epoch,blockRevision,buildRevision,context,entries,objectSectors,objectOrder,large}=job;
  const {occ,cut}=job.args,objects=new Map(map.objects.map(o=>[o.id,o]));
  for(let i=0;i<results.length;i++){
   const {key,entry}=results[i];if(key!==job.pending[i].key)throw Error('Unexpected relief sector');
   // Worker clones must not replace the live editable source object.
   for(const cells of entry.cells.values())for(const c of cells)if(c.id!==undefined)c.object=objects.get(c.id);
   entries.set(key,entry);
  }
  builds+=results.length;hits+=job.reused;
  const previous=state,specialGroups=new Map(),plans=[],all=new Map();
  for(const kind of SPECIAL){
   const voxels=[],placed=[];
   for(const e of entries.values())for(const c of e.cells.get(kind)||EMPTY)(c.id===undefined?voxels:placed).push(c);
   placed.sort((a,b)=>objectOrder.get(a.id)-objectOrder.get(b.id));
   const list=voxels.concat(placed),old=previous?.map===map?previous.specialGroups.get(kind):null;
   specialGroups.set(kind,old&&old.length===list.length&&old.every((v,i)=>v===list[i])?old:list);
  }
  if(large){for(const e of entries.values())for(const plan of e.plans)plans.push(plan)}
  else{
   for(const e of entries.values())for(const [kind,cells]of e.cells)if(!special.has(kind))for(const c of cells)add(all,kind,c);
   for(const list of all.values()){
    const voxels=list.filter(c=>c.id===undefined),placed=list.filter(c=>c.id!==undefined).sort((a,b)=>objectOrder.get(a.id)-objectOrder.get(b.id));list.splice(0,list.length,...voxels,...placed);
   }
   for(const plan of reliefPlan(all,occ.fullUnits||new Set(),cut,opaque,false))plans.push({...plan,signature:reliefSignature(plan.cells)});
  }
  state={map,epoch,blockRevision,buildRevision,context,entries,objectSectors,specialGroups};
  return {groups:new Map(specialGroups),plans,earth:new Map([...entries].filter(([,e])=>e.earth.length).map(([k,e])=>[k,e.earth]))};
 }
 function buildPrepared(job){return finish(job,job.pending.map(({key,src})=>({key,entry:buildReliefSector(src,job.args)})))}
 function build(...args){return buildPrepared(prepare(...args))}
 // A deletion transaction has already verified fixed placed-block elevations.
 // Send only dirty columns, their metadata, the neighboring face membership
 // and local ground samples. Never clone the whole world or global unit set.
 function workerPayload(job,sectorResults){
  const {map,occ,region,origin,size,cut,slice,mode,large,images}=job.args;
  const snapshot={width:map.width,height:map.height,chunks:map.chunks,groups:map.groups.map(g=>({id:g.id,visible:g.visible})),ground:{},blockHeights:{},blockGroups:{}};
  const imageIds=new Set(),tasks=[];
  for(const {key,src} of job.pending){
   for(const [column,values]of src.columns)for(const base of Object.keys(values)){
    const id=column+','+base;
    if(map.blockHeights?.[id]!==undefined)snapshot.blockHeights[id]=map.blockHeights[id];
    if(map.blockGroups?.[id]!==undefined)snapshot.blockGroups[id]=map.blockGroups[id];
   }
   for(const [column]of src.earth){
    const [x,y]=column.split(',').map(Number);
    for(const [dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const id=(x+dx)+','+(y+dy);if(map.ground?.[id]!==undefined)snapshot.ground[id]=map.ground[id]}
   }
   for(const o of src.objects)if(images.get(o.imageId))imageIds.add(o.imageId);
   const [cx,cy]=key.split(',').map(Number),fullUnits=[];
   for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)for(const unit of sectorResults.get(x+','+y)?.fullUnits||EMPTY)fullUnits.push(unit);
   tasks.push({key,src,fullUnits,hiddenVoxels:sectorResults.get(key)?.hiddenVoxels||EMPTY,hiddenObjects:src.objects.filter(o=>occ.hiddenObjects.has(o.id)).map(o=>o.id)});
  }
  return {map:snapshot,region:region?{chunks:[...region.chunks]}:null,origin,size,cut,slice,mode,large,imageIds:[...imageIds],tasks};
 }
 return {build,buildPrepared,prepare,finish,workerPayload,reset(){state=null},stats:()=>({reliefSectorBuilds:builds,reliefSectorHits:hits})};
}

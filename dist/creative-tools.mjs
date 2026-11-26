import * as W from './world.mjs';
import * as BT from './block-tools.mjs';
import * as C from './construction.mjs';
export const TOOL_ITEMS=[
 {kind:'inspect',name:'Inspecteur'}, {kind:'selection',name:'Baguette de zone'},
 {kind:'brush',name:'Pinceau de blocs',operation:'fill',size:3,height:1,shape:'sphere',material:'stone',mask:'all',seed:1},
 {kind:'brush',name:'Pinceau de remplacement',operation:'fill',size:3,height:1,shape:'box',material:'grass',mask:'solid',seed:1},
 {kind:'brush',name:'Pinceau de terrain',operation:'terrain',size:3,height:1,shape:'box',material:'grass',mask:'all',seed:1},
 {kind:'pipette',name:'Pipette'}, {kind:'frame',name:'Cadre à image'},
 {kind:'fogbrush',name:'Brouillard manuel',size:3}
];
export const defaultToolConfig=()=>({operation:'fill',size:3,height:1,shape:'box',material:'stone',mask:'all',seed:1,patternEnabled:false,pattern:[{material:'dirt',weight:20},{material:'planks',weight:10},{material:'air',weight:70}]});
export function targetCell(p){
 if(!p||![p.x,p.y,p.z].every(Number.isFinite))return null;
 if(p.block)return{...p.block};
 const n=p.normal||{x:0,y:0,z:p.ground?1:0};
 return{x:Math.floor(p.x-n.x*.001),y:Math.floor(p.y-n.y*.001),z:Math.floor(p.z-n.z*.001)};
}
// Expose the selected soil cube while preserving the soil above it as real blocks.
export function excavate(map,x,y,z){x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);if(!W.activeCell(map,x,y)||z< -16||z>=W.groundAt(map,x,y))return false;const top=W.groundAt(map,x,y);W.prepareBlocks(map);map.ground??={};map.ground[W.cellKey(x,y)]=z;for(let h=z+1;h<top;h++)W.setBlock(map,x,y,h,h+1>=top?'grass':'dirt',Math.min(1,top-h));map.blockRevision=(map.blockRevision||0)+1;return true}
export function brushBox(p,config,remove=false){const size=W.clamp(Math.round(config.size||3),1,9),height=config.shape==='sphere'?size:W.clamp(Math.round(config.height||1),1,9),target=targetCell(p);if(!target)return null;let at=remove?target:p.adjacent||{x:Math.floor(p.x),y:Math.floor(p.y),z:Math.floor(p.z)};return{x:Math.floor(at.x)-Math.floor(size/2),y:Math.floor(at.y)-Math.floor(size/2),z:config.shape==='sphere'?Math.floor(at.z)-Math.floor(height/2):Math.floor(at.z),w:size,d:size,h:height}}
const cellId=p=>[p.x,p.y,p.z].join(',');
export function planEdit(map,box,config,remove=false){
 BT.validateZone(box,1);
 const cells=BT.zoneCells(box,config.shape||'box').filter(p=>W.activeCell(map,p.x,p.y)&&p.z>=-16&&p.z<32);
 const cellKeys=new Set(cells.map(cellId)),removed=new Set(),blocked=new Set(),customAt=new Map();
 const lockedGroups=new Set(map.groups.filter(g=>g.locked).map(g=>g.id)),mask=config.mask||'all';
 let skipped=0;
 // Index only objects overlapping this brush, then visit their occupied cells once.
 for(const o of map.objects){
  if(o.type!=='block')continue;
  const b=W.bounds(o),z=W.elevation(o,map),top=z+o.height;
  if(b.x>=box.x+box.w||b.x+b.w<=box.x||b.y>=box.y+box.d||b.y+b.h<=box.y||z>=box.z+box.h||top<=box.z)continue;
  const hits=[];let complete=C.insideZone(o,box,map);
  for(let h=Math.max(Math.floor(z),box.z);h<Math.min(Math.ceil(top),box.z+box.h);h++)
   for(let y=Math.max(Math.floor(b.y),box.y);y<Math.min(Math.ceil(b.y+b.h),box.y+box.d);y++)
    for(let x=Math.max(Math.floor(b.x),box.x);x<Math.min(Math.ceil(b.x+b.w),box.x+box.w);x++){
     const id=cellId({x,y,z:h});if(cellKeys.has(id))hits.push(id);else complete=false;
    }
  if(!hits.length)continue;
  if(o.locked||lockedGroups.has(o.group)||!complete||mask==='air'||!['all','solid'].includes(mask)&&mask!==o.material){for(const id of hits)blocked.add(id);skipped++;continue}
  removed.add(o.id);for(const id of hits)customAt.set(id,o.material);
 }
 const selected=cells.filter(p=>{
  const id=cellId(p),group=map.blockGroups?.[id],upperGroup=map.blockGroups?.[cellId({...p,z:p.z+.5})];
  if(blocked.has(id)||lockedGroups.has(group)||lockedGroups.has(upperGroup)){skipped++;return false}
  const material=W.blockAt(map,p.x,p.y,p.z)||W.blockAt(map,p.x,p.y,p.z+.5)||(p.z<W.groundAt(map,p.x,p.y)?'dirt':null),custom=customAt.get(id);
  return mask==='air'?!material&&!custom:mask==='solid'?!!material||!!custom:mask==='all'||mask===material||mask===custom;
 });
 const materials=remove?selected.map(()=>null):config.patternEnabled?BT.distributePattern(config.pattern,selected.length,config.seed):selected.map(()=>config.material||'stone');
 const candidate={...map,objects:map.objects.filter(o=>!removed.has(o.id))},voxels=[];
 for(let i=0;i<selected.length;i++){
  const p={...selected[i],height:1,material:materials[i]};
  if(W.blockPlacementError(candidate,p.x,p.y,p.z,p.material)){skipped++;continue}
  const bottom=W.blockAt(map,p.x,p.y,p.z),upper=W.blockAt(map,p.x,p.y,p.z+.5),soil=p.z<W.groundAt(map,p.x,p.y);
  if(!p.material&&!bottom&&!upper&&!soil||p.material&&bottom===p.material&&upper===p.material&&!soil)continue;
  voxels.push(p);
 }
 return{box,voxels,removeIds:[...removed],skipped,count:voxels.length+removed.size};
}
export function applyEdit(map,plan){let changed=0;for(let p of plan.voxels)if(p.z<W.groundAt(map,p.x,p.y)){if(excavate(map,p.x,p.y,p.z))changed++}if(plan.removeIds.length){const ids=new Set(plan.removeIds);map.objects=map.objects.filter(o=>!ids.has(o.id));changed+=ids.size}changed+=BT.applyBlockPlan(map,plan.voxels);return changed}

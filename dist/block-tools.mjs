import {BLOCKS,blockAt,blockBase,groundAt,setBlock,MAX_BLOCK_HEIGHT,MIN_BLOCK_HEIGHT,blockSize} from './blocks.mjs';
import {activeCell} from './chunk-index.mjs';
import {nearbyBlocks,containsBlock} from './placed-geometry.mjs';
export const MAX_ZONE=32768;
export function zoneBounds(a,b){return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),z:Math.min(a.z,b.z),w:Math.abs(a.x-b.x)+1,d:Math.abs(a.y-b.y)+1,h:Math.abs(a.z-b.z)+1}}
export function validateZone(box,step=1){
 if(!box||![box.x,box.y,box.w,box.d].every(Number.isInteger)||![box.z,box.h].every(v=>Number.isFinite(v)&&Number.isInteger(v*2))||box.w<=0||box.d<=0||box.h<=0||![.5,1].includes(step))throw Error('Zone invalide : coordonnées entières et hauteurs par demi-bloc.');
 const count=box.w*box.d*Math.ceil(box.h/step);if(!Number.isSafeInteger(count)||count>MAX_ZONE)throw Error('Zone limitée à 32 768 cubes.');return count;
}
export function zoneCells(box,shape='box',step=1){validateZone(box,step);let cells=[];for(let z=0;z<box.h;z+=step)for(let y=0;y<box.d;y++)for(let x=0;x<box.w;x++){let edge=x===0||y===0||z===0||x===box.w-1||y===box.d-1||z>=box.h-step;if(shape==='shell'&&!edge)continue;if(shape==='walls'&&x!==0&&y!==0&&x!==box.w-1&&y!==box.d-1)continue;if(shape==='sphere'&&((x+.5-box.w/2)/(box.w/2))**2+((y+.5-box.d/2)/(box.d/2))**2+((z+step/2-box.h/2)/(box.h/2))**2>1)continue;cells.push({x:box.x+x,y:box.y+y,z:box.z+z})}return cells}
export function validatePattern(rows){if(!Array.isArray(rows)||rows.some(r=>!Number.isFinite(Number(r.weight))||Number(r.weight)<0))throw Error('Les poids du motif doivent être des nombres positifs.');let entries=rows.filter(r=>Number(r.weight)>0).map(r=>({material:r.material||'air',weight:Number(r.weight)}));if(!entries.length||entries.some(r=>!Number.isFinite(r.weight)||r.weight>100||r.material!=='air'&&!BLOCKS[r.material]))throw Error('Motif invalide : choisissez des matériaux et des poids de 0 à 100.');if(Math.abs(entries.reduce((s,r)=>s+r.weight,0)-100)>.001)throw Error('Le total du motif doit être de 100 %.');return entries}
export function distributePattern(rows,count,seed=1){let pattern=validatePattern(rows),parts=pattern.map((r,i)=>({...r,index:i,n:Math.floor(count*r.weight/100),fraction:count*r.weight/100%1})),remaining=count-parts.reduce((s,r)=>s+r.n,0);for(let r of [...parts].sort((a,b)=>b.fraction-a.fraction||a.index-b.index)){if(!remaining--)break;r.n++}let result=parts.flatMap(r=>Array(r.n).fill(r.material==='air'?null:r.material));let state=seed|0||1;for(let i=result.length-1;i>0;i--){state^=state<<13;state^=state>>>17;state^=state<<5;let j=(state>>>0)%(i+1);[result[i],result[j]]=[result[j],result[i]]}return result}
export function planZone(map,box,{shape='box',operation='fill',material='stone',mask='all',pattern=null,seed=1,height=1}={}){let cells=zoneCells(box,shape,height).filter(p=>p.x>=0&&p.y>=0&&p.x<map.width&&p.y<map.height&&p.z>=MIN_BLOCK_HEIGHT&&p.z<MAX_BLOCK_HEIGHT&&map.chunks.includes(Math.floor(p.x/16)+','+Math.floor(p.y/16))).filter(p=>mask==='all'||mask==='solid'&&blockAt(map,p.x,p.y,p.z)||mask==='air'&&!blockAt(map,p.x,p.y,p.z)||mask===blockAt(map,p.x,p.y,p.z));let materials=operation==='erase'?Array(cells.length).fill(null):pattern?distributePattern(pattern,cells.length,seed):Array(cells.length).fill(material);return cells.map((p,i)=>({...p,height,material:materials[i]})).filter(p=>(blockAt(map,p.x,p.y,p.z)||null)!==(p.material||null)||p.material&&blockSize(map,p.x,p.y,p.z)!==height)}
export function copyZone(map,box){validateZone(box,.5);let cells=[];for(let y=0;y<box.d;y++)for(let x=0;x<box.w;x++)for(let z=0;z<box.h;){let material=blockAt(map,box.x+x,box.y+y,box.z+z),height=z+1<=box.h&&blockAt(map,box.x+x,box.y+y,box.z+z+.5)===material?1:.5;cells.push({x,y,z,height,material});z+=height}return{w:box.w,d:box.d,h:box.h,cells}}
export function pastePlan(clip,at,turns=0,includeAir=false){if(!clip)return[];if(![at.x,at.y,at.z,turns].every(Number.isFinite)||!Number.isInteger(turns)||!Array.isArray(clip.cells)||clip.cells.length>MAX_ZONE)throw Error('Collage invalide ou trop volumineux.');return clip.cells.filter(p=>includeAir||p.material).map(p=>{let x=p.x,y=p.y,w=clip.w,d=clip.d;for(let i=0;i<((turns%4)+4)%4;i++){[x,y]=[d-1-y,x];[w,d]=[d,w]}return{x:x+at.x,y:y+at.y,z:p.z+at.z,material:p.material,height:p.height}})}
// Volume edits preserve the parts of existing blocks outside the selected half-height range.
export function applyBlockPlan(map,plan,canPlace=()=>true){
 let changed=0;
 for(const p of plan){
  if(!canPlace(p))continue;
  const height=p.height===.5?.5:1,top=p.z+height,k=Math.floor(p.x)+','+Math.floor(p.y);
  if(![p.x,p.y,p.z].every(Number.isFinite)||p.z<MIN_BLOCK_HEIGHT||top>MAX_BLOCK_HEIGHT||p.material&&!BLOCKS[p.material])continue;
  const overlaps=Object.entries(map.blocks?.[k]||{}).map(([z,material])=>({z:+z,material,height:blockSize(map,p.x,p.y,+z)})).filter(b=>b.z<top&&b.z+b.height>p.z);
  if(overlaps.length===1&&overlaps[0].z===p.z&&overlaps[0].height===height&&overlaps[0].material===p.material)continue;
  if(!p.material&&!overlaps.length)continue;
  let edited=false;
  for(const b of overlaps)edited=setBlock(map,p.x,p.y,b.z,null,b.height)||edited;
  if(p.material)edited=setBlock(map,p.x,p.y,p.z,p.material,height)||edited;
  for(const b of overlaps){
   if(b.z<p.z)setBlock(map,p.x,p.y,b.z,b.material,.5);
   if(b.z+b.height>top)setBlock(map,p.x,p.y,top,b.material,.5);
  }
  if(edited)changed++;
 }
 return changed;
}
export function cutawayPoint(point,origin,direction,radius=1.1){if(point.y<=origin.y-.78)return false;let x=point.x-origin.x,y=point.y-origin.y,z=point.z-origin.z,t=x*direction.x+y*direction.y+z*direction.z;if(t<0)return false;return (x-direction.x*t)**2+(y-direction.y*t)**2+(z-direction.z*t)**2<radius*radius}
// World-fixed source placement based on actual exposed faces.
const emitterCache=new WeakMap();
export function lightSpace(map){
 const hidden=new Set((map.groups||[]).filter(g=>g.visible===false).map(g=>g.id));
 function open(x,y,z,ignore){
  if(!activeCell(map,x,y)||z<groundAt(map,x,y)-1e-6)return false;
  const ix=Math.floor(x),iy=Math.floor(y),base=blockBase(map,ix,iy,z);
  if(base!==null&&BLOCKS[map.blocks[ix+','+iy][base]]?.opaque&&!hidden.has(map.blockGroups?.[ix+','+iy+','+base]))return false;
  for(const o of nearbyBlocks(map,x,y)){
   if(o.id===ignore||o.visible===false||hidden.has(o.group)||!BLOCKS[o.material||'stone']?.opaque)continue;
   const bottom=(o.baseZ??groundAt(map,x,y))+(o.offsetZ||0);
   if(z>=bottom&&z<bottom+(o.height||1)&&containsBlock(o,x,y))return false;
  }
  return true;
 }
 return {open,hidden};
}
export function exposedLightPosition(map,{x,y,z,w=1,d=1,h=1,angle=0,owner=null,liquid=false},space=lightSpace(map)){
 const c=Math.cos(angle),s=Math.sin(angle);
 const sides=[[c,s,0,w/2],[-c,-s,0,w/2],[-s,c,0,d/2],[s,-c,0,d/2],[0,0,-1,h/2],[0,0,1,h/2]];
 const directions=liquid?[sides[5],...sides.slice(0,4),sides[4]]:sides;
 let best=null,bestScore=-1;
 for(const [dx,dy,dz,extent]of directions){
  const distance=extent+.14,px=x+dx*distance,py=y+dy*distance,pz=z+dz*distance;
  if(!space.open(px,py,pz,owner))continue;
  let score=0;
  for(const extra of [.35,.85,1.6,2.8]){
   if(!space.open(px+dx*extra,py+dy*extra,pz+dz*extra,owner))break;
   score++;
  }
  if(score>bestScore){bestScore=score;best={x:px,y:py,z:pz};if(score===4)break}
 }
 return best;
}
export function blockLightSources(map,space=lightSpace(map)){
 if(map.blockLighting?.enabled===false||map.blockLighting?.power===0)return[];
 const power=map.blockLighting?.power??1,radius=map.blockLighting?.radius??5,groups=[...space.hidden].sort().join('|');
 let e=emitterCache.get(map);
 if(!e||e.blocks!==map.blocks||e.heights!==map.blockHeights||e.ground!==map.ground||e.blockGroups!==map.blockGroups||e.objects!==map.objects||e.chunks!==map.chunks||e.chunkCount!==map.chunks.length||e.revision!==map.blockRevision||e.build!==map.buildRevision||e.groups!==groups||e.power!==power||e.radius!==radius||!Number.isFinite(map.blockRevision)){
  const sources=[];
  for(const [k,column]of Object.entries(map.blocks||{})){
   const [x,y]=k.split(',').map(Number);if(!activeCell(map,x,y))continue;
   for(const [base,kind]of Object.entries(column)){
    const z=+base,id=k+','+z;
    if(!BLOCKS[kind]?.emissive||space.hidden.has(map.blockGroups?.[id]))continue;
    const h=blockSize(map,x,y,z),position=exposedLightPosition(map,{x:x+.5,y:y+.5,z:z+h/2,h,liquid:kind==='lava'},space);
    if(!position)continue;
    sources.push({...position,renderPosition:{x:x+.5,y:y+.5,z:z+h/2},power,radius,color:BLOCKS[kind].accent||BLOCKS[kind].top,block:true,owner:null,sourceId:'voxel:'+id,secondary:false});
   }
  }
  e={blocks:map.blocks,heights:map.blockHeights,ground:map.ground,blockGroups:map.blockGroups,objects:map.objects,chunks:map.chunks,chunkCount:map.chunks.length,revision:map.blockRevision,build:map.buildRevision,groups,power,radius,sources};emitterCache.set(map,e);
 }
 // Keep all exposed emitters. Tactical sampling is already spatially indexed.
 return e.sources;
}

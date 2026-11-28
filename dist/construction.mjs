import * as W from './world.mjs';
import {treeConstructionBoxes} from './tree-construction-collision.mjs';
import {TREE_PROFILES,generateLeaflessTree,treeForm,normalizeTreeConfig} from './organic-trees.mjs';
import {packTreeGraph,validTreeGraph,treeExtent,isUnifiedTree} from './unified-trees.mjs';
import {ensureTreeTypes,treeVariant,plantSequence,treeTypeConfig,makeTreeItem} from './tree-types.mjs';
import {planTreePlanting,treePlantingPlan} from './tree-neighbors.mjs';
import {previewConnectionData,rebuildConnections} from './connected-blocks.mjs';
import {formAllowed,isForm,orientForm,formInfo,hasBlockForm,formsOverlap,connectionEligible,isConnectedForm,isSpatialForm} from './block-forms.mjs';
import * as V from './blocks.mjs';
import {applyLiquidStyle,liquidPresetName} from './liquid-style.mjs';

export const DOORS={oak:'Porte en chêne',iron:'Porte renforcée',glass:'Porte vitrée',bars:'Porte à barreaux'};
export const snap=(n,step=.1)=>Number((Math.round(n/step)*step).toFixed(6));
export function defaultSlots(){return[
 {kind:'inspect',name:'Sélection'},
 {kind:'block',material:'stonebrick',w:1,d:1,h:1,yaw:0,step:1,shape:'box'},
 {kind:'block',material:'planks',w:3,d:.2,h:2,yaw:0,step:.1,shape:'box'},
 {kind:'block',material:'glass',w:1,d:.1,h:2,yaw:0,step:.1,shape:'box'},
 {kind:'door',variant:'oak',w:1,d:.15,h:2,yaw:0,step:1},
 makeTreeItem({key:'small'}),
 {kind:'object',type:'npc',yaw:0,step:1},
 {kind:'object',type:'light',yaw:0,step:1},
 {kind:'selection',name:'Sélection de zone'}
]}
export function createBlockTreeSchema(input,id){
 const config=normalizeTreeConfig(input);
 if(!W.BLOCKS[config.material]||['water','lava','air'].includes(config.material))throw Error('Choisissez un matériau de construction solide.');
 const nodes=generateLeaflessTree(config),minX=Math.min(...nodes.map(n=>n.pos[0])),minY=Math.min(...nodes.map(n=>n.pos[1]));
 const objects=nodes.map((n,i)=>({...blockObject(config.material,n.pos[0]-minX,n.pos[1]-minY,n.pos[2],1,1,1,0,id+'-'+i),blockForm:treeForm(n.radius),formConnect:true,formRadius:n.radius,formOffset:n.offset,formRoot:n.root,formTip:n.tip,formPorts:n.ports,formFlip:false,formMirror:false}));
 rebuildConnections({objects,groups:[]});
 return {id,name:config.name,w:Math.max(...objects.map(o=>o.x))+1,d:Math.max(...objects.map(o=>o.y))+1,h:Math.max(...objects.map(o=>o.baseZ))+1,objects,treeConfig:config,createdAt:Date.now()};
}
export function createTreeSchema(input,id){
 const config=normalizeTreeConfig(input);
 if(!W.BLOCKS[config.material]||W.BLOCKS[config.material].solid===false||['water','lava','air'].includes(config.material))throw Error('Choisissez un matériau solide.');
 const treeGraph=packTreeGraph(generateLeaflessTree(config)),extent=treeExtent(treeGraph);
 const o={...W.newObject('tree',0,0,id+'-tree'),...extent,name:config.name,material:config.material,treeGraph,treeConfig:config,canopy:0,group:null,baseZ:0,blocking:true,blocksSight:!!W.BLOCKS[config.material].opaque};
 return {id,name:config.name,w:o.w,d:o.d,h:o.height,objects:[o],treeConfig:config,createdAt:Date.now()};
}
export function ensureTreeExamples(world){
 world.schematics??=[];if(world.builtinTreeSchemasRevision>=4)return;
 world.schematics=world.schematics.filter(s=>!(s.builtin&&s.id.startsWith('builtin-tree-')));const ids=new Set(world.schematics.map(s=>s.id));
 for(const profile of TREE_PROFILES){
  const id='builtin-tree-'+profile.key;if(ids.has(id))continue;
  world.schematics.push({...createTreeSchema(profile,id),createdAt:0,builtin:true});
 }
 world.builtinTreeSchemasRevision=4;
}
export function initBuilder(world){world.builder??={slots:defaultSlots(),active:1};if(!Array.isArray(world.builder.slots)||world.builder.slots.length!==9)world.builder.slots=defaultSlots();world.builder.active=W.clamp(Math.floor(world.builder.active)||0,0,8);world.schematics??=[];ensureTreeExamples(world);ensureTreeTypes(world);for(let i=0;i<world.builder.slots.length;i++){const item=world.builder.slots[i];if(item?.kind!=='schema')continue;const schema=world.schematics.find(s=>s.id===item.id);if(schema?.treeConfig&&schema.objects?.length===1&&isUnifiedTree(schema.objects[0]))world.builder.slots[i]={...makeTreeItem({...schema.treeConfig,name:schema.name}),yaw:item.yaw||0}}return world.builder}
export function itemName(item,world){if(!item)return'Vide';if(formAllowed(item)&&isForm(item.shape))return (W.BLOCKS[item.material]?.name||'Bloc')+' · '+formInfo(item.shape).name;if(item.kind==='block')return liquidPresetName(item.material,item.liquidStyle)||(item.liquidStyle?((W.BLOCKS[item.material]?.name||'Bloc')+' personnalisée'):(W.BLOCKS[item.material]?.name||'Bloc'));if(item.kind==='door')return DOORS[item.variant]||'Porte';if(item.kind==='treeType')return item.name||item.treeConfig?.name||'Arbre procédural';if(item.kind==='object')return W.TYPES[item.type]||'Décor';if(item.kind==='schema')return world.schematics?.find(s=>s.id===item.id)?.name||'Schéma absent';return item.name||'Sélection'}
export function dimensions(item){const n=(v,f,max)=>Number.isFinite(+v)?W.clamp(snap(+v),.1,max):f;return{w:n(item.w,1,32),d:n(item.d,1,32),h:n(item.h,1,32)}}
export function blockObject(material,x,y,z,w,d,h,yaw,id){return{...W.newObject('block',x,y,id),name:W.BLOCKS[material]?.name||'Bloc',material,w,d,height:h,baseZ:snap(z),facing:yaw,group:null,blocking:W.BLOCKS[material]?.solid!==false,blocksSight:!!W.BLOCKS[material]?.opaque,shadow:true,frameCount:1,frames:{},...(W.BLOCKS[material]?.emissive?{light:{radius:5,power:1,color:W.BLOCKS[material].accent||W.BLOCKS[material].top}}:{})}}
const rotate=(x,y,a)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
export function placement(item,point,world,id=()=>crypto.randomUUID()){
 if(!item||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z))return[];
 const size=dimensions(item),yaw=(item.yaw||0)*Math.PI/180,step=item.step===1?1:.1;
 if(formAllowed(item)&&isForm(item.shape)){
  const pose=orientForm({...item,...size},point),o=blockObject(item.material,pose.x,pose.y,pose.z,pose.w,pose.d,pose.h,pose.angle,id());
  Object.assign(o,{baseZ:pose.z,blockForm:pose.shape,formFlip:pose.flipZ,formMirror:pose.mirror,name:(W.BLOCKS[item.material]?.name||'Bloc')+' · '+formInfo(pose.shape).name});if(isConnectedForm(o.blockForm)){o.formConnect=item.align!==false;if(connectionEligible(o)){const {bits,sizes,diagonals}=previewConnectionData(point.formMap,o);o.formDiagonalLinks=diagonals||[];o.formConnections=bits;if(isSpatialForm(o.blockForm))o.formConnectionSizes=sizes}}return[o];
 }
 let center={x:snap(point.x-size.w/2,step)+size.w/2,y:snap(point.y-size.d/2,step)+size.d/2},z=snap(point.z),angle=yaw;
 const support=point.placedBlock,n=point.normal;
 if(support&&n){
  if(item.align!==false)angle=support.facing||0;
  const c=W.center(support),local=rotate(n.x,n.y,-(support.facing||0));
  if(Math.abs(n.z)>.5){z=n.z>0?support.baseZ+support.height:support.baseZ-size.h;center={x:snap(point.x-size.w/2,step)+size.w/2,y:snap(point.y-size.d/2,step)+size.d/2}}
  else{
   const ca=Math.cos(angle),sa=Math.sin(angle),reach=Math.abs(n.x*ca+n.y*sa)*size.w/2+Math.abs(-n.x*sa+n.y*ca)*size.d/2;
   center={x:point.x+n.x*reach,y:point.y+n.y*reach};
   // Keep the tangential coordinate aligned with the face center for seamless repetition.
   if(item.align!==false){let shift=rotate(Math.abs(local.x)>.5?Math.sign(local.x)*(support.w+size.w)/2:0,Math.abs(local.y)>.5?Math.sign(local.y)*(support.d+size.d)/2:0,support.facing||0);center={x:c.x+shift.x,y:c.y+shift.y};z=support.baseZ}
  }
 }else if((point.block||point.ground)&&n){
  if(n.z>.5)z=point.z;else if(n.z<-.5)z=point.z-size.h;
  else {center={x:Math.abs(n.x)>.5?point.x+n.x*(Math.abs(Math.cos(angle))*size.w+Math.abs(Math.sin(angle))*size.d)/2:center.x,y:Math.abs(n.y)>.5?point.y+n.y*(Math.abs(Math.sin(angle))*size.w+Math.abs(Math.cos(angle))*size.d)/2:center.y};z=point.block?.z??Math.floor(point.z)}
 }
 if(item.kind==='treeType'){
  const config=treeTypeConfig(item.treeConfig),def=W.BLOCKS[config.material];if(!def||def.solid===false||['water','lava','air'].includes(config.material))return[];
  // Each click anchors the trunk at the target cell, independently of the
  // changing crown dimensions. Only successful placement advances sequence.
  if(n&&n.z<.5)return[];
  const v=treeVariant(config,plantSequence(world)),o={...W.newObject('tree',0,0,id()),...v.extent,name:config.name,material:config.material,treeGraph:v.graph,treeConfig:config,treeVariantSeed:v.seed,treeVariantSequence:v.sequence,canopy:0,group:null,baseZ:z,facing:yaw+v.rotation,blocking:true,blocksSight:!!def.opaque};
  o.x=Math.floor(point.x)+.5-o.w/2;o.y=Math.floor(point.y)+.5-o.d/2;return[planTreePlanting(point.treeMap,o)];
 }
 if(item.kind==='schema')return schemaPlacement(world.schematics.find(s=>s.id===item.id),{x:point.x,y:point.y,z},yaw,id);
 if(item.kind==='block'){
  const a=blockObject(item.material,center.x-size.w/2,center.y-size.d/2,z,size.w,size.d,size.h,angle,id());
  if(['water','lava'].includes(item.material))applyLiquidStyle(a,item.liquidStyle);
  if(item.shape!=='corner'||size.w<=size.d+.001)return[a];
  const shift=rotate(-size.w/2+size.d/2,-size.w/2,angle),b=blockObject(item.material,center.x+shift.x-size.d/2,center.y+shift.y-(size.w-size.d)/2,z,size.d,size.w-size.d,size.h,angle,id());if(['water','lava'].includes(item.material))applyLiquidStyle(b,item.liquidStyle);return[a,b];
 }
 if(item.kind==='door'){
  let o=W.newObject('build_door',center.x-size.w/2,center.y-size.d/2,id());Object.assign(o,{name:DOORS[item.variant],variant:item.variant||'oak',w:size.w,d:size.d,height:size.h,baseZ:z,facing:angle,group:'architecture',open:false,blocksSight:item.variant!=='glass'&&item.variant!=='bars'});return[o];
 }
 if(item.kind==='object'){
  let o=W.applyProp(W.newObject(item.type,Math.floor(point.x),Math.floor(point.y),id()));o.facing=angle;o.variant=item.variant||o.variant;
  if(W.character(o))o.voxelZ=z;else o.baseZ=z;return[o];
 }
 return[];
}
function vertical(o,map){const z=W.elevation(o,map);return[z,z+(o.height||1)]}
export function overlap(a,b,map){
 // Tree volumes are small, cached construction proxies, not scene objects.
 if(a.type==='tree'||b.type==='tree'){
  const aa=a.type==='tree'?treeConstructionBoxes(a,W.elevation(a,map)):[a],bb=b.type==='tree'?treeConstructionBoxes(b,W.elevation(b,map)):[b];
  return aa.some(x=>bb.some(y=>overlap(x,y,map)));
 }
 const [a0,a1]=vertical(a,map),[b0,b1]=vertical(b,map);if(a1<=b0+.001||b1<=a0+.001)return false;
 const pa=W.footprint(a),pb=W.footprint(b);
 for(const polygon of [pa,pb])for(let i=0;i<4;i++){
  const p=polygon[i],q=polygon[(i+1)%4],axis={x:p.y-q.y,y:q.x-p.x},aa=pa.map(t=>t.x*axis.x+t.y*axis.y),bb=pb.map(t=>t.x*axis.x+t.y*axis.y);
  if(Math.max(...aa)<=Math.min(...bb)+.0001||Math.max(...bb)<=Math.min(...aa)+.0001)return false;
 }
 return hasBlockForm(a)||hasBlockForm(b)?formsOverlap(a,b,a0,b0):true;
}
export function placementError(map,objects){
 if(!objects.length)return'Choisissez un élément dans l’inventaire.';
 for(const o of objects){
  const plan=treePlantingPlan(o);if(plan?.error)return plan.error;
  const z=W.elevation(o,map);if(!Number.isFinite(z)||z< -16||z+(o.height||1)>32)return'Altitude autorisée : de −16 à +32.';
  const error=W.placementError(map,o);if(error)return error;
  if(!['block','build_door','tree'].includes(o.type))continue;
  for(const other of map.objects){const effective=plan?.replacements.get(other.id)||other;if(['block','build_door','tree'].includes(effective.type)&&effective.id!==o.id&&overlap(o,effective,map))return effective.type==='tree'||o.type==='tree'?'Un arbre occupe ce volume.':'Ce volume est déjà occupé.';}
  const b=W.bounds(o);for(let x=Math.max(0,Math.floor(b.x));x<Math.min(map.width,Math.ceil(b.x+b.w));x++)for(let y=Math.max(0,Math.floor(b.y));y<Math.min(map.height,Math.ceil(b.y+b.h));y++)for(const [base,material] of Object.entries(map.blocks?.[W.cellKey(x,y)]||{})){
   const voxel=blockObject(material,x,y,+base,1,1,W.blockSize(map,x,y,+base),0,'voxel');if(overlap(o,voxel,map))return'Un bloc occupe ce volume.';
  }
 }
 // Validate characters carried by a schematic against its own newly placed structure.
 const combined={...map,objects:[...map.objects,...objects]};for(const o of objects.filter(W.character))if(!W.cellFree(combined,o.x,o.y,o))return'Le schéma placerait un personnage dans un obstacle.';
 return'';
}
export function selectionBounds(a,b){return{x:Math.floor(Math.min(a.x,b.x)),y:Math.floor(Math.min(a.y,b.y)),z:snap(Math.min(a.z,b.z)),w:Math.max(1,Math.ceil(Math.max(a.x,b.x))-Math.floor(Math.min(a.x,b.x))),d:Math.max(1,Math.ceil(Math.max(a.y,b.y))-Math.floor(Math.min(a.y,b.y))),h:Math.max(.1,snap(Math.abs(a.z-b.z)))}}
export function insideZone(o,zone,map){let b=W.bounds(o),z=W.elevation(o,map);return b.x>=zone.x-.001&&b.y>=zone.y-.001&&b.x+b.w<=zone.x+zone.w+.001&&b.y+b.h<=zone.y+zone.d+.001&&z>=zone.z-.001&&z+(o.height||.1)<=zone.z+zone.h+.001}
export function zoneContents(map,zone,includeActors=false){
 if(!zone||![zone.x,zone.y,zone.z,zone.w,zone.d,zone.h].every(Number.isFinite)||zone.w<=0||zone.d<=0||zone.h<=0||zone.w*zone.d*zone.h>32768)throw Error('Zone invalide ou supérieure à 32 768 unités.');
 const objects=map.objects.filter(o=>(includeActors||!W.character(o))&&insideZone(o,zone,map)),voxels=[];
 for(const [key,column] of Object.entries(map.blocks||{})){
  const[x,y]=key.split(',').map(Number);if(x<zone.x||y<zone.y||x+1>zone.x+zone.w||y+1>zone.y+zone.d)continue;
  for(const[z,material] of Object.entries(column)){const h=W.blockSize(map,x,y,+z);if(+z>=zone.z-.001&&+z+h<=zone.z+zone.h+.001)voxels.push({x,y,z:+z,material,h})}
 }
 if(objects.length+voxels.length>4096)throw Error('Un schéma est limité à 4 096 éléments. Réduisez la zone.');return{objects,voxels};
}
export function captureSchema(map,zone,name,id,includeActors=false){
 const {objects,voxels}=zoneContents(map,zone,includeActors);if(!objects.length&&!voxels.length)throw Error('La zone ne contient aucun élément entièrement inclus.');
 const copies=objects.map(o=>{
  const c=structuredClone(o),z=W.elevation(o,map);c.x-=zone.x;c.y-=zone.y;if(W.isSegment(c)){c.x2-=zone.x;c.y2-=zone.y}
  c.baseZ=snap(z-zone.z);c.offsetZ=0;c.level=0;if(W.character(c))c.voxelZ=c.baseZ;
  if(c.surface){c.mountNormal=c.surface.normal;c.baseZ=z-zone.z;delete c.surface}
  c.group=null;c.locked=false;return c;
 });
 for(const b of voxels)copies.push(blockObject(b.material,b.x-zone.x,b.y-zone.y,b.z-zone.z,1,1,b.h,0,'voxel-'+b.x+','+b.y+','+b.z));
 return{id,name:String(name||'Schéma').trim().slice(0,60)||'Schéma',w:zone.w,d:zone.d,h:zone.h,objects:copies,createdAt:Date.now()};
}
export function schemaPlacement(schema,at,yaw,id){
 if(!schema)return[];
 const spatial=schema.objects.some(o=>isSpatialForm(o.blockForm)),quarter=Math.PI/2,angle=spatial?Math.round(yaw/quarter)*quarter:yaw;
 yaw=angle;
 const swap=spatial&&Math.abs(Math.round(angle/quarter)%2)===1;
 const width=swap?schema.d:schema.w,depth=swap?schema.w:schema.d;
 const px=spatial?Math.round(at.x-width/2)+width/2:snap(at.x),py=spatial?Math.round(at.y-depth/2)+depth/2:snap(at.y),pz=snap(at.z);
 const parts=schema.objects.map(source=>{
  let o=structuredClone(source),c=W.center(o),relative=rotate(c.x-schema.w/2,c.y-schema.d/2,yaw);o.id=id();o.x=px+relative.x-(o.w||1)/2;o.y=py+relative.y-(o.d||1)/2;
  if(W.isSegment(o)){const a=rotate(source.x-schema.w/2,source.y-schema.d/2,yaw),b=rotate(source.x2-schema.w/2,source.y2-schema.d/2,yaw);o.x=px+a.x;o.y=py+a.y;o.x2=px+b.x;o.y2=py+b.y}
  o.facing=(source.facing||0)+yaw;o.baseZ=snap(pz+(source.baseZ||0));if(W.character(o))o.voxelZ=o.baseZ;
  if(o.mountNormal){const n=rotate(o.mountNormal.x,o.mountNormal.y,yaw);o.mountNormal={...o.mountNormal,...n}}
  o.locked=false;o.group=null;if(spatial){o.x=snap(o.x);o.y=snap(o.y)}return o;
 });
 if(spatial)rebuildConnections({objects:parts,groups:[]});return parts;
}
export function groupZone(map,zone,name,id,includeActors=false){const parts=zoneContents(map,zone,includeActors);if(!parts.objects.length&&!parts.voxels.length)throw Error('Aucun élément entièrement inclus dans la zone.');map.groups.push({id,name:name||'Zone regroupée',color:'#85baa1',visible:true,locked:false,kind:'zone'});for(const o of parts.objects)o.group=id;map.blockGroups??={};for(const b of parts.voxels)map.blockGroups[b.x+','+b.y+','+b.z]=id;map.buildRevision=(map.buildRevision||0)+1;return parts.objects.length+parts.voxels.length}

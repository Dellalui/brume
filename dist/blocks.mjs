import {activeCell} from './chunk-index.mjs';
import {blockTops,placedBodyClear,placedRayClear} from './placed-geometry.mjs';
// Sparse voxel columns. Heights are block coordinates, not scene floors.
export const MAX_BLOCK_HEIGHT=32;
export const MIN_BLOCK_HEIGHT=-16;
export const BLOCK_CATEGORIES={terrain:'Terrain',stone:'Roches et minerais',wood:'Bois',building:'Construction',nature:'Nature',infernal:'Enfer',special:'Verre et liquides'};
const rows=[
['grass','Gazon','terrain','#71964d','#786044','grass'],['dirt','Terre','terrain','#967653','#71553c','noise'],['sand','Sable','terrain','#d6bc7e','#b69a62','noise'],['gravel','Gravier','terrain','#9e9890','#797571','stone'],['clay','Argile','terrain','#b8aca0','#8f8278','noise'],['snow','Neige','terrain','#e1ece9','#a3bdc5','noise'],['mud','Boue','terrain','#64574c','#443b33','noise'],
['stone','Pierre','stone','#969c96','#737c78','stone'],['cobble','Pavés','stone','#a1a69b','#7c8279','cobble'],['granite','Granit','stone','#b19084','#8c6e65','stone'],['marble','Marbre','stone','#e3ddd0','#b9b4ac','stone'],['slate','Ardoise','stone','#646d78','#414d58','brick'],['coal','Minerai de charbon','stone','#777c78','#555b57','ore','#292c2c'],['iron','Minerai de fer','stone','#99948c','#77756e','ore','#dbb299'],['copper','Minerai de cuivre','stone','#8c998e','#65756a','ore','#e5945a'],['gold','Minerai d’or','stone','#92968c','#6d736b','ore','#f8d358'],['crystal','Minerai de cristal','stone','#6c8f9b','#446976','ore','#72efed'],
['oak','Tronc de chêne','wood','#b69a67','#795536','log'],['pinewood','Tronc de pin','wood','#c1a16e','#584533','log'],['birchwood','Tronc de bouleau','wood','#d5c89d','#dfdbcb','birch'],['planks','Planches de chêne','wood','#bd995e','#ac844d','planks'],['darkplanks','Planches sombres','wood','#78523f','#563b30','planks'],['paleplanks','Planches claires','wood','#e1cb93','#c1aa76','planks'],
['brick','Briques rouges','building','#b47a62','#8c5647','brick'],['stonebrick','Briques de pierre','building','#a0a79e','#7e887d','brick'],['sandstone','Grès','building','#d7ba83','#c2a46e','brick'],['tile','Tuiles','building','#ba654b','#8f4736','brick'],['white','Bloc blanc','building','#ede7da','#cfc7b9','noise'],['red','Bloc rouge','building','#b84e49','#8f3434','noise'],['blue','Bloc bleu','building','#5276b5','#36588d','noise'],['purple','Bloc violet','building','#956bb5','#6d4e89','noise'],['mossbrick','Pierre moussue','building','#809366','#647c51','cobble'],
['leaves','Feuillage','nature','#739451','#506b3c','leaves'],['darkleaves','Feuillage sombre','nature','#417759','#2e5641','leaves'],['hay','Paille','nature','#d7b753','#ad8b37','planks'],['cactus','Cactus','nature','#74935b','#496b40','log'],['ice','Glace','special','#a6dcea','#70b7d0','glass'],['glass','Verre','special','#c1e4df','#9acbc7','glass'],['water','Source d’eau','special','#58a3cf','#377fa7','water'],['lava','Source de lave','infernal','#ffb647','#ef6635','lava'],
['basalt','Basalte','infernal','#545361','#383743','stone'],['infernal','Roche infernale','infernal','#9d483a','#642e30','stone'],['ash','Cendres','infernal','#8b807c','#5d5554','noise'],['magma','Magma','infernal','#ef803e','#9b342a','lava'],['obsidian','Obsidienne','infernal','#443957','#272235','stone'],['soul','Sable des âmes','infernal','#8c6b54','#604635','cobble'],['hellbrick','Briques infernales','infernal','#6d3942','#492832','brick'],['glowstone','Pierre lumineuse','infernal','#ffe0a0','#d3a653','ore','#fff4cc']];
export const BLOCKS=Object.fromEntries(rows.map(([id,name,category,top,side,pattern,accent])=>[id,{name,category,top,side,pattern,accent,solid:!['water','lava'].includes(id),opaque:!['water','lava','glass','ice','leaves','darkleaves'].includes(id),opacity:id==='glass'?.32:id==='ice'?.65:['water','lava'].includes(id)?.8:1,emissive:['lava','magma','glowstone'].includes(id)}]));
export const key=(x,y)=>Math.floor(x)+','+Math.floor(y);
export function prepareBlocks(map){if(map.blocks)return;map.blocks={};for(let[k,b]of Object.entries(map.terrain||{})){let h=Math.max(0,Math.min(12,Math.round(b.height)||0));if(h){let c={};for(let z=0;z<h;z++)c[z]=BLOCKS[b.material]?b.material:'grass';map.blocks[k]=c}}map.blockRevision=0;}
export const groundAt=(map,x,y)=>Math.max(MIN_BLOCK_HEIGHT,Math.min(0,map.ground?.[key(x,y)]??0));
export const blockSize=(map,x,y,z)=>map.blockHeights?.[key(x,y)+','+z]===.5?.5:1;
export function blockBase(map,x,y,z){let c=map.blocks?.[key(x,y)];if(!c)return null;for(let base of [Math.floor(z*2)/2,Math.floor(z*2)/2-.5])if(c[base]&&z>=base&&z<base+blockSize(map,x,y,base)-.00001)return base;return null}
export const blockAt=(map,x,y,z)=>{let base=blockBase(map,x,y,z);return base===null?null:map.blocks[key(x,y)][base]};
export const solidAt=(map,x,y,z)=>z<groundAt(map,x,y)||!!BLOCKS[blockAt(map,x,y,z)]?.solid;
export function blockHeight(map,x,y){let c=map.blocks?.[key(x,y)];if(!c)return Math.max(groundAt(map,x,y),...blockTops(map,x,y));return Math.max(groundAt(map,x,y),...blockTops(map,x,y),...Object.keys(c).filter(z=>BLOCKS[c[z]]?.solid).map(z=>Number(z)+blockSize(map,x,y,+z)))}
export function clearBody(map,x,y,z,height=1.6){
 if(!Number.isFinite(z)||z<groundAt(map,x,y)||z>MAX_BLOCK_HEIGHT||!placedBodyClear(map,x,y,z,height))return false;
 for(const [base,kind] of Object.entries(map.blocks?.[key(x,y)]||{})){
  if(BLOCKS[kind]?.solid&&+base<z+height-.001&&+base+blockSize(map,x,y,+base)>z+.001)return false;
 }
 return true;
}
export function surfaces(map,x,y,height=1.6){let c=map.blocks?.[key(x,y)]||{},zs=[groundAt(map,x,y),...blockTops(map,x,y),...Object.keys(c).filter(z=>BLOCKS[c[z]]?.solid).map(z=>+z+blockSize(map,x,y,+z))];return [...new Set(zs)].filter(z=>clearBody(map,x,y,z,height)).sort((a,b)=>a-b)}
export function surfaceNear(map,x,y,z=0,step=Infinity,height=1.6){return surfaces(map,x,y,height).filter(h=>Math.abs(h-z)<=step).sort((a,b)=>Math.abs(a-z)-Math.abs(b-z)||b-a)[0]}
export function digGround(map,x,y,amount=1){if(![x,y,amount].every(Number.isFinite))return false;x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=map.width||y>=map.height||!activeCell(map,x,y))return false;let old=groundAt(map,x,y),next=Math.max(MIN_BLOCK_HEIGHT,old-(amount===.5?.5:1));if(next===old)return false;map.ground??={};map.ground[key(x,y)]=next;map.blockRevision=(map.blockRevision||0)+1;return true}
export function setBlock(map,x,y,z,material,height=1){if(![x,y,z,height].every(Number.isFinite))return false;x=Math.floor(x);y=Math.floor(y);z=Math.floor(z*2)/2;height=height===.5?.5:1;if(x<0||y<0||x>=map.width||y>=map.height||z<MIN_BLOCK_HEIGHT||z+height>MAX_BLOCK_HEIGHT||!activeCell(map,x,y))return false;if(material&&!BLOCKS[material])return false;prepareBlocks(map);let k=key(x,y),base=blockBase(map,x,y,z);if(!material){if(base===null)return false;delete map.blocks[k][base];if(map.blockHeights)delete map.blockHeights[k+','+base];if(!Object.keys(map.blocks[k]).length)delete map.blocks[k]}else{if(base===z&&map.blocks[k]?.[base]===material&&blockSize(map,x,y,z)===height)return false;map.blocks[k]??={};for(let old of Object.keys(map.blocks[k]))if(+old<z+height&&+old+blockSize(map,x,y,+old)>z){delete map.blocks[k][old];if(map.blockHeights)delete map.blockHeights[k+','+old]}map.blocks[k][z]=material;map.blockHeights??={};if(height===.5)map.blockHeights[k+','+z]=.5;else delete map.blockHeights[k+','+z];if(z<groundAt(map,x,y)){map.ground??={};map.ground[k]=z}}
map.blockRevision=(map.blockRevision||0)+1;return true}
export function voxelRayClear(map,a,b,z0,z1){
 if(![a.x,a.y,b.x,b.y,z0,z1].every(Number.isFinite)||!placedRayClear(map,a,b,z0,z1))return false;
 const dx=b.x-a.x,dy=b.y-a.y,dz=z1-z0,sx=Math.sign(dx),sy=Math.sign(dy),epsilon=1e-7;
 let x=Math.floor(a.x),y=Math.floor(a.y),t=0;
 const deltaX=dx?1/Math.abs(dx):Infinity,deltaY=dy?1/Math.abs(dy):Infinity;
 let nextX=dx?((dx>0?x+1:x)-a.x)/dx:Infinity,nextY=dy?((dy>0?y+1:y)-a.y)/dy:Infinity;
 // Traverse every crossed column; fixed-distance samples missed thin corner intersections.
 const limit=Math.abs(Math.floor(b.x)-x)+Math.abs(Math.floor(b.y)-y)+3;
 for(let count=0;count<limit;count++){
  const end=Math.min(1,nextX,nextY),lo=Math.max(t,epsilon),hi=Math.min(end,1-epsilon);
  if(hi>lo+epsilon){
   const za=z0+dz*lo,zb=z0+dz*hi,low=Math.min(za,zb),high=Math.max(za,zb);
   if(low<groundAt(map,x,y)-epsilon)return false;
   for(const [base,kind] of Object.entries(map.blocks?.[key(x,y)]||{}))if(BLOCKS[kind]?.opaque){
    const bottom=+base,top=bottom+blockSize(map,x,y,bottom);
    if(low<top-epsilon&&high>bottom+epsilon)return false;
   }
  }
  if(end>=1)return true;
  const crossX=nextX<=end+epsilon,crossY=nextY<=end+epsilon;
  if(crossX){x+=sx;nextX+=deltaX}if(crossY){y+=sy;nextY+=deltaY}t=end;
 }
 return true;
}
export function* voxelPath(map,actor,destination,legal,Heap){
 if(![actor.x,actor.y,destination.x,destination.y].every(Number.isFinite)||destination.z!==undefined&&!Number.isFinite(destination.z))return [];
 const active=new Set(map.chunks),surfaceCache=new Map(),edgeCache=new Map();
 const levels=(x,y)=>{const k=key(x,y);if(!surfaceCache.has(k))surfaceCache.set(k,x<0||y<0||x>=map.width||y>=map.height||!active.has(Math.floor(x/16)+','+Math.floor(y/16))?[]:surfaces(map,x,y,actor.bodyHeight||1.6));return surfaceCache.get(k)};
 const encode=p=>p.x+','+p.y+','+p.z;
 const canStep=(a,b)=>{const k=encode(a)+':'+encode(b);if(!edgeCache.has(k))edgeCache.set(k,legal(a,b));return edgeCache.get(k)};
 const start={x:Math.floor(actor.x),y:Math.floor(actor.y),z:surfaceNear(map,actor.x,actor.y,actor.voxelZ??blockHeight(map,actor.x,actor.y),Infinity,actor.bodyHeight||1.6)};
 const end={x:Math.floor(destination.x),y:Math.floor(destination.y)},targetZ=destination.z;
 // Reject occupied/impossible goals before exploring the entire map.
 const targets=levels(end.x,end.y).filter(z=>(targetZ===undefined||Math.abs(z-targetZ)<.1)&&canStep({...end,z},{...end,z}));
 if(start.z===undefined||!targets.length)return [];
 if(start.x===end.x&&start.y===end.y&&targets.includes(start.z))return [start];
 // A fully isolated roof/ledge cannot be entered. Avoid searching the whole map.
 function hasLink(p,entering){for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const x=p.x+dx,y=p.y+dy;for(const z of levels(x,y)){if(Math.abs(z-p.z)>1)continue;const q={x,y,z};if(entering?canStep(q,p):canStep(p,q))return true}}return false}
 if(!hasLink(start,false)||!targets.some(z=>hasLink({...end,z},true)))return [];
 const origin=encode(start),open=new Heap(),cost=new Map([[origin,0]]),parents=new Map(),closed=new Set();
 const h=p=>{const dx=Math.abs(end.x-p.x),dy=Math.abs(end.y-p.y);return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy)+.15*Math.min(...targets.map(z=>Math.abs(z-p.z)))};
 open.push({...start,g:0,f:h(start)});let n=0;
 while(open.size&&n++<65536){
  if(n%128===0)yield null;
  const c=open.pop(),k=encode(c);if(closed.has(k))continue;
  if(c.x===end.x&&c.y===end.y&&targets.includes(c.z)){let result=[{x:c.x,y:c.y,z:c.z}],at=k;while(at!==origin){const p=parents.get(at);if(!p)return [];result.push(p);at=encode(p)}return result.reverse()}
  closed.add(k);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
   if(!dx&&!dy)continue;const x=c.x+dx,y=c.y+dy;
   for(const z of levels(x,y)){
    if(Math.abs(z-c.z)>1)continue;const p={x,y,z},pk=encode(p);
    if(closed.has(pk)||!canStep(c,p))continue;
    if(dx&&dy){const side=(sx,sy)=>levels(sx,sy).some(sz=>Math.abs(sz-c.z)<=1&&Math.abs(sz-z)<=1&&canStep(c,{x:sx,y:sy,z:sz})&&canStep({x:sx,y:sy,z:sz},p));if(!side(c.x+dx,c.y)||!side(c.x,c.y+dy))continue}
    const g=c.g+(dx&&dy?Math.SQRT2:1)+Math.abs(z-c.z)*.15;if(g>=(cost.get(pk)??Infinity))continue;
    cost.set(pk,g);parents.set(pk,{x:c.x,y:c.y,z:c.z});open.push({...p,g,f:g+h(p)});
   }
  }
 }
 return [];
}

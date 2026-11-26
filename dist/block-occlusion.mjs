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
export function buildBlockOcclusion(map,{region=null,slice=32,mode='mj'}={}){
 const hiddenObjects=new Set(),hiddenVoxels=new Set(),boxes=[],grid=new Map(),fullUnits=new Set(),groups=new Map(map.groups.map(g=>[g.id,g]));
 const add=b=>{b.unit=b.min.every((v,i)=>Math.abs(v-Math.round(v))<EPS&&Math.abs(b.max[i]-v-1)<EPS)?b.min.map(Math.round):null;boxes.push(b);if(!b.opaque)return;if(b.unit)fullUnits.add(key(...b.unit));for(let x=Math.floor(b.min[0]/BUCKET);x<=Math.floor((b.max[0]-EPS)/BUCKET);x++)for(let y=Math.floor(b.min[1]/BUCKET);y<=Math.floor((b.max[1]-EPS)/BUCKET);y++)for(let z=Math.floor(b.min[2]/BUCKET);z<=Math.floor((b.max[2]-EPS)/BUCKET);z++){const k=key(x,y,z);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(b)}};
 for(const [column,entries]of Object.entries(map.blocks||{})){
  const [x,y]=column.split(',').map(Number);if(region&&!region.cell(x,y)||!W.activeCell(map,x,y))continue;
  for(const [base,kind]of Object.entries(entries)){const z=+base,h=W.blockSize(map,x,y,z),id=key(x,y,z),def=W.BLOCKS[kind];if(!def||z>=slice||groups.get(map.blockGroups?.[id])?.visible===false)continue;add({id,voxel:true,min:[x,y,z],max:[x+1,y+1,z+h],opaque:def.opaque&&def.opacity===1,canHide:true})}
 }
 for(const o of map.objects){
  if(o.type!=='block'||o.visible===false||groups.get(o.group)?.visible===false||mode!=='mj'&&o.secret||region&&!region.object(o))continue;
  const turn=(o.facing||0)/(Math.PI/2);if(Math.abs(turn-Math.round(turn))>EPS)continue;
  const b=W.bounds(o),z=W.elevation(o,map),def=W.BLOCKS[o.material||'stone'];if(z>=slice)continue;
  add({id:o.id,min:[b.x,b.y,z],max:[b.x+b.w,b.y+b.h,z+o.height],opaque:!!def?.opaque&&def.opacity===1&&(o.opacity??1)===1&&!o.imageId,canHide:!o.effect?.kind&&!o.aura?.enabled});
 }
 const neighbours=(box,axis,side)=>{
  const min=[...box.min],max=[...box.max],at=side?box.max[axis]:box.min[axis];min[axis]=at-EPS;max[axis]=at+EPS;const found=new Set();
  for(let x=Math.floor(min[0]/BUCKET);x<=Math.floor(max[0]/BUCKET);x++)for(let y=Math.floor(min[1]/BUCKET);y<=Math.floor(max[1]/BUCKET);y++)for(let z=Math.floor(min[2]/BUCKET);z<=Math.floor(max[2]/BUCKET);z++)for(const b of grid.get(key(x,y,z))||[])if(b!==box&&b.min[axis]<=at+EPS&&b.max[axis]>=at-EPS&&(side?b.max[axis]>at+EPS:b.min[axis]<at-EPS))found.add(b);
  return found;
 };
 for(const box of boxes){if(!box.canHide)continue;let enclosed=true;
  for(let axis=0;axis<3&&enclosed;axis++)for(let side=0;side<2&&enclosed;side++){
   if(box.unit){const n=[...box.unit];n[axis]+=side?1:-1;if(fullUnits.has(key(...n)))continue}const [u,v]=[0,1,2].filter(a=>a!==axis),rects=[];
   for(const b of neighbours(box,axis,side)){if(b.max[u]<=box.min[u]+EPS||b.min[u]>=box.max[u]-EPS||b.max[v]<=box.min[v]+EPS||b.min[v]>=box.max[v]-EPS)continue;rects.push([b.min[u],b.max[u],b.min[v],b.max[v]])}
   enclosed=covered(box.min[u],box.max[u],box.min[v],box.max[v],rects);
  }
  if(enclosed)(box.voxel?hiddenVoxels:hiddenObjects).add(box.id);
 }
 return{hiddenObjects,hiddenVoxels,fullUnits,candidates:boxes.length};
}

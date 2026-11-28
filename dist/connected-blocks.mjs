// Cardinal connections are derived from adjacent unit cells, never from the camera.
// Persist only the 4-bit mask; the geometry and all collision paths share it.
import {connectionEligible,isConnectedForm,isSpatialForm,connectionCompatible,connectionRadiusCode} from './block-forms.mjs';
const indices=new WeakMap(),DIRS=[[1,0,0],[0,1,0],[-1,0,0],[0,-1,0],[0,0,1],[0,0,-1]];
const cell=(x,y,z,level)=>[Math.round(x),Math.round(y),Math.round(z*1e5),level||0].join(',');
const key=(o,dx=0,dy=0,dz=0)=>cell(o.x+dx,o.y+dy,o.baseZ+dz,o.level);
function stateFor(map){return {map,bins:new Map(),byId:new Map(),hidden:new Set((map.groups||[]).filter(g=>g.visible===false).map(g=>g.id))}}
function visible(s,o){return o.visible!==false&&!s.hidden.has(o.group)}
function insert(s,o){
 if(!connectionEligible(o)||!visible(s,o))return;
 const k=key(o);let set=s.bins.get(k);if(!set)s.bins.set(k,set=new Set());set.add(o);s.byId.set(o.id,{o,k});
}
function remove(s,id){
 const old=s.byId.get(id);if(!old)return null;
 const set=s.bins.get(old.k);set.delete(old.o);if(!set.size)s.bins.delete(old.k);s.byId.delete(id);return old.o;
}
function links(s,o){
 if(!connectionEligible(o)||!visible(s,o))return {bits:0,sizes:0};
 let bits=0,sizes=0;const turn=((Math.round((o.facing||0)/(Math.PI/2))%4)+4)%4;
 for(let i=0;i<(isSpatialForm(o.blockForm)?6:4);i++){const [dx,dy,dz]=DIRS[i<4?(i+turn)%4:i];
  const neighbors=[...(s.bins.get(key(o,dx,dy,dz))||[])].filter(n=>n!==o&&n.id!==o.id&&connectionCompatible(n.blockForm,o.blockForm)&&!!n.secret===!!o.secret);
  if(neighbors.length){bits|=1<<i;sizes|=Math.min(...neighbors.map(n=>connectionRadiusCode(n.blockForm,o.blockForm)))<<(i*3)}
 }
 return {bits,sizes};
}
function refresh(s,o,changed){const {bits,sizes}=links(s,o);if(o.formConnections!==bits||isSpatialForm(o.blockForm)&&o.formConnectionSizes!==sizes){o.formConnections=bits;if(isSpatialForm(o.blockForm))o.formConnectionSizes=sizes;changed.push(o)}}
function around(s,o,dirty){
 if(!connectionEligible(o))return;
 for(const [dx,dy,dz]of [[0,0,0],...DIRS])for(const n of s.bins.get(key(o,dx,dy,dz))||[])dirty.add(n);
}
// Full reconciliation for world import, undo, group/position/dimension edits.
export function rebuildConnections(map){
 const s=stateFor(map),changed=[];
 for(const o of map.objects||[])insert(s,o);
 for(const o of map.objects||[])if(isConnectedForm(o.blockForm)){
  if(connectionEligible(o))refresh(s,o,changed);
  else if(o.formConnections!==undefined){delete o.formConnections;delete o.formConnectionSizes;changed.push(o)}
 }
 indices.set(map,s);return changed;
}
// Explicit construction/impact deltas touch only the affected cells. The
// editor uses the conservative full path for unrelated mutations.
export function updateConnections(map,{added=[],removed=[]}={}){
 const s=indices.get(map);if(!s)return rebuildConnections(map);
 const dirty=new Set(),changed=[];
 for(const id of removed){const o=remove(s,typeof id==='object'?id.id:id);if(o)around(s,o,dirty)}
 for(const o of added){insert(s,o);around(s,o,dirty);if(connectionEligible(o))dirty.add(o)}
 for(const o of dirty)if(s.byId.get(o.id)?.o===o||added.includes(o))refresh(s,o,changed);
 return changed;
}
// Preview is read-only, including a previously unindexed map.
export function previewConnectionData(map,o){
 if(!map||!connectionEligible(o))return {bits:0,sizes:0};
 let s=indices.get(map);if(!s){s=stateFor(map);for(const n of map.objects||[])insert(s,n)}
 return links(s,o);
}
export function previewConnections(map,o){return previewConnectionData(map,o).bits}

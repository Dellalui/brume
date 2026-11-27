import * as W from './world.mjs';
const FIELDS=['id','type','x','y','x2','y2','w','d','height','scale','facing','level','baseZ','offsetZ','voxelZ','travelZ','surface','blocking','open','occupancy','underClearance','bodyHeight','trunkRadius','material','blocksSight','rise'];
const DICTS=['blocks','blockHeights','ground','terrain'];
export function collisionObject(o){return Object.fromEntries(FIELDS.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]))}
const encode=v=>JSON.stringify(v);
function dictDelta(old,next){
 const set={},remove=[];
 for(const k of Object.keys(old||{}))if(!Object.hasOwn(next,k))remove.push(k);
 for(const [k,v]of Object.entries(next))if(!Object.hasOwn(old||{},k)||encode(old[k])!==encode(v))set[k]=v;
 return {set,remove};
}
const hasDelta=d=>d.remove.length>0||Object.keys(d.set).length>0;
export function createPathSync(){
 let mapRef=null,prev=null,staticKey=null,revision=0,staticObjects=[],staticFields=null,chunksRef=null;
 return {reset(){mapRef=null;prev=null;staticKey=null;staticFields=null;staticObjects=[];chunksRef=null},prepare(map){
  const key=encode([map.blockRevision,map.buildRevision,map.width,map.height,map.editLevel,map.levelHeight,map.chunks.length]);
  if(map!==mapRef||key!==staticKey||chunksRef!==map.chunks||!staticFields){
   chunksRef=map.chunks;
   staticFields=structuredClone({id:map.id,width:map.width,height:map.height,editLevel:map.editLevel,levelHeight:map.levelHeight,chunks:map.chunks,blockRevision:map.blockRevision,buildRevision:map.buildRevision,...Object.fromEntries(DICTS.filter(k=>map[k]!==undefined).map(k=>[k,map[k]]))});
   staticObjects=map.objects.filter(o=>!W.character(o)).map(collisionObject).filter(o=>o.blocking||o.type==='block'||o.type==='platform'||o.type==='balcony');
   staticKey=key;
  }
  const objects=[...staticObjects,...map.objects.filter(W.character).map(collisionObject)],objectMap=new Map(objects.map(o=>[o.id,o])),full=map!==mapRef||!prev;
  if(full){mapRef=map;prev={fields:staticFields,objects:objectMap};return {revision:++revision,init:{...staticFields,objects}}}
  const update={},deltas={};
  if(staticFields!==prev.fields){
   for(const [k,v]of Object.entries(staticFields))if(!DICTS.includes(k)&&encode(v)!==encode(prev.fields[k]))update[k]=v;
   for(const k of DICTS){
    const old=prev.fields[k],next=staticFields[k];
    if(next===undefined){if(old!==undefined)update[k]=null;continue}
    if(old===undefined){update[k]=next;continue}
    const delta=dictDelta(old,next);if(hasDelta(delta))deltas[k]=delta;
   }
  }
  const objectDelta={set:[],remove:[]};
  for(const [id,o]of objectMap){const old=prev.objects.get(id);if(old!==o&&encode(old)!==encode(o))objectDelta.set.push(o)}
  for(const id of prev.objects.keys())if(!objectMap.has(id))objectDelta.remove.push(id);
  prev={fields:staticFields,objects:objectMap};
  if(Object.keys(update).length||Object.keys(deltas).length||objectDelta.set.length||objectDelta.remove.length)return {revision:++revision,update,deltas,objectDelta};
  return {revision};
 }};
}
export function applyPathSync(state,msg){
 if(msg.init)return {map:msg.init,revision:msg.revision};
 if(!state||msg.revision<state.revision)throw Error('Collision snapshot missing or stale');
 if(!msg.update&&!msg.deltas&&!msg.objectDelta){if(msg.revision!==state.revision)throw Error('Collision revision mismatch');return state}
 if(msg.revision!==state.revision+1)throw Error('Collision delta missing');
 const map={...state.map,...msg.update};
 if(msg.objectDelta){const objects=new Map(map.objects.map(o=>[o.id,o]));for(const id of msg.objectDelta.remove)objects.delete(id);for(const o of msg.objectDelta.set)objects.set(o.id,o);map.objects=[...objects.values()]}
 for(const [k,d]of Object.entries(msg.deltas||{})){const next={...map[k]};for(const id of d.remove)delete next[id];Object.assign(next,d.set);map[k]=next}
 return {map,revision:msg.revision};
}

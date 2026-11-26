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
 let mapRef=null,prev=null,staticKey=null,revision=0,staticObjects=[],staticFields=null;
 return {reset(){mapRef=null;prev=null;staticKey=null;staticFields=null;staticObjects=[]},prepare(map){
  const key=encode([map.blockRevision,map.buildRevision,map.width,map.height,map.editLevel,map.levelHeight,map.chunks]);
  if(map!==mapRef||key!==staticKey||!staticFields){
   staticFields=structuredClone({id:map.id,width:map.width,height:map.height,editLevel:map.editLevel,levelHeight:map.levelHeight,chunks:map.chunks,blockRevision:map.blockRevision,buildRevision:map.buildRevision,...Object.fromEntries(DICTS.filter(k=>map[k]!==undefined).map(k=>[k,map[k]]))});
   staticObjects=map.objects.filter(o=>!W.character(o)).map(collisionObject).filter(o=>o.blocking||o.type==='block'||o.type==='platform'||o.type==='balcony');
   staticKey=key;
  }
  const objects=[...staticObjects,...map.objects.filter(W.character).map(collisionObject)],objectsKey=encode(objects),full=map!==mapRef||!prev;
  if(full){mapRef=map;prev={fields:staticFields,objectsKey};return {revision:++revision,init:{...staticFields,objects}}}
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
  if(objectsKey!==prev.objectsKey)update.objects=objects;
  prev={fields:staticFields,objectsKey};
  if(Object.keys(update).length||Object.keys(deltas).length)return {revision:++revision,update,deltas};
  return {revision};
 }};
}
export function applyPathSync(state,msg){
 if(msg.init)return {map:msg.init,revision:msg.revision};
 if(!state||msg.revision<state.revision)throw Error('Collision snapshot missing or stale');
 if(!msg.update&&!msg.deltas){if(msg.revision!==state.revision)throw Error('Collision revision mismatch');return state}
 if(msg.revision!==state.revision+1)throw Error('Collision delta missing');
 const map={...state.map,...msg.update};
 for(const [k,d]of Object.entries(msg.deltas||{})){const next={...map[k]};for(const id of d.remove)delete next[id];Object.assign(next,d.set);map[k]=next}
 return {map,revision:msg.revision};
}

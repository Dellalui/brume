import {capture} from './history.mjs';
const fields=['blocks','blockHeights','blockGroups','ground','terrain','floor'];
export function partition(world){const records=new Map(),add=(mapId,field,key,value)=>records.set(JSON.stringify([mapId,field,key]),{mapId,field,key,value});
 const {maps,...root}=world;add(null,'world','',{...root,mapIds:maps.map(m=>m.id)});
 for(const map of maps){const head={...map,objectIds:map.objects.map(o=>o.id),recordFields:fields.filter(f=>map[f]!==undefined)};delete head.objects;for(const f of fields)delete head[f];add(map.id,'head','',head);for(const o of map.objects)add(map.id,'objects',o.id,o);for(const f of fields)if(map[f])for(const[k,v]of Object.entries(map[f]))add(map.id,f,k,v)}return records;
}
export function assemble(records){const root=records.find(r=>r.field==='world'&&r.mapId===null)?.value;if(!root)return null;const {mapIds,...world}=root,maps=new Map();for(const r of records)if(r.field==='head')maps.set(r.mapId,{...r.value,objects:[],...Object.fromEntries((r.value.recordFields||fields).map(f=>[f,{}]))});
 const objects=new Map();for(const r of records){const map=maps.get(r.mapId);if(!map)continue;if(r.field==='objects')objects.set(JSON.stringify([r.mapId,r.key]),r.value);else if(fields.includes(r.field))map[r.field][r.key]=r.value}
 world.maps=mapIds.map(id=>{const m=maps.get(id);if(!m)throw Error('Carte sauvegardée manquante');m.objects=m.objectIds.map(oid=>objects.get(JSON.stringify([id,oid])));if(m.objects.some(o=>!o))throw Error('Objet sauvegardé manquant');delete m.objectIds;delete m.recordFields;return m});return world;
}
export function createWorldStorage(indexedDB){
 let previous=new Map(),chain=Promise.resolve();const db=new Promise((resolve,reject)=>{const r=indexedDB.open('brumes-world-records',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 return {async load(){const d=await db;return new Promise((resolve,reject)=>{const r=d.transaction('records').objectStore('records').getAll();r.onsuccess=()=>{try{resolve(assemble(r.result))}catch(e){reject(e)}};r.onerror=()=>reject(r.error)})},save(world){
  const snapshot=capture(world);const write=async()=>{const d=await db,next=partition(snapshot),changes=[],removed=[];for(const[k,r]of next){const old=previous.get(k);if(!old||old.value!==r.value&&(r.field!=='world'&&r.field!=='head'||JSON.stringify(old.value)!==JSON.stringify(r.value)))changes.push([k,r])}for(const k of previous.keys())if(!next.has(k))removed.push(k);
   if(changes.length||removed.length)await new Promise((resolve,reject)=>{const tx=d.transaction('records','readwrite'),store=tx.objectStore('records');for(const[k,r]of changes)store.put(r,k);for(const k of removed)store.delete(k);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error)});previous=next;return{changed:changes.length,removed:removed.length};
  };chain=chain.catch(()=>{}).then(write);return chain;
 }};
}

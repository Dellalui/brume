// History owns immutable snapshots; only changed branches allocate new nodes.
const snapshots=new WeakMap();
export function capture(value){
 if(!value||typeof value!=='object')return value;
 const previous=snapshots.get(value),old=previous?.snapshot,keys=Object.keys(value),array=Array.isArray(value);
 let next=!old||previous.count!==keys.length?(array?[]:{}):null;
 for(const key of keys){const v=capture(value[key]);if(next)next[key]=v;else if(!Object.hasOwn(old,key)||old[key]!==v){next=array?old.slice():{...old};next[key]=v}}
 if(!next)return old;
 if(old)for(const key of Object.keys(old))if(!Object.hasOwn(value,key))delete next[key];
 if(array)next.length=value.length;
 Object.freeze(next);snapshots.set(value,{snapshot:next,count:keys.length});return next;
}
export function materialize(snapshot){return typeof snapshot==='string'?JSON.parse(snapshot):structuredClone(snapshot)}

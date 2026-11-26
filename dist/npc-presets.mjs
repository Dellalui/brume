// Shared built-in NPC appearances; the map stores IDs, never image bytes.
export const NPC_PRESETS=Object.freeze([
 {id:'scout',name:'Éclaireur'}, {id:'villager',name:'Villageoise'},
 {id:'guard',name:'Garde'}, {id:'merchant',name:'Marchand'},
 {id:'bandit',name:'Bandit'}, {id:'mage',name:'Mage / guérisseur'}
]);
const known=id=>NPC_PRESETS.some(p=>p.id===id);
export const npcFrameId=(id,i)=>'preset:npc:'+id+':'+String(i).padStart(2,'0');
export function npcImageURL(id){
 if(typeof id!=='string')return null;
 const m=/^preset:npc:([a-z]+):(0[0-9]|1[0-5])$/.exec(id);
 return m&&known(m[1])?new URL('./assets/npc/'+m[1]+'-'+m[2]+'.webp',import.meta.url).href:null;
}
export function currentNpcPreset(o){
 return NPC_PRESETS.find(p=>o.frameCount===16&&o.imageId===npcFrameId(p.id,0)&&Array.from({length:16},(_,i)=>o.frames?.[i]===npcFrameId(p.id,i)).every(Boolean))?.id||'';
}
export function applyNpcPreset(o,id){
 if(!known(id))return false;
 o.npcPreset=id;o.frameCount=16;o.frames=Object.fromEntries(Array.from({length:16},(_,i)=>[i,npcFrameId(id,i)]));
 o.imageId=o.frames[0];o.frameSets={};delete o.sheetId;
 o.appearanceSource='files';o.frameOffset=0;o.tokenFixed=false;o.flat=false;o.flip=false;
 return true;
}
export function clearNpcPreset(o){
 o.npcPreset='none';
 if(npcImageURL(o.imageId))delete o.imageId;
 o.frames=Object.fromEntries(Object.entries(o.frames||{}).filter(([,id])=>!npcImageURL(id)));
 for(const [n,frames] of Object.entries(o.frameSets||{})){
  o.frameSets[n]=Object.fromEntries(Object.entries(frames||{}).filter(([,id])=>!npcImageURL(id)));
 }
 if(!Object.keys(o.frames).length&&!o.imageId)o.frameCount=1;
}
export function ensureNpcPreset(o){
 if(o.type!=='npc'||o.npcPreset!==undefined||o.imageId||o.sheetId||Object.values(o.frames||{}).some(Boolean)||Object.values(o.frameSets||{}).some(f=>Object.values(f||{}).some(Boolean)))return false;
 // Deterministic variety: does not change on reload or camera motion.
 let h=2166136261;
 for(const c of String(o.id))h=Math.imul(h^c.charCodeAt(0),16777619);
 return applyNpcPreset(o,NPC_PRESETS[(h>>>0)%NPC_PRESETS.length].id);
}

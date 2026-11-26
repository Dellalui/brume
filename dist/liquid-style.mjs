// Saved appearance belongs only to a source; flow inherits it.
export const LIQUID_PRESETS=Object.freeze([{"id":"water","kind":"water","name":"Eau naturelle","colorA":"#65b9d0","colorB":"#174c68","opacity":0.58,"speed":0.65,"glow":0},{"id":"swamp","kind":"water","name":"Eau marécageuse","colorA":"#849d4e","colorB":"#283b22","opacity":0.72,"speed":0.3,"glow":0},{"id":"toxic","kind":"water","name":"Eau toxique","colorA":"#a1e95a","colorB":"#17633b","opacity":0.64,"speed":0.55,"glow":0.18},{"id":"arcane","kind":"water","name":"Eau astrale","colorA":"#ba9ff7","colorB":"#413075","opacity":0.52,"speed":0.5,"glow":0.2},{"id":"lava","kind":"lava","name":"Lave volcanique","colorA":"#ffb044","colorB":"#49191a","opacity":1,"speed":0.38,"glow":0.72},{"id":"bluefire","kind":"lava","name":"Lave bleue","colorA":"#77d9ff","colorB":"#172958","opacity":1,"speed":0.4,"glow":0.85},{"id":"infernal","kind":"lava","name":"Lave infernale","colorA":"#ff4540","colorB":"#261222","opacity":1,"speed":0.23,"glow":0.65},{"id":"gold","kind":"lava","name":"Métal en fusion","colorA":"#ffe097","colorB":"#6c4220","opacity":1,"speed":0.26,"glow":0.45}].map(Object.freeze));
export function normalizeLiquidStyle(kind,style){
 const d=LIQUID_PRESETS.find(p=>p.id===kind)||LIQUID_PRESETS[0],s=style||{};
 const color=(v,f)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():f;
 const n=(v,f,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):f;
 return {colorA:color(s.colorA,d.colorA),colorB:color(s.colorB,d.colorB),opacity:kind==='lava'?1:n(s.opacity,d.opacity,.12,.95),speed:n(s.speed,d.speed,0,2),glow:n(s.glow,d.glow,0,1.5)};
}
export function liquidPresetName(kind,style){
 if(!style)return null;
 const key=JSON.stringify(normalizeLiquidStyle(kind,style));
 return LIQUID_PRESETS.find(p=>p.kind===kind&&JSON.stringify(normalizeLiquidStyle(kind,p))===key)?.name||null;
}
export function linearLiquidColor(hex){
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 return rgb.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
}
export function liquidVertexStyle(kind,style){
 const s=normalizeLiquidStyle(kind,style);
 return {a:linearLiquidColor(s.colorA),b:linearLiquidColor(s.colorB),params:[s.opacity,s.speed,s.glow]};
}
export function applyLiquidStyle(source,style){
 const kind=source.material;
 if(kind!=='water'&&kind!=='lava')return false;
 source.liquidStyle=normalizeLiquidStyle(kind,style);
 if(kind==='lava'&&source.light)source.light.color=source.liquidStyle.colorA;
 return true;
}

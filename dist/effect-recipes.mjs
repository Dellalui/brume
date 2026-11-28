// Serializable recipes; delays are relative to impact, never to projectile launch.
export const EFFECT_TYPES=Object.freeze([
 ['blast','Explosion','#ffb25c'],['fire','Feu','#ff6230'],['ice','Givre','#9cdeff'],['storm','Foudre','#d6edff'],['arcane','Arcane','#c08aff'],['dust','Poussière','#c2a581'],['toxic','Toxique','#b9e85b'],['holy','Sacré','#ffe3a0'],['void','Implosion','#aa7cff'],['distortion','Distorsion','#83dbea'],['blackhole','Trou noir','#ffb97a'],['shockwave','Onde de choc','#c7e4ef']
].map(([id,name,color])=>Object.freeze({id,name,color})));
export const SOUND_PROFILES=Object.freeze([['auto','Automatique (effet visuel)'],['none','Silencieux'],...EFFECT_TYPES.map(t=>[t.id,t.id==='holy'?'Explosion sainte':t.name])]);
export const SOUND_SIZES=Object.freeze([['auto','Selon la taille visuelle'],['small','Petite'],['medium','Moyenne'],['large','Grande'],['massive','Massive']]);
export function normalizeLayerSound(v={}){
 return {soundProfile:SOUND_PROFILES.some(([id])=>id===v.soundProfile)?v.soundProfile:'auto',soundSize:SOUND_SIZES.some(([id])=>id===v.soundSize)?v.soundSize:'auto',soundGain:number(v.soundGain,1,0,1),soundDelay:number(v.soundDelay,0,0,10)};
}
export const SHAPES=Object.freeze([['sphere','Sphère'],['dome','Dôme'],['ring','Anneau'],['column','Colonne'],['cone','Cône'],['cube','Cube'],['disc','Disque']].map(([id,name])=>({id,name})));
const number=(v,fallback,min,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
export function normalizeLayer(v={},i=0){const type=EFFECT_TYPES.find(t=>t.id===v.kind)||EFFECT_TYPES[0];return {id:String(v.id||'layer-'+i),kind:type.id,...normalizeLayerSound(v),enabled:v.enabled!==false,delay:number(v.delay,0,0,3600),duration:number(v.duration,3,.1,3600),size:number(v.size,1,.05,20),strength:number(v.strength,1,0,3),shape:SHAPES.some(s=>s.id===v.shape)?v.shape:'sphere',color:/^#[0-9a-f]{6}$/i.test(v.color)?v.color:type.color}}
export function normalizeLayers(layers){return (Array.isArray(layers)?layers:[]).map((l,i)=>({...normalizeLayer(l,i),id:'layer-'+i}))}
const l=(kind,delay=0,duration=3,shape='sphere',size=1,strength=1)=>normalizeLayer({kind,delay,duration,shape,size,strength});
const original=EFFECT_TYPES.slice(0,9).map((t,i)=>({id:t.id,name:['Explosion classique','Explosion de feu','Explosion de givre','Décharge de foudre','Explosion arcanique','Impact de poussière','Déflagration toxique','Éclat sacré','Implosion du néant'][i],color:t.color,symbol:['✹','✦','❋','ϟ','✧','◉','☣','✺','◎'][i],layers:[l(t.id)]}));
export const RECIPE_PRESETS=Object.freeze([...original,
 {id:'blackhole',name:'Trou noir',color:'#ffb97a',symbol:'◉',layers:[l('blackhole',0,8),l('void',0,2,'ring',1.4)]},
 {id:'heatwave',name:'Mirage thermique',color:'#f6b57c',symbol:'≈',layers:[l('distortion',0,6,'dome',1.5,.7)]},
 {id:'shockwave',name:'Onde de pression',color:'#c7e4ef',symbol:'◎',layers:[l('shockwave',0,2,'ring',1.6),l('distortion',0,1.5,'ring',1.6)]},
 {id:'supernova',name:'Supernova',color:'#ffe7ae',symbol:'✺',layers:[l('holy',0,2),l('fire',.25,4,'sphere',1.6),l('distortion',.25,2,'sphere',2),l('dust',1,5,'dome',1.8)]},
 {id:'volcano',name:'Éruption volcanique',color:'#ff5926',symbol:'▲',layers:[l('fire',0,4,'cone'),l('blast',.25,2,'column',.7),l('dust',.8,6,'column',1.4)]},
 {id:'glacial',name:'Onde glaciaire',color:'#a4e9ff',symbol:'❄',layers:[l('ice',0,4,'dome'),l('shockwave',.1,2,'ring',1.8),l('distortion',.15,2,'disc',1.5,.4)]},
 {id:'thunder',name:'Tempête électrique',color:'#91b4ff',symbol:'ϟ',layers:[l('storm',0,2,'column'),l('storm',.6,2,'sphere',1.3),l('storm',1.2,2,'ring',1.6),l('distortion',0,3,'sphere',1.6,.4)]},
 {id:'plasma',name:'Déflagration plasma',color:'#a57cff',symbol:'✧',layers:[l('arcane',0,3,'sphere'),l('fire',0,2,'ring',1.3),l('distortion',0,2,'sphere',1.5)]},
 {id:'meteor',name:'Impact de météore',color:'#ff9b50',symbol:'☄',layers:[l('blast',0,2),l('shockwave',0,2,'disc',2),l('fire',.15,4,'dome',1.4),l('dust',.4,5,'column',1.8)]},
 {id:'alchemy',name:'Nuage alchimique',color:'#ace15c',symbol:'☣',layers:[l('toxic',0,5,'dome',1.4),l('distortion',0,4,'dome',1.5,.6)]},
 {id:'judgment',name:'Jugement céleste',color:'#ffeba5',symbol:'✚',layers:[l('holy',0,4,'column'),l('holy',.5,3,'ring',1.8),l('shockwave',.5,2,'disc',2)]},
 {id:'singularity',name:'Singularité instable',color:'#b494e8',symbol:'◉',layers:[l('blackhole',0,6),l('void',4.5,1.5,'sphere',1.5),l('arcane',6,3,'cube',1.6),l('distortion',6,2,'sphere',2)]},
 {id:'sonic',name:'Triple choc sonique',color:'#c4eef4',symbol:'≋',layers:[l('shockwave',0,2,'ring'),l('shockwave',.35,2,'ring',1.4),l('shockwave',.7,2,'ring',1.8),l('distortion',0,3,'ring',2)]},
 {id:'cube',name:'Rupture cubique',color:'#ce9aff',symbol:'▣',layers:[l('arcane',0,4,'cube'),l('ice',.5,3,'cube',1.3)]},
 {id:'sandstorm',name:'Souffle des sables',color:'#cbb38b',symbol:'◌',layers:[l('dust',0,6,'cone',1.8),l('shockwave',0,2,'disc',1.6),l('distortion',0,4,'cone',1.5,.5)]}
].map(p=>Object.freeze({...p,layers:normalizeLayers(p.layers)})));
export const recipeDuration=layers=>layers.reduce((n,l)=>l.enabled===false?n:Math.max(n,l.delay+l.duration),0);
export function arrangeLayers(layers,sequential=false){let time=0;return normalizeLayers(layers).map(l=>{const next={...l,delay:sequential?time:0};if(l.enabled)time+=l.duration;return next})}

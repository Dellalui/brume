// Seeded leafless tree grammar. Every vertex occupies a logical unit cell;
// explicit reciprocal ports describe the growth graph (not every nearby cell).
// Organic geometry is independent of the material and remains editable.
const dirs=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const n=Math.abs(x)+Math.abs(y)+Math.abs(z);if(n>0&&n<3)dirs.push([x,y,z])}
const key=p=>p.join(','),clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),length=p=>Math.hypot(...p),unit=p=>p.map(x=>x/(length(p)||1)),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),r3=x=>Math.round(x*1000)/1000;
function rng(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
export const TREE_PROFILES=Object.freeze([
 {key:'small',name:'Arbre sec simple',material:'oak',seed:48,height:6,radius:.36,branches:4,reach:3,depth:2,spread:1,roots:3,budget:56},
 {key:'fork',name:'Bouleau fourchu',material:'birchwood',seed:172,height:9,radius:.27,branches:5,reach:4,depth:2,spread:.72,roots:3,budget:80,fork:true},
 {key:'tall',name:'Grand arbre mort',material:'oak',seed:530,height:10,radius:.41,branches:6,reach:5,depth:2,spread:1.12,roots:4,budget:94},
 {key:'stump',name:'Souche et racines',material:'oak',seed:99,height:2,radius:.43,branches:0,reach:2,depth:0,spread:1,roots:5,budget:32,broken:true},
 {key:'lean',name:'Tronc sinueux',material:'pinewood',seed:207,height:8,radius:.31,branches:4,reach:4,depth:2,spread:.9,roots:3,budget:73,lean:.55},
 {key:'crown',name:'Chêne sec ramifié',material:'oak',seed:882,height:9,radius:.43,branches:7,reach:5,depth:3,spread:1.35,roots:4,budget:96}
]);
// Extra presets are available to the workshop without replacing the six
// built-in schematics in existing saved worlds.
const SPECIES_PROFILES=[
 {
  "key": "oak",
  "name": "Chêne",
  "material": "oak",
  "architecture": "broadleaf",
  "height": 10,
  "radius": 0.44,
  "branches": 7,
  "reach": 5,
  "depth": 3,
  "spread": 1.35,
  "roots": 5,
  "lean": 0.2,
  "curvature": 0.76,
  "twigDensity": 0.74,
  "droop": 0,
  "seed": 1001,
  "budget": 96,
  "dominance": 0.57,
  "rootFlare": 0.7
 },
 {
  "key": "beech",
  "name": "Hêtre",
  "material": "oak",
  "architecture": "broadleaf",
  "height": 12,
  "radius": 0.36,
  "branches": 8,
  "reach": 4,
  "depth": 3,
  "spread": 1.05,
  "roots": 4,
  "lean": 0.08,
  "curvature": 0.48,
  "twigDensity": 0.82,
  "droop": 0,
  "seed": 1132,
  "budget": 96,
  "dominance": 0.57,
  "rootFlare": 0.7
 },
 {
  "key": "birch",
  "name": "Bouleau",
  "material": "birchwood",
  "architecture": "columnar",
  "height": 11,
  "radius": 0.23,
  "branches": 8,
  "reach": 3,
  "depth": 3,
  "spread": 0.85,
  "roots": 3,
  "lean": 0.21,
  "curvature": 0.62,
  "twigDensity": 0.85,
  "droop": 0.2,
  "seed": 1263,
  "budget": 96,
  "dominance": 0.9,
  "rootFlare": 0.45
 },
 {
  "key": "maple",
  "name": "Érable",
  "material": "oak",
  "architecture": "broadleaf",
  "height": 9,
  "radius": 0.33,
  "branches": 8,
  "reach": 4,
  "depth": 3,
  "spread": 1.4,
  "roots": 4,
  "lean": 0.23,
  "curvature": 0.57,
  "twigDensity": 0.92,
  "droop": 0,
  "seed": 1394,
  "budget": 96,
  "dominance": 0.57,
  "rootFlare": 0.7
 },
 {
  "key": "ash-tree",
  "name": "Frêne",
  "material": "oak",
  "architecture": "broadleaf",
  "height": 12,
  "radius": 0.32,
  "branches": 7,
  "reach": 4,
  "depth": 3,
  "spread": 1.12,
  "roots": 3,
  "lean": 0.13,
  "curvature": 0.5,
  "twigDensity": 0.8,
  "droop": 0,
  "seed": 1525,
  "budget": 96,
  "dominance": 0.57,
  "rootFlare": 0.7
 },
 {
  "key": "poplar",
  "name": "Peuplier",
  "material": "birchwood",
  "architecture": "columnar",
  "height": 15,
  "radius": 0.24,
  "branches": 9,
  "reach": 2,
  "depth": 2,
  "spread": 0.52,
  "roots": 3,
  "lean": 0.08,
  "curvature": 0.31,
  "twigDensity": 0.65,
  "droop": 0,
  "seed": 1656,
  "budget": 96,
  "dominance": 0.9,
  "rootFlare": 0.45
 },
 {
  "key": "chestnut",
  "name": "Châtaignier",
  "material": "oak",
  "architecture": "broadleaf",
  "height": 11,
  "radius": 0.46,
  "branches": 7,
  "reach": 5,
  "depth": 3,
  "spread": 1.37,
  "roots": 5,
  "lean": 0.3,
  "curvature": 0.7,
  "twigDensity": 0.8,
  "droop": 0,
  "seed": 1787,
  "budget": 96,
  "dominance": 0.57,
  "rootFlare": 0.7
 },
 {
  "key": "linden",
  "name": "Tilleul",
  "material": "oak",
  "architecture": "broadleaf",
  "height": 10,
  "radius": 0.36,
  "branches": 9,
  "reach": 4,
  "depth": 3,
  "spread": 1.27,
  "roots": 4,
  "lean": 0.12,
  "curvature": 0.47,
  "twigDensity": 0.9,
  "droop": 0,
  "seed": 1918,
  "budget": 96,
  "dominance": 0.57,
  "rootFlare": 0.7
 },
 {
  "key": "olive",
  "name": "Olivier",
  "material": "oak",
  "architecture": "broadleaf",
  "height": 5,
  "radius": 0.39,
  "branches": 7,
  "reach": 3,
  "depth": 3,
  "spread": 1.6,
  "roots": 4,
  "lean": 0.69,
  "curvature": 0.9,
  "twigDensity": 0.8,
  "droop": 0,
  "seed": 2049,
  "budget": 96,
  "dominance": 0.57,
  "rootFlare": 0.7
 },
 {
  "key": "apple",
  "name": "Pommier",
  "material": "oak",
  "architecture": "broadleaf",
  "height": 6,
  "radius": 0.26,
  "branches": 7,
  "reach": 3,
  "depth": 3,
  "spread": 1.45,
  "roots": 3,
  "lean": 0.35,
  "curvature": 0.7,
  "twigDensity": 0.95,
  "droop": 0,
  "seed": 2180,
  "budget": 96,
  "dominance": 0.57,
  "rootFlare": 0.7
 },
 {
  "key": "cherry",
  "name": "Cerisier",
  "material": "oak",
  "architecture": "broadleaf",
  "height": 8,
  "radius": 0.29,
  "branches": 7,
  "reach": 4,
  "depth": 3,
  "spread": 1.25,
  "roots": 3,
  "lean": 0.25,
  "curvature": 0.62,
  "twigDensity": 0.86,
  "droop": 0,
  "seed": 2311,
  "budget": 96,
  "dominance": 0.57,
  "rootFlare": 0.7
 },
 {
  "key": "fir",
  "name": "Sapin",
  "material": "pinewood",
  "architecture": "conifer",
  "height": 14,
  "radius": 0.34,
  "branches": 10,
  "reach": 4,
  "depth": 2,
  "spread": 1.05,
  "roots": 3,
  "lean": 0.06,
  "curvature": 0.25,
  "twigDensity": 0.8,
  "droop": 0.24,
  "seed": 2442,
  "budget": 96,
  "dominance": 0.9,
  "rootFlare": 0.45
 },
 {
  "key": "spruce",
  "name": "Épicéa",
  "material": "pinewood",
  "architecture": "conifer",
  "height": 16,
  "radius": 0.31,
  "branches": 10,
  "reach": 4,
  "depth": 3,
  "spread": 1.15,
  "roots": 3,
  "lean": 0.05,
  "curvature": 0.22,
  "twigDensity": 0.9,
  "droop": 0.45,
  "seed": 2573,
  "budget": 96,
  "dominance": 0.9,
  "rootFlare": 0.45
 },
 {
  "key": "scots-pine",
  "name": "Pin sylvestre",
  "material": "pinewood",
  "architecture": "umbrella",
  "height": 12,
  "radius": 0.31,
  "branches": 8,
  "reach": 5,
  "depth": 2,
  "spread": 1.4,
  "roots": 4,
  "lean": 0.35,
  "curvature": 0.63,
  "twigDensity": 0.6,
  "droop": 0,
  "seed": 2704,
  "budget": 96,
  "dominance": 0.75,
  "rootFlare": 0.45
 },
 {
  "key": "larch",
  "name": "Mélèze",
  "material": "pinewood",
  "architecture": "conifer",
  "height": 13,
  "radius": 0.27,
  "branches": 10,
  "reach": 3,
  "depth": 3,
  "spread": 1.12,
  "roots": 3,
  "lean": 0.12,
  "curvature": 0.42,
  "twigDensity": 0.9,
  "droop": 0.35,
  "seed": 2835,
  "budget": 96,
  "dominance": 0.9,
  "rootFlare": 0.45
 },
 {
  "key": "cedar",
  "name": "Cèdre",
  "material": "pinewood",
  "architecture": "conifer",
  "height": 12,
  "radius": 0.45,
  "branches": 9,
  "reach": 6,
  "depth": 2,
  "spread": 1.5,
  "roots": 5,
  "lean": 0.12,
  "curvature": 0.42,
  "twigDensity": 0.7,
  "droop": 0.3,
  "seed": 2966,
  "budget": 96,
  "dominance": 0.9,
  "rootFlare": 0.45
 },
 {
  "key": "cypress",
  "name": "Cyprès",
  "material": "pinewood",
  "architecture": "columnar",
  "height": 15,
  "radius": 0.25,
  "branches": 9,
  "reach": 2,
  "depth": 2,
  "spread": 0.5,
  "roots": 2,
  "lean": 0.05,
  "curvature": 0.22,
  "twigDensity": 0.72,
  "droop": 0,
  "seed": 3097,
  "budget": 96,
  "dominance": 0.9,
  "rootFlare": 0.45
 },
 {
  "key": "cut-trunk",
  "name": "Tronc coupé debout",
  "material": "oak",
  "architecture": "cut",
  "height": 4,
  "radius": 0.4,
  "branches": 0,
  "reach": 1,
  "depth": 0,
  "spread": 1,
  "roots": 2,
  "lean": 0.08,
  "curvature": 0.12,
  "twigDensity": 0,
  "droop": 0,
  "seed": 3228,
  "budget": 96,
  "dominance": 0.75,
  "rootFlare": 0.45,
  "tipStyle": "broken",
  "structureVariation": 0
 },
 {
  "key": "fallen-log",
  "name": "Tronc abattu",
  "material": "oak",
  "architecture": "log",
  "height": 5,
  "radius": 0.41,
  "branches": 0,
  "reach": 1,
  "depth": 0,
  "spread": 1,
  "roots": 0,
  "lean": 0,
  "curvature": 0,
  "twigDensity": 0,
  "droop": 0,
  "seed": 3359,
  "budget": 96,
  "dominance": 0.75,
  "rootFlare": 0.45,
  "tipStyle": "broken",
  "structureVariation": 0
 },
 {
  "key": "cut-log",
  "name": "Bûche coupée",
  "material": "oak",
  "architecture": "log",
  "height": 2,
  "radius": 0.27,
  "branches": 0,
  "reach": 1,
  "depth": 0,
  "spread": 1,
  "roots": 0,
  "lean": 0,
  "curvature": 0,
  "twigDensity": 0,
  "droop": 0,
  "seed": 3490,
  "budget": 96,
  "dominance": 0.75,
  "rootFlare": 0.45,
  "tipStyle": "broken",
  "structureVariation": 0
 },
 {
  "key": "snag",
  "name": "Chicot de bois mort",
  "material": "oak",
  "architecture": "dead",
  "height": 7,
  "radius": 0.33,
  "branches": 4,
  "reach": 2,
  "depth": 1,
  "spread": 0.8,
  "roots": 3,
  "lean": 0.38,
  "curvature": 0.75,
  "twigDensity": 0.2,
  "droop": 0,
  "seed": 3621,
  "budget": 96,
  "dominance": 0.75,
  "rootFlare": 0.45,
  "tipStyle": "broken",
  "structureVariation": 0
 }
];
export const TREE_GENERATOR_PROFILES=Object.freeze([...TREE_PROFILES,
 {key:'willow',name:'Saule dénudé',material:'oak',seed:413,height:8,radius:.36,branches:6,reach:5,depth:2,spread:1.55,roots:4,budget:96,droop:.85,curvature:.95},
 {key:'pine',name:'Pin dénudé',material:'pinewood',seed:618,height:12,radius:.31,branches:7,reach:3,depth:2,spread:1.05,roots:3,budget:96,droop:.24},
 {key:'young',name:'Jeune arbre',material:'birchwood',seed:391,height:5,radius:.13,branches:4,reach:2,depth:1,spread:.85,roots:1,budget:32,lean:.35},
 ...SPECIES_PROFILES
]);
export function normalizeTreeConfig(input={}){
 const base=TREE_GENERATOR_PROFILES.find(p=>p.key===input.key)||TREE_GENERATOR_PROFILES[0];
 const number=(k,lo,hi,f,integer=false)=>{const v=input[k];const n=clamp(v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):f,lo,hi);return integer?Math.round(n):r3(n)};
 const budget=number('budget',12,96,base.budget,true),height=number('height',2,Math.min(16,budget),base.height,true);
 const tipStyle=['mixed','round','broken','taper'].includes(input.tipStyle)?input.tipStyle:(base.tipStyle||'mixed');
 const kinds=['broadleaf','columnar','conifer','umbrella','cut','log','dead'];const architecture=kinds.includes(input.architecture)?input.architecture:base.architecture||({pine:'conifer',fork:'columnar',stump:'cut',tall:'dead',small:'dead'}[base.key]||'broadleaf');
 return {key:base.key,name:String(input.name||base.name).trim().slice(0,60)||base.name,material:String(input.material||base.material),seed:number('seed',0,4294967295,base.seed,true),height,radius:number('radius',.065,.46,base.radius),branches:number('branches',0,10,base.branches,true),reach:number('reach',1,8,base.reach,true),depth:number('depth',0,3,base.depth,true),spread:number('spread',.5,1.8,base.spread),roots:number('roots',0,6,base.roots,true),budget,lean:number('lean',0,1.2,base.lean??.17),curvature:number('curvature',0,1,base.curvature??.6),taper:number('taper',.5,1.5,1),droop:number('droop',0,1,base.droop??0),tipStyle,architecture,twigDensity:number('twigDensity',0,1,base.twigDensity??.68),dominance:number('dominance',0,1,base.dominance??.65),asymmetry:number('asymmetry',0,1,.55),irregularity:number('irregularity',0,1,.55),rootFlare:number('rootFlare',0,1,base.rootFlare??.5),flexibility:number('flexibility',0,1,.6),spacing:number('spacing',.01,.35,.055),structureVariation:number('structureVariation',0,30,base.structureVariation??10,true),broken:!!base.broken||architecture==='cut'||architecture==='log',fork:!!base.fork};
}
export function generateLeaflessTree(profile,seed=profile.seed){
 profile=normalizeTreeConfig({...profile,seed});seed=profile.seed;
 const rand=rng(seed),nodes=[],occupied=new Map(),limit=clamp(profile.budget||96,8,96);
 const maxZ=Math.min(23,profile.height+7),jitter=()=>r3((rand()-.5)*.36*profile.curvature*(.5+profile.irregularity));
 function add(pos,r,parent=null,root=false){
  if(nodes.length>=limit||occupied.has(key(pos)))return null;
  const radius=r3(clamp(r,.013,.46)),node={pos:[...pos],radius,offset:[jitter(),jitter(),root?0:jitter()*.65],root,tip:'round',ports:[],children:[]};
  nodes.push(node);occupied.set(key(pos),node);
  if(parent){const dir=pos.map((x,i)=>x-parent.pos[i]);parent.ports.push(dir);node.ports.push(dir.map(x=>-x));parent.children.push(node)}
  return node;
 }
 function step(node,wanted,r,previous,ground=false,vertical=false){
  let best=null,score=-Infinity;const dir=unit(wanted);
  for(const d of dirs){
   if(ground&&d[2]!==0||vertical&&d[2]!==1)continue;
   const p=node.pos.map((x,i)=>x+d[i]);if(p[2]<0||p[2]>maxZ||Math.abs(p[0])>13||Math.abs(p[1])>13||occupied.has(key(p)))continue;
   const heading=unit(d),fit=dot(heading,dir),smooth=previous?dot(heading,unit(previous))*.25:0;
   if(fit<.05||previous&&dot(heading,unit(previous))<.15)continue;const q=fit+smooth+rand()*.17;if(q>score){score=q;best=p}
  }
  return best?add(best,r,node):null;
 }
 if(profile.architecture==='log'){
  let prev=null;for(let i=0;i<profile.height;i++){const n=add([i,0,0],profile.radius*(1-.12*i/profile.height),prev,i===0);n.offset=[0,0,profile.radius-.5];n.tip='broken';prev=n}return nodes;
 }
 const root=add([0,0,0],profile.radius,null,true),trunk=[root];
 let angle=rand()*Math.PI*2,lean=profile.lean;
 for(let i=1;i<profile.height;i++){
  angle+=(rand()-.5)*1.2*profile.curvature;
  const taper=1-i/(profile.height+1),r=profile.architecture==='cut'?profile.radius*(1-.12*i/profile.height):profile.radius*(.10+.90*Math.pow(taper,.86*profile.taper)),prev=trunk.at(-1);
  const next=step(prev,[Math.cos(angle)*lean,Math.sin(angle)*lean,1],r,null,false,true);
  if(!next)break;trunk.push(next);
 }
 trunk.at(-1).tip=profile.tipStyle!=='mixed'?profile.tipStyle:profile.broken?'broken':rand()<.38?'round':'taper';
 const turn=2.399963229728653,rootAngle=rand()*Math.PI*2;
 for(let i=0;i<profile.roots;i++){
  const a=rootAngle+i*turn,run=profile.broken?2+(i%2):1+(i%2);let n=root,previous=null;
  for(let k=0;k<run;k++){const b=a+(rand()-.5)*.4,old=n,p=step(n,[Math.cos(b),Math.sin(b),0],profile.radius*.49*Math.pow(.55,k),previous,true);if(!p)break;p.offset[2]=-.13;n=p;previous=n.pos.map((x,j)=>x-old.pos[j])}
  if(n!==root)n.tip='taper';
 }
 // Branch recursively, changing direction a little along the way. Major
 // limbs get longer runs, then smaller secondary branches and fine twigs.
 const secondary=[];
 function grow(parent,a,rise,count,startRadius,depth,order=0){
  if(nodes.length>=limit||count<1)return;
  let n=parent,prev=null,heading=a;const chain=[];
  for(let i=0;i<count;i++){
   heading+=(rand()-.5)*(order?1.35:.9)*profile.curvature*(.5+profile.flexibility*.5);
   const slope=rise+(rand()-.5)*.43+(i/count)*(.19-profile.droop*1.7),r=startRadius*Math.pow(.32,i/Math.max(1,count-1)*profile.taper);
   const old=n,p=step(n,[Math.cos(heading),Math.sin(heading),slope],r,prev);
   if(!p)break;n=p;prev=n.pos.map((x,k)=>x-old.pos[k]);chain.push({n,heading});
  }
  if(!chain.length)return;
  // Keep the seeded random stream/topology unchanged. Mixed now means
  // two natural terminal styles, not random saw cuts.
  n.tip=profile.tipStyle!=='mixed'?profile.tipStyle:rand()<.19&&n.radius>.045?'taper':rand()<.22?'round':'taper';
  if(!depth||chain.length<2)return;
  const forks=profile.twigDensity===0?0:order===0?(profile.twigDensity>.75?3:2):profile.twigDensity>.78?2:1;
  for(let j=0;j<forks;j++){
   const i=clamp(Math.floor((j+1)*chain.length/(forks+1)),0,chain.length-1),q=chain[i],sign=(j+order)%2?1:-1;
   secondary.push([q.n,q.heading+sign*(.65+rand()*.85),rise*.63+.28+(rand()-.5)*.35-profile.droop*.5,Math.max(1,Math.round(count*(.48+rand()*.20))),q.n.radius*(.43+rand()*.19),depth-1,order+1]);
  }
 }
 const start=rand()*Math.PI*2;
 for(let i=0;i<profile.branches;i++){
  const conifer=profile.architecture==='conifer',umbrella=profile.architecture==='umbrella',columnar=profile.architecture==='columnar',fraction=i/Math.max(1,profile.branches-1);const at=clamp(Math.floor(((conifer?.19:umbrella?.62:.30)+(conifer?.72:umbrella?.28:.61)*fraction)*(trunk.length-1)),1,trunk.length-1),parent=trunk[at];
  const a=start+i*turn+(rand()-.5)*(.15+profile.asymmetry),rise=conifer?.04+rand()*.18:columnar?.95+rand()*.6:(profile.fork?.78:.32)+rand()*.47;
  const count=clamp(Math.round(profile.reach*(conifer?1.25-.97*fraction:1.1-.24*fraction)*(.82+rand()*.34)),1,8);
  grow(parent,a,rise/profile.spread,count,parent.radius*(.44+rand()*.22)*(1.1-.35*profile.dominance),profile.depth,0);
 }
 // Give every primary limb a chance before spending the remaining budget
 // on smaller branches. The queue also distributes higher branch orders.
 for(let i=0;i<secondary.length&&nodes.length<limit;i++)grow(...secondary[i]);
 // A terminal that became a fork must not still carry its old free tip.
 for(const n of nodes)if(n.children.length)n.tip='round';
 return nodes;
}
export function treeForm(radius){return radius>.355?'trunk-connected':radius>.265?'pillar-connected':radius>.17?'branch-connected':radius>.095?'pillar-thin-connected':'rod-connected'}

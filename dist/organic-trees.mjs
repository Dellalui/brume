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
export const TREE_GENERATOR_PROFILES=Object.freeze([...TREE_PROFILES,
 {key:'willow',name:'Saule dénudé',material:'oak',seed:413,height:8,radius:.36,branches:6,reach:5,depth:2,spread:1.55,roots:4,budget:96,droop:.85,curvature:.95},
 {key:'pine',name:'Pin dénudé',material:'pinewood',seed:618,height:12,radius:.31,branches:7,reach:3,depth:2,spread:1.05,roots:3,budget:96,droop:.24},
 {key:'young',name:'Jeune arbre',material:'birchwood',seed:391,height:5,radius:.13,branches:4,reach:2,depth:1,spread:.85,roots:1,budget:32,lean:.35}
]);
export function normalizeTreeConfig(input={}){
 const base=TREE_GENERATOR_PROFILES.find(p=>p.key===input.key)||TREE_GENERATOR_PROFILES[0];
 const number=(k,lo,hi,f,integer=false)=>{const v=input[k];const n=clamp(v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):f,lo,hi);return integer?Math.round(n):r3(n)};
 const budget=number('budget',12,96,base.budget,true),height=number('height',2,Math.min(16,budget),base.height,true);
 const tipStyle=['mixed','round','broken','taper'].includes(input.tipStyle)?input.tipStyle:'mixed';
 return {key:base.key,name:String(input.name||base.name).trim().slice(0,60)||base.name,material:String(input.material||base.material),seed:number('seed',0,4294967295,base.seed,true),height,radius:number('radius',.065,.46,base.radius),branches:number('branches',0,10,base.branches,true),reach:number('reach',1,8,base.reach,true),depth:number('depth',0,3,base.depth,true),spread:number('spread',.5,1.8,base.spread),roots:number('roots',0,6,base.roots,true),budget,lean:number('lean',0,1.2,base.lean??.17),curvature:number('curvature',0,1,base.curvature??.6),taper:number('taper',.5,1.5,1),droop:number('droop',0,1,base.droop??0),tipStyle,broken:!!base.broken,fork:!!base.fork};
}
export function generateLeaflessTree(profile,seed=profile.seed){
 profile=normalizeTreeConfig({...profile,seed});seed=profile.seed;
 const rand=rng(seed),nodes=[],occupied=new Map(),limit=clamp(profile.budget||96,8,96);
 const maxZ=Math.min(23,profile.height+7),jitter=()=>r3((rand()-.5)*.36*profile.curvature);
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
   if(fit<.05)continue;const q=fit+smooth+rand()*.17;if(q>score){score=q;best=p}
  }
  return best?add(best,r,node):null;
 }
 const root=add([0,0,0],profile.radius,null,true),trunk=[root];
 let angle=rand()*Math.PI*2,lean=profile.lean;
 for(let i=1;i<profile.height;i++){
  angle+=(rand()-.5)*1.2*profile.curvature;
  const taper=1-i/(profile.height+1),r=profile.radius*(.10+.90*Math.pow(taper,.86*profile.taper)),prev=trunk.at(-1);
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
   heading+=(rand()-.5)*(order?1.80:1.16)*profile.curvature;
   const slope=rise+(rand()-.5)*.43+(i/count)*(.19-profile.droop*1.7),r=startRadius*Math.pow(.32,i/Math.max(1,count-1)*profile.taper);
   const old=n,p=step(n,[Math.cos(heading),Math.sin(heading),slope],r,prev);
   if(!p)break;n=p;prev=n.pos.map((x,k)=>x-old.pos[k]);chain.push({n,heading});
  }
  if(!chain.length)return;
  // Keep the seeded random stream/topology unchanged. Mixed now means
  // two natural terminal styles, not random saw cuts.
  n.tip=profile.tipStyle!=='mixed'?profile.tipStyle:rand()<.19&&n.radius>.045?'taper':rand()<.22?'round':'taper';
  if(!depth||chain.length<2)return;
  const forks=order===0?2:1;
  for(let j=0;j<forks;j++){
   const i=clamp(Math.floor((j+1)*chain.length/(forks+1)),0,chain.length-1),q=chain[i],sign=(j+order)%2?1:-1;
   secondary.push([q.n,q.heading+sign*(.65+rand()*.85),rise*.63+.28+(rand()-.5)*.35-profile.droop*.5,Math.max(1,Math.round(count*(.48+rand()*.20))),q.n.radius*(.43+rand()*.19),depth-1,order+1]);
  }
 }
 const start=rand()*Math.PI*2;
 for(let i=0;i<profile.branches;i++){
  const at=clamp(Math.floor((.37+.54*i/Math.max(1,profile.branches-1))*(trunk.length-1)),1,trunk.length-1),parent=trunk[at];
  const a=start+i*turn+(rand()-.5)*.6,rise=(profile.fork?.78:.32)+rand()*.47;
  const count=clamp(Math.round(profile.reach*(1.1-.24*i/Math.max(1,profile.branches-1))*(.82+rand()*.34)),1,8);
  grow(parent,a,rise/profile.spread,count,parent.radius*(.55+rand()*.16),profile.depth,0);
 }
 // Give every primary limb a chance before spending the remaining budget
 // on smaller branches. The queue also distributes higher branch orders.
 for(let i=0;i<secondary.length&&nodes.length<limit;i++)grow(...secondary[i]);
 // A terminal that became a fork must not still carry its old free tip.
 for(const n of nodes)if(n.children.length)n.tip='round';
 return nodes;
}
export function treeForm(radius){return radius>.355?'trunk-connected':radius>.265?'pillar-connected':radius>.17?'branch-connected':radius>.095?'pillar-thin-connected':'rod-connected'}

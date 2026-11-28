// Deterministic local growth steering. Existing scenery is never mutated
// by a preview or by planting a new tree.
import * as W from './world.mjs';
import {validTreeGraph,treeExtent,treeTipEnd} from './unified-trees.mjs';
import {treeConstructionBoxes,boxIntersects} from './tree-construction-collision.mjs';
const plans=new WeakMap(),lastPlan=new WeakMap(),round=x=>Math.round(x*10000)/10000;
const organic=o=>o?.type==='tree'&&validTreeGraph(o.treeGraph);
const sub=(a,b)=>a.map((x,i)=>x-b[i]),add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,s)=>a.map(x=>x*s),len=a=>Math.hypot(...a),unit=a=>mul(a,1/Math.max(1e-8,len(a))),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function withGraph(o,g){if(g===o.treeGraph)return o;const c=W.center(o),e=treeExtent(g);return {...o,...e,x:c.x-e.w/2,y:c.y-e.d/2,treeGraph:g}}
function obstacleQuery(map,o){
 const c=W.center(o),z=W.elevation(o,map),a=o.facing||0,co=Math.cos(a),si=Math.sin(a),reach=Math.hypot(o.w,o.d)/2+3;
 const world=p=>[c.x+p[0]*co-p[1]*si,c.y+p[0]*si+p[1]*co,z+p[2]];
 const bins=new Map(),cell=4,key=(x,y)=>x+','+y;
 function insert(b){for(let x=Math.floor(b.x/cell);x<=Math.floor((b.x+b.w)/cell);x++)for(let y=Math.floor(b.y/cell);y<=Math.floor((b.y+b.d)/cell);y++){const k=key(x,y);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(b)}}
 for(const t of map.objects){
  if(t.id===o.id||t.blocking===false||W.character(t))continue;
  if((t.type==='door'||t.type==='build_door')&&t.open)continue;
  const b=W.bounds(t),tz=W.elevation(t,map);
  if(b.x>c.x+reach||b.x+b.w<c.x-reach||b.y>c.y+reach||b.y+b.h<c.y-reach||tz+(t.height||1)<z||tz>z+o.height+3)continue;
  if(t.type==='tree'){for(const box of treeConstructionBoxes(t,tz))insert(box)}
  else insert({x:b.x,y:b.y,w:b.w,d:b.h,baseZ:tz,height:t.height||1});
 }
 function blocked(b){
  if(b.baseZ+b.height>32||b.x<0||b.y<0||b.x+b.w>map.width||b.y+b.d>map.height)return true;
  const seen=new Set();
  for(let x=Math.floor(b.x/cell);x<=Math.floor((b.x+b.w)/cell);x++)for(let y=Math.floor(b.y/cell);y<=Math.floor((b.y+b.d)/cell);y++)for(const v of bins.get(key(x,y))||[]){if(seen.has(v))continue;seen.add(v);if(boxIntersects(b,v))return true}
  for(let x=Math.floor(b.x);x<Math.ceil(b.x+b.w);x++)for(let y=Math.floor(b.y);y<Math.ceil(b.y+b.d);y++){
   if(!W.activeCell(map,x,y))return true;
   if(b.baseZ<W.groundAt(map,x,y)-.0001)return true;
   for(const [base,material] of Object.entries(map.blocks?.[W.cellKey(x,y)]||{})){
    if(W.BLOCKS[material]?.solid===false)continue;
    if(boxIntersects(b,{x,y,w:1,d:1,baseZ:+base,height:W.blockSize(map,x,y,+base)}))return true;
   }
  }
  return false;
 }
 // Same conservative edge envelope as construction collision. Ground contact
 // is allowed but a raised neighboring column remains a real obstacle.
 function edge(p,q,r,terminal=false){
  const a=world(p),b=world(q),margin=r+.20*len(sub(q,p))+.035+(terminal?.09:0);
  const x=Math.min(a[0],b[0])-margin,y=Math.min(a[1],b[1])-margin,baseZ=Math.max(z,Math.min(a[2],b[2])-margin);
  return blocked({x,y,w:Math.abs(a[0]-b[0])+2*margin,d:Math.abs(a[1]-b[1])+2*margin,baseZ,height:Math.max(a[2],b[2])+margin-baseZ});
 }
 function tipClear(n,p){
  const tip=treeTipEnd(n,p);if(!tip)return true;
  const a=world(n),b=world(tip.point),r=n[3]+.08;
  const x=Math.min(a[0],b[0])-r,y=Math.min(a[1],b[1])-r,baseZ=Math.max(z,Math.min(a[2],b[2])-r);
  return !blocked({x,y,w:Math.abs(a[0]-b[0])+2*r,d:Math.abs(a[1]-b[1])+2*r,baseZ,height:Math.max(a[2],b[2])+r-baseZ});
 }
 return {edge,blocked,tipClear};
}
function solve(map,o){
 const fail=error=>({tree:o,replacements:new Map(),error}),query=obstacleQuery(map,o);
 const clear=t=>treeConstructionBoxes(t,W.elevation(t,map)).every(b=>!query.blocked(b));
 if(clear(o))return {tree:o,replacements:new Map(),error:''};
 if(o.treeConfig?.adaptCrowns===false)return fail('Un obstacle occupe la couronne de cet arbre.');
 const original=o.treeGraph,root=original[0].slice(),g=[root],ids=new Map([[0,0]]),terminated=new Set(),source=[0],forcedTips=new Set();
 const children=new Map();for(let i=1;i<original.length;i++){const p=original[i][4];if(!children.has(p))children.set(p,[]);children.get(p).push(i)}
 if(root[5]!=='broken'&&query.edge([root[0],root[1],0],root,Math.min(.55,root[3]*1.22)+.08))return fail('La base du tronc est obstruée.');
 const steer=(d,angle,lift)=>[d[0]*Math.cos(angle)-d[1]*Math.sin(angle),d[0]*Math.sin(angle)+d[1]*Math.cos(angle),d[2]+lift];
 for(let i=1;i<original.length;i++){
  const n=original[i],oldParent=original[n[4]],pi=ids.get(n[4]);
  if(pi===undefined||terminated.has(n[4]))continue;
  const p=g[pi],direction=sub(n.slice(0,3),oldParent.slice(0,3)),length=len(direction),u=unit(direction),terminal=!children.has(i);
  const incoming=p[4]>=0?unit(sub(p.slice(0,3),g[p[4]].slice(0,3))):u;
  const trunk=n[3]>.23&&direction[2]>.55*length;
  let best=null;
  // Try the original direction, then modest horizontal turns, upward and
  // downward deflections, and only then smaller lengths. Never create cuts.
  for(const scale of [1,.85,.65,.42,.24]){
   if(trunk&&scale<.65)break;
   const candidates=[];
   for(const angle of [0,.28,-.28,.56,-.56,.95,-.95,1.35,-1.35])for(const lift of [0,.35,-.35,.70,-.70]){
    if(trunk&&(Math.abs(angle)>1||lift<-.35))continue;
    const v=unit(steer(u,angle,lift));
    if(len(v)<.5||dot(v,u)<.15)continue;
    const pos=add(p.slice(0,3),mul(v,length*scale)).map(round);pos[2]=Math.max(.02,pos[2]);
    if(len(sub(pos,p.slice(0,3)))<=.115||pos[2]>24.6||Math.abs(pos[0])>29||Math.abs(pos[1])>29)continue;
    const r=round(Math.max(.013,n[3]*(scale<.65?.65:1)));
    const score=dot(v,u)*3+dot(v,incoming)*.55-Math.abs(lift)*.18-Math.abs(angle)*.08;
    candidates.push({pos,r,score,scale});
   }
   candidates.sort((a,b)=>b.score-a.score);
   for(const q of candidates){if(!query.edge(p,q.pos,Math.max(p[3],q.r),terminal)){best=q;break}}
   if(best)break;
  }
  if(!best){if(trunk)return fail('Espace insuffisant pour le tronc.');continue}
  const shortened=best.scale<.65,tip=shortened?'taper':n[5],index=g.length;
  if(best.scale<.999||len(sub(best.pos,add(p.slice(0,3),direction)))>.001)forcedTips.add(index);
  ids.set(i,index);source.push(i);g.push([...best.pos,best.r,pi,tip]);if(shortened)terminated.add(i);
 }
 if(g.length<2)return fail('Espace insuffisant pour cet arbre.');
 // Walk from the tips towards the root. A node becomes a natural end
 // whenever obstacle steering removed its continuation, even if the
 // original graph marked it as a deliberate broken branch.
 const childCount=Array(g.length).fill(0),dropped=new Set();
 for(const n of g.slice(1))childCount[n[4]]++;
 for(let i=g.length-1;i>0;i--){
  if(childCount[i])continue;
  const n=g[i],p=g[n[4]],d=sub(n.slice(0,3),p.slice(0,3));
  const interrupted=forcedTips.has(i)||children.has(source[i]);
  if(!interrupted&&(n[5]==='broken'||query.tipClear(n,p)))continue;
  // The preceding edge itself now tapers, rather than leaving a thick
  // cylinder with a tiny cone glued to its end. Re-test the actual tip
  // before accepting it, including the final mesh extension.
  let found=false;
  for(const scale of [1,.85,.65,.45,.25]){
   const pos=add(p.slice(0,3),mul(d,scale)).map(round);
   if(len(sub(pos,p.slice(0,3)))<=.115)continue;
   const radius=round(Math.max(.013,Math.min(n[3],p[3]*.32)*Math.sqrt(scale)));
   const tip=[...pos,radius,n[4],'taper'];
   if(query.edge(p,tip,Math.max(p[3],radius))||!query.tipClear(tip,p))continue;
   g[i]=tip;found=true;break;
  }
  // If there is no room even for a short taper, omit just this terminal
  // segment and let its parent form a tip if it has no other children.
  if(!found){dropped.add(i);childCount[n[4]]--;}
 }
 const remap=new Map(),final=[];
 for(let i=0;i<g.length;i++){
  if(dropped.has(i))continue;
  const n=g[i].slice();if(i>0)n[4]=remap.get(n[4]);
  remap.set(i,final.length);final.push(n);
 }
 if(!validTreeGraph(final))return fail('Espace insuffisant pour cet arbre.');
 const fitted=withGraph(o,final);
 if(!clear(fitted))return fail('Espace insuffisant pour contourner les obstacles.');
 return {tree:fitted,replacements:new Map(),error:''};
}
export function planTreePlanting(map,o){
 if(!map||!organic(o))return o;
 const c=W.center(o),key=[map.buildRevision||0,map.blockRevision||0,c.x,c.y,o.baseZ,o.facing,o.treeConfig?.adaptCrowns!==false].join(','),prev=lastPlan.get(map);
 let plan=prev?.key===key&&prev.graph===o.treeGraph&&prev.objects===map.objects?prev.plan:null;
 if(!plan){plan=solve(map,o);lastPlan.set(map,{key,graph:o.treeGraph,objects:map.objects,plan})}
 const tree={...o,...plan.tree,id:o.id};plans.set(tree,{replacements:plan.replacements,error:plan.error,adapted:plan.tree.treeGraph!==o.treeGraph});return tree;
}
export const treePlantingPlan=o=>plans.get(o);
export function applyTreePlanting(map,objects){/* Existing trees remain unchanged. */}

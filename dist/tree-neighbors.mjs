// Local, deterministic crown separation. Preview never edits the map.
// Each conflicting pair gets a horizontal boundary between their trunks.
// Branches that would cross it are shortened, preserving the growth graph.
import * as W from './world.mjs';
import {validTreeGraph,treeExtent} from './unified-trees.mjs';
import {treeConstructionBoxes,boxIntersects} from './tree-construction-collision.mjs';
const GAP=.10,plans=new WeakMap(),lastPlan=new WeakMap(),round=x=>Math.round(x*10000)/10000;
const organic=o=>o?.type==='tree'&&validTreeGraph(o.treeGraph);
function withGraph(o,g){
 if(g===o.treeGraph)return o;
 const center=W.center(o),e=treeExtent(g);
 return {...o,...e,x:center.x-e.w/2,y:center.y-e.d/2,treeGraph:g};
}
function projected(o,n,axis){const c=W.center(o),a=o.facing||0,co=Math.cos(a),si=Math.sin(a);return axis===0?c.x+n[0]*co-n[1]*si:c.y+n[0]*si+n[1]*co}
export function shortenCrown(o,axis,sign,boundary,extra=0){
 const g=o.treeGraph;if(!validTreeGraph(g))return o;
 // A modest halo covers the curved interpolant and the construction boxes.
 const p=n=>sign*(projected(o,n,axis)-boundary),out=[g[0].slice()],ids=new Map([[0,0]]),terminal=new Set();
 let changed=false;
 for(let i=1;i<g.length;i++){
  const n=g[i],parent=g[n[4]],pi=ids.get(n[4]);if(pi===undefined||terminal.has(n[4])){changed=true;continue}
  const length=Math.hypot(n[0]-parent[0],n[1]-parent[1],n[2]-parent[2]),margin=Math.max(n[3],parent[3])+.20*length+.035+extra;
  const a=p(parent)+margin,b=p(n)+margin;
  let q=n.slice();q[4]=pi;
  if(b>0){
   if(a>=0||b<=a){changed=true;continue}
   const t=Math.min(1,Math.max(0,-a/(b-a)));
   if(t*length<.115){changed=true;continue}
   q=[...n.slice(0,4).map((v,j)=>round(parent[j]+(v-parent[j])*t)),pi,'broken'];
   q[3]=Math.max(.013,q[3]);terminal.add(i);changed=true;
  }else if(n[5]!=='broken'&&p(n)+n[3]+.48+extra>0){q[5]='broken';changed=true}
  ids.set(i,out.length);out.push(q);
 }
 if(!changed)return o;
 return validTreeGraph(out)?withGraph(o,out):null;
}
function touching(a,b,map){
 const ca=W.center(a),cb=W.center(b),za=W.elevation(a,map),zb=W.elevation(b,map);
 if(Math.hypot(ca.x-cb.x,ca.y-cb.y)>Math.hypot(a.w||1,a.d||1)/2+Math.hypot(b.w||1,b.d||1)/2+1)return false;
 if(za+(a.height||1)+.1<=zb||zb+(b.height||1)+.1<=za)return false;
 const aa=treeConstructionBoxes(a,za),bb=treeConstructionBoxes(b,zb);
 return aa.some(x=>bb.some(y=>boxIntersects({...x,x:x.x-GAP/2,y:x.y-GAP/2,w:x.w+GAP,d:x.d+GAP},y)));
}
function solve(map,original){
 let tree=original;const replacements=new Map(),lockedGroups=new Set((map.groups||[]).filter(g=>g.locked).map(g=>g.id)),origin=W.center(tree);
 const nearby=map.objects.filter(o=>o.type==='tree'&&o.id!==tree.id&&o.blocking!==false&&W.levelOf(o)===W.levelOf(tree)).sort((a,b)=>{const x=W.center(a),y=W.center(b);return Math.hypot(x.x-origin.x,x.y-origin.y)-Math.hypot(y.x-origin.x,y.y-origin.y)||String(a.id).localeCompare(String(b.id))});
 const fail=error=>({tree:original,replacements:new Map(),error});
 for(const old of nearby){
  if(!touching(tree,old,map))continue;
  const a=W.center(tree),b=W.center(old),dx=b.x-a.x,dy=b.y-a.y,axis=Math.abs(dx)>=Math.abs(dy)?0:1,sign=Math.sign(axis===0?dx:dy)||1,dist=Math.abs(axis===0?dx:dy),ac=axis===0?a.x:a.y;
  const ra=Math.min(.55,tree.trunkRadius||.13)+.09,rb=Math.min(.55,old.trunkRadius||.13)+.09;
  if(dist<ra+rb+GAP)return fail('Les troncs sont trop proches.');
  const split=ac+sign*Math.max(ra+GAP/2,Math.min(dist-rb-GAP/2,(dist+ra-rb)/2));
  const canTrim=organic(old)&&!old.locked&&!lockedGroups.has(old.group);
  let fitted=null,neighbor=null;
  for(const extra of [0,.10,.24]){
   fitted=shortenCrown(tree,axis,sign,split-sign*GAP/2,extra);
   neighbor=canTrim?shortenCrown(old,axis,-sign,split+sign*GAP/2,extra):old;
   if(fitted&&neighbor&&!touching(fitted,neighbor,map))break;
   fitted=neighbor=null;
  }
  if(!fitted||!neighbor)return fail(canTrim?'Pas assez de place pour séparer les couronnes.':'Un arbre protégé occupe cet espace.');
  tree=fitted;if(neighbor!==old)replacements.set(old.id,neighbor);
 }
 // Recheck previous pairs after every pruning pass; no overlap is accepted
 // just because a pair was considered earlier in the loop.
 for(const old of nearby)if(touching(tree,replacements.get(old.id)||old,map))return fail('Pas assez de place pour séparer les couronnes.');
 return {tree,replacements,error:''};
}
export function planTreePlanting(map,o){
 if(!map||!organic(o))return o;
 const c=W.center(o),key=[map.buildRevision||0,map.blockRevision||0,c.x,c.y,o.baseZ,o.facing,o.treeConfig?.adaptCrowns!==false].join(','),prev=lastPlan.get(map);
 let plan=prev?.key===key&&prev.graph===o.treeGraph&&prev.objects===map.objects?prev.plan:null;
 if(!plan){plan=o.treeConfig?.adaptCrowns===false?{tree:o,replacements:new Map(),error:''}:solve(map,o);lastPlan.set(map,{key,graph:o.treeGraph,objects:map.objects,plan})}
 const tree={...o,...plan.tree,id:o.id};
 plans.set(tree,{replacements:plan.replacements,error:plan.error});return tree;
}
export const treePlantingPlan=o=>plans.get(o);
export function applyTreePlanting(map,objects){
 for(const o of objects){const p=plans.get(o);if(!p||p.error)continue;for(const [id,next]of p.replacements){const existing=map.objects.find(t=>t.id===id);if(existing)Object.assign(existing,next)}}
}

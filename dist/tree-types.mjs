// Tree recipes are independent of fixed schematics. A recipe uses one
// reference growth graph, with bounded deterministic geometric mutations.
// No random state is consumed by previews, failed placements or rendering.
import {normalizeTreeConfig,generateLeaflessTree} from './organic-trees.mjs';
import {packTreeGraph,validTreeGraph,treeExtent} from './unified-trees.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),round=x=>Math.round(x*10000)/10000;
export function treeTypeConfig(input={}){
 const n=Number(input.variation??12),variation=Number.isFinite(n)?Math.round(clamp(n,0,30)):12;
 return {...normalizeTreeConfig(input),variation};
}
export function ensureTreeTypes(world){
 if(!Array.isArray(world.treeTypes)){
  // Copy previously saved personal tree recipes, leaving their static
  // schematics and all planted objects unchanged.
  world.treeTypes=(world.schematics||[]).filter(s=>!s.builtin&&s.treeConfig).map(s=>({id:'tree-from-'+s.id,config:treeTypeConfig({...s.treeConfig,name:s.name||s.treeConfig.name})}));
 }
 return world.treeTypes;
}
export function saveTreeType(world,config,id){
 const list=ensureTreeTypes(world),preset={id,config:treeTypeConfig(config)},i=list.findIndex(p=>p.id===id);
 if(i<0)list.push(preset);else list[i]=preset;return preset;
}
const baseCache=new Map(),variantCache=new Map();
function memo(cache,key,make,max){if(cache.has(key))return cache.get(key);const value=make();cache.set(key,value);if(cache.size>max)cache.delete(cache.keys().next().value);return value}
export function referenceTreeGraph(input){
 const c=treeTypeConfig(input),{name,material,variation,...shape}=c;
 return memo(baseCache,JSON.stringify(shape),()=>packTreeGraph(generateLeaflessTree(c)),32);
}
function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
export function treeVariant(input,sequence=0){
 const c=treeTypeConfig(input),base=referenceTreeGraph(c),seq=(Number(sequence)||0)>>>0;
 if(c.variation===0)return {graph:base,extent:treeExtent(base),seed:c.seed,sequence:seq};
 const key=JSON.stringify([c,seq]);
 return memo(variantCache,key,()=>{
  const seed=(c.seed^Math.imul(seq+1,0x9e3779b9))>>>0,rand=rng(seed),a=c.variation/100,sign=()=>2*rand()-1;
  // Keep the reference topology, branch count, ends and proportions. A
  // smooth coordinate warp perturbs neighboring samples coherently.
  const sx=1+sign()*a*.7,sy=1+sign()*a*.7,sz=1+sign()*a*.65,th=sign()*a*1.8,co=Math.cos(th),si=Math.sin(th),bendX=sign()*a,bendY=sign()*a,phase=rand()*6.283185307,rscale=1+sign()*a*.65;
  const graph=base.map(([x,y,z,r,parent,tip],i)=>{
   const bend=Math.max(0,z-.5),warp=a*.26*Math.sin(x*.57+y*.43+z*.38+phase)*Math.hypot(x,y);
   const xx=x*sx+bendX*bend*.30+warp,yy=y*sy+bendY*bend*.30-warp*.55;
   return [round(xx*co-yy*si),round(xx*si+yy*co),round(clamp(.5+(z-.5)*sz,.02,24.8)),round(clamp(r*rscale*(1+a*.16*Math.sin(z*.6+x*.4+phase)),.013,.46)),parent,tip];
  });
  const safe=validTreeGraph(graph)?graph:base;
  return {graph:safe,extent:treeExtent(safe),seed,sequence:seq};
 },24);
}
export const plantSequence=world=>(Number(world.builder?.treePlantSequence)||0)>>>0;
export function advanceTreeSequence(world){world.builder??={};world.builder.treePlantSequence=(plantSequence(world)+1)>>>0;return world.builder.treePlantSequence}
export function makeTreeItem(input){const config=treeTypeConfig(input);return {kind:'treeType',type:'tree',name:config.name,treeConfig:config,yaw:0,step:1}}

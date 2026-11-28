import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import * as W from '../dist/world.mjs';
import {treeTipEnd,treeExtent,unifiedTreeGeometry,validTreeGraph} from '../dist/unified-trees.mjs';
import {treeConstructionBoxes,boxIntersects} from '../dist/tree-construction-collision.mjs';
import {generateLeaflessTree,TREE_GENERATOR_PROFILES} from '../dist/organic-trees.mjs';
import {planTreePlanting,treePlantingPlan} from '../dist/tree-neighbors.mjs';
for(const p of TREE_GENERATOR_PROFILES){
 const nodes=generateLeaflessTree(p);
 if(p.key!=='stump'&&p.tipStyle!=='broken')assert(nodes.every(n=>n.tip!=='broken'),p.key+' mixed natural tips');
}
assert(generateLeaflessTree({...TREE_GENERATOR_PROFILES[0],tipStyle:'broken'}).some(n=>n.tip==='broken'));
assert(generateLeaflessTree(TREE_GENERATOR_PROFILES.find(p=>p.key==='stump')).some(n=>n.tip==='broken'));
const simple=[[0,0,.5,.3,-1,'round'],[0,0,1.5,.2,0,'taper']];
for(const style of ['taper','round','broken']){
 const graph=simple.map(n=>n.slice());graph[1][5]=style;
 const g=unifiedTreeGeometry(T,graph);
 const cap=g.groups.find(q=>q.materialIndex===1);
 assert.equal(cap.count,style==='broken'?72:36,'end grain only on root and intentional cut');
 assert(g.attributes.position.array.every(Number.isFinite));
 assert(g.attributes.normal.array.every(Number.isFinite));g.dispose();
 const end=treeTipEnd(graph[1],graph[0]);if(style==='broken')assert.equal(end,null);else{
  assert(end.radius<graph[1][3]*.1);
  const e=treeExtent(graph),tree={type:'tree',x:-e.w/2,y:-e.d/2,...e,treeGraph:graph};
  assert(treeConstructionBoxes(tree,0).some(b=>b.x<=end.point[0]&&b.x+b.w>=end.point[0]&&b.y<=end.point[1]&&b.y+b.d>=end.point[1]&&b.baseZ<=end.point[2]&&b.baseZ+b.height>=end.point[2]));
 }
}
const map=W.newMap('test','Natural tips',64,64);W.prepareBlocks(map);
const graph=[[0,0,.5,.16,-1,'round'],[0,0,1.5,.14,0,'round'],[1,0,2,.09,1,'round'],[2,0,2.5,.05,2,'broken']];
const e=treeExtent(graph),tree={...W.newObject('tree',0,0,'new'),...e,x:20.5-e.w/2,y:20.5-e.d/2,baseZ:0,treeGraph:graph,treeConfig:{adaptCrowns:true,tipStyle:'broken'}};
const clear=planTreePlanting(map,tree);assert.equal(treePlantingPlan(clear).error,'');assert.equal(clear.treeGraph.at(-1)[5],'broken');
const obstacle={...W.newObject('block',22,20,'wall'),baseZ:1,w:1,d:1,height:3,material:'stone'};
map.objects.push(obstacle);map.buildRevision=1;
const fitted=planTreePlanting(map,tree);assert.equal(treePlantingPlan(fitted).error,'');assert(treePlantingPlan(fitted).adapted);assert(validTreeGraph(fitted.treeGraph));
assert.equal(fitted.treeGraph.at(-1)[5],'taper');assert(fitted.treeGraph.every(n=>n[5]!=='broken'));
const leaf=fitted.treeGraph.at(-1),parent=fitted.treeGraph[leaf[4]];assert(leaf[3]<=Math.max(.013,parent[3]*.32)+.0001);
assert(treeConstructionBoxes(fitted,0).every(b=>!boxIntersects(b,obstacle)));
assert.deepEqual(planTreePlanting(map,tree).treeGraph,fitted.treeGraph);
console.log('PASS: natural end bark, deliberate cuts, shared tip collision and obstacle-constrained taper.');

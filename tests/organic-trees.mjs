import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {TREE_PROFILES,generateLeaflessTree} from '../dist/organic-trees.mjs';
import {ensureTreeExamples,schemaPlacement} from '../dist/construction.mjs';
import {formGeometry,formCollisionBoxes} from '../dist/block-forms.mjs';
import {rebuildConnections,updateConnections} from '../dist/connected-blocks.mjs';
const world={schematics:[]};ensureTreeExamples(world);
for(const p of TREE_PROFILES){
 const nodes=generateLeaflessTree(p);assert.deepEqual(nodes,generateLeaflessTree(p));assert(nodes.length<=96);assert(nodes.length>1);assert.equal(new Set(nodes.map(n=>n.pos.join(','))).size,nodes.length);
 assert(nodes.every(n=>n.radius>=.013&&n.radius<=.46));
}
for(const s of world.schematics){
 let i=0;const objects=schemaPlacement(s,{x:40,y:40,z:0},Math.PI/2,()=>String(++i));const map={objects,groups:[]};rebuildConnections(map);
 for(const o of objects){assert(o.formOrganicLinks.length>0);const g=formGeometry(T,o);assert(g.attributes.position.count>0);assert([...g.attributes.position.array].every(Number.isFinite));assert(formCollisionBoxes(o).length>0);g.dispose()}
 const first=objects[0],neighbor=objects.find(o=>o!==first&&o.formOrganicLinks.length>0);map.objects=objects.filter(o=>o!==first);updateConnections(map,{removed:[first.id]});assert(map.objects.includes(neighbor));
}
console.log('PASS: seeded leafless tree profiles, continuous radii, rotated ports and organic meshes');

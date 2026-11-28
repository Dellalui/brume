import assert from 'node:assert/strict';
import {TREE_GENERATOR_PROFILES,normalizeTreeConfig,generateLeaflessTree} from '../dist/organic-trees.mjs';
import {createTreeSchema,schemaPlacement} from '../dist/construction.mjs';
import {formGeometry} from '../dist/block-forms.mjs';
import * as T from '../dist/vendor/three.module.min.js';
assert.equal(TREE_GENERATOR_PROFILES.length,9);
for(const p of TREE_GENERATOR_PROFILES){
 const config=normalizeTreeConfig(p),a=generateLeaflessTree(config);
 assert.deepEqual(a,generateLeaflessTree(config));assert(a.length<=config.budget);
 assert.equal(new Set(a.map(n=>n.pos.join(','))).size,a.length);
 const schema=createTreeSchema(config,'test-'+p.key);
 assert.equal(schema.objects.length,a.length);
 for(const o of schemaPlacement(schema,{x:40,y:40,z:0},Math.PI/2,()=>crypto.randomUUID())){
  assert(o.formOrganicLinks.length>0);const g=formGeometry(T,o);assert(g.attributes.position.array.every(Number.isFinite));g.dispose();
 }
}
const c=normalizeTreeConfig({height:999,budget:12,radius:-9,depth:99,seed:-1});
assert.equal(c.height,12);assert.equal(c.radius,.065);assert.equal(c.depth,3);assert.equal(c.seed,0);
assert.notDeepEqual(generateLeaflessTree({...c,seed:1}),generateLeaflessTree({...c,seed:2}));
assert.throws(()=>createTreeSchema({material:'water'},'invalid'));
console.log('PASS: configurable leafless generator, nine profiles, deterministic seeds, limits, rotated geometry');

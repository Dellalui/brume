import {TREE_PROFILES} from '../dist/organic-trees.mjs';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {formGeometry,shapeIntervals} from '../dist/block-forms.mjs';
import {createBlockTreeSchema,schemaPlacement} from '../dist/construction.mjs';
const o={type:'block',blockForm:'rod-connected',w:1,d:1,height:1,x:0,y:0,baseZ:0,facing:0,formConnections:5};
const g=formGeometry(T,o);assert(g.groups.every(x=>x.materialIndex===0),'horizontal connected tube has bark only');assert([...g.attributes.uv.array].every(Number.isFinite));g.dispose();
const trunk={...o,blockForm:'trunk-connected',formConnections:17};assert.equal(shapeIntervals(trunk,.5,.5)[0][0],0);
const world={schematics:[{id:'custom',objects:[]}]};world.schematics.push(...TREE_PROFILES.map(p=>createBlockTreeSchema(p,p.key)));assert.equal(world.schematics.length,7);
for(const s of world.schematics.slice(1)){
 const seen=new Set([s.objects[0].id]);let changed=true;
 while(changed){changed=false;for(const a of s.objects.filter(a=>seen.has(a.id)))for(const b of s.objects)if(!seen.has(b.id)&&(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.baseZ-b.baseZ)===1||a.formOrganicLinks?.some(d=>d[0]===b.x-a.x&&d[1]===b.y-a.y&&d[2]===b.baseZ-a.baseZ))){seen.add(b.id);changed=true}}
 assert.equal(seen.size,s.objects.length,s.name+' disconnected');
 for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5]){
 let n=0;const parts=schemaPlacement(s,{x:20.2,y:20.7,z:0},angle,()=>String(++n));assert(parts.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&(p.formConnections>0||p.formDiagonalLinks?.length>0)));
 }
}
console.log('PASS: bark along horizontal arms, full trunk base, six connected leafless schemas and grid-aligned placement');

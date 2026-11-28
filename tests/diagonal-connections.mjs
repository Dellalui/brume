import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {rebuildConnections,updateConnections} from '../dist/connected-blocks.mjs';
import {formGeometry,shapeRayEntry,formCollisionBoxes,orientForm} from '../dist/block-forms.mjs';
const make=(id,shape,x,y,z)=>({id,type:'block',blockForm:shape,x,y,baseZ:z,w:1,d:1,height:1,facing:0,formConnect:true});
const a=make('a','trunk-connected',15,4,0),b=make('b','branch-diagonal',16,4,1),c=make('c','rod-diagonal',17,4,2);
const map={objects:[a,b,c],groups:[]};rebuildConnections(map);
assert.deepEqual(a.formDiagonalLinks,[[1,0,1,3]]);
assert.deepEqual(b.formDiagonalLinks,[[-1,0,-1,3],[1,0,1,1]]);
assert.deepEqual(c.formDiagonalLinks,[[-1,0,-1,1]]);
for(const o of map.objects){const g=formGeometry(T,o);assert(g.attributes.position.count>0);assert([...g.attributes.uv.array].every(Number.isFinite));assert(formCollisionBoxes(o).length>0);g.dispose()}
assert(Number.isFinite(shapeRayEntry(b,{x:16.5,y:3,z:1.5},{x:0,y:3,z:0})));
map.objects.pop();updateConnections(map,{removed:['c']});assert.equal(b.formDiagonalLinks.length,1);
const p=orientForm({shape:'branch-diagonal',w:1,d:1,h:1,step:1},{x:15.8,y:4.5,z:.8,normal:{x:1,y:0,z:0},placedBlock:a});assert.equal(p.x,16);assert.equal(p.z,1);
console.log('PASS: diagonal geometry, tapered reciprocal links, collision, local removal and placement.');

import assert from 'node:assert/strict';
import {BLOCK_FORMS,orientForm,shapeIntervals,shapeRayEntry,formsOverlap,formGeometry,isForm} from '../dist/block-forms.mjs';
import * as T from '../dist/vendor/three.module.min.js';
const o=(blockForm,extra={})=>({type:'block',material:'dirt',blockForm,x:0,y:0,w:1,d:1,height:1,baseZ:0,facing:0,...extra});
assert.equal(BLOCK_FORMS.length,38);
assert.deepEqual(shapeIntervals(o('slab'),.5,.5),[[0,.5]]);
assert.deepEqual(shapeIntervals(o('slab',{formFlip:true}),.5,.5),[[.5,1]]);
assert(!formsOverlap(o('slab'),o('slab',{formFlip:true})));
assert.equal(shapeRayEntry(o('half-wall'),{x:-1,y:.25,z:.5},{x:3,y:0,z:0}),Infinity);
assert.equal(shapeRayEntry(o('frame'),{x:.5,y:-1,z:.5},{x:0,y:3,z:0}),Infinity);
assert(Math.abs(orientForm({shape:'stairs',w:1,d:1,h:1,step:1},{x:3.5,y:4.5,z:0,aimDirection:{x:1,y:0}}).angle+Math.PI/2)<1e-6);
for(const f of BLOCK_FORMS.filter(f=>isForm(f.id)))for(const formFlip of [false,true])for(const formMirror of [false,true]){const g=formGeometry(T,o(f.id,{formFlip,formMirror}));assert(g.attributes.position.count>0);assert([...g.attributes.position.array].every(Number.isFinite));g.dispose()}
console.log('38 block forms and 144 geometry variants: OK');

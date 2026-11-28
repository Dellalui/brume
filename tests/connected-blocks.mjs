import assert from 'node:assert/strict';
import {rebuildConnections,updateConnections,previewConnections} from '../dist/connected-blocks.mjs';
import {shapeIntervals,formCollisionBoxes,formIconPolygons,orientForm} from '../dist/block-forms.mjs';
const make=(id,x,y,extra={})=>({id,type:'block',blockForm:'fence',material:'stone',x,y,w:1,d:1,height:1,baseZ:0,facing:0,...extra});
const a=make('a',15,4),b=make('b',16,4),c=make('c',15,5),map={objects:[a,b,c],groups:[]};
rebuildConnections(map);assert.equal(a.formConnections,3);assert.equal(b.formConnections,4);assert.equal(c.formConnections,8);
assert(shapeIntervals(a,15.95,4.5).length===2);assert.equal(shapeIntervals(a,15.05,4.5).length,0);
const d=make('d',14,4);assert.equal(previewConnections(map,d),1);assert.equal(a.formConnections,3);
map.objects.push(d);assert(updateConnections(map,{added:[d]}).includes(a));assert.equal(a.formConnections,7);assert.equal(d.formConnections,1);
map.objects=map.objects.filter(o=>o!==b);updateConnections(map,{removed:['b']});assert.equal(a.formConnections,6);assert.equal(formCollisionBoxes(a).length,5);
const remote=make('remote',40,40);map.objects.push(remote);updateConnections(map,{added:[remote]});assert.equal(remote.formConnections,0);
const elevated=make('up',16,4,{baseZ:1});map.objects.push(elevated);updateConnections(map,{added:[elevated]});assert.equal(a.formConnections,6);
const hidden=make('hidden',16,4,{secret:true});map.objects.push(hidden);updateConnections(map,{added:[hidden]});assert.equal(a.formConnections,6);
const rotated=make('rotated',16,4,{facing:Math.PI/2});map.objects.push(rotated);updateConnections(map,{added:[rotated]});assert.equal(a.formConnections,7);assert.equal(rotated.formConnections,2);
for(const kind of ['fence','connected-wall','railing']){const n=make(kind,0,0,{blockForm:kind,formConnections:15});assert(formCollisionBoxes(n).length>=5);assert(formIconPolygons(kind).length>0)}
const p=orientForm({shape:'fence',w:1,d:1,h:1,step:1},{x:15.65,y:4.5,z:.6,normal:{x:1,y:0,z:0},placedBlock:a});assert.equal(p.x,16);assert.equal(p.y,4);assert.equal(p.z,0);
console.log('PASS: automatic fence, wall and railing geometry, local neighbor updates, cross-chunk joins, rotation and preview.');

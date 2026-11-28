import assert from 'node:assert/strict';
import {rebuildConnections,updateConnections,previewConnectionData} from '../dist/connected-blocks.mjs';
import {shapeIntervals,shapeRayEntry,formCollisionBoxes,formGeometry,formIconPolygons,orientForm,spatialSize} from '../dist/block-forms.mjs';
import * as T from '../dist/vendor/three.module.min.js';
const make=(id,blockForm,x,y,baseZ=0,extra={})=>({id,type:'block',blockForm,material:'stone',x,y,w:1,d:1,height:1,baseZ,facing:0,...extra});
const trunk=make('trunk','trunk-connected',15,5),top=make('top','trunk-connected',15,5,1),branch=make('branch','branch-connected',16,5),rod=make('rod','rod-connected',17,5),spike=make('tip','spike-connected',18,5);
const remote=make('remote','trunk-connected',45,45),map={objects:[trunk,top,branch,rod,spike,remote],groups:[]};
rebuildConnections(map);
assert.equal(trunk.formConnections,17);assert.equal(top.formConnections,32);assert.equal(branch.formConnections,5);assert.equal(rod.formConnections,5);assert.equal(spike.formConnections,4);
assert.equal(trunk.formConnectionSizes&7,3);assert.equal((branch.formConnectionSizes>>>6)&7,3);
assert.equal(branch.formConnectionSizes&7,1);assert.equal((rod.formConnectionSizes>>>6)&7,1);
assert.equal(remote.formConnections,0);
assert(shapeIntervals(trunk,15.99,5.5).length>0);assert(shapeIntervals(branch,16.01,5.5).length>0);
assert.equal(shapeRayEntry(rod,{x:17.5,y:4,z:.5},{x:0,y:3,z:0})<Infinity,true);
const d=make('down','pillar-thin-connected',15,5,-1);assert.equal(previewConnectionData(map,d).bits,16);assert.equal(trunk.formConnections,17);
map.objects.push(d);const changed=updateConnections(map,{added:[d]});assert(changed.includes(trunk));assert(!changed.includes(remote));assert.equal(trunk.formConnections,49);
map.objects=map.objects.filter(o=>o!==branch);updateConnections(map,{removed:['branch']});assert.equal(trunk.formConnections,48);assert.equal(rod.formConnections,1);
const side=orientForm({shape:'rod-connected',w:1,d:1,h:1,step:1},{x:15.93,y:5.5,z:.5,normal:{x:1,y:0,z:0},placedBlock:trunk});assert.equal(side.x,16);assert.equal(side.z,0);
const above=orientForm({shape:'rod-connected',w:1,d:1,h:1,step:1},{x:15.5,y:5.5,z:2,normal:{x:0,y:0,z:1},placedBlock:top});assert.equal(above.z,2);assert.equal(above.x,15);
for(const id of ['trunk-connected','pillar-connected','branch-connected','pillar-thin-connected','rod-connected','spike-connected']){
 assert(spatialSize(id)>0);assert(formIconPolygons(id).length>0);
 for(let mask=0;mask<64;mask++){
  const o=make('test',id,0,0,0,{formConnections:mask,formConnectionSizes:0});
  const g=formGeometry(T,o);assert(g.attributes.position.count>0);assert([...g.attributes.position.array].every(Number.isFinite));g.dispose();
  assert(formCollisionBoxes(o).length>0);
 }
}
console.log('PASS: six-axis mixed-radius connections, local updates, preview, 384 spatial configurations and geometry.');

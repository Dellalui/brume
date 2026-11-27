import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {doorSlabs,aimedDoor,doorAccess,doorRayDistance} from '../dist/door-interaction.mjs';
import {createActivationQueue,setActivation,canActivateBlock} from '../dist/block-activation.mjs';
const m=W.newMap('doors','Doors',32,32);W.prepareBlocks(m);
const a=W.newObject('hero',10,10,'actor');a.voxelZ=0;
const d=W.newObject('build_door',10,9.425,'door');Object.assign(d,{w:1,d:.15,height:2,baseZ:0,open:false,name:'Porte'});
const side=W.newObject('build_door',11.5,10.425,'side');Object.assign(side,{w:1,d:.15,height:2,baseZ:0,facing:Math.PI/2});
m.objects=[a,d,side];const eye={x:10.5,y:10.5,z:1.53},ray={origin:eye,direction:{x:0,y:-1,z:0}};
assert.equal(aimedDoor(m,a,ray,W)?.door,d);assert.equal(doorAccess(m,d,a,W),'');
assert.equal(aimedDoor(m,a,{origin:eye,direction:{x:1,y:0,z:0}},W)?.door,side);
assert(!aimedDoor(m,a,{origin:eye,direction:{x:0,y:1,z:0}},W),'no nearest-door fallback behind player');
d.open=true;assert.equal(aimedDoor(m,a,ray,W)?.door,d,'empty doorway remains a target');
const leaf=doorSlabs(m,d,W)[1];assert(Number.isFinite(doorRayDistance({x:leaf.x-1,y:leaf.y,z:1},{x:1,y:0,z:0},leaf)));
assert(W.canCloseDoor(m,d));const stuck=W.newObject('npc',25,25,'stuck');stuck.voxelZ=0;m.objects.push(stuck);W.setBlock(m,25,25,0,'stone');assert(W.canCloseDoor(m,d),'unrelated embedded actor must not block door');
a.x=10;a.y=9;assert(!W.canCloseDoor(m,d),'actor in the doorway blocks closing');a.y=10;
const upper=W.newObject('hero',10,9,'upper');Object.assign(upper,{level:1,voxelZ:0});m.objects.push(upper);assert(W.canCloseDoor(m,d),'other level does not obstruct');
const segment=W.newObject('door',10,8,'segment');Object.assign(segment,{x2:12,y2:8,height:2,baseZ:0,open:true});m.objects.push(segment);a.x=10.5;a.y=7.5;assert(!W.canCloseDoor(m,segment),'segment door occupancy');a.y=10;
// The old fixture had an OPEN leaf extending two cells towards the actor,
 // and only one voxel column beside the ray (actor centre x=11). It did
 // not actually obstruct the interaction. Test a closed door behind a
 // complete two-column wall, then test the open leaf separately.
 segment.open=false;
 W.setBlock(m,10,9,0,'stone');W.setBlock(m,10,9,1,'stone');
 W.setBlock(m,11,9,0,'stone');W.setBlock(m,11,9,1,'stone');
 assert(doorAccess(m,segment,a,W),'closed door behind a complete wall is not reachable');
 const blockedRay={origin:{...W.center(a),z:W.eyeHeight(a)},direction:{x:0,y:-1,z:0}};
 // Isolate the tested door from other doors nearer the actor.
 m.objects=[a,segment];
 const blocked=aimedDoor(m,a,blockedRay,W);
 assert.equal(blocked?.door,segment);
 assert(doorAccess(m,segment,a,W,blocked.point),'aimed surface behind wall is blocked');
 // An open leaf can still be reachable, but that cannot authorize a hit
 // on an obstructed part of the opening.
 segment.open=true;
 assert.equal(doorAccess(m,segment,a,W),'','open leaf is on the actor side of the obstruction');
 const aperture={x:11,y:8.08,z:W.eyeHeight(a)};
 assert(doorAccess(m,segment,a,W,aperture),'reachable leaf does not authorize hidden aperture');
 for(const x of [10,11])for(const z of [0,1])W.setBlock(m,x,9,z,null);
 assert.equal(doorAccess(m,segment,a,W,aperture),'','removing wall restores exact-point access');
 m.objects=[a,d,side,stuck,upper,segment];
d.visible=false;assert.notEqual(aimedDoor(m,a,ray,W)?.door,d);d.visible=true;
 // A wide door must not offer an action on a far-away end just because
 // the nearest end is close. The actual selected point is range checked.
 const wide=W.newObject('door',5,12,'wide');Object.assign(wide,{x2:15,y2:12,height:2,baseZ:0,open:false});
 a.x=5;a.y=10;m.objects=[a,wide];
 const longRay={origin:{x:14,y:10.5,z:W.eyeHeight(a)},direction:{x:0,y:1,z:0}};
 assert.equal(aimedDoor(m,a,longRay,W),null,'far end out of reach');
 assert(doorAccess(m,wide,a,W,{x:14,y:11.92,z:W.eyeHeight(a)}),'exact point out of reach');
 m.objects=[a,d,side,stuck,upper,segment];
const ref={kind:'voxel',x:13,y:12,z:0};W.setBlock(m,13,12,0,'stone');assert(setActivation(m,ref,{enabled:true,delay:2},W));
const q=createActivationQueue();assert(q.arm(m,ref,100,W));assert.equal(q.remaining(m,ref,900,W),1200);setActivation(m,ref,{enabled:false},W);assert.equal(q.remaining(m,ref,900,W),null);
console.log('PASS: aimed door selection, open aperture/leaf, local closure occupancy, level/visibility checks and activation countdown.');

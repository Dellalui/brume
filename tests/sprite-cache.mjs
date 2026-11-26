import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {fixture} from '../test-support/three-fixture.mjs';
const {r,gpu}=fixture(),map=W.newMap('sprite','Sprite',32,32);W.prepareBlocks(map);
const npc={...W.newObject('npc',16,16,'npc'),frameCount:16,frames:Object.fromEntries(Array.from({length:16},(_,i)=>[i,'im'+i])),imageId:'im0'};map.objects=[npc];
const images=new Map(Array.from({length:16},(_,i)=>['im'+i,{width:100+i,height:200}]));
const opts={map,images,selection:npc.id,mode:'mj',lights:W.buildLights(map),vision:new Set(),explored:new Set(),terrainEpoch:1,path:[]};
function orbit(i){let a=i*Math.PI/8;Object.assign(map.camera,{mode:'fly',angle:a,fly:{x:16.5+8*Math.sin(a),y:5,z:16.5+8*Math.cos(a)}});r.render(opts)}
orbit(0);const root=r.debug().cache.get(npc.id).root,sprite=root.userData.sprite,shadow=root.userData.shadowVolume,first=sprite.material.map;let changed=false;
for(let i=1;i<=16;i++){gpu.shadowMap.needsUpdate=false;orbit(i);assert.equal(r.debug().cache.get(npc.id).root,root);assert.equal(root.userData.sprite,sprite);assert.equal(root.userData.shadowVolume,shadow);assert(!gpu.shadowMap.needsUpdate,'directional frame alone does not invalidate shadows');changed||=first!==sprite.material.map;}
assert(changed);r.dispose();console.log('PASS: persistent NPC mesh, directional textures and stable shadow volume.');

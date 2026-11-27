import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {planImpact,applyImpact} from '../dist/throw-effects.mjs';
import {createPartyVisionCache} from '../dist/party-vision.mjs';
import {writeSightMask} from '../dist/sight-mask.mjs';
import {createFrameMeter} from '../dist/frame-meter.mjs';
const m=W.newMap('spikes','Spikes',512,512);W.prepareBlocks(m);m.groups.push({id:'safe',locked:true});
const entries={};for(let i=0;i<10000;i++)entries[(200+i%100)+','+(200+Math.floor(i/100))+',0']='safe';
let visits=0;m.blockGroups=new Proxy(entries,{ownKeys(t){const keys=Reflect.ownKeys(t);visits+=keys.length;return keys}});
const plan=planImpact(m,{x:32.5,y:32.5,z:.5},{power:6},W);
assert(plan.ground.length>100);assert.equal(visits,10000);visits=0;assert(applyImpact(m,plan,W)>100);assert.equal(visits,10000);
const locked=W.newMap('lock','Lock',40,40);W.prepareBlocks(locked);locked.groups.push({id:'g',locked:false});
W.setBlock(locked,20,20,0,'glass');locked.blockGroups={'20,20,0':'g'};
const lp=planImpact(locked,{x:20.5,y:20.5,z:.5},{power:4},W);locked.groups.at(-1).locked=true;applyImpact(locked,lp,W);assert.equal(W.blockAt(locked,20,20,0),'glass');assert.equal(W.groundAt(locked,20,20),0);
const map=W.newMap('mask','Mask',64,64);W.prepareBlocks(map);const actor=W.newObject('hero',32,32,'a');actor.vision={range:12,far:24,angle:180,near:3.5};map.objects=[actor];map.fog.push('32,30');
const lights=W.buildLights(map),cache=createPartyVisionCache(),data=new Uint8Array(64*64*4),reference=new Uint8Array(data.length),explored=new Set();
function verify(r,delta){for(const keys of r.newlyExplored.values())for(const k of keys)explored.add(k);const opts={x0:0,y0:0,width:64,height:64,mode:'selected',sightDisplay:r.display,vision:r.vision,explored,fog:map.fog};const part=writeSightMask(data,opts,delta);writeSightMask(reference,opts);assert.deepEqual(data,reference);return part}
let r=cache.collect(map,[actor],lights,0,{maxRays:96});assert(r.reset);verify(r,null);
let slices=0;while(r.pending){assert(++slices<1000);r=cache.collect(map,[actor],lights,0,{maxRays:96});assert(!r.reset);assert(verify(r,r.changedCells).visited<=96)}
actor.y--;r=cache.collect(map,[actor],lights,0,{maxRays:96});assert(r.reset);verify(r,null);
actor.facing=Math.PI;r=cache.collect(map,[actor],lights,0,{maxRays:96});assert(r.reset);verify(r,null);
r=cache.collect(map,[actor],lights,1,{maxRays:96});assert(r.reset);verify(r,null);
const spikes=createFrameMeter();spikes.record(0,4,{}, {vision:1,relief:0});spikes.record(16,5,{}, {vision:1,relief:1});spikes.record(96,40,{}, {vision:2,relief:35});
const peak=spikes.read(96);assert.equal(peak.worst,80);assert.equal(peak.p99,80);assert.equal(peak.low1,12.5);assert.equal(peak.stages[0].max,35);
console.log('PASS: blast protection, mask equivalence, frame profiler.');
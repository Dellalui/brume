import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {planImpact,applyImpact} from '../dist/throw-effects.mjs';
const m=W.newMap('spikes','Spikes',512,512);W.prepareBlocks(m);m.groups.push({id:'safe',locked:true});
const entries={};for(let i=0;i<10000;i++)entries[(200+i%100)+','+(200+Math.floor(i/100))+',0']='safe';
let visits=0;m.blockGroups=new Proxy(entries,{ownKeys(t){const keys=Reflect.ownKeys(t);visits+=keys.length;return keys}});
const plan=planImpact(m,{x:32.5,y:32.5,z:.5},{power:6},W);
assert(plan.ground.length>100);assert.equal(visits,10000);visits=0;assert(applyImpact(m,plan,W)>100);assert.equal(visits,10000);
const locked=W.newMap('lock','Lock',40,40);W.prepareBlocks(locked);locked.groups.push({id:'g',locked:false});
W.setBlock(locked,20,20,0,'glass');locked.blockGroups={'20,20,0':'g'};
const lp=planImpact(locked,{x:20.5,y:20.5,z:.5},{power:4},W);locked.groups.at(-1).locked=true;applyImpact(locked,lp,W);assert.equal(W.blockAt(locked,20,20,0),'glass');assert.equal(W.groundAt(locked,20,20),0);

console.log('PASS: bounded blast protection scans and commit-time group locks.');

import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {RECIPE_PRESETS,normalizeLayers,recipeDuration,arrangeLayers,SHAPES} from '../dist/effect-recipes.mjs';
import {throwConfig,createThrowQueue,inThrowRange,renderableImpacts} from '../dist/throw-effects.mjs';
const m=W.newMap('recipe','Recipe',256,256);W.prepareBlocks(m);const from={x:1,y:1,z:1},to={x:101,y:1,z:1};
assert(!inThrowRange(from,to,{range:99}));assert(inThrowRange(from,to,{range:100}));assert(inThrowRange(from,to,{range:0}));assert.equal(throwConfig({range:-5}).range,0);
const q=createThrowQueue(),item={range:0,speed:100,destroy:false,layers:[{kind:'fire',delay:0,duration:1},{kind:'ice',delay:0,duration:2},{kind:'blackhole',delay:4,duration:3},{kind:'storm',enabled:false,delay:200,duration:5}]};
assert(q.launch(m,true,from,to,item,W,0));item.layers[0].kind='dust';let count=0;
assert.equal(q.advance(m,true,500,()=>count++)[0].phase,'flight');assert.equal(count,0);
let visible=q.advance(m,true,1000,()=>count++);assert.equal(count,1);assert.deepEqual(visible.map(e=>e.config.id),['fire','ice'],'same delay means simultaneous immutable layers');
assert.equal(q.advance(m,true,2500,()=>count++).length,1);
assert.equal(q.advance(m,true,4000,()=>count++).length,0);assert.equal(q.size,1,'a silent interval must retain the pending sequence');
visible=q.advance(m,true,5500,()=>count++);assert.equal(visible[0].config.id,'blackhole');assert.equal(visible[0].age,.5);
assert.equal(q.advance(m,true,8000,()=>count++).length,0);assert.equal(q.size,0);assert.equal(count,1,'one impact mutation, not one per layer');
for(let i=0;i<100;i++)assert(q.launch(m,true,from,to,{range:0,speed:100},W,0));assert.equal(q.size,100);assert.equal(q.advance(m,true,1100,()=>{}).length,100);
q.clear();assert.equal(q.size,0);
const layers=normalizeLayers([{kind:'fire',duration:2},{kind:'ice',duration:3}]);assert.deepEqual(arrangeLayers(layers,true).map(l=>l.delay),[0,2]);assert.deepEqual(arrangeLayers(layers,false).map(l=>l.delay),[0,0]);assert.equal(recipeDuration(arrangeLayers(layers,true)),5);
assert.equal(RECIPE_PRESETS.length,24);assert.equal(new Set(RECIPE_PRESETS.map(p=>p.id)).size,24);assert.equal(SHAPES.length,7);
for(const preset of RECIPE_PRESETS){const cfg=throwConfig({preset:preset.id});assert(cfg.duration>0);assert(cfg.layers.every(l=>Number.isFinite(l.delay+l.duration)&&l.duration>0));assert.deepEqual(JSON.parse(JSON.stringify(cfg.layers)),cfg.layers)}
assert(normalizeLayers([{kind:'bad',duration:NaN,size:Infinity}]).every(l=>Number.isFinite(l.duration+l.size)));
// Real block effects are not construction-only previews. Distinct queue
// namespaces also prevent reuse of a projectile mesh for a pressure trap.
const builder=createThrowQueue(),game=createThrowQueue('block-impact');
assert(builder.launch(m,true,from,to,{range:0,speed:100},W,0));
assert(game.impact(m,to,{preset:'fire',destroy:false},W,1000));
const previews=builder.advance(m,true,1100,()=>{}),blocks=game.advance(m,true,1100,()=>{});
assert(blocks.length&&previews.length);assert.notEqual(blocks[0].id,previews[0].id);
for(const mode of ['selected','party','mj']){
 assert.deepEqual(renderableImpacts({map:m,mode,building:false,thrownEffects:previews,blockEffects:blocks}),blocks);
}
assert.deepEqual(renderableImpacts({map:m,mode:'mj',building:true,thrownEffects:previews,blockEffects:blocks}),[...previews,...blocks]);
m.fog.push('101,1');assert.deepEqual(renderableImpacts({map:m,mode:'selected',blockEffects:blocks}),[]);m.fog=[];
m.editLevel=1;assert.deepEqual(renderableImpacts({map:m,mode:'mj',blockEffects:blocks}),[]);m.editLevel=0;
game.advance(m,true,5000,()=>{});assert.equal(game.size,0);
console.log('PASS: 24 recipes, seven shapes, launch range/unlimited throws, flight speed, concurrent/delayed layers, gaps, immutable launches, single impact and cleanup.');

import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {fixture} from '../test-support/three-fixture.mjs';
import {indexGroundEdits,groundChunkDescriptor} from '../dist/ground-rectangles.mjs';
import {createLiquidCache} from '../dist/liquid-flow.mjs';
const map=W.newMap('large','Large empty map',4096,4096);W.prepareBlocks(map);
assert.equal(Object.keys(map.blocks).length,0);assert.equal(map.chunks.length,65536);
let index=indexGroundEdits(map),flat=groundChunkDescriptor(map,128,128,index);
assert.equal(flat.cells,256);assert.equal(flat.rects.length,1);
map.floor['2049,2049']='#ee0000';map.ground={'2050,2050':-.5};
index=indexGroundEdits(map);let modified=groundChunkDescriptor(map,128,128,index,flat);
assert(modified.rects.length>1&&modified.rects.length<256);
const coverage=new Map();for(const p of modified.rects)for(let y=p.y;y<p.y+p.d;y++)for(let x=p.x;x<p.x+p.w;x++){const k=x+','+y;assert(!coverage.has(k));coverage.set(k,p)}
assert.equal(coverage.size,256);assert.equal(coverage.get('2049,2049').paint,'#ee0000');assert.equal(coverage.get('2050,2050').height,-.5);assert.equal(groundChunkDescriptor(map,128,128,index,modified),modified);
const partial=W.newMap('partial','Partial',25,23);assert.equal(groundChunkDescriptor(partial,1,1,indexGroundEdits(partial)).cells,63);
partial.chunks=partial.chunks.filter(k=>k!=='1,1');assert.equal(groundChunkDescriptor(partial,1,1,indexGroundEdits(partial)),null);
const ext=W.newMap('extend','Extend',32,24);W.prepareBlocks(ext);ext.chunks=ext.chunks.filter(k=>k!=='0,1');const original=JSON.stringify(ext.chunks);
assert(W.extendMap(ext,'east',16));assert.equal(ext.width,48);assert.equal(ext.height,24);assert(!W.activeCell(ext,1,17));assert(W.activeCell(ext,40,20));assert.equal(Object.keys(ext.blocks).length,0);assert(W.removeExtension(ext));assert.equal(JSON.stringify(ext.chunks),original);assert.equal(ext.width,32);
assert.equal(W.extensionRegions(ext,32)[0].w,32);assert(!W.extendMap(ext,'west',16));assert(!W.extendMap(ext,'east',-1));
const cache=createLiquidCache(),none=cache(map,W,'mj');assert.equal(none.cells.length,0);assert.equal(cache(map,W,'mj'),none);map.chunks=[...map.chunks];assert.notEqual(cache(map,W,'mj'),none);
// Real Three scene objects, fake GPU: cost of natural ground depends on the
// local view, not whether the map is 256 or 4096 cells across.
delete map.floor['2049,2049'];delete map.ground['2050,2050'];const {r}=fixture();
const render=(m)=>{m.camera.mode='fly';m.camera.fly={x:m.width/2,y:8,z:m.height/2};m.camera.angle=0;return {map:m,mode:'mj',selection:null,images:new Map(),lights:W.buildLights(m),vision:new Set(),explored:new Set(),terrainEpoch:1,path:[],showChunks:true}};
const small=W.newMap('medium','Medium',256,256);W.prepareBlocks(small);r.render(render(small));const medium=r.stats();
const opts=render(map);r.render(opts);const large=r.stats();assert.equal(large.groundPlanes,medium.groundPlanes);assert.equal(large.groundCells,medium.groundCells);assert(large.groundPlanes<150);assert.equal(large.groundCells,large.groundPlanes*256);
assert.equal(r.debug().terrain.children.length,1);assert.equal(r.debug().overlays.children.filter(o=>o.userData.chunkGrid).length,1);
const mesh=r.debug().groundBatch;r.render(opts);assert.equal(r.debug().groundBatch,mesh);
r.dispose();console.log('PASS: 4096² empty map, sparse edited ground, one terrain draw, bounded local work, chunk holes and reversible strip extensions.');

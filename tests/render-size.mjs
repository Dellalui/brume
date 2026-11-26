import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as W from '../dist/world.mjs';
import {renderer} from '../dist/scene.mjs';
import {createBufferSizer} from '../dist/render-size.mjs';
import {setText,setHidden,setValue,setData,setAttr} from '../dist/ui-values.mjs';
import {canvasStub} from '../test-support/three-fixture.mjs';
const size=createBufferSizer(),overlay={width:0,height:0};let changes=0;
const gpu={setDrawingBufferSize(w,h,dpr){changes++}};
for(let i=0;i<300;i++)size.sync(gpu,overlay,1001,751,1.5);
assert.equal(changes,1);assert.equal(overlay.width,1501);assert.equal(overlay.height,1126);
assert(!size.sync(gpu,overlay,1001.01,751.01,1.5));assert(size.sync(gpu,overlay,1002,751,1.5));assert(size.sync(gpu,overlay,1002,751,1.25));assert.equal(changes,3);
assert(!size.sync(gpu,overlay,0,751,1.25));
const fallback=createBufferSizer();let ratio=0,resize=0;
const fake={setPixelRatio(){ratio++},setSize(){resize++}};
for(let i=0;i<20;i++)fallback.sync(fake,overlay,1001,751,1.5);
fallback.sync(fake,overlay,1002,751,1.5);
assert.equal(ratio,1);assert.equal(resize,2);
let writes=0,v='60 FPS';const node={get textContent(){return v},set textContent(x){writes++;v=x}};
for(let i=0;i<300;i++)setText(node,'60 FPS');assert.equal(writes,0);setText(node,'59 FPS');assert.equal(writes,1);
const values={hidden:false,value:'fly',dataset:{dockLeft:'false'},getAttribute:()=> 'false',setAttribute(){writes++}};
setHidden(values,false);setValue(values,'fly');setData(values,'dockLeft',false);setAttr(values,'aria-pressed',false);assert.equal(writes,1);
// Exercise the actual scene renderer using Three objects and its real
// render loop, but a fake GPU implementing r180's integer buffer sizing.
let dimensions={width:1001,height:751},calls=0;
const canvas=canvasStub();canvas.getBoundingClientRect=()=>({...dimensions});
const renderGpu={shadowMap:{},setClearColor(){},setDrawingBufferSize(w,h,d){calls++;canvas.width=Math.floor(w*d);canvas.height=Math.floor(h*d)},render(s,c){s.updateMatrixWorld(true);c.updateMatrixWorld(true)},dispose(){}};
const desc=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');
Object.defineProperty(globalThis,'devicePixelRatio',{configurable:true,value:1.5});
let r;
try{
 r=renderer(canvas,{createRenderer:()=>renderGpu,createCanvas:()=>canvasStub(300,150)});
 const map=W.newMap('size','Size',24,24);W.prepareBlocks(map);
 const opts={map,mode:'mj',selection:null,images:new Map(),lights:W.buildLights(map),vision:new Set(),explored:new Set(),terrainEpoch:1,path:[]};
 for(let i=0;i<12;i++)r.render(opts);
 assert.equal(calls,1);assert.equal(r.stats().bufferResizes,1);assert.equal(r.stats().bufferWidth,1501);
 dimensions.width=1003;r.render(opts);assert.equal(calls,2);
 r.render({...opts,building:true});r.render(opts);assert.equal(calls,2);
}finally{r?.dispose();if(desc)Object.defineProperty(globalThis,'devicePixelRatio',desc);else delete globalThis.devicePixelRatio}
const editor=fs.readFileSync(new URL('../dist/editor.mjs',import.meta.url),'utf8');
assert(editor.includes('schedule();if(t<1){queueMovementFrame();return}'));
console.log('PASS: odd-size fractional-DPR render buffers, actual scene integration, stable UI values and coalesced movement rendering.');

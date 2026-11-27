import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {syncDockState} from '../dist/workspace-ui.mjs';
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../dist/editor.mjs',import.meta.url),'utf8');
const {document}=parseHTML(html);
const lines=source.split('\n');
const fn=name=>{const line=lines.find(l=>l.startsWith('function '+name+'('));assert(line,name+' missing');return line};
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const scheduled=[],camera={mode:'fly',angle:0,tilt:.45,fly:{x:4,y:5,z:6}};
const c=vm.createContext({document,$,$$,syncDockState,playerCameraMode:()=> 'first',cameraFromHeading:a=>-a-Math.PI/4,canvasHUD:{schedule(){}},inventoryOpen:false,innerWidth:1600,viewMode:'mj',mode:'play',creativeReady:true,workspaceUI:{setFocus(){},refresh(){}},renderEffectLayer(){},schedule(){scheduled.push(1)},toggleInventory(){},localStorage:{removeItem(){}},toast(){},selected:()=>({id:'actor'}),actor:()=>({id:'actor',facing:0}),map:()=>({width:32,height:32,camera}),canvas:$('#map'),stopCreativeStroke(){},stopMovement(){},clearNavigationInput(){},recenterPlayer(){},renderCreative(){},refresh(){},setTool(){},setBuildTab(){},buildTab:'catalog',tool:'select',adding:null,drawBrush:null,dirty:false,W:{FX:{},TYPES:{}},structuredClone});
vm.runInContext(['syncPanels','showPanel','closePanel','resetLayout','syncWorkspace','setView','setMode'].map(fn).join('\n'),c);
const run=s=>vm.runInContext(s,c);
const panel=id=>document.getElementById(id);
const open=id=>!panel(id).hidden;
const buttons=id=>[...document.querySelectorAll('[data-panel]')].filter(b=>b.dataset.panel===id);
// Execute the editor's real click bindings, not a separate mock controller.
const bindings=lines.find(l=>l.startsWith("$$('[data-panel]').forEach"));
assert(bindings);run(bindings);
run('syncPanels()');
for(const id of ['layersPanel','lightPanel','effectsPanel','journalPanel','bookmarksPanel']){
 const button=buttons(id)[0];assert(button,id);
 button.onclick();assert(open(id),'open '+id);assert.equal(button.getAttribute('aria-expanded'),'true');
 assert.equal(document.body.dataset.dockLeft,'true');
 assert([...document.querySelectorAll('.panel:not(.legacy-build-data)')].filter(p=>p.id!=='inspectorPanel'&&!p.hidden).length<=1);
 button.onclick();assert(!open(id),'close '+id);assert.equal(button.getAttribute('aria-expanded'),'false');
}
run("showPanel('inspectorPanel');showPanel('layersPanel');syncWorkspace()");
assert(open('inspectorPanel')&&open('layersPanel'),'wide layout');
assert.equal(document.body.dataset.dockRight,'true');
// Execute the actual resize callback from editor.mjs.
const resize=lines.find(l=>l.startsWith("window.addEventListener('resize'"));
assert(resize);const end=resize.indexOf(";window.addEventListener('pagehide'");assert(end>0);
let resizeHandler;c.window={addEventListener(type,cb){assert.equal(type,'resize');resizeHandler=cb}};
run(resize.slice(0,end+1));c.innerWidth=900;resizeHandler();
assert([...document.querySelectorAll('.panel:not(.legacy-build-data)')].filter(p=>!p.hidden).length<=1,'narrow layout');
run('resetLayout()');assert([...document.querySelectorAll('.panel')].every(p=>p.hidden));
assert.equal(document.body.dataset.dockLeft,'false');assert.equal(document.body.dataset.dockRight,'false');
// Linkedom's select.value is read-only in some releases. Give the existing
// select its browser-equivalent writable value for the view/mode tests.
const view=panel('viewMode');let value='mj';
Object.defineProperty(view,'value',{configurable:true,get:()=>value,set:v=>{value=v}});
c.innerWidth=1600;run("showPanel('layersPanel');showPanel('inspectorPanel');setView('selected')");
assert.equal(c.viewMode,'selected');assert.equal(camera.mode,'first');assert([...document.querySelectorAll('.panel')].every(p=>p.hidden));
run("syncWorkspace();showPanel('lightPanel')");assert(!open('lightPanel'),'MJ panels hidden in player view');
run("setView('mj');setMode('build');syncWorkspace()");assert.equal(c.mode,'build');assert.equal(camera.mode,'fly');
run("setMode('play');syncWorkspace()");assert.equal(c.mode,'play');
assert(scheduled.length>0);
assert(!/\bof\s+(?<!\$)\$\((?:'[^']*'|"[^"]*")\)\s*\)/.test(source),'querySelector must not be iterated directly');
console.log('PASS: real editor panel clicks, workspace sync, resize, reset, player view, construction/play modes and collection selectors.');

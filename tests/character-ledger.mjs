import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {moneyAmount,walletValues,monitorConfig,monitorLayout,monitorPosition} from '../dist/character-ledger.mjs';
import {inspectorRows,propertyLayout} from '../dist/canvas-properties.mjs';
import {syncDockState} from '../dist/workspace-ui.mjs';
assert.equal(moneyAmount(12.3456),12.346);for(const v of [-1,'',NaN,Infinity,1e13])assert.equal(moneyAmount(v),null);
assert.deepEqual(walletValues({}),[]);
const a={wallet:[{id:'gold',name:'Or',value:1000,icon:'coin'},{id:'secret',name:'Secret',value:50,visible:false}]};
assert.equal(walletValues(a).length,1);assert.equal(walletValues(a,true).length,2);
assert.equal(walletValues(JSON.parse(JSON.stringify(a)))[0].value,1000);
const m={hudMonitor:{ids:['x','x','y',false],x:5,y:-2}};assert.deepEqual(monitorConfig(m),{ids:['x','y'],x:1,y:0,collapsed:false});
for(const w of [320,640,1280,1920])for(const h of [320,420,720,1080]){
 const r=monitorLayout(w,h,12,{x:1,y:1,collapsed:false},3),p=propertyLayout(w,h);
 assert(r.x>=0&&r.x+r.w<=w&&r.y>=0&&r.y+r.h<=h);
 assert(r.length<=3&&r.pages>=4);
 const moved=monitorPosition(-100,10000,r,w,h);assert.deepEqual(moved,{x:0,y:1});
 assert(p.x>=0&&p.x+p.w<=w&&p.y+p.h<=h);
}
const {document}=parseHTML('<html><body class="canvas-inspector"><section id="inspectorPanel" class="panel"></section><div id="root"><label>Nom<input id="name"></label><details><summary>Vision</summary><label>Portée<input id="far"></label></details><div hidden><button>Secret</button></div><button id="save">Enregistrer</button></div></body></html>');
const root=document.getElementById('root'),detail=root.querySelector('details');detail.open=false;
let rows=inspectorRows(root);assert.deepEqual(rows.map(r=>r.kind),['field','section','button']);assert.equal(rows[0].label,'Nom');assert.equal(rows[0].node,document.getElementById('name'));
detail.open=true;rows=inspectorRows(root);assert(rows.some(r=>r.node?.id==='far'));
assert(!rows.some(r=>r.label==='Secret'));syncDockState(document);assert.equal(document.body.dataset.dockRight,'false');
console.log('PASS: wallet validation and privacy, monitor persistence/geometry, live inspector field bindings and non-docked layout.');

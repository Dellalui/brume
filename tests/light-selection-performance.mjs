import assert from 'node:assert/strict';
import {selectSceneLights,selectLocalLights} from '../dist/shadow-system.mjs';
const anchor={x:21,y:13},viewer={x:33,y:20};
const sources=Array.from({length:256},(_,i)=>({owner:'l'+i,x:i%32,y:(i*17)%37,z:i%3,radius:1+i%8,power:i%7,secondary:i%3===0,color:'#ffffff'}));
const valid=s=>s&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&s.power>0;
const score=s=>Math.hypot(s.x-anchor.x,s.y-anchor.y)-Math.min(8,s.radius||0)*.5-Math.min(2,s.power||0);
const tie=s=>[s.owner??'',s.x,s.y,s.z??0,s.radius??0,s.color??''].join('|');
const old=(src,n)=>src.filter(valid).sort((a,b)=>Number(!!a.secondary)-Number(!!b.secondary)||score(a)-score(b)||tie(a).localeCompare(tie(b))).slice(0,n);
for(const src of [sources,[...sources].reverse(),[...sources,sources[10]]]){
 for(const n of [1,2,4,8,12]){
  assert.deepEqual(selectSceneLights(src,anchor,n),old(src,n));
  const previous=old(src,5),stable=old(src,1)[0],id=s=>[s.owner,s.x,s.y,s.z,s.secondary].join('|'),prior=new Set(previous.map(id));
  const near=s=>Math.hypot(s.x-viewer.x,s.y-viewer.y)-(s.radius||0)-(prior.has(id(s))?2:0);
  assert.deepEqual(selectLocalLights(src,anchor,viewer,previous,n),[stable,...src.filter(s=>s!==stable&&valid(s)).sort((a,b)=>near(a)-near(b)||id(a).localeCompare(id(b))).slice(0,n-1)]);
 }
}
console.log('PASS: bounded light selection matches the full stable sort.');

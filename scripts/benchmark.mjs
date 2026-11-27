import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=pathToFileURL(resolve(process.argv[2]||'.')+'/'),mod=n=>import(new URL('dist/'+n+'.mjs',root));
const W=await mod('world'),C=await mod('construction'),{createPathSync}=await mod('path-sync'),{createPartyVisionCache}=await mod('party-vision');
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)],time=(f,n=20)=>{const a=[];for(let i=0;i<n;i++){const start=performance.now();f(i);a.push(performance.now()-start)}return +median(a).toFixed(3)};
const map=W.newMap('bench','Benchmark',256,256);W.prepareBlocks(map);
for(let i=0;i<8000;i++)map.objects.push(C.blockObject('stone',i%40,Math.floor(i/40)%40,Math.floor(i/1600),1,1,1,0,'b'+i));
const hero=W.newObject('hero',60,60,'hero');map.objects.push(hero);const sync=createPathSync();sync.prepare(map);
const result={stationaryPathSyncMs:time(()=>sync.prepare(map)),movingActorSyncMs:time(()=>{hero.x+=.25;sync.prepare(map)}),stationaryMessageBytes:JSON.stringify(sync.prepare(map)).length};
hero.x+=1;result.movedMessageBytes=JSON.stringify(sync.prepare(map)).length;
const world={version:4,maps:[map],active:map.id},history=[];
let capture;try{({capture}=await mod('history'))}catch{capture=JSON.stringify}
capture(world);result.historySnapshotMs=time(()=>{hero.hp--;history.push(capture(world))},35);
if(typeof history[0]==='string')result.historyRetainedBytes=history.reduce((n,h)=>n+h.length*2,0);else{const seen=new Set();let bytes=0;function visit(o){if(!o||typeof o!=='object')return;if(seen.has(o))return;seen.add(o);bytes+=Array.isArray(o)?o.length*8:Object.keys(o).length*32;for(const v of Object.values(o))visit(v)}for(const h of history)visit(h);result.historyRetainedEstimateBytes=bytes}
const vm=W.newMap('vision','Vision',64,64);W.prepareBlocks(vm);vm.objects=Array.from({length:10},(_,i)=>W.newObject('hero',20+i%5,20+Math.floor(i/5),'a'+i));const lights=W.buildLights(vm),cache=createPartyVisionCache();
result.partyColdFrameMs=time(()=>{cache.clear();cache.collect(vm,vm.objects,lights,0,{budgetMs:4})},10);
result.partyColdFrameObservers=(()=>{cache.clear();return cache.collect(vm,vm.objects,lights,0,{budgetMs:4}).recomputed})();
console.log(JSON.stringify(result,null,2));

import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {blockObject} from '../dist/construction.mjs';
import {traceProjectile} from '../dist/projectile-collision.mjs';
import {createThrowQueue,planImpact,applyImpactBatch} from '../dist/throw-effects.mjs';
import {createChunkOcclusionCache,buildBlockOcclusion} from '../dist/block-occlusion.mjs';
const fresh=()=>{const m=W.newMap('wall','Wall impacts',64,64);W.prepareBlocks(m);return m};
function fire(m,from,direction,settings={}){
 const queue=createThrowQueue(),hits=[];
 assert(queue.fire(m,true,from,direction,{range:32,speed:100,power:3,...settings},W,0));
 const effects=queue.advance(m,true,250,(point,item)=>hits.push({point,item}));
 assert.equal(hits.length,1,'a real collision produces one damage transaction');
 assert(effects.some(p=>p.phase==='impact'));
 return hits;
}
const from={x:10.5,y:16.5,z:4.25},dir={x:1,y:0,z:0};
for(const shape of ['sphere','ring','disc','dome','cone','cube','column']){
 const m=fresh();W.setBlock(m,14,16,4,'stone',.5);
 const hits=fire(m,from,dir,{layers:[{shape}]});
 assert.deepEqual(hits[0].item.contact,{kind:'voxel',id:'14,16,4',cell:[14,16]});
 assert(applyImpactBatch(m,hits,W).changed,shape+' breaks the direct contact');
 assert.equal(W.blockAt(m,14,16,4.25),null);
}
const reverse=fresh();W.setBlock(reverse,14,16,4,'stone');const rev=fire(reverse,{x:18.5,y:16.5,z:4.25},{x:-1,y:0,z:0},{layers:[{shape:'ring'}]});
assert.equal(rev[0].item.contact.id,'14,16,4');applyImpactBatch(reverse,rev,W);assert.equal(W.blockAt(reverse,14,16,4.25),null);
const seam=fresh();W.setBlock(seam,14,16,4,'glass');assert.equal(traceProjectile(seam,{...from,z:4},{x:20,y:16.5,z:4},W).id,'14,16,4');
const placed=fresh();placed.objects.push(blockObject('stone',14,16,4,1,1,1,.3,'wall'));
const placedHits=fire(placed,from,dir,{layers:[{shape:'ring'}]});assert.equal(placedHits[0].item.contact.id,'wall');applyImpactBatch(placed,placedHits,W);assert(!placed.objects.some(o=>o.id==='wall'));
const protectedMap=fresh();protectedMap.groups.push({id:'safe',locked:true});W.setBlock(protectedMap,14,16,4,'stone');protectedMap.blockGroups={'14,16,4':'safe'};W.setBlock(protectedMap,15,16,4,'glass');
const lockedHits=fire(protectedMap,from,dir,{power:6});const protectedPlan=planImpact(protectedMap,lockedHits[0].point,lockedHits[0].item,W);assert(!protectedPlan.voxels.some(v=>v.x===14||v.x===15),'locked contact shields itself and blocks directly behind');
applyImpactBatch(protectedMap,lockedHits,W);assert.equal(W.blockAt(protectedMap,14,16,4.25),'stone');assert.equal(W.blockAt(protectedMap,15,16,4.25),'glass');
const hard=fresh();W.setBlock(hard,14,16,4,'obsidian');applyImpactBatch(hard,fire(hard,from,dir,{power:3}),W);assert.equal(W.blockAt(hard,14,16,4.25),'obsidian','direct hit still respects material hardness');
const visual=fresh();W.setBlock(visual,14,16,4,'stone');assert(!applyImpactBatch(visual,fire(visual,from,dir,{destroy:false}),W).changed);assert.equal(W.blockAt(visual,14,16,4.25),'stone');
const cliff=fresh();cliff.ground={};for(let x=8;x<14;x++)for(let y=12;y<21;y++)cliff.ground[x+','+y]=-10;
const cache=createChunkOcclusionCache();cache.collect(cliff,{epoch:1});const token=cache.beginRemoval(cliff,1);
const hits=fire(cliff,{x:10.5,y:16.5,z:-6.25},dir,{power:2,layers:[{shape:'sphere'}]});
assert.deepEqual(hits[0].item.contact,{kind:'ground',id:null,cell:[14,16]});
const before=cliff.blockRevision,result=applyImpactBatch(cliff,hits,W);assert(result.changed);assert(result.changes.addedVoxels.length>0,'intact overburden is kept as explicit blocks');
assert.equal(W.blockAt(cliff,14,16,-6.25),null);assert(W.groundAt(cliff,14,16)<-6.25);assert(W.blockAt(cliff,14,16,-.25),'cliff above the impact remains solid');
assert.equal(W.groundAt(cliff,30,30),0);assert.equal(cliff.blockRevision,before+result.changes.voxels.length+result.changes.ground+result.changes.addedVoxels.length);
cliff.buildRevision=1;assert.equal(cache.finishRemoval(cliff,2,token,result.changes),false,'new soil voxels require rebuilding the removal-only cache');
assert.deepEqual(cache.collect(cliff,{epoch:2}),buildBlockOcclusion(cliff));
console.log('PASS: directional wall hits, all damage shapes, reverse faces, voxel seams, placed blocks, protection, resistance, visual-only impacts and localized cliff excavation.');

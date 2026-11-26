import assert from 'node:assert/strict';
import * as W from '../dist/world.mjs';
import {deriveLiquids,liquidMeshData,liquidSurfaceProfiles} from '../dist/liquid-flow.mjs';
const b=(x,y,z,h,renderH,extra={})=>({x,y,z,h,renderH,kind:'lava',source:false,...extra});
const cells=[b(15,10,0,1,.88,{source:true}),b(16,10,0,1,.66),b(17,10,0,1,.44),b(18,10,0,1,.22)];
const p=liquidSurfaceProfiles(cells);
for(let i=1;i<cells.length;i++){
 const a=p.profiles.get(cells[i-1]),c=p.profiles.get(cells[i]);
 assert.equal(a.p[3][1],c.p[0][1]);assert.equal(a.p[2][1],c.p[1][1]);
 assert.deepEqual(p.normal(a.corners[3].id),p.normal(c.corners[0].id));
}
assert.notEqual(p.profiles.get(cells[1]).p[0][1],p.profiles.get(cells[1]).p[3][1]);
const result={cells,irregular:[]},mesh=liquidMeshData(result);assert.equal(mesh.length,2);
const checkGeometry=batches=>{for(const m of batches){assert.equal(m.positions.length,m.normals.length);assert.equal(m.positions.length%9,0);assert(m.positions.every(Number.isFinite));for(let i=0;i<m.normals.length;i+=3)assert(Math.abs(Math.hypot(...m.normals.slice(i,i+3))-1)<1e-6)}};
checkGeometry(mesh);
assert.deepEqual(liquidMeshData(result,x=>x.x>=16),mesh.filter(m=>m.positions.every((v,i)=>i%3!==0||v>=16)),'region boundaries do not alter corner normals');
const flat=[b(0,0,0,1,.88,{source:true}),b(1,0,0,1,.88,{source:true})];
assert.equal(liquidMeshData({cells:flat,irregular:[]}).reduce((n,m)=>n+m.positions.length,0),180,'interior sides omitted');
const diagonal=[b(0,0,0,1,.8),b(1,1,0,1,.2)],d=liquidSurfaceProfiles(diagonal);
assert.notEqual(d.profiles.get(diagonal[0]).p[2][1],d.profiles.get(diagonal[1]).p[0][1]);
const stack=[b(0,0,0,1,1,{falling:true}),b(0,0,1,1,.88,{source:true}),b(1,0,0,1,.4)];
assert(!liquidSurfaceProfiles(stack).profiles.get(stack[0]).top);
checkGeometry(liquidMeshData({cells:stack,irregular:[]}));
checkGeometry(liquidMeshData({cells:[b(0,0,0,1,.8),b(1,0,.5,.5,.3)],irregular:[{...b(4,4,0,1,1),w:1.5,d:1.2,angle:.4}]}));
for(const kind of ['water','lava']){
 const map=W.newMap('smooth','Smooth',32,32);W.prepareBlocks(map);W.setBlock(map,16,16,2,kind);
 const save=JSON.stringify(map),flow=deriveLiquids(map,W);
 assert.equal(JSON.stringify(map),save);checkGeometry(liquidMeshData(flow));
 assert(flow.cells.some(b=>b.falling));
}
console.log('PASS: smooth liquid slopes, matching corners and normals, no internal faces, region boundaries and waterfall geometry.');

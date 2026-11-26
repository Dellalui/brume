import assert from 'node:assert/strict';
import fs from 'node:fs';
import {routeMarkers,routeMarkerGeometry} from '../dist/path-markers.mjs';
const a={x:.5,y:.5,z:0},b={x:1.5,y:.5,z:0},c={x:2.5,y:1.5,z:0},d={x:3.5,y:1.5,z:0};
const route=routeMarkers([a,b,c,d]);
assert(route.dashes.length>3);assert.equal(route.target,d);
assert(route.dashes.every(p=>p.z===0&&p.length<=.24));
for(const dash of route.dashes){
 const onSegment=(p,q)=>Math.abs((dash.x-p.x)*(q.y-p.y)-(dash.y-p.y)*(q.x-p.x))<1e-6&&dash.x>=Math.min(p.x,q.x)-1e-6&&dash.x<=Math.max(p.x,q.x)+1e-6;
 assert(onSegment(a,b)||onSegment(b,c)||onSegment(c,d),'marker follows a real path segment');
}
assert(routeMarkers([a,null,c,d]).dashes.every(p=>p.x>=c.x));
assert.equal(routeMarkers([a,null]).target,null);
assert(routeMarkers([a,{...b,z:1},c]).dashes.every(p=>p.length===0));
const g=routeMarkerGeometry(route);
for(const p of [g.border,g.ink]){assert(p.length>0&&p.length%9===0&&p.every(Number.isFinite))}
assert.equal(routeMarkerGeometry(routeMarkers([])).ink.length,0);
assert.equal(routeMarkerGeometry(routeMarkers([a])).ink.length,0);
const scene=fs.readFileSync(new URL('../dist/scene.mjs',import.meta.url),'utf8');
assert(scene.includes("mesh.userData.pathMarker=true")&&scene.includes("function drawRouteMarkers"));
assert(scene.includes("depthTest:true,depthWrite:false,side:T.DoubleSide,toneMapped:false"));
assert(scene.includes("opts.pathKind==='measure'"));
console.log('PASS: rounded route markers, visibility gaps, height transitions, destination and finite geometry.');

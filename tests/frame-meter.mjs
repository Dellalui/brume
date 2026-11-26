import assert from 'node:assert/strict';
import {createFrameMeter} from '../dist/frame-meter.mjs';
let m=createFrameMeter();assert(m.read(0).idle);for(let i=0;i<61;i++)m.record(i*1000/60,5,{triangles:8000,calls:48});
let s=m.read(1000);assert(Math.abs(s.fps-60)<.01);assert.equal(s.cpu,5);assert.equal(s.triangles,8000);assert.equal(s.calls,48);assert(m.read(1700).idle);m.record(1900,10);assert.equal(m.read(1900).fps,null);
console.log('PASS: measured FPS, CPU and idle state.');

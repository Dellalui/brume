import assert from 'node:assert/strict';
import {IMPACT_PROFILES,IMPACT_SAMPLE_RATE,IMPACT_VARIANTS,renderImpactSample,renderImpactBank,impactHearing} from '../dist/impact-samples.mjs';
import {EFFECT_TYPES} from '../dist/effect-recipes.mjs';
import {createGameAudio,MAX_SOUND_VOICES} from '../dist/game-audio.mjs';
const rate=IMPACT_SAMPLE_RATE;
assert.deepEqual(Object.keys(IMPACT_PROFILES).sort(),EFFECT_TYPES.map(t=>t.id).sort());
const rms=(a,start=0,end=a.length)=>Math.sqrt(a.slice(start,end).reduce((s,v)=>s+v*v,0)/Math.max(1,end-start));
const bank=renderImpactBank();let samples=0,bytes=0;
for(const [kind,variants]of Object.entries(bank)){
 assert.equal(variants.length,IMPACT_VARIANTS);
 for(const a of variants){
  assert.equal(a.length,Math.round(rate*IMPACT_PROFILES[kind].duration));
  assert(a.every(v=>Number.isFinite(v)&&Math.abs(v)<=.881));assert(Math.abs(a.at(-1))<1e-6);
  assert(rms(a,0,Math.floor(rate*.12))>rms(a,a.length-Math.floor(rate*.12),a.length)*4,'strong attack, quiet tail');
  assert(rms(a,Math.floor(rate*.12),Math.floor(rate*.42))>.015,'audible body after transient');
  samples++;bytes+=a.byteLength;
 }
 assert.notDeepEqual(variants[0],variants[1],'independent variations');
}
assert.equal(samples,36);assert(bytes<10*1024*1024);
assert.deepEqual(bank.blast[0],renderImpactSample('blast',0));
const listener={x:0,y:0,z:0,rx:1,ry:0,rz:0};
const near=impactHearing({x:1,y:0,z:0},listener,48),far=impactHearing({x:36,y:0,z:0},listener,48);
assert(near.gain>far.gain&&near.cutoff>far.cutoff);assert.equal(far.pan,1);assert.equal(impactHearing({x:49,y:0,z:0},listener,48).gain,0);
class Param{value=0;setTargetAtTime(v){this.value=v}setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.value=v}exponentialRampToValueAtTime(v){this.value=v}}
class Node{gain=new Param();pan=new Param();frequency=new Param();Q=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();connect(){}disconnect(){}start(){}stop(){}}
class Context{
 state='running';sampleRate=48000;currentTime=0;destination={};oscillators=0;buffers=[];filters=[];
 createGain(){return new Node()}createStereoPanner(){return new Node()}createDynamicsCompressor(){return new Node()}
 createBiquadFilter(){const n=new Node();this.filters.push(n);return n}
 createBufferSource(){const n=new Node();this.buffers.push(n);return n}createOscillator(){this.oscillators++;return new Node()}
 createBuffer(c,n,sr){const data=new Float32Array(n);return {sampleRate:sr,getChannelData:()=>data}}
 resume(){return Promise.resolve()}close(){return Promise.resolve()}
}
const worker={terminate(){this.terminated=true}},ctx=new Context(),audio=createGameAudio({createContext:()=>ctx,createImpactWorker:()=>worker});
worker.onmessage({data:{bank}});assert(worker.terminated);assert(audio.unlock());assert.equal(audio.stats().impactSamples,36);
const event=(kind,x=1)=>({position:{x,y:0,z:0},config:{id:kind,soundEnabled:true,soundVolume:1,soundRange:48}});
assert.equal(audio.playImpacts([event('blast'),event('blast'),event('blast'),event('blast'),event('fire')],listener),2,'duplicates do not starve other kinds');
assert.equal(ctx.oscillators,0);assert(ctx.buffers.every(n=>n.loop===false));assert(ctx.buffers.every(n=>n.buffer.sampleRate===rate));
const first=ctx.buffers[0].buffer;
ctx.currentTime=.1;assert(audio.play('blast',{x:36,y:0,z:0},listener));assert.notEqual(ctx.buffers.at(-1).buffer,first);assert(ctx.filters.at(-1).frequency.value<ctx.filters[0].frequency.value);
for(let i=0;i<10;i++){ctx.currentTime+=.06;audio.playImpacts(Object.keys(IMPACT_PROFILES).map(k=>event(k)),listener)}
assert(audio.stats().voices<=MAX_SOUND_VOICES);assert.equal(ctx.oscillators,0);
const count=audio.stats().started;ctx.currentTime=1.5;assert(audio.playImpacts([event('blast')],listener)>0);assert(audio.stats().started>count);assert(audio.stats().voices<=MAX_SOUND_VOICES);
audio.dispose();
const slowWorker={terminate(){}},ctx2=new Context(),slow=createGameAudio({createContext:()=>ctx2,createImpactWorker:()=>slowWorker});
assert(slow.unlock());assert.equal(slow.stats().impactSamples,1);assert(slow.play('blast',{x:0,y:0,z:0},listener));assert.equal(ctx2.oscillators,0);slowWorker.onmessage({data:{bank}});assert.equal(slow.stats().impactSamples,36);slow.dispose();

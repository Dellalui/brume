import {audioPreferences,spatialSound} from './impact-feedback.mjs';
// Original procedural sounds. One shared noise buffer; native audio nodes
// run off the rendering thread. No network requests or licensed samples.
export const MAX_SOUND_VOICES=8,MAX_AMBIENT_VOICES=3,MAX_IMPACTS_PER_FRAME=4;
// duration, noise level, start/end filter Hz, oscillator start/end Hz,
// oscillator level, waveform, filter type.
const sound=(duration,noise,from,to,freq,end,tone,wave='sine',filter='lowpass')=>({duration,noise,from,to,freq,end,tone,wave,filter});
export const IMPACT_SOUNDS=Object.freeze({
 blast:sound(1.05,.9,1800,90,95,28,.6),
 fire:sound(.9,.65,1300,220,165,50,.32,'triangle'),
 ice:sound(.65,.38,7800,1600,1800,480,.45,'triangle','highpass'),
 storm:sound(.65,.75,5200,330,220,42,.4,'sawtooth','bandpass'),
 arcane:sound(.9,.22,1600,430,380,820,.64,'sine','bandpass'),
 dust:sound(.48,.75,850,140,90,45,.18),
 toxic:sound(1.1,.5,1100,240,160,65,.28,'triangle','bandpass'),
 holy:sound(1.2,.16,3600,1500,520,1040,.64,'sine','highpass'),
 void:sound(.95,.48,180,1800,150,35,.66,'sine','bandpass'),
 distortion:sound(.65,.35,500,2200,260,110,.48,'triangle','bandpass'),
 blackhole:sound(1.8,.4,420,65,65,22,.7,'sine'),
 shockwave:sound(.62,.63,1100,90,120,30,.65),
});
const OTHER_SOUNDS=Object.freeze({
 launch:sound(.2,.42,2500,650,290,630,.24,'triangle','bandpass'),
 'door-open':sound(.48,.26,650,230,125,75,.35,'triangle'),
 'door-close':sound(.24,.55,850,150,100,45,.35,'triangle'),
 'place-stone':sound(.16,.55,1300,350,175,72,.32),
 'break-stone':sound(.34,.75,2300,400,125,45,.28),
 'place-wood':sound(.17,.34,1000,240,250,95,.55,'triangle'),
 'break-wood':sound(.33,.64,3300,800,210,75,.33,'triangle'),
 'place-earth':sound(.16,.65,580,100,90,48,.12),
 'break-earth':sound(.32,.75,960,170,80,40,.14),
 'place-glass':sound(.19,.2,5500,1800,1050,700,.5,'triangle','highpass'),
 'break-glass':sound(.45,.57,7400,2100,1450,530,.44,'triangle','highpass'),
 'place-liquid':sound(.32,.48,1600,260,350,110,.24,'sine','bandpass'),
 'break-liquid':sound(.25,.4,2000,430,480,135,.18,'sine','bandpass'),
 'place-magic':sound(.28,.17,2800,800,570,880,.5,'sine'),
 'break-magic':sound(.4,.28,3700,1000,880,330,.44,'triangle')
});
// Each of the existing 16 world FX has a distinct low-volume ambience.
const ambient=(hz,noise,tone,freq,wave='sine',filter='lowpass')=>({hz,noise,tone,freq,wave,filter});
export const AMBIENT_SOUNDS=Object.freeze({
 lightning:ambient(3700,.14,.035,110,'sawtooth','bandpass'),
 heal:ambient(1800,.035,.13,440),
 fire:ambient(950,.22,.015,70,'triangle'),
 smoke:ambient(340,.12,0,50),mist:ambient(230,.085,.025,90),
 embers:ambient(2100,.13,.014,100,'triangle','bandpass'),
 sparks:ambient(5200,.095,.035,710,'triangle','highpass'),
 rain:ambient(4600,.23,0,80,'sine','highpass'),
 snow:ambient(1050,.065,0,90,'sine','bandpass'),
 dust:ambient(480,.13,0,80,'sine','bandpass'),
 fireflies:ambient(2400,.035,.035,880),
 magic:ambient(1250,.055,.11,330,'sine','bandpass'),
 poison:ambient(560,.12,.045,93,'triangle','bandpass'),
 waterfall:ambient(2700,.30,0,75,'sine','lowpass'),
 vortex:ambient(680,.19,.04,85,'triangle','bandpass'),
 beam:ambient(950,.05,.105,196,'sine','bandpass')
});
export function materialSound(material,category,remove=false){
 const family=['water','lava'].includes(material)?'liquid':['glass','ice','crystal'].includes(material)?'glass':material==='glowstone'?'magic':category==='wood'?'wood':category==='terrain'||category==='nature'?'earth':'stone';
 return (remove?'break-':'place-')+family;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const level=n=>Number.isFinite(n)?clamp(n,0,1):1;
export function createGameAudio({settings={},createContext=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null}}={}){
 let prefs=audioPreferences(settings),ctx=null,master=null,noise=null,failed=false,nextAmbient=0,paused=false,started=0,skipped=0;
 const voices=new Set(),loops=new Map(),cooldowns=new Map();
 const ready=()=>!paused&&prefs.sound&&prefs.volume>0&&ctx?.state==='running';
 function unlock(){
  if(failed||!prefs.sound)return false;
  paused=false;
  try{
   if(!ctx){
    ctx=createContext();if(!ctx){failed=true;return false}
    master=ctx.createGain();const limit=ctx.createDynamicsCompressor();limit.threshold.value=-18;limit.knee.value=12;limit.ratio.value=8;limit.attack.value=.003;limit.release.value=.14;master.gain.value=prefs.volume*.65;master.connect(limit);limit.connect(ctx.destination);
    // Deterministic, seamless repeating noise, generated only once on a
    // trusted user gesture, not during an explosion/render frame.
    noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*1.5),ctx.sampleRate);const data=noise.getChannelData(0);let seed=0x6d2b79f5;
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1}
    const edge=Math.min(96,Math.floor(data.length/4));for(let i=0;i<edge;i++){const t=i/edge;data[i]*=t;data[data.length-1-i]*=t}
   }
   if(ctx.state==='suspended'||ctx.state==='interrupted'){const p=ctx.resume();p?.catch?.(()=>{})}
   return true;
  }catch{failed=true;return false}
 }
 function graph(){
  const gain=ctx.createGain(),pan=ctx.createStereoPanner?.();
  gain.gain.value=0;if(pan){gain.connect(pan);pan.connect(master)}else gain.connect(master);
  const nodes=[gain,...(pan?[pan]:[])],sources=[];
  const set=(volume,stereo,now,smooth=.035)=>{gain.gain.setTargetAtTime(volume,now,smooth);pan?.pan.setTargetAtTime(stereo,now,smooth)};
  const dispose=()=>{for(const n of sources){try{n.stop()}catch{}}for(const n of nodes){try{n.disconnect()}catch{}}};
  return {gain,pan,nodes,sources,set,dispose};
 }
 function sourceNoise(g,frequency,filter,volume,now,loop){
  if(volume<=0)return null;const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),amp=ctx.createGain();s.buffer=noise;s.loop=loop;f.type=filter;f.frequency.value=clamp(frequency,20,ctx.sampleRate*.45);f.Q.value=.7;amp.gain.value=volume;s.connect(f);f.connect(amp);amp.connect(g.gain);g.nodes.push(s,f,amp);g.sources.push(s);s.start(now);return f;
 }
 function sourceTone(g,freq,wave,volume,now){
  if(volume<=0)return null;const s=ctx.createOscillator(),amp=ctx.createGain();s.type=wave;s.frequency.value=freq;amp.gain.value=volume;s.connect(amp);amp.connect(g.gain);g.nodes.push(s,amp);g.sources.push(s);s.start(now);return s;
 }
 function reap(now){for(const v of voices)if(v.end<=now){v.graph.dispose();voices.delete(v)}}
 function start(kind,volume,pan){
  if(!ready()||volume<.008)return false;
  const p=IMPACT_SOUNDS[kind]||OTHER_SOUNDS[kind];if(!p)return false;
  const now=ctx.currentTime;reap(now);
  // Spam of the same kind is merged perceptually instead of stacking
  // hundreds of independent audio nodes and clipping the speakers.
  if(voices.size>=MAX_SOUND_VOICES||now-(cooldowns.get(kind)??-Infinity)<.055){skipped++;return false}
  const g=graph(),end=now+p.duration;
  const filter=sourceNoise(g,p.from,p.filter,p.noise,now,true),tone=sourceTone(g,p.freq,p.wave,p.tone,now);
  if(filter)filter.frequency.exponentialRampToValueAtTime(clamp(p.to,20,ctx.sampleRate*.45),end);
  if(tone)tone.frequency.exponentialRampToValueAtTime(Math.max(20,p.end),end);
  g.gain.gain.setValueAtTime(.0001,now);g.gain.gain.linearRampToValueAtTime(volume*.4,now+.012);g.gain.gain.exponentialRampToValueAtTime(.0001,end);
  if(g.pan)g.pan.pan.value=pan;
  const voice={graph:g,end};voices.add(voice);cooldowns.set(kind,now);started++;
  const cleanup=()=>{if(voices.delete(voice))g.dispose()};
  if(g.sources.length){g.sources[0].onended=cleanup;for(const s of g.sources)s.stop(end+.025)}else cleanup();
  return true;
 }
 function play(kind,point,listener,{volume=1,range=48}={}){
  if(!ready())return false;const pos=spatialSound(point,listener,range);return start(kind,pos.gain*level(volume),pos.pan);
 }
 function playImpacts(events,listener){
  if(!ready()||!events.length)return 0;
  // Keep a bounded shortlist without sorting all projectile instances.
  const best=[];
  for(const e of events){
   const c=e.config;if(c?.soundEnabled===false||!IMPACT_SOUNDS[c?.id])continue;
   const s=spatialSound(e.position,listener,c.soundRange??48),volume=s.gain*level(c.soundVolume??.85)*level(c.strength??1);
   if(volume<.008)continue;
   let i=best.findIndex(v=>v.volume<volume);if(i<0)i=best.length;if(i>=MAX_IMPACTS_PER_FRAME)continue;
   best.splice(i,0,{kind:c.id,volume,pan:s.pan});if(best.length>MAX_IMPACTS_PER_FRAME)best.pop();
  }
  let n=0;for(const e of best)if(start(e.kind,e.volume,e.pan))n++;return n;
 }
 function stopLoops(){for(const l of loops.values())l.graph.dispose();loops.clear();nextAmbient=0}
 function ambientDue(now){if(!ready()||!prefs.ambience||now<nextAmbient)return false;nextAmbient=now+180;return true}
 function syncAmbient(sources,listener){
  if(!ready()||!prefs.ambience){stopLoops();return}
  const now=ctx.currentTime,best=[];
  for(const s of sources){
   if(!AMBIENT_SOUNDS[s.kind])continue;
   const p=spatialSound(s.point,listener,s.range??24),gain=p.gain*level(s.volume??1);
   if(gain<.015)continue;
   const score=gain+(loops.has(s.id)?.065:0),entry={...s,gain,pan:p.pan,score};
   let i=best.findIndex(v=>v.score<score);if(i<0)i=best.length;if(i>=MAX_AMBIENT_VOICES)continue;best.splice(i,0,entry);if(best.length>MAX_AMBIENT_VOICES)best.pop();
  }
  const keep=new Set(best.map(s=>s.id));for(const [id,l]of loops)if(!keep.has(id)){l.graph.dispose();loops.delete(id)}
  for(const s of best){
   let l=loops.get(s.id);if(l&&l.kind!==s.kind){l.graph.dispose();loops.delete(s.id);l=null}
   if(!l){const p=AMBIENT_SOUNDS[s.kind],g=graph();sourceNoise(g,p.hz,p.filter,p.noise,now,true);sourceTone(g,p.freq,p.wave,p.tone,now);l={kind:s.kind,graph:g};loops.set(s.id,l)}
   l.graph.set(s.gain*.25,s.pan,now,.12);
  }
 }
 function stop(){for(const v of voices)v.graph.dispose();voices.clear();cooldowns.clear();stopLoops()}
 function setSettings(value){prefs=audioPreferences(value);if(master)master.gain.setTargetAtTime(prefs.volume*.65,ctx.currentTime,.035);if(!prefs.sound||prefs.volume===0)stop();else if(!prefs.ambience)stopLoops();return {...prefs}}
 function pause(){paused=true;stop();try{ctx?.suspend()?.catch?.(()=>{})}catch{}}
 return {unlock,play,playImpacts,ambientDue,syncAmbient,stop,pause,setSettings,settings:()=>({...prefs}),stats:()=>({voices:voices.size,ambient:loops.size,started,skipped,ready:!!ready()}),dispose(){stop();try{ctx?.close()?.catch?.(()=>{})}catch{}ctx=null;master=null;noise=null}};
}

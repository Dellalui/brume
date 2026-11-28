import {audioPreferences,spatialSound} from './impact-feedback.mjs';
import {IMPACT_PROFILES,IMPACT_SAMPLE_RATE,renderImpactSample,renderImpactBank,impactHearing,impactSoundEvent,SOUND_SIZE_INFO} from './impact-samples.mjs';
// Original procedural sounds. One shared noise buffer; native audio nodes
// run off the rendering thread. No network requests or licensed samples.
export const MAX_SOUND_VOICES=8,MAX_AMBIENT_VOICES=3,MAX_IMPACTS_PER_FRAME=4;
// duration, noise level, start/end filter Hz, oscillator start/end Hz,
// oscillator level, waveform, filter type.
const sound=(duration,noise,from,to,freq,end,tone,wave='sine',filter='lowpass')=>({duration,noise,from,to,freq,end,tone,wave,filter});
export const IMPACT_SOUNDS=IMPACT_PROFILES;
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
export function createGameAudio({settings={},createContext=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null},createImpactWorker=()=>typeof Worker==='undefined'?null:new Worker(new URL('./impact-sound-worker.mjs',import.meta.url),{type:'module'})}={}){
 let prefs=audioPreferences(settings),ctx=null,master=null,effectsBus=null,ambienceBus=null,noise=null,failed=false,nextAmbient=0,paused=false,started=0,skipped=0;
 const voices=new Set(),loops=new Map(),cooldowns=new Map(),variantIndex=new Map();let worker=null,pcmBank=null,sampleBank=null,backup=null,workerFailed=false,disposed=false;
 function installBank(){
  if(!ctx||!pcmBank||disposed)return;
  const next={};for(const [kind,variants]of Object.entries(pcmBank))next[kind]=variants.map(data=>makeSample(data));
  sampleBank=next;pcmBank=null;backup=null;
 }
 function makeSample(data){const buffer=ctx.createBuffer(1,data.length,IMPACT_SAMPLE_RATE);buffer.getChannelData(0).set(data);return {buffer,duration:data.length/IMPACT_SAMPLE_RATE}}
 function prepareBank(){
  if(worker||pcmBank||sampleBank||disposed)return;
  try{worker=createImpactWorker();if(!worker){workerFailed=true;return}
   worker.onmessage=e=>{if(disposed)return;pcmBank=e.data.bank;worker?.terminate();worker=null;installBank()};
   worker.onerror=()=>{worker?.terminate();worker=null;workerFailed=true};
  }catch{worker=null;workerFailed=true}
 }
 if(prefs.sound)prepareBank();
 function sampleFor(kind){
  const variants=sampleBank?.[kind];if(!variants?.length)return backup;
  const i=variantIndex.get(kind)||0;variantIndex.set(kind,(i+1)%variants.length);return variants[i];
 }
 const ready=()=>!paused&&prefs.sound&&prefs.volume>0&&ctx?.state==='running';
 function unlock(){
  if(failed||disposed||!prefs.sound)return false;
  paused=false;if(!workerFailed&&!sampleBank&&!pcmBank&&!worker)prepareBank();
  try{
   if(!ctx){
    ctx=createContext();if(!ctx){failed=true;return false}
    master=ctx.createGain();const limit=ctx.createDynamicsCompressor();limit.threshold.value=-10;limit.knee.value=7;limit.ratio.value=5;limit.attack.value=.003;limit.release.value=.17;master.gain.value=prefs.volume*.65;master.connect(limit);limit.connect(ctx.destination);effectsBus=ctx.createGain();ambienceBus=ctx.createGain();effectsBus.gain.value=prefs.effectsVolume;ambienceBus.gain.value=prefs.ambienceVolume;effectsBus.connect(master);ambienceBus.connect(master);
    // Deterministic, seamless repeating noise, generated only once on a
    // trusted user gesture, not during an explosion/render frame.
    noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*1.5),ctx.sampleRate);const data=noise.getChannelData(0);let seed=0x6d2b79f5;
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1}
    const edge=Math.min(96,Math.floor(data.length/4));for(let i=0;i<edge;i++){const t=i/edge;data[i]*=t;data[data.length-1-i]*=t}
   }
   if(!sampleBank){if(pcmBank)installBank();else if(workerFailed){pcmBank=renderImpactBank();installBank()}else if(!backup)backup=makeSample(renderImpactSample('blast',0));}
   if(ctx.state==='suspended'||ctx.state==='interrupted'){const p=ctx.resume();p?.catch?.(()=>{})}
   return true;
  }catch{failed=true;return false}
 }
 function graph(bus=effectsBus){
  const gain=ctx.createGain(),pan=ctx.createStereoPanner?.();
  gain.gain.value=0;if(pan){gain.connect(pan);pan.connect(bus)}else gain.connect(bus);
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
 function start(kind,volume,pan,cutoff=11000,size='medium',delay=0){
  if(!ready()||!prefs.effectsVolume||volume<.008)return false;
  const p=IMPACT_SOUNDS[kind]||OTHER_SOUNDS[kind];if(!p)return false;
  const now=ctx.currentTime;reap(now);
  // Spam of the same kind is merged perceptually instead of stacking
  // hundreds of independent audio nodes and clipping the speakers.
  const impact=!!IMPACT_SOUNDS[kind];
  const cooldownKey=impact?kind+'|'+size+'|'+Math.round(delay*10):kind;
  if(now-(cooldowns.get(cooldownKey)??-Infinity)<.055){skipped++;return false}
  // Reserve two slots for impacts. Replace an old impact tail rather
  // than mute every new blast for the entire multi-second sample.
  if(voices.size>=(impact?MAX_SOUND_VOICES:MAX_SOUND_VOICES-2)){
   let oldest=null;if(impact)for(const v of voices)if(now-v.start>.45&&(!oldest||v.start<oldest.start))oldest=v;
   if(!oldest){skipped++;return false}
   oldest.graph.dispose();voices.delete(oldest);
  }
  const sample=impact?sampleFor(kind):null;if(impact&&!sample)return false;
  const rate=sample?(SOUND_SIZE_INFO[size]?.rate??1):1,at=now+(sample?Math.max(0,Math.min(12,delay)):0),g=graph(),end=at+(sample?.duration??p.duration)/rate;
  if(sample){
   // One sample and one distance filter. No oscillator, real-time
   // debris generation, pitch sweep or per-impact reverb graph.
   const s=ctx.createBufferSource(),f=ctx.createBiquadFilter();s.buffer=sample.buffer;s.loop=false;if(s.playbackRate)s.playbackRate.value=rate;f.type='lowpass';f.Q.value=.707;f.frequency.value=clamp(cutoff,500,ctx.sampleRate*.45);
   s.connect(f);f.connect(g.gain);g.nodes.push(s,f);g.sources.push(s);
   g.gain.gain.setValueAtTime(volume*.85,at);s.start(at);
  }else{
   const filter=sourceNoise(g,p.from,p.filter,p.noise,now,true),tone=sourceTone(g,p.freq,p.wave,p.tone,now);
   if(filter)filter.frequency.exponentialRampToValueAtTime(clamp(p.to,20,ctx.sampleRate*.45),end);
   if(tone)tone.frequency.exponentialRampToValueAtTime(Math.max(20,p.end),end);
   g.gain.gain.setValueAtTime(.0001,now);g.gain.gain.linearRampToValueAtTime(volume*.4,now+.012);g.gain.gain.exponentialRampToValueAtTime(.0001,end);
  }
  if(g.pan)g.pan.pan.value=pan;
  const voice={graph:g,end,start:at};voices.add(voice);if(cooldowns.size>256)for(const [k,t]of cooldowns)if(now-t>1)cooldowns.delete(k);cooldowns.set(cooldownKey,now);started++;
  const cleanup=()=>{if(voices.delete(voice))g.dispose()};
  if(g.sources.length){g.sources[0].onended=cleanup;for(const s of g.sources)s.stop(end+.025)}else cleanup();
  return true;
 }
 function play(kind,point,listener,{volume=1,range=48}={}){
  if(!ready())return false;const pos=IMPACT_SOUNDS[kind]?impactHearing(point,listener,range):spatialSound(point,listener,range);return start(kind,pos.gain*level(volume),pos.pan,pos.cutoff);
 }
 function playImpacts(events,listener){
  if(!ready()||!events.length||!prefs.effectsVolume)return 0;
  const best=[];
  for(const event of events){
   const e=impactSoundEvent(event,listener,prefs);if(!e||e.volume<.008)continue;
   const same=best.findIndex(v=>v.kind===e.kind&&v.size===e.size&&Math.abs(v.delay-e.delay)<.075);
   if(same>=0){if(best[same].volume>=e.volume)continue;best.splice(same,1)}
   let i=best.findIndex(v=>v.volume<e.volume);if(i<0)i=best.length;if(i>=MAX_IMPACTS_PER_FRAME)continue;
   best.splice(i,0,e);if(best.length>MAX_IMPACTS_PER_FRAME)best.pop();
  }
  let n=0;for(const e of best)if(start(e.kind,e.volume,e.pan,e.cutoff,e.size,e.delay))n++;return n;
 }
 function previewImpact(config){
  const point={x:0,y:0,z:0},e=impactSoundEvent({position:point,config:{...config,soundDelay:0}},point,{...prefs,soundTravel:false});
  return !!e&&start(e.kind,e.volume,e.pan,e.cutoff,e.size,0);
 }
 function stopLoops(){for(const l of loops.values())l.graph.dispose();loops.clear();nextAmbient=0}
 function ambientDue(now){if(!ready()||!prefs.ambience||!prefs.ambienceVolume||now<nextAmbient)return false;nextAmbient=now+180;return true}
 function syncAmbient(sources,listener){
  if(!ready()||!prefs.ambience||!prefs.ambienceVolume){stopLoops();return}
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
   if(!l){const p=AMBIENT_SOUNDS[s.kind],g=graph(ambienceBus);sourceNoise(g,p.hz,p.filter,p.noise,now,true);sourceTone(g,p.freq,p.wave,p.tone,now);l={kind:s.kind,graph:g};loops.set(s.id,l)}
   l.graph.set(s.gain*.25,s.pan,now,.12);
  }
 }
 function stop(){for(const v of voices)v.graph.dispose();voices.clear();cooldowns.clear();stopLoops()}
 function setSettings(value){prefs=audioPreferences(value);if(master){master.gain.setTargetAtTime(prefs.volume*.65,ctx.currentTime,.035);effectsBus.gain.setTargetAtTime(prefs.effectsVolume,ctx.currentTime,.035);ambienceBus.gain.setTargetAtTime(prefs.ambienceVolume,ctx.currentTime,.035)}if(!prefs.sound||prefs.volume===0)stop();else if(!prefs.ambience||!prefs.ambienceVolume)stopLoops();return {...prefs}}
 function pause(){paused=true;stop();try{ctx?.suspend()?.catch?.(()=>{})}catch{}}
 return {unlock,play,playImpacts,previewImpact,ambientDue,syncAmbient,stop,pause,setSettings,settings:()=>({...prefs}),stats:()=>({voices:voices.size,ambient:loops.size,started,skipped,ready:!!ready(),impactSamples:sampleBank?Object.values(sampleBank).reduce((n,a)=>n+a.length,0):backup?1:0}),dispose(){disposed=true;worker?.terminate();worker=null;stop();try{ctx?.close()?.catch?.(()=>{})}catch{}ctx=null;master=null;noise=null;sampleBank=pcmBank=backup=null}};
}

// Original offline game-audio design: perceptual envelopes and spectral
// bands, not a real explosive pressure/yield model. No pitched oscillator.
export const IMPACT_SAMPLE_RATE=24000,IMPACT_VARIANTS=3;
const profile=(duration,crack,bass,body,texture,debris,room,decay,grain,attack=1)=>Object.freeze({duration,crack,bass,body,texture,debris,room,decay,grain,attack});
export const IMPACT_PROFILES=Object.freeze({
 blast:profile(2.9,1.05,1.45,.95,.36,.50,.40,.42,'stone'),
 fire:profile(2.5,.80,1.10,1.15,.52,.38,.32,.38,'fire'),
 ice:profile(2.1,.95,.52,.78,.90,.65,.34,.23,'glass'),
 storm:profile(2.8,1.22,1.28,.90,.64,.31,.43,.48,'electric'),
 arcane:profile(2.3,.68,.94,.74,.68,.40,.37,.34,'magic'),
 dust:profile(1.9,.65,1.05,.85,.28,.58,.25,.29,'stone'),
 toxic:profile(2.4,.48,.75,.91,.63,.39,.27,.39,'fire'),
 holy:profile(2.6,.85,.77,.70,.84,.47,.44,.35,'glass'),
 void:profile(2.6,.66,1.40,.85,.29,.30,.40,.48,'stone',.72),
 distortion:profile(2.0,.65,.82,.92,.43,.33,.30,.26,'electric',.75),
 blackhole:profile(3.3,.72,1.65,1.00,.28,.33,.47,.62,'stone',.8),
 shockwave:profile(2.2,1.12,1.32,.79,.22,.26,.34,.32,'stone')
});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function randomGenerator(seed){let state=seed>>>0||1;return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296}}
const grainProfiles={stone:[380,2300,.065],fire:[750,4400,.037],glass:[1900,7900,.095],electric:[850,5700,.045],magic:[650,3600,.080]};
const coeff=(f,sr)=>1-Math.exp(-2*Math.PI*Math.min(f,sr*.42)/sr);
export function renderImpactSample(kind,variant=0,sampleRate=IMPACT_SAMPLE_RATE){
 const p=IMPACT_PROFILES[kind];if(!p)throw Error('Unknown impact sound: '+kind);
 const rate=clamp(Math.round(sampleRate)||IMPACT_SAMPLE_RATE,8000,48000),index=Object.keys(IMPACT_PROFILES).indexOf(kind);
 const rng=randomGenerator(0x7b65e9ad^Math.imul(index+1,0x9e3779b9)^Math.imul(variant+1,0x85ebca6b));
 const length=Math.round(rate*p.duration),direct=new Float32Array(length),out=new Float32Array(length);
 const a28=coeff(28,rate),a105=coeff(105,rate),a410=coeff(410,rate),a1550=coeff(1550,rate),a6100=coeff(6100,rate);
 let lp28=0,lp105=0,lp410=0,lp1550=0,lp6100=0,rumble=0;
 const timeScale=.88+rng()*.24,decay=p.decay*timeScale,peakBias=.87+rng()*.22,slow=coeff(9,rate),inv=1/rate;
 // Broadband attack and separate low/mid-frequency body.
 for(let i=0;i<length;i++){
  const t=i*inv,n=rng()*2-1;
  lp28+=a28*(n-lp28);lp105+=a105*(n-lp105);lp410+=a410*(n-lp410);lp1550+=a1550*(n-lp1550);lp6100+=a6100*(n-lp6100);
  rumble+=slow*((rng()*2-1)-rumble);
  const low=(lp105-lp28)*5.6,lowMid=(lp410-lp105)*3.4,mid=(lp1550-lp410)*2.1,high=(lp6100-lp1550)*1.55;
  const onset=Math.min(1,t/.0015),bodyOn=1-Math.exp(-t/.009),attack=onset*Math.exp(-t/(.013*p.attack));
  const bodyEnv=bodyOn*Math.exp(-t/(decay*.65)),lowEnv=bodyOn*Math.exp(-t/(decay*1.25))*(.76+.24*Math.min(1,Math.abs(rumble)*13));
  const tail=(1-Math.exp(-t/.035))*Math.exp(-t/(decay*1.8));
  const crack=peakBias*p.crack*attack*(.64*n+.45*high+.33*mid);
  direct[i]=crack+p.bass*low*lowEnv*.66+p.body*(lowMid*.66+mid*.40)*bodyEnv+p.texture*(mid*.55+high*.45)*tail*.24;
 }
 // Distinct, quiet baked modal resonance over the broadband impact.
 // Fixed partials, no pitch sweep or real-time oscillator.
 if(kind==='holy'||kind==='arcane'||kind==='distortion'){
  const modes=kind==='holy'?[[392,.10,1.05],[588,.07,.85],[783,.045,.68],[1176,.028,.44]]:kind==='arcane'?[[174,.085,.65],[279,.055,.5],[463,.035,.38]]:[[83,.085,.38],[131,.065,.34],[251,.035,.25]];
  const phase=modes.map(()=>rng()*Math.PI*2);
  for(let i=0;i<length;i++){
   const t=i*inv,env=Math.min(1,t/.035)*Math.exp(-t/.92);let v=0;
   for(let j=0;j<modes.length;j++){const [hz,amp,decay]=modes[j];v+=amp*Math.sin(2*Math.PI*hz*t+phase[j])*Math.exp(-t/decay)}
   direct[i]+=v*env;
  }
 }
 // Independent, irregular secondary impacts/debris, not periodic tones.
 const [lo,hi,width]=grainProfiles[p.grain],grains=Math.round(16+p.debris*46);
 for(let j=0;j<grains;j++){
  const t=.036+Math.pow(rng(),1.65)*Math.min(p.duration*.73,decay*3.7);
  const start=Math.floor(t*rate),span=Math.min(length-start,Math.round(rate*width*(.34+rng()*1.35)));
  const strength=p.debris*(.12+rng()*.48)*Math.exp(-t/(decay*1.8)),alphaLo=coeff(lo*(.65+rng()*.7),rate),alphaHi=coeff(hi*(.65+rng()*.5),rate);
  let l=0,h=0;
  for(let i=0;i<span;i++){
   const n=rng()*2-1;l+=alphaLo*(n-l);h+=alphaHi*(n-h);
   const u=i/Math.max(1,span-1),env=Math.min(1,u*25)*Math.exp(-u*5)*Math.min(1,(1-u)*10);
   direct[start+i]+=(h-l)*strength*env;
  }
 }
 // Non-periodic, damped reflection taps. No repeating pitched delay.
 const taps=[.027,.049,.087,.142,.219,.321,.47,.69,.91].map((t,i)=>({delay:Math.max(1,Math.round(rate*t*(.82+rng()*.36))),gain:p.room*Math.pow(.73,i)*(.75+rng()*.5)*(i%3===1?-.8:1)}));
 const aReflect=coeff(1900,rate),aRemove=coeff(115,rate),aDC=coeff(20,rate);
 let reflectionLow=0,reflectionDC=0,dc=0,peak=0;
 for(let i=0;i<length;i++){
  let echo=0;for(const tap of taps)if(i>=tap.delay)echo+=direct[i-tap.delay]*tap.gain;
  reflectionLow+=aReflect*(echo-reflectionLow);reflectionDC+=aRemove*(reflectionLow-reflectionDC);
  const v=direct[i]+(reflectionLow-reflectionDC)*.75;dc+=aDC*(v-dc);
  const fade=Math.min(1,(length-1-i)/(rate*.12)),x=Math.tanh((v-dc)*.88)*Math.max(0,fade);out[i]=x;peak=Math.max(peak,Math.abs(x));
 }
 const gain=peak>0?.88/peak:0;for(let i=0;i<length;i++)out[i]*=gain;
 return out;
}
export function renderImpactBank(){const bank={};for(const kind of Object.keys(IMPACT_PROFILES))bank[kind]=Array.from({length:IMPACT_VARIANTS},(_,i)=>renderImpactSample(kind,i));return bank}
// Artistic game-audio distances; one cell = one meter only for optional
// propagation delay. This is not a physical explosion pressure model.
export const SOUND_SIZE_INFO=Object.freeze({small:{range:90,rate:1.10},medium:{range:150,rate:1},large:{range:240,rate:.91},massive:{range:360,rate:.84}});
export function soundSizeFor(c={}){
 if(Object.hasOwn(SOUND_SIZE_INFO,c.soundSize))return c.soundSize;
 const radius=Math.max(0,Number(c.soundVisualRadius??c.radius??3)||3);
 return radius>=12?'massive':radius>=5?'large':radius>=2.5?'medium':'small';
}
export function impactAudibleRange(c={},scale=1){
 const size=soundSizeFor(c),explicit=Number(c.soundRange);
 const manual=Number.isFinite(explicit)&&explicit>0&&!(explicit===48&&c.soundRangeVersion!==2);
 return clamp((manual?explicit:SOUND_SIZE_INFO[size].range)*clamp(Number(scale)||1,.5,2),1,600);
}
export function impactHearing(point,listener,range){
 if(!point||!listener||![point.x,point.y,point.z,listener.x,listener.y,listener.z,range].every(Number.isFinite)||range<=0)return {gain:0,cutoff:1000,pan:0,distance:0};
 const dx=point.x-listener.x,dy=point.y-listener.y,dz=point.z-listener.z,d=Math.hypot(dx,dy,dz),q=clamp(d/range,0,1);
 const edge=clamp((q-.72)/.28,0,1),gain=(1-edge*edge*(3-2*edge))/(1+1.4*q*q),cutoff=12000/(1+5*q*q);
 const pan=d>.001?clamp((dx*(listener.rx||0)+dy*(listener.ry||0)+dz*(listener.rz||0))/d,-1,1):0;
 return {gain,cutoff,pan,distance:d};
}
export function impactSoundEvent(event,listener,prefs={}){
 const c=event.config||{},kind=c.soundProfile==='none'?null:c.soundProfile&&c.soundProfile!=='auto'?c.soundProfile:c.id;
 if(c.soundEnabled===false||!Object.hasOwn(IMPACT_PROFILES,kind))return null;
 const size=soundSizeFor(c),heard=impactHearing(event.position,listener,impactAudibleRange(c,prefs.hearingScale));
 const unit=v=>clamp(Number.isFinite(Number(v))?Number(v):1,0,1);
 const volume=heard.gain*unit(c.soundVolume??.85)*unit(c.soundGain??1)*unit(c.strength??1);
 const delay=Math.max(0,clamp(Number(c.soundDelay)||0,0,10)+(prefs.soundTravel?heard.distance/343:0)-Math.max(0,Number(event.age)||0));
 return {kind,size,volume,pan:heard.pan,cutoff:heard.cutoff,delay};
}

export function createFrameMeter(){
 let samples=[],last=null;
 return {record(now,cpu,stats={}){
  if(!Number.isFinite(now)||!Number.isFinite(cpu))return;
  if(last&&now-last.now>600)samples=[];
  if(last&&now<=last.now)return;
  last={now,cpu,triangles:stats.triangles||0,calls:stats.calls||0,phaseMs:stats.phaseMs||{}};samples.push(last);
  while(samples.length>2&&samples[0].now<now-1000)samples.shift();
 },read(now){
  if(!last)return {idle:true,fps:null,cpu:null,triangles:0,calls:0};
  const idle=now-last.now>600,span=samples.at(-1).now-samples[0].now,intervals=samples.slice(1).map((s,i)=>s.now-samples[i].now).sort((a,b)=>a-b),p95=intervals.length?intervals[Math.ceil(intervals.length*.95)-1]:null;
  let peakPhase=null,peakPhaseMs=0,cpuPeak=0;for(const sample of samples){cpuPeak=Math.max(cpuPeak,sample.cpu);for(const [name,ms]of Object.entries(sample.phaseMs))if(Number.isFinite(ms)&&ms>peakPhaseMs){peakPhase=name;peakPhaseMs=ms}}
  return {idle,cpuPeak,peakPhase,peakPhaseMs,fps:!idle&&samples.length>1&&span>0?(samples.length-1)*1000/span:null,cpu:samples.reduce((n,s)=>n+s.cpu,0)/samples.length,triangles:last.triangles,calls:last.calls,p95,worst:intervals.at(-1)??null};
 }};
}

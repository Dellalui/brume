export function createFrameMeter(){
 let samples=[],last=null;
 return {record(now,cpu,stats={}){
  if(!Number.isFinite(now)||!Number.isFinite(cpu))return;
  if(last&&now-last.now>600)samples=[];
  if(last&&now<=last.now)return;
  last={now,cpu,triangles:stats.triangles||0,calls:stats.calls||0};samples.push(last);
  while(samples.length>2&&samples[0].now<now-1000)samples.shift();
 },read(now){
  if(!last)return {idle:true,fps:null,cpu:null,triangles:0,calls:0};
  const idle=now-last.now>600,span=samples.at(-1).now-samples[0].now;
  return {idle,fps:!idle&&samples.length>1&&span>0?(samples.length-1)*1000/span:null,cpu:samples.reduce((n,s)=>n+s.cpu,0)/samples.length,triangles:last.triangles,calls:last.calls};
 }};
}

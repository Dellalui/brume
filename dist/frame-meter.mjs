export function createFrameMeter(){
 let samples=[],last=null;
 return {record(now,cpu,stats={},stages={}){
 if(!Number.isFinite(now)||!Number.isFinite(cpu))return;if(last&&now-last.now>600)samples=[];if(last&&now<=last.now)return;last={now,cpu,triangles:stats.triangles||0,calls:stats.calls||0,stages:{...stages}};samples.push(last);while(samples.length>2&&samples[0].now<now-1000)samples.shift();if(samples.length>240)samples.shift();
 },read(now){if(!last)return {idle:true,fps:null,cpu:null,triangles:0,calls:0,p95:null,p99:null,worst:null,low1:null,stages:[]};
 const idle=now-last.now>600,span=samples.at(-1).now-samples[0].now,intervals=samples.slice(1).map((s,i)=>s.now-samples[i].now).sort((a,b)=>a-b),quantile=p=>intervals.length?intervals[Math.ceil(intervals.length*p)-1]:null;
 const slowest=intervals.slice(-Math.max(1,Math.ceil(intervals.length*.01))),slowMean=slowest.length?slowest.reduce((n,s)=>n+s,0)/slowest.length:null,summary=new Map();
 for(const sample of samples)for(const [name,ms]of Object.entries(sample.stages)){if(!Number.isFinite(ms)||ms<0)continue;const entry=summary.get(name)||{name,sum:0,max:0};entry.sum+=ms;entry.max=Math.max(entry.max,ms);summary.set(name,entry)}
 const stages=[...summary.values()].map(({name,sum,max})=>({name,mean:sum/samples.length,max})).sort((a,b)=>b.max-a.max);
 return {idle,fps:!idle&&samples.length>1&&span>0?(samples.length-1)*1000/span:null,cpu:samples.reduce((n,s)=>n+s.cpu,0)/samples.length,triangles:last.triangles,calls:last.calls,p95:quantile(.95),p99:quantile(.99),worst:intervals.at(-1)??null,low1:!idle&&slowMean>0?1000/slowMean:null,stages};
 }};
}
// A generated tree is one scene object, one indexed mesh, at most two
// material groups. The growth graph is stored, not hundreds of block objects.
// Coordinates in the graph are x/y horizontal, z vertical.
const EPS=1e-8,add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=a=>len(a)>EPS?mul(a,1/len(a)):[0,1,0],mix=(a,b,t)=>add(mul(a,1-t),mul(b,t)),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rounded=x=>Math.round(x*10000)/10000;
export function packTreeGraph(nodes){
 const ids=new Map(nodes.map((n,i)=>[n,i])),parents=new Map();
 for(const n of nodes)for(const c of n.children)parents.set(c,ids.get(n));
 const origin=nodes[0].pos.map((x,i)=>x+nodes[0].offset[i]);
 return nodes.map(n=>[rounded(n.pos[0]+n.offset[0]-origin[0]),rounded(n.pos[1]+n.offset[1]-origin[1]),rounded(n.pos[2]+n.offset[2]+.5),n.radius,parents.get(n)??-1,n.tip]);
}
export function validTreeGraph(graph){
 return Array.isArray(graph)&&graph.length>=2&&graph.length<=96&&graph.every((n,i)=>Array.isArray(n)&&n.length===6&&n.slice(0,4).every(Number.isFinite)&&Math.abs(n[0])<=30&&Math.abs(n[1])<=30&&n[2]>=0&&n[2]<=25&&n[3]>=.013&&n[3]<=.46&&(i===0?n[4]===-1:Number.isInteger(n[4])&&n[4]>=0&&n[4]<i)&&['round','broken','taper'].includes(n[5])&&(i===0||Math.hypot(n[0]-graph[n[4]][0],n[1]-graph[n[4]][1],n[2]-graph[n[4]][2])>.1));
}
// Shared tip geometry for rendering, growth steering and construction
// collision. Natural ends close with bark; only a deliberate cut uses end grain.
export function treeTipEnd(n,p){
 if(n[5]==='broken')return null;
 const d=sub(n.slice(0,3),p.slice(0,3)),l=len(d);
 if(l<=EPS)return null;
 const r=n[3],taper=n[5]==='taper',length=taper?clamp(r*3,.055,.38):clamp(r*.85,.035,.15);
 const point=add(n.slice(0,3),mul(d,length/l));point[2]=Math.max(.018,point[2]);
 return {point,radius:taper?.001:Math.max(.001,r*.08)};
}
export const isUnifiedTree=o=>o?.type==='tree'&&Array.isArray(o.treeGraph);
export function treeExtent(graph){
 if(!validTreeGraph(graph))throw Error('Structure végétale invalide.');
 let w=.5,d=.5,h=1;
 for(const [x,y,z,r]of graph){w=Math.max(w,Math.abs(x)+r+.45);d=Math.max(d,Math.abs(y)+r+.45);h=Math.max(h,z+r+.45)}
 return {w:Math.ceil(w*20)/10,d:Math.ceil(d*20)/10,height:Math.ceil(h*10)/10,trunkRadius:Math.min(.55,graph[0][3]*1.22)};
}
function basis(t){
 // Pick the least aligned axis; no degeneracy on a vertical trunk.
 const ref=Math.abs(t[0])<.8?[1,0,0]:[0,0,1];
 return unit(sub(ref,mul(t,dot(ref,t))));
}
function smoothSamples(points){
 const out=[];const tangent=i=>{
  const p=points[i].p,a=points[Math.max(0,i-1)].p,b=points[Math.min(points.length-1,i+1)].p;
  if(i===0)return unit(sub(b,p));if(i===points.length-1)return unit(sub(p,a));
  return unit(add(unit(sub(p,a)),unit(sub(b,p))));
 };
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],d=len(sub(b.p,a.p)),m0=mul(tangent(i),d*.78),m1=mul(tangent(i+1),d*.78),steps=d>.65?3:2;
  for(let j=0;j<steps;j++){
   const t=j/steps,t2=t*t,t3=t2*t;
   const p=add(add(mul(a.p,2*t3-3*t2+1),mul(m0,t3-2*t2+t)),add(mul(b.p,-2*t3+3*t2),mul(m1,t3-t2)));
   const v=add(add(mul(a.p,6*t2-6*t),mul(m0,3*t2-4*t+1)),add(mul(b.p,-6*t2+6*t),mul(m1,3*t2-2*t)));
   out.push({p,t:unit(v),r:a.r+(b.r-a.r)*t,node:j===0?a.node:null});
  }
 }
 const last=points.at(-1);out.push({p:last.p,t:tangent(points.length-1),r:last.r,node:last.node});return out;
}
export function unifiedTreeGeometry(T,graph){
 if(!validTreeGraph(graph))throw Error('Structure végétale invalide.');
 const nodes=graph.map((n,i)=>({i,p:[n[0],n[2],n[1]],r:n[3],parent:n[4],tip:n[5],children:[]}));
 for(const n of nodes.slice(1))nodes[n.parent].children.push(n);
 const pos=[],normal=[],uv=[],side=[],caps=[],distAt=new Map(),starts=[];
 const vertex=(p,n,u,v)=>{const i=pos.length/3;pos.push(...p);normal.push(...n);uv.push(u,v);return i};
 function cap(sample,u,v,sides,reverse,indices=caps){
  const n=mul(sample.t,reverse?-1:1),c=vertex(sample.p,n,0,0),ring=[];
  for(let j=0;j<sides;j++){const a=j*Math.PI*2/sides,x=Math.cos(a)*sample.r,y=Math.sin(a)*sample.r;ring.push(vertex(add(sample.p,add(mul(u,x),mul(v,y))),n,x,y))}
  for(let j=0;j<sides;j++){const k=(j+1)%sides;if(reverse)indices.push(c,ring[k],ring[j]);else indices.push(c,ring[j],ring[k])}
 }
 function continuation(n){
  if(!n.children.length)return null;
  const incoming=n.parent<0?[0,1,0]:unit(sub(n.p,nodes[n.parent].p));
  return [...n.children].sort((a,b)=>{const score=c=>c.r*(1+.48*dot(incoming,unit(sub(c.p,n.p))))+(n.parent<0&&c.p[1]>n.p[1]+.3?.2:0);return score(b)-score(a)||a.i-b.i})[0];
 }
 function buildPath(first,parent=null){
  const points=[],forks=[];let n=first;
  if(parent)points.push({p:parent.p,r:Math.min(parent.r*.72,Math.max(first.r*1.18,.015)),node:null});
  else if(first.tip!=='broken')points.push({p:[first.p[0],0,first.p[2]],r:Math.min(.55,first.r*1.22),node:null});
  for(;;){
   points.push({p:n.p,r:n.r,node:n.i});
   const next=continuation(n);for(const c of n.children)if(c!==next)forks.push([c,n]);
   if(!next)break;n=next;
  }
  const last=points.at(-1),tip=n.parent<0?null:treeTipEnd(graph[n.i],graph[n.parent]);
  if(tip){
   const end=[tip.point[0],tip.point[2],tip.point[1]];
   if(len(sub(end,last.p))>EPS)points.push({p:end,r:tip.radius,node:null});
  }
  const samples=smoothSamples(points),maxR=Math.max(...points.map(p=>p.r)),sides=maxR>.22?12:maxR>.07?10:6,circumference=Math.PI*2*maxR;
  let distance=parent?(distAt.get(parent.i)||0):0,u=basis(samples[0].t),v=cross(samples[0].t,u),previousRing=null;
  for(let k=0;k<samples.length;k++){
   const q=samples[k],prior=samples[k-1],next=samples[Math.min(samples.length-1,k+1)];
   if(prior)distance+=len(sub(q.p,prior.p));if(q.node!==null&&q.node!==undefined)distAt.set(q.node,distance);
   // Parallel transport prevents the UV seam twisting on every bend.
   const projected=sub(u,mul(q.t,dot(u,q.t)));u=len(projected)>EPS?unit(projected):basis(q.t);v=unit(cross(q.t,u));
   const before=prior||q,ds=Math.max(EPS,len(sub(next.p,before.p))),slope=(next.r-before.r)/ds,ring=[];
   for(let j=0;j<=sides;j++){
    const a=j*Math.PI*2/sides,radial=add(mul(u,Math.cos(a)),mul(v,Math.sin(a))),p=add(q.p,mul(radial,q.r)),nn=unit(sub(radial,mul(q.t,slope)));
    ring.push(vertex(p,nn,circumference*j/sides,distance));
   }
   if(previousRing)for(let j=0;j<sides;j++){const a=previousRing[j],b=previousRing[j+1],c=ring[j],d=ring[j+1];side.push(a,b,c,b,d,c)}
   if(k===0&&!parent)cap(q,u,v,sides,true);
   if(k===samples.length-1)cap(q,u,v,sides,false,n.tip==='broken'?caps:side);
   previousRing=ring;
  }
  for(const [c,p]of forks)buildPath(c,p);
 }
 buildPath(nodes[0]);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex([...side,...caps]);g.addGroup(0,side.length,0);if(caps.length)g.addGroup(side.length,caps.length,1);g.computeBoundingBox();g.computeBoundingSphere();return g;
}

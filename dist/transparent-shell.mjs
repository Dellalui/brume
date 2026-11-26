// Exact exterior faces of touching glass/ice cuboids. Material groups are
// processed separately. Coplanar faces are clipped only against matching
// opposite faces, so partial joins and 90-degree rotations stay watertight.
const EPS=1e-5,BUCKET=4,QUARTER=Math.PI/2;
export function isCrystal(kind){return kind==='glass'||kind==='ice'}
function subtractRect(rect,cover){
 const [a,b,c,d]=rect;
 const x0=Math.max(a,cover[0]),x1=Math.min(b,cover[1]),y0=Math.max(c,cover[2]),y1=Math.min(d,cover[3]);
 if(x1-x0<=EPS||y1-y0<=EPS)return [rect];
 return [[a,x0,c,d],[x1,b,c,d],[x0,x1,c,y0],[x0,x1,y1,d]].filter(r=>r[1]-r[0]>EPS&&r[3]-r[2]>EPS);
}
export function transparentShell(cells){
 const groups=new Map(),batches=new Map();
 const bins=(rect,fn)=>{for(let u=Math.floor(rect[0]/BUCKET);u<=Math.floor((rect[1]-EPS)/BUCKET);u++)for(let v=Math.floor(rect[2]/BUCKET);v<=Math.floor((rect[3]-EPS)/BUCKET);v++)fn(u,v)};
 const planeKey=(axis,sign,plane,u,v)=>[axis,sign,plane,u,v].join(',');
 for(const b of cells){
  const w=b.w??1,d=b.d??1,h=b.h,angle=b.angle||0;
  if(![b.x,b.y,b.z,w,d,h,angle].every(Number.isFinite)||Math.min(w,d,h)<=EPS)continue;
  let frame=((angle%QUARTER)+QUARTER)%QUARTER;
  if(frame<EPS||QUARTER-frame<EPS)frame=0;
  const groupKey=Math.round(frame/EPS);
  let group=groups.get(groupKey);
  if(!group){group={angle:frame,faces:[],index:new Map()};groups.set(groupKey,group)}
  frame=group.angle;
  const co=Math.cos(frame),si=Math.sin(frame),swap=Math.abs(Math.round((angle-frame)/QUARTER)%2)===1;
  const cx=b.x+.5,cz=b.y+.5,local=[cx*co+cz*si,b.z+h/2,-cx*si+cz*co],size=[swap?d:w,h,swap?w:d];
  const min=local.map((x,i)=>x-size[i]/2),max=local.map((x,i)=>x+size[i]/2);
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const u=(axis+1)%3,v=(axis+2)%3,plane=sign===1?max[axis]:min[axis],q=Math.round(plane/EPS),rect=[min[u],max[u],min[v],max[v]];
   const face={b,axis,sign,plane,q,u,v,rect};group.faces.push(face);
   bins(rect,(i,j)=>{const k=planeKey(axis,sign,q,i,j);let list=group.index.get(k);if(!list){list=[];group.index.set(k,list)}list.push(face)});
  }
 }
 for(const group of groups.values()){
  const co=Math.cos(group.angle),si=Math.sin(group.angle);
  const rotate=p=>[p[0]*co-p[2]*si,p[1],p[0]*si+p[2]*co];
  for(const f of group.faces){
   const neighbours=new Set();
   bins(f.rect,(i,j)=>{for(let q=f.q-1;q<=f.q+1;q++)for(const n of group.index.get(planeKey(f.axis,-f.sign,q,i,j))||[])if(n.b!==f.b&&Math.abs(n.plane-f.plane)<=EPS)neighbours.add(n)});
   let open=[f.rect];
   for(const n of neighbours){open=open.flatMap(r=>subtractRect(r,n.rect));if(!open.length)break}
   if(!open.length)continue;
   const k=Math.floor((f.b.x+.5)/16)+','+Math.floor((f.b.y+.5)/16);
   let batch=batches.get(k);if(!batch){batch={key:k,positions:[],normals:[],faceBlocks:[]};batches.set(k,batch)}
   const n=[0,0,0];n[f.axis]=f.sign;const normal=rotate(n);
   for(const [u0,u1,v0,v1]of open){
    const point=(u,v)=>{const p=[0,0,0];p[f.axis]=f.plane;p[f.u]=u;p[f.v]=v;return rotate(p)};
    const p=[point(u0,v0),point(u1,v0),point(u1,v1),point(u0,v1)];
    const tris=f.sign>0?[[0,1,2],[0,2,3]]:[[0,2,1],[0,3,2]];
    for(const tri of tris){for(const i of tri){batch.positions.push(...p[i]);batch.normals.push(...normal)}batch.faceBlocks.push(f.b)}
   }
  }
 }
 return [...batches.values()];
}

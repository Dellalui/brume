// Brume block forms. x/y horizontal, z up. Existing box/corner slots are unchanged.
const EPS=1e-7;
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=a=>{const n=norm(a);return n>EPS?a.map(v=>v/n):null};
const round=n=>Math.round(n*1e6)/1e6;
const mean=vs=>[0,1,2].map(i=>vs.reduce((s,v)=>s+v[i],0)/vs.length);
function poly(vertices,faces,box=null){
 const center=mean(vertices),valid=[],planes=[],edges=[];
 for(const raw of faces){let f=[...raw],n=null;for(let i=1;i<f.length-1&&!n;i++)n=unit(cross(sub(vertices[f[i]],vertices[f[0]]),sub(vertices[f[i+1]],vertices[f[0]])));if(!n)continue;
  if(dot(n,sub(center,vertices[f[0]]))>0){f.reverse();n=n.map(v=>-v)}
  valid.push(f);planes.push({n,c:dot(n,vertices[f[0]])});for(let i=0;i<f.length;i++){const a=f[i],b=f[(i+1)%f.length];if(norm(sub(vertices[a],vertices[b]))>EPS)edges.push([a,b])}
 }
 return {vertices,faces:valid,planes,edges,box};
}
function prism(xy,low,high,box=null){const n=xy.length,at=(f,x,y)=>typeof f==='function'?f(x,y):f;const vertices=[...xy.map(([x,y])=>[x,y,at(low,x,y)]),...xy.map(([x,y])=>[x,y,at(high,x,y)])];return poly(vertices,[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>n+i),...xy.map((_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])],box)}
const rect=(x0,y0,z0,x1,y1,z1)=>prism([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],z0,z1,[x0,y0,z0,x1,y1,z1]);
const square=[[0,0],[1,0],[1,1],[0,1]],back=[[0,.5],[1,.5],[1,1],[0,1]],front=[[0,0],[1,0],[1,.5],[0,.5]];
const circle=(r=.5,n=16)=>Array.from({length:n},(_,i)=>[.5+r*Math.cos(i*2*Math.PI/n),.5+r*Math.sin(i*2*Math.PI/n)]);
const base=()=>rect(0,0,0,1,1,.5);
// Connection bits are local +X, +Y, -X, -Y. Each branch ends at the
// cell boundary; no duplicate corner posts or overlap with the center.
// Spatial connectors use the same local cardinal bits, plus +Z (16) and
// -Z (32). A shared three-bit radius code per arm prevents gaps when mixing
// thick and thin pieces. All solids use the same polygonal ring resolution.
const SPATIAL_SIZES=Object.freeze({'trunk-connected':5,'pillar-connected':4,'branch-connected':3,'pillar-thin-connected':2,'rod-connected':1,'spike-connected':1,'branch-diagonal':3,'rod-diagonal':1});
const RADII=[0,.075,.14,.22,.32,.43],AXIS_BITS=[[0,2],[1,3],[4,5]];
export const isSpatialForm=id=>Object.hasOwn(SPATIAL_SIZES,id);
export const spatialSize=id=>SPATIAL_SIZES[id]||0;
export const isDiagonalForm=id=>id==='branch-diagonal'||id==='rod-diagonal';
export const hasDiagonalLinks=o=>!!(o?.formDiagonalLinks?.length);
export const diagonalEnabled=o=>isSpatialForm(o?.blockForm)&&(isDiagonalForm(o.blockForm)||o.formDiagonal===true);
export const CONNECTED_FORMS=Object.freeze(['fence','connected-wall','railing',...Object.keys(SPATIAL_SIZES)]);
export const connectionCompatible=(a,b)=>a===b||isSpatialForm(a)&&isSpatialForm(b);
export function connectionRadiusCode(a,b){return Math.min(spatialSize(a),spatialSize(b))}
function axialTube(axis,start,end,r0,r1,omitStart=false,omitEnd=false){
 const n=12,other=[0,1,2].filter(i=>i!==axis);
 const ring=(at,r)=>Array.from({length:n},(_,i)=>{const p=[.5,.5,.5],a=i*2*Math.PI/n;p[axis]=at;p[other[0]]+=r*Math.cos(a);p[other[1]]+=r*Math.sin(a);return p});
 const p=poly([...ring(start,r0),...ring(end,r1)],[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>n+i),...Array.from({length:n},(_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])]);
 p.tube={axis,start,end,r0,r1,n,other};p.omitCaps=[];if(omitStart)p.omitCaps.push([axis,start]);if(omitEnd)p.omitCaps.push([axis,end]);
 // Swept box proxies remain narrow even for a 0.15-cell rod. Exact convex
 // geometry is still used for overlap, visibility, ray and surface tests.
 const steps=Math.abs(r0-r1)<EPS?1:3;p.cameraBoxes=[];
 for(let i=0;i<steps;i++){const a=i/steps,b=(i+1)/steps,r=Math.max(r0+(r1-r0)*a,r0+(r1-r0)*b),lo=[.5-r,.5-r,.5-r],hi=[.5+r,.5+r,.5+r];lo[axis]=start+(end-start)*a;hi[axis]=start+(end-start)*b;p.cameraBoxes.push([...lo,...hi])}
 return p;
}
// A round hub is used only at bends and forks; a straight stem needs no
// extra mesh. The closed convex segments remain shared by all collision code.
function jointHub(radius){
 const p=[],rings=[[.5-radius,0],[.5-radius*.72,radius*.70],[.5,radius],[.5+radius*.72,radius*.70],[.5+radius,0]];
 for(let i=0;i<rings.length-1;i++){const [a,r0]=rings[i],[b,r1]=rings[i+1];p.push(axialTube(2,a,b,r0,r1,i>0,i<rings.length-2))}
 return p;
}
// Oblique arms meet at the exact midpoint of their two logical cells.
// Use the same ring basis on both sides (a twelve-sided ring is invariant
// under quarter-turns and reversal). The convex frustum is also a collider.
function obliqueTube(start,end,r0,r1,omitStart=false,omitEnd=false){
 const n=12,axis=unit(sub(end,start)),length=norm(sub(end,start));
 const u=axis[2]!==0?unit(cross([0,0,1],axis)): [0,0,1],v=cross(axis,u);
 const ring=(p,r)=>Array.from({length:n},(_,i)=>{const a=i*2*Math.PI/n;return p.map((x,k)=>x+r*(u[k]*Math.cos(a)+v[k]*Math.sin(a)))});
 const p=poly([...ring(start,r0),...ring(end,r1)],[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>n+i),...Array.from({length:n},(_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])]);
 p.oblique={axis,u,v,length,n,r0,r1,start,end,omitStart,omitEnd};p.cameraBoxes=[];
 const steps=6;for(let i=0;i<steps;i++){const a=i/steps,b=(i+1)/steps,r=Math.max(r0+(r1-r0)*a,r0+(r1-r0)*b),q=start.map((x,k)=>x+(end[k]-x)*a),t=start.map((x,k)=>x+(end[k]-x)*b);
  const pad=axis.map(x=>r*Math.sqrt(Math.max(0,1-x*x)));p.cameraBoxes.push([...q.map((x,k)=>Math.min(x,t[k])-pad[k]),...q.map((x,k)=>Math.max(x,t[k])+pad[k])]);}
 return p;
}
const CENTER=[.5,.5,.5],CARDINAL=[[1,0,0],[0,1,0],[-1,0,0],[0,-1,0],[0,0,1],[0,0,-1]];
const endPoint=(dir,t=.5)=>CENTER.map((x,i)=>x+dir[i]*t);
function obliqueParts(id,mask,sizes,diagonals){
 const radius=RADII[spatialSize(id)],point=id==='spike-connected',arms=[];
 for(let i=0;i<6;i++)if(mask&(1<<i))arms.push([...CARDINAL[i],(sizes>>>(i*3))&7||spatialSize(id)]);
 for(const d of diagonals)arms.push(d);
 if(!arms.length&&isDiagonalForm(id))return[obliqueTube([.13,.5,.13],[.87,.5,.87],radius,radius)];
 const r=d=>RADII[Math.max(1,Math.min(spatialSize(id),d[3]||spatialSize(id)))],p=[];
 if(arms.length===1&&point){const d=arms[0].slice(0,3);return [obliqueTube(endPoint(d),CENTER,r(arms[0]),radius,true,true),obliqueTube(CENTER,endPoint(d,-.5),radius,0,true,false)]}
 if(arms.length===2&&arms[0].slice(0,3).every((x,i)=>x===-arms[1][i])){
  for(const a of arms)p.push(obliqueTube(CENTER,endPoint(a),radius,r(a),true,true));return p;
 }
 // Thick vertical stems retain a grounded base. Other bends get a compact
 // round junction without any unconnected horizontal or vertical prong.
 const vertical=spatialSize(id)>=4&&!!(mask&48);
 if(vertical){
  const code=i=>(sizes>>>(i*3))&7||spatialSize(id);
  p.push(axialTube(2,0,.5,mask&32?RADII[code(5)]:radius,radius,!!(mask&32),true),axialTube(2,.5,1,radius,mask&16?RADII[code(4)]:radius,true,!!(mask&16)));
 }else p.push(...jointHub(radius));
 for(const a of arms){if(vertical&&a[0]===0&&a[1]===0)continue;const root=Math.min(radius*.98,r(a)*1.4);p.push(obliqueTube(CENTER,endPoint(a),root,r(a),true,true))}
 return p;
}
function spatialParts(id,mask=0,sizes=0,diagonals=[]){
 if(diagonals.length||isDiagonalForm(id)&&!mask)return obliqueParts(id,mask,sizes,diagonals);
 const radius=RADII[spatialSize(id)],point=id==='spike-connected',count=AXIS_BITS.flat().filter(b=>mask&(1<<b)).length,linked=b=>!!(mask&(1<<b)),r=b=>RADII[Math.min(spatialSize(id),(sizes>>>(b*3))&7)||spatialSize(id)];
 const score=a=>AXIS_BITS[a].filter(linked).length*4+(a===2?2:a===0?1:0);
 const axis=[2,0,1].sort((a,b)=>score(b)-score(a))[0],[pos,neg]=AXIS_BITS[axis],p=[];
 if(point&&count<=1){
  const positive=linked(pos),negative=linked(neg);
  if(positive&&!negative)p.push(axialTube(axis,0,.5,0,radius,false,true),axialTube(axis,.5,1,radius,r(pos),true,true));
  else p.push(axialTube(axis,0,.5,negative?r(neg):radius,radius,negative,true),axialTube(axis,.5,1,radius,0,true,false));
  return p;
 }
 const straight=count<=1||count===2&&linked(pos)&&linked(neg);
 if(straight){p.push(axialTube(axis,0,.5,linked(neg)?r(neg):radius,radius,linked(neg),true),axialTube(axis,.5,1,radius,linked(pos)?r(pos):radius,true,linked(pos)));return p}
 // Keep a thick vertical trunk continuous when it gains a side branch,
 // especially at the ground and at the cut top. Thin elbows follow only
 // their connected directions instead of growing unintended extra prongs.
 const verticalTrunk=spatialSize(id)>=4&&(linked(4)||linked(5));
 if(verticalTrunk){
  p.push(axialTube(2,0,.5,linked(5)?r(5):radius,radius,linked(5),true),axialTube(2,.5,1,radius,linked(4)?r(4):radius,true,linked(4)));
 }else p.push(...jointHub(radius*1.035));
 for(let a=0;a<3;a++){
  if(verticalTrunk&&a===2)continue;
  const [positive,negative]=AXIS_BITS[a];
  if(linked(positive)){const end=r(positive),root=Math.min(radius*.98,end*1.40);p.push(axialTube(a,.5,1,root,end,true,true))}
  if(linked(negative)){const end=r(negative),root=Math.min(radius*.98,end*1.40);p.push(axialTube(a,0,.5,end,root,true,true))}
 }
 return p;
}
const spatialCache=new Map();
function spatialVariant(id,mask,sizes,diagonals=[]){
 const k=id+':'+mask+':'+sizes+':'+JSON.stringify(diagonals);
 let parts=spatialCache.get(k);if(!parts){parts=spatialParts(id,mask,sizes,diagonals);spatialCache.set(k,parts);if(spatialCache.size>512)spatialCache.delete(spatialCache.keys().next().value)}
 return parts;
}
export const isConnectedForm=id=>CONNECTED_FORMS.includes(id);
function connectedParts(id,mask){
 const wall=id==='connected-wall',rail=id==='railing',half=wall?.25:rail?.10:.15,lo=.5-half,hi=.5+half,bar=wall?.18:rail?.055:.07;
 const p=[rect(lo,lo,0,hi,hi,1)],levels=wall?[[0,.85]]:rail?[[.83,.95],[.45,.53]]:[[.25,.4],[.7,.85]];
 for(let i=0;i<4;i++)if(mask&(1<<i))for(const [z,h]of levels){
  const a=.5-bar,b=.5+bar,xy=[[hi,a,1,b],[a,hi,b,1],[0,a,lo,b],[a,0,b,lo]][i];p.push(rect(xy[0],xy[1],z,xy[2],xy[3],h));
 }
 return p;
}
const definitions=[
 ['box','Bloc complet','■',()=>[rect(0,0,0,1,1,1)]],
 ['slab','Dalle (demi-hauteur)','▰',()=>[base()]],
 ['quarter-slab','Dalle fine','━',()=>[rect(0,0,0,1,1,.25)]],
 ['half-wall','Demi-mur','▌',()=>[rect(0,.5,0,1,1,1)]],
 ['thin-wall','Mur fin','▏',()=>[rect(0,.75,0,1,1,1)]],
 ['corner-wall','Angle en L','┗',()=>[rect(0,.5,0,1,1,1),rect(0,0,0,.5,.5,1)]],
 ['quarter','Quart de bloc','▪',()=>[rect(0,.5,0,.5,1,1)]],
 ['stairs','Escalier droit','▟',()=>[base(),rect(0,.5,.5,1,1,1)]],
 ['stairs-inner','Escalier angle rentrant','◩',()=>[base(),rect(0,.5,.5,1,1,1),rect(0,0,.5,.5,.5,1)]],
 ['stairs-outer','Escalier angle sortant','◪',()=>[base(),rect(0,.5,.5,.5,1,1)]],
 ['stairs-3','Escalier trois marches','▥',()=>[rect(0,0,0,1,1,1/3),rect(0,1/3,1/3,1,1,2/3),rect(0,2/3,2/3,1,1,1)]],
 ['ramp','Rampe lisse','◢',()=>[prism(square,0,(x,y)=>y)]],
 ['roof','Toit lisse incliné','╱',()=>[prism(square,(x,y)=>.8*y,(x,y)=>.2+.8*y)]],
 ['ridge','Toit faîtage','⌃',()=>[prism(front,(x,y)=>1.6*y,(x,y)=>.2+1.6*y),prism(back,(x,y)=>1.6*(1-y),(x,y)=>.2+1.6*(1-y))]],
 ['roof-hip','Toit angle sortant','◇',()=>[prism([[0,0],[1,0],[1,1]],(x,y)=>.8*y,(x,y)=>.2+.8*y),prism([[0,0],[1,1],[0,1]],(x,y)=>.8*x,(x,y)=>.2+.8*x)]],
 ['roof-valley','Toit angle rentrant','∨',()=>[prism([[0,0],[1,0],[1,1]],(x,y)=>.8*x,(x,y)=>.2+.8*x),prism([[0,0],[1,1],[0,1]],(x,y)=>.8*y,(x,y)=>.2+.8*y)]],
 ['pillar','Pilier carré','▮',()=>[rect(.25,.25,0,.75,.75,1)]],
 ['pillar-round','Pilier rond','●',()=>[prism(circle(.32),0,1)]],
 ['trunk-connected','Tronc connecté','⬤',()=>spatialParts('trunk-connected')],
 ['pillar-connected','Pilier connecté','▮',()=>spatialParts('pillar-connected')],
 ['branch-connected','Branche connectée','╋',()=>spatialParts('branch-connected')],
 ['pillar-thin-connected','Pilier fin connecté','▏',()=>spatialParts('pillar-thin-connected')],
 ['rod-connected','Tige fine connectée','│',()=>spatialParts('rod-connected')],
 ['spike-connected','Pique automatique','▲',()=>spatialParts('spike-connected')],
 ['branch-diagonal','Branche oblique','╱',()=>spatialParts('branch-diagonal')],
 ['rod-diagonal','Tige oblique','╱',()=>spatialParts('rod-diagonal')],
 ['beam','Poutre','▬',()=>[rect(0,.3,.55,1,.7,1)]],
 ['frame','Cadre de fenêtre','⊞',()=>[rect(0,.375,0,.2,.625,1),rect(.8,.375,0,1,.625,1),rect(.2,.375,0,.8,.625,.2),rect(.2,.375,.8,.8,.625,1)]],
 ['arch','Passage voûté','∩',()=>[rect(0,.25,0,.22,.75,1),rect(.78,.25,0,1,.75,1),prism([[.22,.25],[.78,.25],[.78,.75],[.22,.75]],.8,1),prism([[.22,.25],[.4,.25],[.4,.75],[.22,.75]],x=>.58+(x-.22)*(.22/.18),.8),prism([[.6,.25],[.78,.25],[.78,.75],[.6,.75]],x=>.8-(x-.6)*(.22/.18),.8)]],
 ['fence','Barrière','╫',()=>[rect(0,.35,0,.18,.65,1),rect(.82,.35,0,1,.65,1),rect(.18,.43,.25,.82,.57,.4),rect(.18,.43,.7,.82,.57,.85)]],
 ['connected-wall','Mur connecté','╋',()=>connectedParts('connected-wall',5)],
 ['railing','Rambarde connectée','╫',()=>connectedParts('railing',5)],
 ['diagonal','Mur diagonal','╲',()=>[prism([[0,0],[.22,0],[1,.78],[1,1],[.78,1],[0,.22]],0,1)]],
 ['chamfer','Bloc biseauté','⬟',()=>[prism([[0,0],[1,0],[1,.7],[.7,1],[0,1]],0,1)]],
 ['pyramid','Pyramide','▲',()=>[poly([[0,0,0],[1,0,0],[1,1,0],[0,1,0],[.5,.5,1]],[[0,1,2,3],[0,1,4],[1,2,4],[2,3,4],[3,0,4]])]],
 ['cone','Cône','△',()=>{const v=circle(.5).map(([x,y])=>[x,y,0]),n=v.length;return[poly([...v,[.5,.5,1]],[Array.from({length:n},(_,i)=>i),...v.map((_,i)=>[i,(i+1)%n,n])])]}],
 ['cylinder','Cylindre','⬤',()=>[prism(circle(.5),0,1)]],
 ['battlement','Créneau','▛',()=>[base(),rect(0,0,.5,.3,1,1),rect(.7,0,.5,1,1)]],
 ['corner-cut','Triangle','◤',()=>[prism([[0,0],[1,0],[0,1]],0,1)]],
 ['legacy-corner','Angle réglable (ancien)','└',null]
];
export const BLOCK_FORMS=Object.freeze(definitions.map(([id,name,symbol])=>Object.freeze({id,name,symbol})));
const catalog=new Map(definitions.filter(d=>d[3]).map(([id,,,factory])=>[id,factory()]));
const connectedCatalog=new Map(CONNECTED_FORMS.filter(id=>!isSpatialForm(id)).map(id=>[id,Array.from({length:16},(_,mask)=>connectedParts(id,mask))]));
const grid=v=>Number.isFinite(v)&&Math.abs(v-Math.round(v))<1e-5;
export function connectionEligible(o){return o?.type==='block'&&isConnectedForm(o.blockForm)&&o.formConnect!==false&&grid(o.x)&&grid(o.y)&&Math.abs((o.w||1)-1)<EPS&&Math.abs((o.d||1)-1)<EPS&&Number.isFinite(o.baseZ)&&Math.abs(o.offsetZ||0)<EPS&&Math.abs((o.height||1)-1)<EPS&&grid((o.facing||0)/(Math.PI/2))&&!o.formFlip&&!o.formMirror}
export const formInfo=id=>BLOCK_FORMS.find(f=>f.id===id)||BLOCK_FORMS[0];
export const formId=id=>id==='corner'?'legacy-corner':formInfo(id).id;
export const slotShape=id=>id==='legacy-corner'?'corner':id;
export const isForm=id=>id!=='box'&&id!=='legacy-corner'&&catalog.has(id);
export const hasBlockForm=o=>o?.type==='block'&&isForm(o.blockForm);
export const formAllowed=item=>item?.kind==='block'&&!['water','lava'].includes(item.material);
export function cycleForm(id,delta){const i=BLOCK_FORMS.findIndex(f=>f.id===formId(id));return BLOCK_FORMS[(i+(delta>0?1:-1)+BLOCK_FORMS.length)%BLOCK_FORMS.length].id}
export function orientForm(item,p){
 const ray=p.aimDirection,explicit=item.align===false;
 const heading=explicit?(Number(item.yaw)||0)*Math.PI/180:ray&&Math.hypot(ray.x,ray.y)>.02?Math.atan2(-ray.x,ray.y):Number(item.yaw||0)*Math.PI/180;
 const angle=explicit?heading:Math.round(heading/(Math.PI/2))*Math.PI/2;
 const n=p.normal||{},s=p.placedBlock,raw=p.block;
 const w=Number(item.w)||1,d=Number(item.d)||1,h=Number(item.h)||1,step=item.step===1?1:.1;
 const snap=(v,q=step)=>round(Math.round(v/q)*q),c=Math.cos(angle),si=Math.sin(angle),rw=Math.abs(c)*w+Math.abs(si)*d,rd=Math.abs(si)*w+Math.abs(c)*d;
 let cx=snap(p.x-rw/2)+rw/2,cy=snap(p.y-rd/2)+rd/2,z=snap(p.z,.1);
 if(Math.abs(n.z||0)>.5){z=round(p.z-(n.z<0?h:0));}
 else if(Math.abs(n.x||0)>.5||Math.abs(n.y||0)>.5){
  if(Math.abs(n.x)>Math.abs(n.y)){cx=round(p.x+Math.sign(n.x)*rw/2);cy=snap(p.y-rd/2)+rd/2}else{cy=round(p.y+Math.sign(n.y)*rd/2);cx=snap(p.x-rw/2)+rw/2}
  z=snap(s?.baseZ??raw?.z??Math.floor(p.z),.1);
 }
 let flipZ=false;const id=formId(item.shape),half=raw?.z??s?.baseZ??Math.floor(p.z);
 if(['slab','quarter-slab','stairs','stairs-inner','stairs-outer','stairs-3','ramp','roof','ridge','roof-hip','roof-valley'].includes(id)){
  flipZ=(n.z||0)<-.5||Math.abs(n.z||0)<.5&&p.z-half>(s?.height||1)*.5+EPS;
 }
 const out={x:round(cx-w/2),y:round(cy-d/2),z,w,d,h,angle,flipZ,shape:id,mirror:false};
 // Aim at the logical cell of a post rather than its narrow physical
 // surface. Otherwise a fence placed against a fence drifts off-grid.
 if(isConnectedForm(id)&&!explicit&&step===1&&w===1&&d===1&&h===1){
  const horizontal=Math.abs(n.z||0)<.5&&Math.max(Math.abs(n.x||0),Math.abs(n.y||0))>.5;
  if(isSpatialForm(id)&&s&&grid(s.x)&&grid(s.y)&&s.w===1&&s.d===1&&s.height===1&&Number.isFinite(s.baseZ)){
   // On a thin stem, the physical surface is inside the cell. Use the
   // support's logical face instead, including caps at intermediate height.
   const nz=Math.abs(n.z||0),nx=Math.abs(n.x||0),ny=Math.abs(n.y||0);
   out.x=Math.round(s.x);out.y=Math.round(s.y);out.z=round(s.baseZ+(s.offsetZ||0));
   if(isDiagonalForm(id)){
    // The oblique tool deliberately steps one cell sideways and one up
    // (or down when aiming at the lower half). Top/bottom use view heading.
    if(nz>=Math.max(nx,ny)&&nz>EPS){const ray=p.aimDirection||{x:1,y:0};if(Math.abs(ray.x)>=Math.abs(ray.y))out.x+=Math.sign(ray.x)||1;else out.y+=Math.sign(ray.y)||1;out.z+=Math.sign(n.z)}
    else{if(nx>=ny)out.x+=Math.sign(n.x)||1;else out.y+=Math.sign(n.y)||1;out.z+=p.z<s.baseZ+.5?-1:1}
    out.z=round(out.z);
   }else if(nz>=Math.max(nx,ny)&&nz>EPS)out.z=round(out.z+Math.sign(n.z));
   else if(nx>=ny&&nx>EPS)out.x+=Math.sign(n.x);
   else if(ny>EPS)out.y+=Math.sign(n.y);
  }else if(horizontal&&connectionEligible(s)){
   out.x=Math.round(s.x)+(Math.abs(n.x)>Math.abs(n.y)?Math.sign(n.x):0);
   out.y=Math.round(s.y)+(Math.abs(n.y)>=Math.abs(n.x)?Math.sign(n.y):0);
   out.z=s.baseZ;
  }else if(horizontal){
   out.x=Math.floor(p.x+(n.x||0)*.001);out.y=Math.floor(p.y+(n.y||0)*.001);
   if(s&&grid(s.x)&&grid(s.y)&&s.w===1&&s.d===1){out.x=Math.round(s.x)+(Math.abs(n.x)>Math.abs(n.y)?Math.sign(n.x):0);out.y=Math.round(s.y)+(Math.abs(n.y)>=Math.abs(n.x)?Math.sign(n.y):0)}
  }else{out.x=Math.floor(p.x);out.y=Math.floor(p.y)}
  out.angle=0;out.flipZ=false;
 }
 if(id==='stairs'&&!explicit&&w===1&&d===1&&h===1&&p.formMap){
  const rise=[-Math.round(Math.sin(angle)),Math.round(Math.cos(angle))],left=[-rise[1],rise[0]],objects=p.formMap.objects||[];
  const neighbor=sign=>objects.find(o=>hasBlockForm(o)&&['stairs','stairs-inner','stairs-outer'].includes(o.blockForm)&&Math.abs((o.baseZ||0)-z)<EPS&&!!o.formFlip===flipZ&&o.w===1&&o.d===1&&o.height===1&&Math.abs(o.x+.5-cx-sign*rise[0])<EPS&&Math.abs(o.y+.5-cy-sign*rise[1])<EPS);
  for(const [sign,form] of [[1,'stairs-outer'],[-1,'stairs-inner']]){const o=neighbor(sign);if(!o)continue;const a=o.facing||0,side=dot([-Math.round(Math.sin(a)),Math.round(Math.cos(a)),0],[...left,0]);if(Math.abs(side)===1){out.shape=form;out.mirror=side<0;break}}
 }
 return out;
}
const organicCache=new Map();
function organicParts(o){
 const radius=Math.max(.013,Math.min(.46,Number(o.formRadius)||.075)),offset=(o.formOffset||[0,0,0]).map(x=>Math.max(-.2,Math.min(.2,Number(x)||0))),center=CENTER.map((x,i)=>x+offset[i]),links=o.formOrganicLinks||[];
 const cacheKey=JSON.stringify([radius,offset,o.formRoot,o.formTip,links]);
 if(organicCache.has(cacheKey))return organicCache.get(cacheKey);
 const parts=[],mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
 // Every half-branch ends at a shared ring; a short quadratic bend follows
 // the growth tangent while the center hub closes the junction.
 function arm(end,r,connected=true){
  if(norm(sub(end,center))<EPS)return;
  const mid=mix(center,end,.5),bend=mix(mid,CENTER,.16);
  const first=obliqueTube(center,bend,radius*.94,(radius+r)/2,true,true),second=obliqueTube(bend,end,(radius+r)/2,r,true,connected);
  parts.push(first,second);
 }
 const hubRadius=radius*.98;
 // Shift a small rounded hub with the growth center.
 for(const p of jointHub(hubRadius)){
  const q=poly(p.vertices.map(v=>v.map((x,i)=>x+offset[i])),p.faces);
  q.cameraBoxes=p.cameraBoxes.map(b=>b.map((x,i)=>x+offset[i%3]));q.organicHub=true;parts.push(q);
 }
 for(const link of links){if(!Array.isArray(link)||link.length<7)continue;const d=link.slice(0,3),off=link.slice(4,7),end=CENTER.map((x,i)=>x+(d[i]+off[i]+offset[i])*.5);arm(end,Math.max(.013,Math.min(radius,link[3])));}
 if(o.formRoot){parts.push(obliqueTube([center[0],center[1],0],center,Math.min(.49,radius*1.23),radius,false,true))}
 if(links.length<=1&&!o.formRoot){
  const d=links[0]?.slice(0,3)||[0,0,-1],v=unit(d)||[0,0,-1],end=center.map((x,i)=>x-v[i]*.38);
  arm(end,o.formTip==='broken'?radius*.72:o.formTip==='taper'?.003:radius*.20,false);
 }
 if(!parts.length)parts.push(...jointHub(radius));
 organicCache.set(cacheKey,parts);if(organicCache.size>768)organicCache.delete(organicCache.keys().next().value);return parts;
}
function localParts(o){if(isSpatialForm(o.blockForm)&&Number.isFinite(o.formRadius))return organicParts(o);if(connectionEligible(o)&&Number.isInteger(o.formConnections)){if(isSpatialForm(o.blockForm))return spatialVariant(o.blockForm,o.formConnections&63,(o.formConnectionSizes||0)&262143,o.formDiagonalLinks||[]);return connectedCatalog.get(o.blockForm)[o.formConnections&15]}return catalog.get(hasBlockForm(o)?o.blockForm:'box')||catalog.get('box')}
function transformed(o,p,z=0){const w=o.w||1,d=o.d||1,h=o.height||1,a=o.facing||0,c=Math.cos(a),s=Math.sin(a),cx=o.x+w/2,cy=o.y+d/2;return p.vertices.map(([x,y,v])=>{const u=(o.formMirror?.5-x:x-.5)*w,t=(y-.5)*d;return [cx+u*c-t*s,cy+u*s+t*c,z+(o.formFlip?1-v:v)*h]})}
function worldPolys(o,z=o.baseZ||0){return localParts(o).map(p=>poly(transformed(o,p,z),p.faces))}
function toLocal(o,x,y,z=0){const w=o.w||1,d=o.d||1,h=o.height||1,a=o.facing||0,c=Math.cos(a),s=Math.sin(a),dx=x-(o.x+w/2),dy=y-(o.y+d/2);return [(dx*c+dy*s)/w+.5,(-dx*s+dy*c)/d+.5,(z-(o.baseZ||0))/h]}
function clip(p,a,d,lo,hi,strict=false){for(const {n,c} of p.planes){const v=dot(n,d),distance=c-dot(n,a);if(Math.abs(v)<EPS){if(distance<(strict?EPS:-EPS))return null;continue}const t=distance/v;if(v>0)hi=Math.min(hi,t);else lo=Math.max(lo,t);if(hi<lo-EPS)return null}return [lo,hi]}
export function shapeRayEntry(o,from,d,max=1,base=o.baseZ||0){const a=toLocal({...o,baseZ:base},from.x,from.y,from.z),end=toLocal({...o,baseZ:base},from.x+d.x,from.y+d.y,from.z+d.z);if(o.formFlip){a[2]=1-a[2];end[2]=1-end[2]}if(o.formMirror){a[0]=1-a[0];end[0]=1-end[0]}const v=sub(end,a);let best=Infinity;for(const p of localParts(o)){const t=clip(p,a,v,0,max,false);if(t&&t[1]-t[0]>EPS)best=Math.min(best,t[0]);else if(t&&Math.abs(t[0]-max)<EPS){const longer=clip(p,a,v,0,max+1,false);if(longer&&longer[1]>max+EPS)best=Math.min(best,max)}}return best}
function localIntervals(p,x,y){const z=p.oblique||p.organicHub?p.vertices.map(v=>v[2]):[0,1];return clip(p,[x,y,0],[0,0,1],Math.min(...z),Math.max(...z))}
export function shapeIntervals(o,x,y,base=o.baseZ||0){let [u,v]=toLocal(o,x,y);if(o.formMirror)u=1-u;const h=o.height||1,spans=[];for(const p of localParts(o)){const t=localIntervals(p,u,v);if(!t||t[1]-t[0]<EPS)continue;const [a,b]=o.formFlip?[1-t[1],1-t[0]]:t;spans.push([base+a*h,base+b*h])}spans.sort((a,b)=>a[0]-b[0]);const out=[];for(const s of spans){const prev=out.at(-1);if(prev&&s[0]<=prev[1]+EPS)prev[1]=Math.max(prev[1],s[1]);else out.push(s)}return out}
// Convex separating-axis test, allowing touching but not overlapping pieces.
function convexOverlap(a,b){const axes=[...a.planes.map(p=>p.n),...b.planes.map(p=>p.n)];const ea=a.edges.map(([i,j])=>sub(a.vertices[j],a.vertices[i])),eb=b.edges.map(([i,j])=>sub(b.vertices[j],b.vertices[i]));for(const v of ea)for(const w of eb){const n=unit(cross(v,w));if(n)axes.push(n)}for(const n of axes){const aa=a.vertices.map(v=>dot(n,v)),bb=b.vertices.map(v=>dot(n,v));if(Math.max(...aa)<=Math.min(...bb)+1e-5||Math.max(...bb)<=Math.min(...aa)+1e-5)return false}return true}
export function formsOverlap(a,b,za=a.baseZ||0,zb=b.baseZ||0){return worldPolys(a,za).some(p=>worldPolys(b,zb).some(q=>convexOverlap(p,q)))}
// Conservative box proxies for camera movement; exact rectangular pieces.
function proxyBoxes(p){if(p.cameraBoxes)return p.cameraBoxes;if(p.box)return[p.box];const count=6,boxes=[];
 for(let i=0;i<count;i++)for(let j=0;j<count;j++){const x0=i/count,x1=(i+1)/count,y0=j/count,y1=(j+1)/count,zs=[];
  const visit=(x,y)=>{const t=localIntervals(p,x,y);if(t)zs.push(...t)};
  for(const x of [x0,x1])for(const y of [y0,y1])visit(x,y);
  for(const v of p.vertices)if(v[0]>=x0-EPS&&v[0]<=x1+EPS&&v[1]>=y0-EPS&&v[1]<=y1+EPS)zs.push(v[2]);
  for(const [a,b] of p.edges){const u=p.vertices[a],v=p.vertices[b],d=sub(v,u);for(const [axis,edges]of [[0,[x0,x1]],[1,[y0,y1]]])for(const edge of edges){if(Math.abs(d[axis])<EPS)continue;const t=(edge-u[axis])/d[axis];if(t<0||t>1)continue;const q=u.map((v,k)=>v+t*d[k]);if(q[0]>=x0-EPS&&q[0]<=x1+EPS&&q[1]>=y0-EPS&&q[1]<=y1+EPS)zs.push(q[2])}}
  if(zs.length){const lo=Math.max(0,Math.min(...zs)),hi=Math.min(1,Math.max(...zs));if(hi-lo>EPS)boxes.push([x0,y0,lo,x1,y1,hi])}
 }
 for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;){const p=boxes[a],q=boxes[b],eq=(x,y)=>Math.abs(x-y)<EPS;if(eq(p[2],q[2])&&eq(p[5],q[5])&&((eq(p[0],q[0])&&eq(p[3],q[3])&&(eq(p[4],q[1])||eq(q[4],p[1])))||(eq(p[1],q[1])&&eq(p[4],q[4])&&(eq(p[3],q[0])||eq(q[3],p[0]))))){boxes[a]=p.map((v,i)=>i<3?Math.min(v,q[i]):Math.max(v,q[i]));boxes.splice(b,1);b=a+1}else b++}
 return boxes;
}
const proxies=new Map([...catalog].map(([k,p])=>[k,p.flatMap(proxyBoxes)]));
export function formCollisionBoxes(o,base=o.baseZ||0){if(!hasBlockForm(o))return[o];const w=o.w||1,d=o.d||1,h=o.height||1,a=o.facing||0,c=Math.cos(a),s=Math.sin(a),cx=o.x+w/2,cy=o.y+d/2;return (Number.isFinite(o.formRadius)||connectionEligible(o)&&Number.isInteger(o.formConnections)?localParts(o).flatMap(proxyBoxes):proxies.get(o.blockForm)).map(([x0,y0,z0,x1,y1,z1])=>{let u=(o.formMirror?.5-(x0+x1)/2:(x0+x1)/2-.5)*w,v=((y0+y1)/2-.5)*d,ww=(x1-x0)*w,dd=(y1-y0)*d;return {...o,blockForm:undefined,formFlip:undefined,formMirror:undefined,formConnections:undefined,formConnectionSizes:undefined,formDiagonalLinks:undefined,formRadius:undefined,formOrganicLinks:undefined,x:cx+u*c-v*s-ww/2,y:cy+u*s+v*c-dd/2,w:ww,d:dd,baseZ:base+(o.formFlip?1-z1:z0)*h,offsetZ:0,height:(z1-z0)*h}})}
export function formGeometry(T,o){
 const groups=[[],[],[],[],[],[]],w=o.w||1,d=o.d||1,h=o.height||1,scale=[w,d,h],mirror=o.formMirror?-1:1,flip=o.formFlip?-1:1;
 for(const p of localParts(o)){
  const vs=p.vertices.map(([x,y,z])=>[(o.formMirror?.5-x:x-.5)*w,(o.formFlip?1-z:z)*h,(y-.5)*d]),center=mean(vs),tube=p.tube;
  for(const raw of p.faces){
   if(p.omitCaps?.some(([axis,at])=>raw.every(i=>Math.abs(p.vertices[i][axis]-at)<EPS)))continue;
   let f=[...raw],n=null;for(let i=1;i<f.length-1&&!n;i++)n=unit(cross(sub(vs[f[i]],vs[f[0]]),sub(vs[f[i+1]],vs[f[0]])));
   if(!n)continue;if(dot(n,sub(center,vs[f[0]]))>0){n=n.map(v=>-v);f.reverse()}
   const oblique=p.oblique,ringCap=oblique&&raw.every(i=>Math.floor(i/oblique.n)===Math.floor(raw[0]/oblique.n));
   if(ringCap&&(raw[0]<oblique.n?oblique.omitStart:oblique.omitEnd))continue;
   const cap=oblique?ringCap:tube&&raw.every(i=>Math.abs(p.vertices[i][tube.axis]-p.vertices[raw[0]][tube.axis])<EPS);
   const mi=p.organicHub?0:tube||oblique?(cap?2:0):n[1]>.25?2:n[1]<-.25?3:0;
   const wrap=tube&&!cap&&raw.some(i=>i%tube.n===0)&&raw.some(i=>i%tube.n===tube.n-1);
   function vertex(i){
    const v=vs[i];
    if(oblique){
     const j=i%oblique.n,theta=j*2*Math.PI/oblique.n,raw=p.vertices[i],offset=sub(raw,oblique.start);
     if(cap)return {v,n,uv:[dot(offset,oblique.u),dot(offset,oblique.v)]};
     const seam=f.some(k=>k%oblique.n===0)&&f.some(k=>k%oblique.n===oblique.n-1);
     const radial=oblique.u.map((x,k)=>x*Math.cos(theta)+oblique.v[k]*Math.sin(theta)-oblique.axis[k]*(oblique.r1-oblique.r0)/oblique.length);
     return {v,n:unit([radial[0]*mirror/w,radial[2]*flip/h,radial[1]/d])||n,uv:[(seam&&j===0?oblique.n:j)/oblique.n*2*Math.PI*(o.formRadius||RADII[spatialSize(o.blockForm)]),dot(offset,oblique.axis)]};
    }
    if(!tube)return {v,n,uv:Math.abs(n[1])>.5?[v[0]+w/2,v[2]+d/2]:Math.abs(n[0])>Math.abs(n[2])?[v[2]+d/2,v[1]]:[v[0]+w/2,v[1]]};
    const raw=p.vertices[i],[uAxis,vAxis]=tube.other;
    if(cap)return {v,n,uv:[(raw[uAxis]-.5)*scale[uAxis],(raw[vAxis]-.5)*scale[vAxis]]};
    const j=i%tube.n,theta=j*Math.PI*2/tube.n,radial=[0,0,0];
    radial[uAxis]=Math.cos(theta);radial[vAxis]=Math.sin(theta);radial[tube.axis]=-(tube.r1-tube.r0)/(tube.end-tube.start);
    const normal=unit([radial[0]*mirror/w,radial[2]*flip/h,radial[1]/d])||n;
    // One consistent full circumference per nominal piece; duplicate the
    // seam vertex in UV space so the bark never interpolates across it.
    const circumference=Math.PI*2*Math.max(.075,RADII[spatialSize(o.blockForm)]||.32)*Math.sqrt(scale[uAxis]*scale[vAxis]);
    return {v,n:normal,uv:[(wrap&&j===0?tube.n:j)/tube.n*circumference,raw[tube.axis]*scale[tube.axis]]};
   }
   for(let i=1;i<f.length-1;i++){
    const tri=[f[0],f[i],f[i+1]];if(norm(cross(sub(vs[tri[1]],vs[tri[0]]),sub(vs[tri[2]],vs[tri[0]])))<EPS)continue;
    for(const j of tri)groups[mi].push(vertex(j));
   }
  }
 }
 const positions=[],normals=[],uvs=[],g=new T.BufferGeometry();for(let i=0;i<groups.length;i++){const start=positions.length/3;for(const {v,n,uv}of groups[i]){positions.push(...v);normals.push(...n);uvs.push(...uv)}if(groups[i].length)g.addGroup(start,groups[i].length,i)}g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function shapeGridBlocked(o,x,y,z,height,radius,base=o.baseZ||0){
 const center=shapeIntervals(o,x,y,base),standing=center.some(s=>Math.abs(s[1]-z)<.002),blocked=spans=>spans.some(([a,b])=>a<z+height-.001&&b>z+.001);
 if(blocked(center))return true;
 const rising=['ramp','roof','ridge','roof-hip','roof-valley','pyramid','cone'].includes(o.blockForm);
 if(standing&&rising)return false;
 for(let i=0;i<8;i++){const a=i*Math.PI/4;if(blocked(shapeIntervals(o,x+radius*Math.cos(a),y+radius*Math.sin(a),base)))return true}return false;
}
export function shapeGridStepBlocked(o,a,b,z,height,radius,base=o.baseZ||0){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*8));for(let i=0;i<=n;i++){const t=i/n;if(shapeGridBlocked(o,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,z,height,radius,base))return true}return false}
const iconCache=new Map();
export function formIconPolygons(id){if(iconCache.has(id))return iconCache.get(id);const parts=isDiagonalForm(id)?spatialVariant(id,0,0):isSpatialForm(id)?spatialVariant(id,id==='branch-connected'?49:id==='spike-connected'?32:48,0):isConnectedForm(id)?connectedCatalog.get(id)[5]:catalog.get(id)||catalog.get('corner-wall'),camera=[1,-1,1],out=[];for(const p of parts)for(let i=0;i<p.faces.length;i++){const n=p.planes[i].n,ob=p.oblique,obCap=ob&&p.faces[i].every(j=>Math.floor(j/ob.n)===Math.floor(p.faces[i][0]/ob.n)),cap=p.tube&&p.faces[i].every(j=>Math.abs(p.vertices[j][p.tube.axis]-p.vertices[p.faces[i][0]][p.tube.axis])<EPS);if(p.omitCaps?.some(([axis,at])=>p.faces[i].every(j=>Math.abs(p.vertices[j][axis]-at)<EPS))||dot(n,camera)<=EPS)continue;const vs=p.faces[i].map(j=>p.vertices[j]);out.push({depth:dot(mean(vs),camera),points:vs.map(([x,y,z])=>[8+24*(x+y),40+12*(x-y)-29*z].map(round).join(',')).join(' '),shade:n[2]>.25?1:n[0]>.25?.72:.86,top:ob?!!obCap:p.tube?!!cap:n[2]>.25})}out.sort((a,b)=>a.depth-b.depth);iconCache.set(id,out);return out}

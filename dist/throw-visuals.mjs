import * as T from './vendor/three.module.min.js';
import {createLightning} from './lightning.mjs';
import {IMPACT_MS} from './throw-effects.mjs';
import {createOpticalEffects} from './optical-effects.mjs';
import {createImpactBodies} from './impact-bodies.mjs';

// Shared, procedural sprite textures: no downloads, no post-processing pass.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)};
function noise(x,y){const a=Math.floor(x),b=Math.floor(y),u=smooth(0,1,x-a),v=smooth(0,1,y-b);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v}
function makeTexture(kind){
 const n=128,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=(x+.5)/n*2-1,v=(y+.5)/n*2-1,r=Math.hypot(u,v),i=(y*n+x)*4;
  const f=.55*noise(u*3.6+14,v*3.6+8)+.30*noise(u*8+4,v*8+19)+.15*noise(u*17,v*17);
  let red=255,green=255,blue=255,alpha=0;
  if(kind==='fire'){
   const heat=clamp(1-r*.8+(f-.5)*.68),edge=r+(f-.5)*.46;
   red=255;green=60+195*smooth(.15,.88,heat);blue=8+232*smooth(.52,1,heat);
   alpha=(1-smooth(.53,1,edge))*(.7+.3*f);
  }else if(kind==='smoke'){
   const edge=r+(f-.5)*.48,g=90+165*smooth(.12,.92,f);red=green=blue=g;
   alpha=(1-smooth(.24,1,edge))*(.38+.62*f);
  }else if(kind==='ring')alpha=smooth(.57,.79,r)*(1-smooth(.82,1,r))*(.62+.38*f);
  else alpha=Math.pow(Math.max(0,1-r),2.6);
  data[i]=red;data[i+1]=green;data[i+2]=blue;data[i+3]=Math.round(255*clamp(alpha));
 }
 const t=new T.DataTexture(data,n,n);t.colorSpace=T.SRGBColorSpace;t.magFilter=T.LinearFilter;t.minFilter=T.LinearFilter;t.needsUpdate=true;return t;
}
const PROFILE={
 blast:{cloud:'#635046',smoke:1,fire:1,shards:'#75665b',flash:'#ffdf9a'},
 fire:{cloud:'#40312c',smoke:1.1,fire:1.4,shards:'#ff8c38',flash:'#fff0b2'},
 ice:{cloud:'#c5e8ff',smoke:.65,shards:'#9cddff',flash:'#c8f3ff'},
 storm:{cloud:'#a3bbd9',smoke:.35,shards:'#c8e9ff',flash:'#e0f4ff'},
 arcane:{cloud:'#724398',smoke:.65,shards:'#d88dff',flash:'#eed1ff'},
 toxic:{cloud:'#76913d',smoke:1.1,shards:'#b4d36b',flash:'#dfff8d'},
 holy:{cloud:'#d0b481',smoke:.45,shards:'#ffe5a1',flash:'#fff5d4'},
 void:{cloud:'#342449',smoke:.6,shards:'#a88cdb',flash:'#c6a4ff'},
 dust:{cloud:'#ad9273',smoke:1.2,shards:'#947b60',flash:'#ddc9a9'}
};
export function impactQuality(config,quality,count=1){const wanted=config.visualQuality==='high'?'high':quality;return count>8?'minimal':count>=3?'low':count===2&&wanted==='high'?'balanced':['low','balanced','high'].includes(wanted)?wanted:'balanced'}
const BUDGET={minimal:[2,1,3],low:[8,4,10],balanced:[14,7,20],high:[20,10,30]};
function seeds(n,seed){let s=seed>>>0;const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};return Array.from({length:n},()=>({a:random()*Math.PI*2,r:.35+random()*.65,up:random(),size:.55+random()*.65,spin:random()*6.28,phase:random()}))}
function runeGeometry(){const a=[];for(let i=0;i<64;i++){const p=i*Math.PI/32,q=(i+1)*Math.PI/32;for(const r of [.72,.95])a.push(Math.cos(p)*r,0,Math.sin(p)*r,Math.cos(q)*r,0,Math.sin(q)*r)}for(let i=0;i<12;i++){const p=i*Math.PI/6,c=Math.cos(p),s=Math.sin(p),point=(r,o)=>[c*r-s*o,0,s*r+c*o];for(const [x,y]of [[point(.77,-.04),point(.89,0)],[point(.89,0),point(.77,.04)],[point(.77,.04),point(.77,-.04)]])a.push(...x,...y)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));return g}

// Analytic motion, fixed-size instance buffers and one-shot Quarks accents.
// The impact effects never change world state or add dynamic shadow maps.
export function createThrowVisuals(factory){
 const group=new T.Group(),entries=new Map(),plane=new T.PlaneGeometry(1,1),orbGeo=new T.SphereGeometry(1,12,8),shardGeo=new T.OctahedronGeometry(1,0),runeGeo=runeGeometry(),tex={};let bodies=null;const optical=createOpticalEffects(),proxyGeo=new T.IcosahedronGeometry(1,0),proxyMat=new T.MeshBasicMaterial({transparent:true,opacity:.35,depthWrite:false});let proxy=null;
 function prepare(){if(bodies)return;bodies=createImpactBodies();for(const k of ['fire','smoke','halo','ring'])tex[k]=makeTexture(k)}
 // Baked facet colors make crystal and stone fragments visibly three-dimensional
 // even at night, without adding lights or material programs for each effect.
 const normals=shardGeo.attributes.normal,facet=new Float32Array(normals.count*3);
 for(let i=0;i<normals.count;i++){const shade=.42+.58*clamp(normals.getX(i)*.24+normals.getY(i)*.75+normals.getZ(i)*.45);facet.set([shade,shade,shade],i*3)}
 shardGeo.setAttribute('color',new T.BufferAttribute(facet,3));
 const dummy=new T.Object3D(),cameraLocal=new T.Vector3(),cameraQ=new T.Quaternion(),frustum=new T.Frustum(),projection=new T.Matrix4(),bounds=new T.Sphere();
 group.name='Impacts cinematiques';
 function basic(color,map=null,add=false){return new T.MeshBasicMaterial({color,map,transparent:true,opacity:1,depthWrite:false,alphaTest:map?.001:0,side:T.DoubleSide,toneMapped:false,blending:add?T.AdditiveBlending:T.NormalBlending})}
 function sprite(color,map,add=false){return new T.Mesh(plane,basic(color,map,add))}
 function batch(n,geometry,material){const m=new T.InstancedMesh(geometry,material,n);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;m.count=0;return m}
 function remove(id,e){group.remove(e.root);e.fx?.dispose();e.bolt?.dispose();e.body.dispose();e.lens?.dispose();for(const m of e.materials)m.dispose();for(const b of [e.trail,e.smoke,e.fire,e.shards])b?.dispose();entries.delete(id)}
 function build(p,quality){
  prepare();
  const root=new T.Group(),profile=PROFILE[p.config.id]||PROFILE.blast,[smokeCount,fireCount,shardCount]=BUDGET[quality]||BUDGET.balanced,materials=new Set(),add=o=>{root.add(o);materials.add(o.material);return o};
  const body=bodies.create(p.config.id,quality,p.config.shape,p.config.color);root.add(body.group);
  const halo=add(sprite(profile.flash,tex.halo,true)),core=add(new T.Mesh(orbGeo,basic('#ffffff',null,true))),trail=add(batch(7,orbGeo,basic(p.config.color,null,true)));
  const flash=add(sprite(profile.flash,tex.halo,true)),wave=add(sprite(p.config.color,tex.ring,true)),wave2=add(sprite(profile.flash,tex.ring,true));wave.rotation.x=-Math.PI/2;wave.position.y=.045;
  const smoke=add(batch(smokeCount,plane,basic(profile.cloud,tex.smoke))),fire=profile.fire?add(batch(fireCount,plane,basic('#ffffff',tex.fire))):null;
  const shards=add(batch(shardCount,shardGeo,basic(profile.shards,null,p.config.id==='arcane'||p.config.id==='storm')));
   shards.material.vertexColors=true;
  const pillar=['arcane','holy'].includes(p.config.id)?add(sprite(p.config.color,tex.halo,true)):null;
  halo.name='Projectile glow';trail.name='Projectile trail';flash.name='Impact flash';wave.name='Shockwave';smoke.name='Residual smoke';shards.name='3D fragments';if(fire)fire.name='Fireball';if(pillar)pillar.name='Arcane column';
  const runes=['arcane','holy','void'].includes(p.config.id)?[0,1].map(()=>add(new T.LineSegments(runeGeo,new T.LineBasicMaterial({color:p.config.color,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})))):[];
  const bolt=p.config.id==='storm'?createLightning({color:'#70bbff',size:p.config.radius*(p.config.visualScale??1.25)*1.6,height:p.config.radius*(p.config.visualScale??1.25)*2.4}):null;if(bolt){root.add(bolt.group);bolt.group.visible=false}
  const seed=[...p.id].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),17);
  const lens=['blackhole','distortion'].includes(p.config.id)?optical.create(p.config.id,p.config.color):null;
  const e={root,profile,lens,halo,core,trail,flash,wave,wave2,smoke,fire,shards,runes,bolt,pillar,body,quality,materials,fx:null,fxStarted:false,smokeSeeds:seeds(smokeCount,seed),fireSeeds:seeds(fireCount,seed+97),shardSeeds:seeds(shardCount,seed+197)};
  e.smokeOrder=e.smokeSeeds.map((_,i)=>({i}));e.fireOrder=e.fireSeeds.map((_,i)=>({i}));
  for(const o of [flash,wave,wave2,smoke,fire,shards,pillar,...runes])if(o)o.visible=false;
  group.add(root);return e;
 }
 function billboard(o,size){o.quaternion.copy(cameraQ);o.scale.set(size,size,1)}
 function billows(mesh,list,order,age,radius,style,kind){
  if(!mesh)return;const fire=style==='fire',life=fire?(kind==='fire'?1.4:.95):3,age01=clamp(age/life),opacity=fire?1-smooth(.48,1,age01):.8*smooth(0,.14,age01)*(1-smooth(.57,1,age01));
  mesh.visible=age<life&&opacity>.005;if(!mesh.visible)return;mesh.material.opacity=fire?opacity*.82:opacity*(kind==='dust'?.95:.8);
  for(let i=0;i<list.length;i++){
   const b=order[i],s=list[b.i],t=1-Math.exp(-age*(fire?4.8:1.8)),spread=radius*s.r*t*(fire?.46:kind==='dust'?1.05:.68),up=radius*(fire?.12+s.up*.45:kind==='dust'?.06+s.up*.16:.12+s.up*.55+age*.20),size=radius*s.size*(fire?.22+.51*t:.40+.75*age01);
   const x=Math.cos(s.a+age*.14)*spread,z=Math.sin(s.a+age*.14)*spread,y=up*t;
   b.x=x;b.y=y;b.z=z;b.size=size;b.depth=(x-cameraLocal.x)**2+(y-cameraLocal.y)**2+(z-cameraLocal.z)**2;
  }
  order.sort((a,b)=>b.depth-a.depth);mesh.count=order.length;
  for(let i=0;i<order.length;i++){const b=order[i];dummy.position.set(b.x,b.y,b.z);dummy.quaternion.copy(cameraQ);dummy.rotateZ(list[b.i].spin+age*.23);dummy.scale.set(b.size,b.size*(fire&&kind==='fire'?1.42:1),1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}mesh.instanceMatrix.needsUpdate=true;
 }
 function fragments(e,age,radius,kind){
  const life=kind==='ice'?1.85:1.45,t=clamp(age/life);e.shards.visible=age<life;if(!e.shards.visible)return;e.shards.material.opacity=1-smooth(.62,1,t);e.shards.count=e.shardSeeds.length;
  for(let i=0;i<e.shardSeeds.length;i++){
   const s=e.shardSeeds[i],spread=radius*s.r*(kind==='void'?Math.max(.02,1-age/1.4):(1-Math.exp(-age*2.8)))*(kind==='arcane'?.85:1.25),a=s.a+(kind==='arcane'?age*3:0),y=kind==='arcane'?radius*(.2+s.up*.65+age*.12):Math.max(.015,radius*(s.up*.95*age-.52*age*age+.05)),size=radius*(kind==='ice'?.073:kind==='arcane'?.045:.038)*s.size*(1-.65*t);
   dummy.position.set(Math.cos(a)*spread,y,Math.sin(a)*spread);dummy.rotation.set(s.spin+age*4,a+age*3,s.phase*6+age*2);dummy.scale.set(size,size*(kind==='ice'?5.5:kind==='storm'?3:1.35),size);dummy.updateMatrix();e.shards.setMatrixAt(i,dummy.matrix);
  }e.shards.instanceMatrix.needsUpdate=true;
 }
 function update(list,time,camera,quality){
  if(!list.length&&!entries.size)return false;
  list=list.filter(p=>p.phase==='flight'||(p.config.strength??1)>0&&Number.isFinite(p.age)&&p.age<(p.config.duration??IMPACT_MS/1000));
  const active=new Set();camera.updateMatrixWorld();camera.getWorldQuaternion(cameraQ);frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const visible=[];
  for(const p of list){bounds.center.set(p.position.x,p.position.z,p.position.y);bounds.radius=p.config.radius*(p.config.visualScale??1.25)*4+2;if(frustum.intersectsSphere(bounds))visible.push(p)}
  visible.sort((a,b)=>Math.hypot(a.position.x-camera.position.x,a.position.z-camera.position.y,a.position.y-camera.position.z)-Math.hypot(b.position.x-camera.position.x,b.position.z-camera.position.y,b.position.y-camera.position.z));
  const detailLimit=quality==='low'?16:quality==='high'?32:24,fallback=visible.slice(detailLimit);
  if(fallback.length){if(!proxy||proxy.instanceMatrix.count<fallback.length){if(proxy){group.remove(proxy);proxy.dispose()}proxy=new T.InstancedMesh(proxyGeo,proxyMat,2**Math.ceil(Math.log2(fallback.length)));proxy.name='Impacts simplifiés';proxy.frustumCulled=false;group.add(proxy)}proxy.visible=true;proxy.count=fallback.length;
   for(let i=0;i<fallback.length;i++){const p=fallback[i],progress=p.phase==='flight'?0:p.age/(p.config.duration||3),r=p.config.radius*(p.config.visualScale??1.25),fade=Math.max(.01,Math.sin(progress*Math.PI));dummy.position.set(p.position.x,p.position.z+(p.phase==='flight'?0:r*.35),p.position.y);dummy.rotation.set(0,0,0);dummy.scale.setScalar(p.phase==='flight'?.13:r*fade*.65);dummy.updateMatrix();proxy.setMatrixAt(i,dummy.matrix);proxy.setColorAt(i,new T.Color(p.config.id==='blackhole'?'#151024':p.config.color))}proxy.instanceMatrix.needsUpdate=true;proxy.instanceColor.needsUpdate=true;
  }else if(proxy){group.remove(proxy);proxy.dispose();proxy=null}
  for(const p of visible.slice(0,detailLimit)){
   active.add(p.id);let e=entries.get(p.id);if(!e){e=build(p,impactQuality(p.config,quality,visible.length));entries.set(p.id,e)}e.root.visible=true;
   const at=p.position,r=p.config.radius*(p.config.visualScale??1.25),kind=p.config.id,life=p.config.duration??3,a=p.age*3/life;e.root.position.set(at.x,at.z,at.y);camera.getWorldPosition(cameraLocal);cameraLocal.sub(e.root.position);
   const strength=p.config.strength??1;
   if(e.lens)e.lens.update(at,r,p.age,life,strength,camera);
   if(p.phase==='flight'){
    if(e.lens)e.lens.mesh.visible=false;e.body.group.visible=false;e.core.visible=e.halo.visible=e.trail.visible=true;e.core.scale.setScalar(.085+r*.035);billboard(e.halo,.5+r*.19);e.trail.count=7;
    for(let i=0;i<7;i++){const t=(i+1)/7;dummy.position.set((p.tail.x-at.x)*t,(p.tail.z-at.z)*t,(p.tail.y-at.y)*t);dummy.rotation.set(0,0,0);dummy.scale.setScalar((.055+r*.015)*(1-t*.8));dummy.updateMatrix();e.trail.setMatrixAt(i,dummy.matrix)}e.trail.instanceMatrix.needsUpdate=true;continue;
   }
   e.core.visible=e.halo.visible=e.trail.visible=false;
   e.body.update(a,r);if(e.lens||kind==='shockwave')e.body.group.visible=false;
   if(!e.fxStarted){e.fxStarted=true;if(a<.18&&!e.lens&&kind!=='shockwave'&&e.quality!=='minimal'){e.fx=factory.burst({kind:'blast_'+kind,color:p.config.color,size:r*.8,speed:3/life,density:1,quality:e.quality,shape:p.config.shape});e.root.add(e.fx.group)}}
   e.flash.visible=!e.lens&&kind!=='dust'&&kind!=='shockwave'&&a<.42;e.flash.material.opacity=(1-smooth(0,.42,a))*.95;billboard(e.flash,r*(1.05+2.4*smooth(0,.15,a)));
   e.wave.visible=!e.lens&&a<.8;e.wave.material.opacity=(1-smooth(.06,.8,a))*.94;e.wave.scale.setScalar(r*(kind==='void'?3-2.7*smooth(0,.7,a):.3+2.7*smooth(0,.7,a)));e.wave.position.y=.055;
   e.wave2.visible=!e.lens&&kind!=='dust'&&a<.48;e.wave2.material.opacity=(1-smooth(0,.48,a))*.42;billboard(e.wave2,r*(.2+2.3*smooth(0,.44,a)));
   if(!e.lens&&kind!=='shockwave'){billows(e.fire,e.fireSeeds,e.fireOrder,a,r,'fire',kind);billows(e.smoke,e.smokeSeeds,e.smokeOrder,a,r,'smoke',kind);fragments(e,a,r,kind)}else{e.smoke.visible=e.shards.visible=false;if(e.fire)e.fire.visible=false}
   for(let i=0;i<e.runes.length;i++){const rune=e.runes[i];rune.visible=a<1.55;rune.material.opacity=.9*(1-smooth(.65,1.55,a));rune.scale.setScalar(r*(.25+smooth(0,.5,a)*(i?.8:1.05)));rune.rotation.set(i?Math.PI/2:0,a*(i?-1.8:1.2),i?a*.7:0);rune.position.y=.06+i*r*.35}
   if(e.pillar){e.pillar.visible=a<1.05;e.pillar.material.opacity=.85*(1-smooth(.18,1.05,a));billboard(e.pillar,r*.8);e.pillar.scale.y=r*(.8+2.8*smooth(0,.35,a));e.pillar.position.y=r*.95}
   if(e.bolt){if(a<.38)e.bolt.update(a,1-smooth(.15,.38,a));else e.bolt.group.visible=false}
   for(const material of e.materials){material.opacity*=Math.min(1,strength);if(material.color){material.userData.baseColor??=material.color.clone();material.color.copy(material.userData.baseColor).multiplyScalar(Math.max(1,strength))}}
   e.body.group.traverse(o=>{if(o.material?.uniforms?.fade){o.material.uniforms.fade.value*=Math.min(1,strength);for(const key of ['hotColor','highlightColor']){const u=o.material.uniforms[key];if(u){o.material.userData[key]??=u.value.clone();u.value.copy(o.material.userData[key]).multiplyScalar(Math.max(1,strength))}}}});
   if(e.fx){if(a<1.8)e.fx.update(time,camera,(1-smooth(1.45,1.8,a))*Math.min(1,strength));else{e.root.remove(e.fx.group);e.fx.dispose();e.fx=null}}
  }
  for(const [id,e]of entries)if(!active.has(id))remove(id,e);
  return list.length>0;
 }
 return{group,update,render:optical.render,optical,stats:()=>({active:entries.size,simplified:proxy?.count||0,instances:[...entries.values()].reduce((n,e)=>n+e.smokeSeeds.length+(e.fire?e.fireSeeds.length:0)+e.shardSeeds.length+7,0)}),dispose(){for(const [id,e]of entries)remove(id,e);if(proxy){group.remove(proxy);proxy.dispose()}proxyGeo.dispose();proxyMat.dispose();optical.dispose();for(const t of Object.values(tex))t.dispose();plane.dispose();orbGeo.dispose();shardGeo.dispose();runeGeo.dispose();bodies?.dispose()}};
}

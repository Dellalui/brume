import * as T from './vendor/three.module.min.js';

// An upright image is a view, not a physical surface. Use a low-poly volume
// in world space to cast shadows; it never contributes color or camera depth.
export function makeShadowVolume(o,actor,geometry){
 const material=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false});
 const mesh=new T.Mesh(geometry,material);
 const height=Math.max(.05,(Number(o.height)||1.8)*(Number(o.scale)||1));
 mesh.scale.set(actor?height*.43:Math.max(.15,Number(o.w)||1),height,actor?height*.30:Math.max(.15,Number(o.d)||1));
 mesh.userData.shadowOnly=true;mesh.castShadow=true;mesh.receiveShadow=false;
 mesh.raycast=()=>{};
 return mesh;
}
export function shadowVolumeGeometry(){
 // A closed, tapered silhouette with shoulders and head. Twelve segments,
 // shared by all sprites; no image alpha, camera angle or frame dependency.
 const profile=[[0,.02],[.26,.02],[.32,.07],[.28,.34],[.42,.46],[.50,.66],[.37,.76],[.20,.78],[.30,.82],[.32,.91],[.22,.98],[0,1]];
 return new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),12);
}
export function contactShadowTexture(){
 const n=64,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const d=Math.hypot((x+.5)/n*2-1,(y+.5)/n*2-1),i=(y*n+x)*4;
  data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(255*Math.max(0,1-d*d)**2);
 }
 const texture=new T.DataTexture(data,n,n,T.RGBAFormat);texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}
// Small maps have a single world-space light budget. Large maps stream by
// fixed 32-cell sectors, not view direction or currently selected character.
export function lightingAnchor(map,camera){
 if(Math.max(map.width,map.height)<=64||!camera.isPerspectiveCamera)return {x:map.width/2,y:map.height/2};
 const sector=(n,max)=>Math.min(max,Math.max(0,Math.floor(Math.max(0,Math.min(max-1,n))/32)*32+16));
 return {x:sector(camera.position.x,map.width),y:sector(camera.position.z,map.height)};
}
export function selectSceneLights(sources,anchor,limit=8){
 const score=s=>Math.hypot(s.x-anchor.x,s.y-anchor.y)-Math.min(8,s.radius||0)*.5-Math.min(2,s.power||0);
 const tie=s=>[s.owner??'',s.x,s.y,s.z??0,s.radius??0,s.color??''].join('|');
 return sources.filter(s=>s&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&s.power>0).sort((a,b)=>Number(!!a.secondary)-Number(!!b.secondary)||score(a)-score(b)||tie(a).localeCompare(tie(b))).slice(0,limit);
}

// Four 256px point-shadow atlases use the nominal texel count of one 512px atlas.
export function pointShadowBudget(shadows,quality){return shadows?(quality===1?2:4):8}

// Keep the shadow owner stable, but reserve the other slots for illumination
// near the viewer. A small score advantage retains sources around a boundary.
export function selectLocalLights(sources,anchor,viewer,previous=[],limit=8){
 const stable=selectSceneLights(sources,anchor,1)[0];
 const id=s=>[s.owner,s.x,s.y,s.z,s.secondary].join('|'),old=new Set(previous.map(id));
 const score=s=>Math.hypot(s.x-viewer.x,s.y-viewer.y)-(s.radius||0)-(old.has(id(s))?2:0);
 return [...(stable?[stable]:[]),...sources.filter(s=>s!==stable&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&s.power>0).sort((a,b)=>score(a)-score(b)||id(a).localeCompare(id(b))).slice(0,limit-(stable?1:0))];
}

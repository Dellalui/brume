import * as T from './vendor/three.module.min.js';
import {lightSourceId} from './shadow-system.mjs';

// A compact CPU-built world-space light grid. Unlike a global array of
// PointLights, its cost depends on lights affecting the shaded cell, not
// the number of visible lamps. It is only rebuilt on real source/LOD edits.
export const DETAIL_LIGHTS=16;
const MAX_CELLS=32768,MIN_CELL=4;
const valid=s=>s&&[s.x,s.y,s.z??.85,s.radius,s.power].every(Number.isFinite)&&s.radius>0&&s.power>0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const attenuation=(distance2,radius)=>Math.max(0,1-(distance2/(radius*radius))**2)**2/Math.max(.01,distance2);
function rgb(source){const c=new T.Color(source.color||'#ffcf88');return [c.r*source.power*12,c.g*source.power*12,c.b*source.power*12]}
export function buildSpatialLightGrid(sources,maxTextureSize=2048){
 const lights=sources.filter(valid).map(s=>({id:lightSourceId(s),p:[s.x,s.z??.85,s.y],radius:s.radius,color:rgb(s)}));
 const width=Math.max(1,Math.min(512,Math.floor(maxTextureSize))),capacity=width*Math.max(1,Math.floor(maxTextureSize));
 if(!lights.length)return {data:new Float32Array(4),width:1,height:1,origin:[0,0,0],dimensions:[1,1,1],cell:MIN_CELL,sources:0,occupied:0,overflow:0};
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(const l of lights)for(let a=0;a<3;a++){low[a]=Math.min(low[a],l.p[a]-l.radius);high[a]=Math.max(high[a],l.p[a]+l.radius)}
 let cell=MIN_CELL;
 for(;;cell*=2){
  const origin=low.map(n=>Math.floor(n/cell)*cell),dimensions=high.map((n,a)=>Math.floor((n-origin[a])/cell)+1),[nx,ny,nz]=dimensions,total=nx*ny*nz;
  if(!Number.isFinite(total)||total>MAX_CELLS||total*2>=capacity)continue;
  const bins=new Map();
  for(const l of lights){
   const lo=l.p.map((v,a)=>clamp(Math.floor((v-l.radius-origin[a])/cell),0,dimensions[a]-1)),hi=l.p.map((v,a)=>clamp(Math.floor((v+l.radius-origin[a])/cell),0,dimensions[a]-1)),r2=l.radius*l.radius;
   for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
    const at=[origin[0]+x*cell,origin[1]+y*cell,origin[2]+z*cell];
    let nearest=0,mid=0;for(let a=0;a<3;a++){nearest+=(l.p[a]-clamp(l.p[a],at[a],at[a]+cell))**2;mid+=(l.p[a]-at[a]-cell*.5)**2}
    if(nearest>=r2)continue;
    const i=(z*ny+y)*nx+x;let list=bins.get(i);if(!list)bins.set(i,list=[]);
    list.push({l,nearest,mid,score:Math.max(...l.color)*attenuation(nearest,l.radius)});
   }
  }
  let count=0,overflow=0;
  for(const list of bins.values()){count+=Math.min(DETAIL_LIGHTS,list.length);overflow+=Math.max(0,list.length-DETAIL_LIGHTS)}
  const texels=total*2+count*2;
  if(texels>capacity)continue;
  const height=Math.max(1,Math.ceil(texels/width)),data=new Float32Array(width*height*4);
  let offset=total*2;
  for(const [i,list]of bins){
   if(list.length>DETAIL_LIGHTS)list.sort((a,b)=>b.score-a.score||a.mid-b.mid||a.l.id.localeCompare(b.l.id));
   const n=Math.min(DETAIL_LIGHTS,list.length),head=i*8;
   data[head]=offset;data[head+1]=n;
   for(let j=0;j<n;j++){
    const {l}=list[j];data.set([...l.p,l.radius,...l.color,0],offset*4);offset+=2;
   }
   // Pathological overlap does not switch the remaining sources off.
   // Fold their low-frequency diffuse contribution into this cell.
   for(let j=n;j<list.length;j++){const {l,mid}=list[j],weight=.25*attenuation(mid,l.radius);for(let a=0;a<3;a++)data[head+4+a]+=l.color[a]*weight}
  }
  return {data,width,height,origin,dimensions,cell,sources:lights.length,occupied:bins.size,overflow};
 }
}

const vertex=`#include <worldpos_vertex>
vec4 brumeGridP = vec4(transformed, 1.0);
#ifdef USE_BATCHING
 brumeGridP = batchingMatrix * brumeGridP;
#endif
#ifdef USE_INSTANCING
 brumeGridP = instanceMatrix * brumeGridP;
#endif
brumeGridWorld = (modelMatrix * brumeGridP).xyz;`;
const fragment=`
varying vec3 brumeGridWorld;
uniform sampler2D brumeLightGrid;
uniform vec3 brumeGridOrigin;
uniform ivec3 brumeGridSize;
uniform float brumeGridCell;
uniform int brumeGridWidth;
uniform float brumeGridEnabled;
vec4 brumeGridRead(int i) {
 return texelFetch(brumeLightGrid, ivec2(i % brumeGridWidth, i / brumeGridWidth), 0);
}
vec3 brumeGridIrradiance(vec3 p, vec3 n) {
 if(brumeGridEnabled < 0.5) return vec3(0.0);
 ivec3 c = ivec3(floor((p-brumeGridOrigin)/brumeGridCell));
 if(any(lessThan(c,ivec3(0))) || any(greaterThanEqual(c,brumeGridSize))) return vec3(0.0);
 int head = ((c.z*brumeGridSize.y+c.y)*brumeGridSize.x+c.x)*2;
 vec4 info = brumeGridRead(head);
 int count = int(info.y);
 if(count == 0) return vec3(0.0);
 int start = int(info.x);
 vec3 result = brumeGridRead(head+1).rgb;
 for(int i=0;i<${DETAIL_LIGHTS};i++){
  if(i>=count) break;
  vec4 s = brumeGridRead(start+i*2);
  vec3 d = s.xyz-p;
  float d2 = dot(d,d), r2=s.w*s.w;
  if(d2>=r2) continue;
  float facing=max(0.0,dot(n,d)*inversesqrt(max(d2,0.00001)));
  if(facing<=0.0) continue;
  float falloff=1.0-d2*d2/(r2*r2);
  result+=brumeGridRead(start+i*2+1).rgb*(facing*falloff*falloff/max(0.01,d2));
 }
 return result;
}
`;
export function injectSpatialLighting(shader,uniforms){
 if(shader.vertexShader.includes('varying vec3 brumeGridWorld;'))return;
 Object.assign(shader.uniforms,uniforms);
 shader.vertexShader='varying vec3 brumeGridWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>',vertex);
 shader.fragmentShader=fragment+shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
 reflectedLight.directDiffuse += brumeGridIrradiance(brumeGridWorld,inverseTransformDirection(normal,viewMatrix))*BRDF_Lambert(material.diffuseColor);`);
}
export function createSpatialLights(maxTextureSize=2048){
 const empty=()=>new T.DataTexture(new Float32Array(4),1,1,T.RGBAFormat,T.FloatType);
 let texture=empty();texture.needsUpdate=true;
 const uniforms={brumeLightGrid:{value:texture},brumeGridOrigin:{value:new T.Vector3()},brumeGridSize:{value:new T.Vector3(1,1,1)},brumeGridCell:{value:MIN_CELL},brumeGridWidth:{value:1},brumeGridEnabled:{value:0}};
 const wrapped=new WeakSet();let prior=null,priorNative='',signature=null,grid=null,rebuilds=0;
 function update(sources,native){
  const nativeIds=new Set(native.map(lightSourceId)),nativeKey=[...nativeIds].sort().join('\n');
  if(prior===sources&&priorNative===nativeKey)return false;
  prior=sources;priorNative=nativeKey;
  const extra=sources.filter(s=>valid(s)&&!nativeIds.has(lightSourceId(s)));
  const key=JSON.stringify(extra.map(s=>[lightSourceId(s),s.x,s.y,s.z??.85,s.radius,s.power,s.color]));
  if(key===signature)return false;
  signature=key;grid=buildSpatialLightGrid(extra,maxTextureSize);
  const next=new T.DataTexture(grid.data,grid.width,grid.height,T.RGBAFormat,T.FloatType);
  next.minFilter=next.magFilter=T.NearestFilter;next.generateMipmaps=false;next.needsUpdate=true;
  texture.dispose();texture=next;uniforms.brumeLightGrid.value=texture;
  uniforms.brumeGridOrigin.value.fromArray(grid.origin);uniforms.brumeGridSize.value.fromArray(grid.dimensions);
  uniforms.brumeGridCell.value=grid.cell;uniforms.brumeGridWidth.value=grid.width;uniforms.brumeGridEnabled.value=grid.sources?1:0;
  rebuilds++;return true;
 }
 function apply(material){
  if(!material?.isMeshStandardMaterial||wrapped.has(material))return;
  wrapped.add(material);const before=material.onBeforeCompile,key=material.customProgramCacheKey.call(material);
  material.onBeforeCompile=function(shader,renderer){before.call(this,shader,renderer);injectSpatialLighting(shader,uniforms)};
  material.customProgramCacheKey=()=>key+'|brume-spatial-lights-v1';material.needsUpdate=true;
 }
 return {apply,update,uniforms,stats:()=>({spatialLightSources:grid?.sources||0,spatialLightCells:grid?.occupied||0,spatialLightOverflow:grid?.overflow||0,spatialLightRebuilds:rebuilds}),dispose(){texture.dispose()}};
}

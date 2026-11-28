import * as T from './vendor/three.module.min.js';
import {BLOCKS} from './blocks.mjs';

// The photographs live alongside the app. Their CC0 provenance is recorded in
// assets/materials/SOURCES.md; no third-party request is made by the renderer.
const ASSETS={
 grass:{scale:.52,color:'#71814d',natural:true,roughness:.97},
 dirt:{scale:.7,color:'#82715b',natural:true,roughness:.97},
 sand:{scale:.65,color:'#c6b58b',natural:true,roughness:.98},
 gravel:{scale:.8,color:'#8a8880',natural:true,roughness:.95},
 stone:{scale:.6,color:'#8c9189',natural:true,roughness:.91},
 cobble:{scale:.65,color:'#9b9c90',natural:false,roughness:.92},
 brick:{scale:.8,color:'#a77864',natural:false,roughness:.91},
 sandstone:{scale:.7,color:'#c4b28e',natural:false,roughness:.94},
 wood:{scale:.6,color:'#a38b68',natural:false,roughness:.82},
 bark:{scale:.8,color:'#76614b',natural:false,roughness:.98},
 leaves:{scale:.65,color:'#678052',natural:true,roughness:.94},
 snow:{scale:.5,color:'#e0e5e3',natural:true,roughness:.9},
 marble:{scale:.55,color:'#c8c6bc',natural:true,roughness:.34},
 metal:{scale:.8,color:'#90968f',natural:false,roughness:.46,metalness:.65},
 ice:{scale:.45,color:'#acd2d9',natural:true,roughness:.22},
 lava:{scale:.65,color:'#d77b3a',natural:true,roughness:.83}
};

const MATERIAL_ASSET={
 grass:'grass',dirt:'dirt',sand:'sand',gravel:'gravel',clay:'dirt',snow:'snow',mud:'dirt',
 stone:'stone',cobble:'cobble',granite:'stone',marble:'marble',slate:'stone',coal:'stone',iron:'stone',copper:'stone',gold:'stone',crystal:'stone',
 oak:'bark',pinewood:'bark',birchwood:'bark',planks:'wood',darkplanks:'wood',paleplanks:'wood',
 brick:'brick',stonebrick:'sandstone',sandstone:'sandstone',tile:'brick',white:'stone',red:'stone',blue:'stone',purple:'stone',mossbrick:'cobble',
 leaves:'leaves',darkleaves:'leaves',hay:'wood',cactus:'bark',ice:'ice',glass:'ice',water:'ice',lava:'lava',
 basalt:'stone',infernal:'stone',ash:'dirt',magma:'lava',obsidian:'marble',soul:'sand',hellbrick:'brick',glowstone:'stone'
};

const COLORED=new Set(['clay','mud','granite','slate','coal','iron','copper','gold','crystal','birchwood','darkplanks','paleplanks','stonebrick','tile','white','red','blue','purple','mossbrick','darkleaves','hay','cactus','glass','water','basalt','infernal','ash','obsidian','soul','hellbrick','glowstone']);
const ORES=new Set(['coal','iron','copper','gold','crystal','glowstone']);

/** A palette entry is also used by inventory thumbnails and material audits. */
export function surfaceDefinition(kind='stone',face='side'){
 const block=BLOCKS[kind],known=ASSETS[kind],id=block||known?kind:'stone';
 let asset=MATERIAL_ASSET[id]||id,detailOnly=COLORED.has(id),endGrain=false;
 const top=face==='top'||face==='ground',bottom=face==='bottom';
 if(id==='grass'&&!top)asset='dirt';
 if(['oak','pinewood','birchwood'].includes(id)&&(top||bottom)){asset='wood';endGrain=true;detailOnly=true;}
 const base=ASSETS[asset]||ASSETS.stone;
 let roughness=base.roughness,metalness=base.metalness||0;
 if(id==='glass'){roughness=.12;metalness=.03;}
 if(id==='water'){roughness=.24;metalness=.02;}
 if(ORES.has(id))metalness=['iron','copper','gold'].includes(id)?.16:.04;
 return{kind:id,asset,url:new URL('./assets/materials/'+asset+'.jpg',import.meta.url).href,face,
  scale:base.scale,natural:base.natural,rotationMode:base.natural?'quarter-turn-blend':'aligned',
  color:detailOnly?(top?block?.top:block?.side)||base.color:'#ffffff',
  previewColor:(top?block?.top:block?.side)||base.color,
  detailOnly,roughness,metalness,endGrain,ore:ORES.has(id)?block?.accent:null,
  birch:id==='birchwood'&&!top&&!bottom,ribbed:id==='cactus'&&!top&&!bottom,
  grassCap:id==='grass'&&!top&&!bottom};
}

// This integer hash is mirrored in GLSL. It does not depend on map creation,
// draw order, camera position or time, so reloads keep exactly the same layout.
export function surfaceHash(x,y,seed=211){
 let h=(Math.imul(Math.floor(x),0x8da6b343)^Math.imul(Math.floor(y),0xd8163841)^Math.imul(seed,0xcb1ab31f))>>>0;
 h=Math.imul(h^(h>>>16),0x7feb352d)>>>0;
 h=Math.imul(h^(h>>>15),0x846ca68b)>>>0;
 return(h^(h>>>16))>>>0;
}
export function surfaceVariation(x,y,seed=211){
 const h=surfaceHash(x,y,seed);
 return{quarterTurns:h&3,rotation:(h&3)*Math.PI/2,offset:[((h>>>2)&1023)/1024,((h>>>12)&1023)/1024]};
}
export function surfaceFaceScale(width=1,height=1,depth=1,axis='y'){
 return axis==='x'?[Math.abs(depth),Math.abs(height)]:axis==='z'?[Math.abs(width),Math.abs(height)]:[Math.abs(width),Math.abs(depth)];
}

const VERTEX_DECLARATIONS=`
varying vec3 brumesSurfacePosition;
varying vec3 brumesSurfaceNormal;
varying vec3 brumesSurfaceWorld;
varying vec3 brumesSurfaceRelative;
varying vec2 brumesSurfaceUv;
varying float brumesSurfaceFaceV;
varying float brumesSurfaceHeight;
`;

const VERTEX_BODY=`
mat4 brumesSurfaceMatrix=modelMatrix;
#ifdef USE_INSTANCING
 brumesSurfaceMatrix=modelMatrix*instanceMatrix;
#endif
vec3 brumesSurfaceScale=vec3(length(brumesSurfaceMatrix[0].xyz),length(brumesSurfaceMatrix[1].xyz),length(brumesSurfaceMatrix[2].xyz));
brumesSurfaceRelative=transformed*brumesSurfaceScale;
brumesSurfacePosition=brumesSurfaceRelative+brumesSurfaceMatrix[3].xyz;
brumesSurfaceWorld=(brumesSurfaceMatrix*vec4(transformed,1.0)).xyz;
brumesSurfaceNormal=normal;
brumesSurfaceUv=uv;
brumesSurfaceFaceV=uv.y;
brumesSurfaceHeight=brumesSurfaceScale.y;
`;

const FRAGMENT_LIBRARY=`
varying vec3 brumesSurfacePosition;
varying vec3 brumesSurfaceNormal;
varying vec3 brumesSurfaceWorld;
varying vec3 brumesSurfaceRelative;
varying vec2 brumesSurfaceUv;
varying float brumesSurfaceFaceV;
varying float brumesSurfaceHeight;
uniform float brumesSurfaceScale;
uniform float brumesSurfaceNatural;
uniform float brumesSurfaceQuality;
uniform float brumesSurfaceDetail;
uniform vec3 brumesOreAccent;

uint brumesSurfaceHash(ivec2 p){
 uint h=uint(p.x)*0x8da6b343u ^ uint(p.y)*0xd8163841u ^ 211u*0xcb1ab31fu;
 h=(h^(h>>16u))*0x7feb352du;
 h=(h^(h>>15u))*0x846ca68bu;
 return h^(h>>16u);
}
vec2 brumesQuarterTurn(vec2 p,uint turn){
 if(turn==1u)return vec2(-p.y,p.x);
 if(turn==2u)return -p;
 if(turn==3u)return vec2(p.y,-p.x);
 return p;
}
vec4 brumesTileSample(sampler2D image,vec2 uv,ivec2 cell,vec2 dx,vec2 dy){
 uint h=brumesSurfaceHash(cell),turn=h&3u;
 vec2 offset=vec2(float((h>>2u)&1023u),float((h>>12u)&1023u))/1024.0;
 return textureGrad(image,brumesQuarterTurn(uv,turn)+offset,brumesQuarterTurn(dx,turn),brumesQuarterTurn(dy,turn));
}
vec4 brumesSurfaceSample(sampler2D image,vec2 uv,float natural){
 if(natural<0.5||brumesSurfaceQuality<0.5)return texture2D(image,uv);
 // Neighboring patches share the same samples at each boundary. Rotations
 // therefore never introduce the hard square seams of per-cell UV rotation.
 ivec2 cell=ivec2(floor(uv));
 vec2 f=fract(uv),w=f*f*(3.0-2.0*f),dx=dFdx(uv),dy=dFdy(uv);
 vec4 a=brumesTileSample(image,uv,cell,dx,dy);
 vec4 b=brumesTileSample(image,uv,cell+ivec2(1,0),dx,dy);
 vec4 c=brumesTileSample(image,uv,cell+ivec2(0,1),dx,dy);
 vec4 d=brumesTileSample(image,uv,cell+ivec2(1,1),dx,dy);
 return mix(mix(a,b,w.x),mix(c,d,w.x),w.y);
}
vec2 brumesProjectedUv(){
 vec3 n=abs(brumesSurfaceNormal);
 if(n.y>=n.x&&n.y>=n.z)return brumesSurfacePosition.xz;
 if(n.x>=n.z)return brumesSurfacePosition.zy;
 return brumesSurfacePosition.xy;
}
float brumesDetail(vec3 color){
 float luminance=dot(color,vec3(0.2126,0.7152,0.0722));
 return clamp(0.79+luminance*0.62,0.79,1.14);
}
`;

function shaderMapBody(spec){
 let body=`
#ifdef USE_MAP
 vec2 brumesUV=${spec.projection==='ground'?'brumesSurfaceWorld.xz':spec.projection==='uv'?'brumesSurfaceUv':'brumesProjectedUv()'}*brumesSurfaceScale;
 vec4 brumesColor;
 float brumesDetailMode=brumesSurfaceDetail;
`;
 if(spec.terrain){
  body+=`
 if(brumesGroundType>2.5){brumesColor=brumesSurfaceSample(brumesGroundSnow,brumesSurfaceWorld.xz*0.5,1.0);brumesDetailMode=0.0;}
 else if(brumesGroundType>1.5){brumesColor=brumesSurfaceSample(brumesGroundDirt,brumesSurfaceWorld.xz*0.7,1.0);brumesDetailMode=0.0;}
 else if(brumesGroundType>0.5){brumesColor=brumesSurfaceSample(brumesGroundStone,brumesSurfaceWorld.xz*0.6,1.0);brumesDetailMode=1.0;}
 else brumesColor=brumesSurfaceSample(map,brumesUV,brumesSurfaceNatural);
`;
 }else body+='brumesColor=brumesSurfaceSample(map,brumesUV,brumesSurfaceNatural);\n';
 if(spec.endGrain)body+=`
 float brumesRadius=length(${spec.projection==='uv'?'brumesSurfaceUv':'brumesSurfaceRelative.xz'}+vec2(0.07,-0.05));
 float brumesRing=0.5+0.5*sin(brumesRadius*91.0+sin(brumesSurfaceRelative.x*18.0)*0.7);
 brumesColor.rgb*=mix(0.66,1.1,smoothstep(0.08,0.38,brumesRing));
`;
 if(spec.birch)body+=`
 vec2 brumesBirchGrid=vec2(brumesUV.x*6.0,brumesUV.y*23.0);
 uint brumesBirchHash=brumesSurfaceHash(ivec2(floor(brumesBirchGrid)));
 vec2 brumesBirchCell=fract(brumesBirchGrid);
 float brumesLenticel=step(0.81,float(brumesBirchHash&1023u)/1024.0)*(1.0-smoothstep(0.1,0.26,abs(brumesBirchCell.y-0.5)))*(1.0-smoothstep(0.25,0.48,abs(brumesBirchCell.x-0.5)));
 brumesColor.rgb*=1.0-brumesLenticel*0.6;
`;
 if(spec.ribbed)body+=`
 float brumesRib=0.5+0.5*cos(brumesUV.x*62.83185);
 brumesColor.rgb*=mix(0.6,1.15,smoothstep(0.05,0.8,brumesRib));
`;
 if(spec.ore)body+=`
 vec2 brumesOreGrid=brumesUV*11.0;
 ivec2 brumesOreCell=ivec2(floor(brumesOreGrid));
 float brumesOreSeed=float(brumesSurfaceHash(brumesOreCell)&1023u)/1024.0;
 vec2 brumesOrePoint=fract(brumesOreGrid)-0.5;
 float brumesOreMask=step(0.77,brumesOreSeed)*(1.0-smoothstep(0.12,0.36,abs(brumesOrePoint.x)+abs(brumesOrePoint.y)));
`;
 body+=`
 vec3 brumesAlbedo=brumesDetailMode>0.5?vec3(brumesDetail(brumesColor.rgb)):brumesColor.rgb;
`;
 if(spec.ore)body+='brumesAlbedo=mix(brumesAlbedo,brumesOreAccent*1.35,brumesOreMask*0.8);\n';
 if(spec.grassCap)body+=`
 float brumesEdgeNoise=sin(brumesSurfacePosition.x*17.0+brumesSurfacePosition.z*13.0)*0.014+sin(brumesSurfacePosition.x*31.0-brumesSurfacePosition.z*23.0)*0.009;
 float brumesTopDistance=(1.0-brumesSurfaceFaceV)*max(brumesSurfaceHeight,0.1);
 float brumesCap=1.0-smoothstep(0.10+brumesEdgeNoise,0.18+brumesEdgeNoise,brumesTopDistance);
 vec3 brumesGrass=brumesSurfaceSample(brumesGrassTexture,brumesUV*0.8,1.0).rgb;
 brumesAlbedo=mix(brumesAlbedo,brumesGrass,brumesCap);
`;
 body+=`
 diffuseColor.rgb*=brumesAlbedo;
 diffuseColor.a*=brumesColor.a;
#endif
`;
 return body;
}

export function createSurfaceLibrary({createCanvas,onReady=()=>{},anisotropy=4}={}){
 const entries=new Map(),records=new Map(),quality={value:1};let disposed=false;
 const maxAnisotropy=Math.max(1,Math.min(8,Number(anisotropy)||1));
 const makeCanvas=createCanvas||(()=>globalThis.document?.createElement?.('canvas'));
 function configure(texture,key,state){
  texture.name='Les Brumes / '+key;
  texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.magFilter=T.LinearFilter;
  texture.minFilter=T.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=maxAnisotropy;
  texture.userData={surfaceAsset:key,surfaceState:state};
  texture.needsUpdate=true;
  return texture;
 }
 function placeholder(key){
  const canvas=makeCanvas?.(),base=ASSETS[key]||ASSETS.stone;
  if(canvas){
   canvas.width=canvas.height=64;
   const ctx=canvas.getContext?.('2d');
   if(ctx){
    ctx.fillStyle=base.color;ctx.fillRect(0,0,64,64);
    // A quiet, periodic fallback remains usable offline while the photo loads.
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
     ctx.fillStyle=(surfaceHash(x,y)&1)?'#ffffff08':'#00000008';
     ctx.fillRect(x*8,y*8,8,8);
    }
    return configure(new T.CanvasTexture(canvas),key,'fallback');
   }
  }
  const color=new T.Color(base.color).convertLinearToSRGB();
  return configure(new T.DataTexture(new Uint8Array([Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255),255]),1,1,T.RGBAFormat),key,'fallback');
 }
 function texture(key='stone'){
  if(disposed)throw Error('Surface library has been disposed');
  if(!ASSETS[key])key='stone';
  if(entries.has(key))return entries.get(key).texture;
  const entry={texture:placeholder(key),state:'fallback',image:null};entries.set(key,entry);
  // Node geometry tests intentionally do not start image/network work.
  if(typeof globalThis.Image==='function'){
   const image=new globalThis.Image();entry.image=image;entry.state='loading';image.decoding='async';
   image.onload=()=>{
    if(disposed)return;
    const old=entry.texture;
    entry.texture=configure(new T.Texture(image),key,'loaded');entry.state='loaded';entry.image=null;
    // Replace, rather than resize, an already uploaded placeholder texture.
    for(const record of records.values())if(record.assets.has(key))record.bind();
    old.dispose();onReady();
   };
   image.onerror=()=>{if(disposed)return;entry.state='error';entry.image=null;onReady();};
   image.src=new URL('./assets/materials/'+key+'.jpg',import.meta.url).href;
  }
  return entry.texture;
 }
 function apply(material,options={}){
  if(disposed)throw Error('Surface library has been disposed');
  const kind=options.kind||'stone',face=options.face||((options.projection==='ground'||options.terrain)?'ground':'side'),def=surfaceDefinition(kind,face);
  const spec={...def,projection:options.projection||'box',terrain:!!options.terrain,
   detailOnly:options.detailOnly??def.detailOnly,grassCap:options.grassCap??def.grassCap};
  const previous=records.get(material);
  const before=previous?.before||material.onBeforeCompile;
  const originalKey=previous?.originalKey||material.customProgramCacheKey.call(material);
  if(previous)material.removeEventListener('dispose',previous.release);
  material.map=texture(def.asset);
  material.roughness=def.roughness;
  material.metalness=def.metalness;
  if(options.detailOnly!==true)material.color.set(def.color);
  const uniforms={
   brumesSurfaceScale:{value:def.scale},brumesSurfaceNatural:{value:def.natural?1:0},brumesSurfaceQuality:quality,
   brumesSurfaceDetail:{value:spec.detailOnly?1:0},brumesOreAccent:{value:new T.Color(def.ore||'#ffffff')}
  };
  if(spec.grassCap)uniforms.brumesGrassTexture={value:texture('grass')};
  if(spec.terrain){uniforms.brumesGroundStone={value:texture('stone')};uniforms.brumesGroundDirt={value:texture('dirt')};uniforms.brumesGroundSnow={value:texture('snow')};}
  const assets=new Set([def.asset]);
  if(spec.grassCap)assets.add('grass');
  if(spec.terrain){assets.add('stone');assets.add('dirt');assets.add('snow');}
  const record={before,originalKey,uniforms,spec,assets,
   bind(){
    material.map=entries.get(def.asset).texture;
    if(spec.grassCap)uniforms.brumesGrassTexture.value=entries.get('grass').texture;
    if(spec.terrain){uniforms.brumesGroundStone.value=entries.get('stone').texture;uniforms.brumesGroundDirt.value=entries.get('dirt').texture;uniforms.brumesGroundSnow.value=entries.get('snow').texture;}
    material.needsUpdate=true;
   },
   release(){records.delete(material);material.removeEventListener('dispose',record.release);}
  };
  records.set(material,record);material.addEventListener('dispose',record.release);
  material.onBeforeCompile=function(shader,renderer){
   before.call(this,shader,renderer);
   Object.assign(shader.uniforms,uniforms);
   let vertexDeclarations=VERTEX_DECLARATIONS,vertexBody=VERTEX_BODY,fragmentDeclarations=FRAGMENT_LIBRARY;
   if(spec.terrain){vertexDeclarations+='attribute float surfaceGroundType;\nvarying float brumesGroundType;\n';vertexBody+='brumesGroundType=surfaceGroundType;\n';fragmentDeclarations+='varying float brumesGroundType;\nuniform sampler2D brumesGroundStone;\nuniform sampler2D brumesGroundDirt;\nuniform sampler2D brumesGroundSnow;\n';}
   if(spec.grassCap)fragmentDeclarations+='uniform sampler2D brumesGrassTexture;\n';
   shader.vertexShader=vertexDeclarations+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n'+vertexBody);
   shader.fragmentShader=fragmentDeclarations+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',shaderMapBody(spec));
  };
  const shaderFlags=[spec.projection,spec.terrain,spec.grassCap,spec.endGrain,spec.birch,spec.ribbed,!!spec.ore].join(':');
  material.customProgramCacheKey=()=>originalKey+'|brumes-surfaces-v1:'+shaderFlags;
  material.userData.surface={kind:def.kind,face,asset:def.asset,projection:spec.projection,
   terrain:spec.terrain,detailOnly:spec.detailOnly,rotationMode:def.rotationMode};
  material.needsUpdate=true;
  return material;
 }
 return{texture,apply,setQuality(value){quality.value=value==='fast'?0:1},
  stats(){return{textures:entries.size,materials:records.size,loaded:[...entries.values()].filter(e=>e.state==='loaded').length,pending:[...entries.values()].filter(e=>e.state==='loading').length,failed:[...entries.values()].filter(e=>e.state==='error').length};},
  dispose(){if(disposed)return;disposed=true;for(const entry of entries.values()){if(entry.image){entry.image.onload=entry.image.onerror=null;}entry.texture.dispose();}entries.clear();for(const[material,record]of records)material.removeEventListener('dispose',record.release);records.clear();}
 };
}

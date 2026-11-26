import * as T from './vendor/three.module.min.js';

// Local 3D surfaces, rather than another full-screen pass or a stack of
// camera-facing sprites. All six styles share one shader program.
export const impactVertexShader=`
uniform float elapsed;
uniform float style;
uniform float shell;
varying vec3 localPoint;
varying vec3 worldPoint;
void main(){
 vec3 p=position;
 float a=elapsed;
 float w=sin(p.x*7.0+p.y*4.0+p.z*3.0-a*4.0)
          *cos(p.z*6.0-p.y*5.0+a*2.7);
 float lobes=sin(p.x*13.0+p.z*7.0+a*3.2)*sin(p.y*11.0-p.z*3.0-a*2.2);
 float deformation=(0.085*w+0.045*lobes)*(shell>.5?.45:1.0);
 if(style>1.5&&style<2.5)deformation*=1.8;
 localPoint=p;
 p*=1.0+deformation;
 vec4 world=modelMatrix*vec4(p,1.0);
 worldPoint=world.xyz;
 gl_Position=projectionMatrix*viewMatrix*world;
}
`;
export const impactFragmentShader=`
uniform float elapsed;
uniform float style;
uniform float shell;
uniform float fade;
uniform float detailNoise;
uniform vec3 hotColor;
uniform vec3 coldColor;
uniform vec3 highlightColor;
varying vec3 localPoint;
varying vec3 worldPoint;
float hash3(vec3 p){
 p=fract(p*.1031);
 p+=dot(p,p.yzx+33.33);
 return fract((p.x+p.y)*p.z);
}
float n3(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),
                mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
                mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void main(){
 vec3 n=normalize(cross(dFdx(worldPoint),dFdy(worldPoint)));
 vec3 v=normalize(cameraPosition-worldPoint);
 float facing=clamp(dot(n,v),0.0,1.0);
 float rim=pow(1.0-facing,2.4);
 vec3 p=localPoint*3.5+vec3(0,-elapsed*2.1,elapsed*.8);
 float broad=n3(p);
 float fine=broad;
 if(detailNoise>.5)fine=n3(p*2.45+vec3(broad*2.0,5.0,9.0));
 float turb=.63*broad+.37*fine;
 float light=.38+.62*max(0.0,dot(n,normalize(vec3(.55,.82,.35))));
 vec3 col;
 float alpha;
 if(shell>.5){
  // Distorted, broken pressure front, fading in the middle of its surface.
  float fringe=smoothstep(.24,.8,rim)*smoothstep(.25,.64,turb);
  col=mix(hotColor,highlightColor,fringe);
  alpha=fade*fringe*.66;
 }else if(style<1.5){
  // Rolling incandescent lobes, dark cooled folds and hot turbulent ridges.
  float heat=smoothstep(.26,.82,turb+(1.0-elapsed)*.13);
  float fissure=1.0-smoothstep(.018,.095,abs(turb-.54));
  col=mix(coldColor,hotColor,heat);
  col=mix(col,highlightColor,clamp(heat*heat*.78+fissure*.23,0.0,1.0));
  col*=.55+.65*light;
  alpha=fade*(.7+.3*heat)*smoothstep(0.0,.28,facing);
 }else if(style<2.5){
  float crystal=pow(abs(sin((localPoint.x+localPoint.z)*12.0+fine*5.0)),9.0);
  col=mix(coldColor,hotColor,turb)*light;
  col=mix(col,highlightColor,clamp(rim*.65+crystal*.45,0.0,1.0));
  alpha=fade*(.28+.36*rim+.3*crystal)*smoothstep(0.0,.2,facing);
 }else if(style<4.5){
  float band=pow(.5+.5*sin(atan(localPoint.z,localPoint.x)*7.0+localPoint.y*13.0-elapsed*9.0+turb*5.0),7.0);
  col=mix(coldColor,hotColor,turb);
  col=mix(col,highlightColor,clamp(band*.8+rim*.44,0.0,1.0));
  alpha=fade*(.15+.56*band+.35*rim)*smoothstep(0.0,.16,facing);
 }else{
  col=mix(coldColor,hotColor,turb)*light;
  alpha=fade*(.22+.6*turb)*smoothstep(0.0,.38,facing);
 }
 gl_FragColor=vec4(col,clamp(alpha,0.0,1.0));
 #include <colorspace_fragment>
}
`;
const STYLES={
 blast:{index:0,hot:'#ff7020',cold:'#4f1c10',highlight:'#fff2b8',life:.96,vertical:.86},
 fire:{index:1,hot:'#ff4313',cold:'#72200b',highlight:'#fff1a0',life:1.34,vertical:1.25},
 ice:{index:2,hot:'#73c5f4',cold:'#245981',highlight:'#eaffff',life:1.0,vertical:.60},
 storm:{index:3,hot:'#5f8fff',cold:'#142d82',highlight:'#ecfcff',life:.72,vertical:1.05},
 arcane:{index:4,hot:'#ab4bff',cold:'#2a1555',highlight:'#ffd6ff',life:1.5,vertical:1.12},
 toxic:{index:5,hot:'#a6cc37',cold:'#29451d',highlight:'#e6ff92',life:1.7,vertical:.52},
 holy:{index:4,hot:'#ffd77e',cold:'#bc7924',highlight:'#ffffe8',life:1.15,vertical:1.35},
 void:{index:4,hot:'#663ba1',cold:'#100e23',highlight:'#c9a5ff',life:1.4,vertical:.88},
 dust:{index:5,hot:'#b99771',cold:'#68503e',highlight:'#d7bda0',life:1.7,vertical:.35}
};
const sat=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=sat((x-a)/(b-a));return t*t*(3-2*t)};
export function impactEnvelope(kind,age,radius){
 const s=STYLES[kind]||STYLES.blast,t=sat(age/s.life),expand=1-Math.exp(-age*8.4);
 const growth=radius*(kind==='void'?.12+.9*(1-smooth(0,1.15,age)):.12+.78*expand+.11*t);
 return {width:growth,height:growth*s.vertical,lift:radius*(.08+.44*expand)*s.vertical,
  alpha:smooth(0,.045,age)*(1-smooth(.43,1,t)),waveRadius:radius*(kind==='void'?1.5-1.3*smooth(0,.65,age):.2+1.18*smooth(0,.65,age)),
  waveAlpha:kind==='dust'?0:smooth(0,.045,age)*(1-smooth(.16,.72,age))};
}
export function createImpactBodies(){
 const geos={low:new T.SphereGeometry(1,18,12),balanced:new T.SphereGeometry(1,28,18),high:new T.SphereGeometry(1,40,26)};
 // The vertex shader can expand the sphere beyond its initial bounding box.
 for(const g of Object.values(geos)){g.computeBoundingSphere();g.boundingSphere.radius*=1.25}
 function create(kind,quality){
  const p=STYLES[kind]||STYLES.blast,geometry=geos[quality]||geos.balanced,group=new T.Group();
  group.name='Corps 3D procédural';
  function material(shell){return new T.ShaderMaterial({uniforms:{
   elapsed:{value:0},style:{value:p.index},shell:{value:shell},fade:{value:0},detailNoise:{value:quality==='low'?0:1},
   hotColor:{value:new T.Color(p.hot)},coldColor:{value:new T.Color(p.cold)},highlightColor:{value:new T.Color(p.highlight)}
  },vertexShader:impactVertexShader,fragmentShader:impactFragmentShader,transparent:true,depthTest:true,depthWrite:false,side:T.FrontSide,toneMapped:false,blending:shell?T.AdditiveBlending:T.NormalBlending})}
  const core=new T.Mesh(geometry,material(0)),wave=new T.Mesh(geos.low,material(1));
  core.name='Noyau turbulent 3D';wave.name='Front de pression 3D';group.add(core,wave);group.visible=false;
  return {group,update(age,radius){
   group.visible=true;
   const v=impactEnvelope(kind,age,radius);
   core.visible=v.alpha>.003;wave.visible=v.waveAlpha>.003;
   core.scale.set(v.width,v.height,v.width);core.position.y=v.lift;
   wave.scale.set(v.waveRadius,v.waveRadius*.78,v.waveRadius);wave.position.y=radius*.18;
   for(const [mesh,fade]of [[core,v.alpha],[wave,v.waveAlpha]]){mesh.material.uniforms.elapsed.value=age;mesh.material.uniforms.fade.value=fade}
  },dispose(){core.material.dispose();wave.material.dispose()}};
 }
 return {create,dispose(){for(const g of Object.values(geos))g.dispose()}};
}

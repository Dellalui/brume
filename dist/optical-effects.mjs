import * as T from './vendor/three.module.min.js';
// Copy the already rendered framebuffer, retaining its original color, AA and depth.
// Only local lenses render afterwards; the world and its shadows are drawn once.
export const lensFragment=`
uniform sampler2D sceneColor;
uniform vec2 resolution;
uniform float elapsed;
uniform float opacity;
uniform float strength;
uniform float blackHole;
uniform vec3 tint;
varying vec2 vUv;
vec3 linearize(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){
 vec2 p=(vUv-.5)*2.;float r=length(p);if(r>1.)discard;
 vec2 uv=gl_FragCoord.xy/resolution;
 float angle=atan(p.y,p.x);
 vec2 radial=p/max(r,.001),tangent=vec2(-radial.y,radial.x);
 float fringe=1.-smoothstep(.72,1.,r);
 float wave=sin(r*28.-elapsed*7.)*exp(-r*2.);
 vec2 delta=radial*wave*.008*strength*fringe;
 if(blackHole>.5)delta=(radial*.028/(.2+r)+tangent*.016*(1.-r))*strength*fringe;
 vec2 at=clamp(uv+delta,vec2(.001),vec2(.999));
 vec3 col=texture2D(sceneColor,at).rgb;
 // Weak chromatic separation along the pressure front.
 col.r=texture2D(sceneColor,clamp(at+delta*.15,vec2(.001),vec2(.999))).r;
 col.b=texture2D(sceneColor,clamp(at-delta*.15,vec2(.001),vec2(.999))).b;
 col=linearize(col);
 if(blackHole>.5){
  float horizon=1.-smoothstep(.25,.29,r);
  col=mix(col,vec3(.001,.001,.004),horizon);
  float ring=exp(-pow((r-.34)*38.,2.));
  float disk=exp(-pow((r-.47)*15.,2.))*(.55+.45*sin(angle*8.-elapsed*3.+r*35.));
  col+=tint*(ring*2.2+disk*.55)*strength;
 }
 gl_FragColor=vec4(col,fringe*opacity);
 #include <colorspace_fragment>
}`;
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export function createOpticalEffects(){
 const scene=new T.Scene(),geometry=new T.PlaneGeometry(2,2),size=new T.Vector2(),entries=new Set();let target=null;
 function create(kind,color){const material=new T.ShaderMaterial({uniforms:{sceneColor:{value:null},resolution:{value:size},elapsed:{value:0},opacity:{value:0},strength:{value:1},blackHole:{value:kind==='blackhole'?1:0},tint:{value:new T.Color(color||'#ffb97a')}},vertexShader:vertex,fragmentShader:lensFragment,toneMapped:false,transparent:true,depthTest:true,depthWrite:false,side:T.DoubleSide});
  const mesh=new T.Mesh(geometry,material);mesh.name=kind==='blackhole'?'Lentille gravitationnelle':'Distorsion du décor';mesh.visible=false;scene.add(mesh);entries.add(mesh);
  return {mesh,update(position,radius,age,duration,strength,camera){mesh.position.set(position.x,position.z+radius*(kind==='blackhole'?1.7:.6),position.y);mesh.quaternion.copy(camera.quaternion);mesh.scale.setScalar(radius*1.7);const t=Math.max(0,Math.min(1,age/duration)),fade=Math.min(1,t*12,(1-t)*8);mesh.visible=fade>.001&&strength>0;material.uniforms.elapsed.value=age;material.uniforms.opacity.value=fade;material.uniforms.strength.value=strength;},dispose(){entries.delete(mesh);scene.remove(mesh);material.dispose()}};
 }
 function releaseTarget(){target?.dispose();target=null}
 function render(gpu,world,camera){
  const active=[...entries].some(m=>m.visible),infoAuto=gpu.info?.autoReset;
  if(!active||!gpu.copyFramebufferToTexture||!gpu.getDrawingBufferSize){gpu.render(world,camera);if(target)releaseTarget();return}
  gpu.getDrawingBufferSize(size);
  if(target&&(target.image.width!==size.x||target.image.height!==size.y))releaseTarget();
  if(!target){target=new T.FramebufferTexture(size.x,size.y);target.colorSpace=T.NoColorSpace;target.minFilter=target.magFilter=T.LinearFilter}
  const auto=gpu.autoClear,shadowAuto=gpu.shadowMap?.autoUpdate;
  try{
   if(gpu.info){gpu.info.autoReset=false;gpu.info.reset?.()}
   gpu.render(world,camera);gpu.copyFramebufferToTexture(target);
   for(const mesh of entries)mesh.material.uniforms.sceneColor.value=target;
   gpu.autoClear=false;if(gpu.shadowMap)gpu.shadowMap.autoUpdate=false;gpu.render(scene,camera);
  }finally{gpu.autoClear=auto;if(gpu.info)gpu.info.autoReset=infoAuto;if(gpu.shadowMap)gpu.shadowMap.autoUpdate=shadowAuto}
 }
 return{create,render,scene,dispose(){for(const m of entries)m.material.dispose();entries.clear();scene.clear();releaseTarget();geometry.dispose()}};
}

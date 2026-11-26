import * as T from './vendor/three.module.min.js';
import * as W from './world.mjs';
export const MAX_MOONS=4;
export const DEFAULT_MOONS=[{name:'Sélène',color:'#dae8ff',size:1.25,phase:.86,orbitOffset:0,ring:false,ringWidth:.65,ringTilt:24,ringColor:'#c3ae91'}];
export const ENV_DEFAULTS={enabled:false,hour:14,zenith:'#5286b5',horizon:'#d9e3e0',cloudColor:'#f1f1e9',clouds:.45,cloudHeight:42,wind:.25,quality:'balanced',weather:'clear',intensity:.55,season:'summer',syncLight:true,cloudShadows:true,cloudShadowStrength:.42,stars:true,starDensity:.72,moons:DEFAULT_MOONS};
export function environmentSettings(map){return {...ENV_DEFAULTS,...map.environment,moons:Array.isArray(map.environment?.moons)?map.environment.moons.slice(0,MAX_MOONS):DEFAULT_MOONS};}
export function environmentLight(e){const altitude=Math.sin((e.hour-6)/12*Math.PI),day=Math.max(0,altitude),dawn=Math.max(0,1-Math.abs(altitude)*5),wet=e.weather==='rain'?.65:1;return{day,sun:Math.max(0,(altitude-.07)/.93)*wet,ambient:(.10+day*.45)*(1-e.clouds*.15),color:new T.Color(day<.30?'#ffb47a':'#fff2d8'),angle:(e.hour-6)/12*Math.PI,dawn};}
export function seasonColor(color,season){const c=new T.Color(color);if(season==='winter')c.lerp(new T.Color('#dce6e5'),.72);if(season==='autumn')c.lerp(new T.Color('#a7763d'),.35);if(season==='spring')c.lerp(new T.Color('#67944c'),.2);return c}
export function createEnvironment(scene){
 const moonDirs=Array.from({length:MAX_MOONS},()=>new T.Vector3(0,-1,0)),moonColors=Array.from({length:MAX_MOONS},()=>new T.Color('#ffffff')),moonRingColors=Array.from({length:MAX_MOONS},()=>new T.Color('#ffffff')),moonParams=Array.from({length:MAX_MOONS},()=>new T.Vector4());
 const uniforms={zenith:{value:new T.Color()},horizon:{value:new T.Color()},cloudColor:{value:new T.Color()},time:{value:0},coverage:{value:.4},cloudHeight:{value:42},steps:{value:12},day:{value:1},night:{value:0},sunDirection:{value:new T.Vector3()},wind:{value:.25},starDensity:{value:.7},starEnabled:{value:1},moonCount:{value:1},moonDirections:{value:moonDirs},moonColors:{value:moonColors},moonParams:{value:moonParams},moonRingColors:{value:moonRingColors}};
 const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms,vertexShader:`varying vec3 vDirection;void main(){vDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,fragmentShader:`precision highp float;
varying vec3 vDirection;
uniform vec3 zenith,horizon,cloudColor,sunDirection;
uniform vec3 moonDirections[4],moonColors[4],moonRingColors[4];
uniform vec4 moonParams[4];
uniform float time,coverage,cloudHeight,day,night,wind,starDensity,starEnabled;
uniform int steps,moonCount;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
float density(vec3 p){float edge=smoothstep(cloudHeight,cloudHeight+3.,p.y)*(1.-smoothstep(cloudHeight+8.,cloudHeight+14.,p.y));vec3 q=p*.065+vec3(time*wind*.015,0.,time*wind*.007);float n=noise(q)*.65+noise(q*2.03)*.25+noise(q*4.1)*.1;return smoothstep(.56-coverage*.42,.65-coverage*.40,n)*edge;}
void main(){
 vec3 d=normalize(vDirection);float up=clamp(d.y,0.,1.);
 float h=pow(up,.48);
 vec3 base=mix(horizon,zenith,h);
 vec3 nightSky=mix(vec3(.025,.045,.085),vec3(.003,.009,.029),pow(up,.65));
 vec3 col=mix(nightSky,base,day)*mix(.65,1.,day);
 float sunAltitude=sunDirection.y;
 float sunGate=smoothstep(.15,.30,sunAltitude);
 float sunDot=dot(d,sunDirection);
 float sunDisk=(1.-smoothstep(.001,.006,1.-sunDot))*sunGate;
 float sunHalo=pow(max(sunDot,0.),110.)*.20*sunGate;
 col+=vec3(1.,.82,.52)*(sunDisk*1.1+sunHalo);
 float starsGate=night*starEnabled*smoothstep(-.03,.19,d.y);
 if(starsGate>.001){
   vec3 cells=floor(d*365.);
   float seed=hash(cells);
   float bright=smoothstep(1.-starDensity*.022,1.,seed);
   vec3 point=fract(d*365.)-.5;
   float star=(1.-smoothstep(.015,.16,length(point)))*bright;
   float twinkle=.87+.13*sin(time*(.7+seed*1.5)+seed*76.);
   col+=vec3(.78,.86,1.)*star*twinkle*starsGate*1.5;
 }
 for(int i=0;i<4;i++){
  if(i>=moonCount)break;
  vec3 m=normalize(moonDirections[i]);
  float celestialGate=smoothstep(-.08,.09,m.y);
  if(celestialGate<.001)continue;
  float angularRadius=moonParams[i].x;
  float cosA=dot(d,m);
  float discAngle=acos(clamp(cosA,-1.,1.));
  float inDisc=1.-smoothstep(angularRadius*.91,angularRadius,discAngle);
  vec3 east=normalize(cross(vec3(0.,1.,.0001),m));
  vec3 north=normalize(cross(m,east));
  vec2 uv=vec2(dot(d,east),dot(d,north))/max(.0001,sin(angularRadius));
  float phase=moonParams[i].y;
  float terminator=uv.x+cos(phase*6.28318)*sqrt(max(.0,1.-uv.y*uv.y));
  float lit=smoothstep(-.06,.08,terminator)*(phase<.5?1.:1.);
  float crater=noise(uv.xyx*10.+vec3(float(i)*19.))*0.10;
  float rim=(1.-smoothstep(.5,1.,length(uv)))*.06;
  col=mix(col,moonColors[i]*(.10+.9*lit-crater+rim),inDisc*celestialGate);
  if(moonParams[i].z>.001){
   float roll=moonParams[i].w;
   vec2 spun=vec2(uv.x*cos(roll)-uv.y*sin(roll),uv.x*sin(roll)+uv.y*cos(roll));
   float ringDistance=length(vec2(spun.x,spun.y*2.6));
   float outer=1.3+moonParams[i].z;
   float ring=(smoothstep(1.08,1.18,ringDistance)-smoothstep(outer-.08,outer,ringDistance));
   ring*=.72+.28*sin(ringDistance*23.);
   float front=step(0.,spun.y);
   col=mix(col,moonRingColors[i],ring*celestialGate*(.37+.37*front)*(1.-inDisc*.65));
  }
 }
 float cloudOpacity=0.;
 if(d.y>.025&&coverage>.01){
  float a=max(0.,(cloudHeight-cameraPosition.y)/d.y),b=max(0.,(cloudHeight+14.-cameraPosition.y)/d.y);
  b=min(b,300.);
  float stepSize=max(0.,b-a)/float(steps);
  vec3 cloud=vec3(0.);
  for(int i=0;i<24;i++){
   if(i>=steps||cloudOpacity>.97)break;
   vec3 p=cameraPosition+d*(a+(float(i)+.5)*stepSize);
   float den=density(p);
   float alpha=1.-exp(-den*stepSize*.16);
   float lit=.58+.42*smoothstep(cloudHeight,cloudHeight+12.,p.y);
   cloud+=(1.-cloudOpacity)*alpha*cloudColor*lit*(.14+day*.86);
   cloudOpacity+=(1.-cloudOpacity)*alpha;
  }
  col=mix(col,col*(1.-cloudOpacity)+cloud,smoothstep(.025,.12,d.y));
 }
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`});
 const sky=new T.Mesh(new T.SphereGeometry(120,32,20),material);sky.frustumCulled=false;sky.renderOrder=-1000;sky.name='Ciel astral et nuages volumétriques';scene.add(sky);
 const count=900,geo=new T.BufferGeometry(),positions=new Float32Array(count*3),seeds=new Float32Array(count),floors=new Float32Array(count);let seed=991;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};for(let i=0;i<count;i++){positions[i*3]=(random()-.5)*36;positions[i*3+1]=random()*18;positions[i*3+2]=(random()-.5)*36;seeds[i]=random()}
 geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('seed',new T.BufferAttribute(seeds,1));geo.setAttribute('floorHeight',new T.BufferAttribute(floors,1));
 const weatherUniforms={time:{value:0},snow:{value:0},strength:{value:.5},origin:{value:new T.Vector3()},wind:{value:.25}};
 const rainMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:weatherUniforms,vertexShader:`attribute float seed,floorHeight;uniform float time,snow,strength,wind;uniform vec3 origin;varying float vVisible;void main(){vec3 p=position+origin;p.y=origin.y+18.-mod(position.y+time*mix(13.,1.2,snow),18.);p.x+=sin(time*.7+seed*20.)*snow*.5+wind*.4;vVisible=step(floorHeight+.08,p.y)*step(seed,strength);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(mix(110.,75.,snow)/max(1.,-mv.z),mix(2.,3.,snow),mix(10.,7.,snow));}`,fragmentShader:`uniform float snow;varying float vVisible;void main(){vec2 p=gl_PointCoord-.5;float a=snow>.5?1.-smoothstep(.18,.48,length(p)):(1.-smoothstep(.03,.13,abs(p.x)))*(1.-smoothstep(.2,.5,abs(p.y)));gl_FragColor=vec4(mix(vec3(.62,.78,.9),vec3(.95,.98,1.),snow),a*vVisible*.6);}`});
 const weather=new T.Points(geo,rainMat);weather.frustumCulled=false;weather.name='Météo locale GPU';scene.add(weather);let weatherKey='';
 return{sky,weather,uniforms,update(map,camera,time){
 const e=environmentSettings(map),l=environmentLight(e);
 sky.visible=e.enabled;sky.position.copy(camera.position);
 uniforms.zenith.value.set(e.zenith);uniforms.horizon.value.set(e.horizon);uniforms.cloudColor.value.set(e.cloudColor);
 uniforms.time.value=time;uniforms.coverage.value=e.quality==='off'?0:e.clouds;
 uniforms.steps.value=e.quality==='high'?24:e.quality==='low'?8:12;
 uniforms.cloudHeight.value=e.cloudHeight;uniforms.wind.value=e.wind;uniforms.day.value=l.day;
 uniforms.night.value=1-T.MathUtils.smoothstep(l.day,.02,.23);
 uniforms.starEnabled.value=e.stars===false?0:1;uniforms.starDensity.value=T.MathUtils.clamp(Number(e.starDensity)||0,.0,1.);
 const solarAngle=(e.hour-6)/12*Math.PI;
 uniforms.sunDirection.value.set(Math.cos(solarAngle),Math.sin(solarAngle),-.25).normalize();
 const moons=e.moons.slice(0,MAX_MOONS);uniforms.moonCount.value=moons.length;
 for(let i=0;i<MAX_MOONS;i++){
  const moon=moons[i];if(!moon){moonDirs[i].set(0,-1,0);moonParams[i].set(0,0,0,0);continue}
  const orbit=solarAngle+Math.PI+Number(moon.orbitOffset||0)*Math.PI/180;
  moonDirs[i].set(Math.cos(orbit),Math.sin(orbit),-.20-i*.055).normalize();
  moonColors[i].set(moon.color||'#dae8ff');moonRingColors[i].set(moon.ringColor||'#c3ae91');
  const size=T.MathUtils.clamp(Number(moon.size)||1,0.3,6),phase=T.MathUtils.clamp(Number(moon.phase??.86),0,1);
  moonParams[i].set(size*Math.PI/180,phase,moon.ring?T.MathUtils.clamp(Number(moon.ringWidth)||.65,.1,2):0,(Number(moon.ringTilt)||0)*Math.PI/180);
 }
 weather.visible=e.enabled&&e.weather!=='clear'&&e.intensity>0;
 if(weather.visible){geo.setDrawRange(0,map.renderSettings?.effects==='low'?300:map.renderSettings?.effects==='high'?900:600);let x=Math.floor(camera.position.x/8)*8,z=Math.floor(camera.position.z/8)*8,y=Math.floor(camera.position.y/4)*4-4;weatherUniforms.origin.value.set(x,y,z);weatherUniforms.time.value=time;weatherUniforms.snow.value=e.weather==='snow'?1:0;weatherUniforms.strength.value=e.intensity;weatherUniforms.wind.value=e.wind;let key=[map.id,x,y,z,map.blockRevision,map.buildRevision].join('|');if(key!==weatherKey){weatherKey=key;for(let i=0;i<count;i++){let px=x+positions[i*3],py=z+positions[i*3+2];floors[i]=W.activeCell(map,px,py)?W.terrainHeight(map,px,py):-100;}geo.attributes.floorHeight.needsUpdate=true;}}
 return e.enabled&&(e.clouds>0&&e.wind>0&&e.quality!=='off'||weather.visible||e.stars!==false&&uniforms.night.value>.02);
 },dispose(){scene.remove(sky,weather);sky.geometry.dispose();material.dispose();geo.dispose();rainMat.dispose()}};
}

import {createLightning} from './lightning.mjs';
import * as T from './vendor/three.module.min.js';
import {BatchedRenderer,ParticleSystem,ConeEmitter,ConstantValue,IntervalValue,ConstantColor,ColorOverLife,Gradient,SizeOverLife,PiecewiseBezier,Bezier} from './vendor/three.quarks.mjs';
export const ENERGY_PRESETS={energy:{color:'#ffe071',label:'Énergie dorée'},azure:{color:'#65dfff',label:'Énergie azur'},crimson:{color:'#ff526c',label:'Énergie écarlate'}};
// One small emitter per visible aura; all its motes share a single instanced batch.
export function createEnergy(a,body,texture){
 const group=new T.Group();group.name='Aura énergie';
 const radius=Math.max(.2,a.radius||1.2),height=Math.max(.6,(body?.height||1.8)*(body?.scale||1)*(a.height||1.55));
 const tint=new T.Color(a.color||ENERGY_PRESETS[a.kind]?.color||'#ffe071'),intensity=a.intensity??.7,speed=a.speed||1;
 const uniforms={time:{value:0},tint:{value:tint},alpha:{value:intensity},height:{value:height},radius:{value:radius}};
 const shell=new T.Mesh(new T.CylinderGeometry(1,1,1,64,24,true),new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
 vertexShader:`uniform float time;uniform float height;uniform float radius;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
 void main(){vUv=uv;float h=uv.y;float angle=uv.x*6.2831853;float spike=sin(angle*9.+time*3.)*.055+sin(angle*17.-time*2.)*.025;
 float taper=pow(max(.0,1.-h),.48);float width=(.63+.42*sin(h*3.14159))*taper;
 vec3 p=position;p.xz*=radius*width*(1.+sin(h*14.-time*6.+angle*5.)*.055);p.y=h*height*(1.+spike*h);
 vec4 mv=modelViewMatrix*vec4(p,1.);vView=normalize(-mv.xyz);vNormal=normalize(normalMatrix*vec3(normal.x,.22,normal.z));gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`uniform float time;uniform vec3 tint;uniform float alpha;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
 void main(){float h=vUv.y;float edge=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.2);
 float flow=sin(vUv.x*100.+sin(h*10.-time*5.)*2.-h*19.+time*3.);float filaments=pow(max(flow,0.),9.);
 float fade=smoothstep(0.,.09,h)*(1.-smoothstep(.68,1.,h));float opacity=(.035+edge*.45+filaments*.17)*fade*alpha;
 gl_FragColor=vec4(mix(tint,vec3(1.),filaments*.32),opacity);}`
 }));shell.name='Enveloppe verticale';shell.frustumCulled=false;group.add(shell);
 const batch=new BatchedRenderer();batch.name='Quarks énergie';
 // Quarks writes world positions into its instance buffer. Do not apply the owner transform twice.
 batch.matrixAutoUpdate=false;batch.matrixWorldAutoUpdate=false;group.add(batch);
 const particleMaterial=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 const system=new ParticleSystem({duration:1,looping:true,prewarm:false,worldSpace:false,
 shape:new ConeEmitter({radius:radius*.7,angle:.06,thickness:.2}),startLife:new IntervalValue(.4,.95),startSpeed:new IntervalValue(height*.8,height*1.5),startSize:new IntervalValue(.025,.065),
 startColor:new ConstantColor(new T.Vector4(tint.r,tint.g,tint.b,intensity)),emissionOverTime:new ConstantValue(32),material:particleMaterial,
 behaviors:[new ColorOverLife(new Gradient([[new T.Vector3(1,1,1),0],[new T.Vector3(1,1,1),1]],[[0,0],[1,.12],[.7,.65],[0,1]])),new SizeOverLife(new PiecewiseBezier([[new Bezier(.3,1,.6,0),0]]))]});
 system.emitter.rotation.x=-Math.PI/2;group.add(system.emitter);batch.addSystem(system);
 const bolts=createLightning({color:a.color,size:radius,height,wrapped:true});group.add(bolts.group);
 let previous=null,boltFrame=-1,disposed=false;return {group,system,batch,height,update(time,camera,opacity=1){if(disposed)return;const dt=previous===null?1/30:Math.min(.05,Math.max(0,time-previous));previous=time;uniforms.time.value=time*speed;uniforms.alpha.value=opacity*intensity;
 group.updateWorldMatrix(true,true);
 // A detached preview should not be simulated: Quarks deliberately disposes orphan emitters.
 let root=group;while(root.parent)root=root.parent;if(root.isScene){batch.update(dt*speed);for(let i=0;i<system.particleNum;i++)system.particles[i].color.w*=opacity;for(let b of batch.batches)b.update();}
 bolts.group.visible=a.lightning!==false;if(a.lightning!==false)bolts.update(time*speed,opacity*intensity);
 },dispose(){if(disposed)return;disposed=true;group.remove(bolts.group);bolts.dispose();system.dispose();particleMaterial.dispose();group.traverse(o=>{o.geometry?.dispose();if(o.material){for(let m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});group.clear();}};
}


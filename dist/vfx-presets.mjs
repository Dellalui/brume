import * as T from './vendor/three.module.min.js';
import {BatchedRenderer,ParticleSystem,ConstantValue,IntervalValue,ConstantColor,ColorOverLife,Gradient,SizeOverLife,PiecewiseBezier,Bezier} from './vendor/three.quarks.mjs';
import {createLightning} from './lightning.mjs';
// All ambient and spell effects use Quarks for emission, lifetime, evolution and batching.
export function createParticleEffect(e,texture){
 const group=new T.Group(),batch=new BatchedRenderer(),systems=[],materials=[],kind=e.kind,size=Math.max(.2,e.size||1),density=Math.min(3,Math.max(.2,e.density||1))*(e.quality==='low'?.45:e.quality==='high'?1:.7),speed=Math.min(3,Math.max(.1,e.speed||1)),tint=new T.Color(e.color||'#c5daef');
 group.name='Quarks · '+kind;batch.matrixAutoUpdate=false;batch.matrixWorldAutoUpdate=false;group.add(batch);let attenuation=1,clock=0;
 const vector=c=>new T.Vector3(c.r,c.g,c.b),white=new T.Vector3(1,1,1),colored=vector(tint);
 function emitter(style){return{type:'BrumesEmitter',update(){},initialize(p){let angle=Math.random()*Math.PI*2,r=Math.sqrt(Math.random()),r2=.1+Math.random()*.9;p.position.set(Math.cos(angle)*r*size,0,Math.sin(angle)*r*size);p.velocity.set(0,p.startSpeed,0);p.vfxPhase=angle;p.vfxRadius=r;p.vfxSeed=Math.random();
 if(style==='cloud'){p.position.y=Math.random()*.22*size;p.velocity.set((Math.random()-.5)*.15*size,p.startSpeed,(Math.random()-.5)*.15*size)}
 if(style==='fall'){if(kind==='waterfall'){p.position.x*=.35;p.position.z*=.08}p.position.y=3.5*size;p.velocity.y=-p.startSpeed;p.velocity.x=kind==='snow'?.12*size:.15*size}
 if(style==='spray'){p.position.multiplyScalar(.12);p.velocity.set(Math.cos(angle)*r2*p.startSpeed,p.startSpeed*(.5+Math.random()),Math.sin(angle)*r2*p.startSpeed)}
 if(style==='rise'){p.position.multiplyScalar(.22);p.velocity.x=(Math.random()-.5)*.15*size;p.velocity.z=(Math.random()-.5)*.15*size}
 if(style==='orbit'){p.position.y=Math.random()*size*1.8;p.velocity.set(0,0,0)}
 if(style==='pillar'){p.position.multiplyScalar(.28);p.velocity.y=p.startSpeed}
 },toJSON(){return{type:this.type}},clone(){return emitter(style)}}}
 function layer({style='rise',tex='soft',rate=20,life=[1,2],velocity=[.3,1],width=[.1,.3],alpha=.8,additive=true,grow=[.2,1,.7,0],colors=[[colored,0],[colored,1]],stretch=1,swirl=false}){
 const material=new T.MeshBasicMaterial({map:texture(tex),transparent:true,depthWrite:false,toneMapped:!additive,blending:additive?T.AdditiveBlending:T.NormalBlending});materials.push(material);
 const motion={type:'BrumesMotion',initialize(){},frameUpdate(){},reset(){},update(p,dt){p.color.w*=attenuation;p.size.y*=stretch;
 if(swirl){let a=p.vfxPhase+p.age*(kind==='vortex'?3.4:1.4),r=size*(kind==='vortex'?.25+p.age/p.life*.75:.35+p.vfxRadius*.6);p.position.x=Math.cos(a)*r;p.position.z=Math.sin(a)*r;p.position.y=kind==='fireflies'?(.25+p.vfxSeed*1.3)*size+Math.sin(p.age*2+p.vfxPhase)*.15:p.age/p.life*size*2.4;}
 if(kind==='snow')p.velocity.x=Math.sin(p.age*2+p.vfxPhase)*.16*size;
 if(style==='spray')p.velocity.y-=dt*size*1.8;
 if(kind==='smoke')p.velocity.x=Math.sin(p.age+p.vfxPhase)*.12*size;
 },toJSON(){return{type:this.type}},clone(){return this}};
 const system=new ParticleSystem({duration:2,looping:true,worldSpace:false,shape:emitter(style),startLife:new IntervalValue(...life),startSpeed:new IntervalValue(velocity[0]*size,velocity[1]*size),startSize:new IntervalValue(width[0]*size,width[1]*size),startRotation:new ConstantValue(0),startColor:new ConstantColor(new T.Vector4(1,1,1,1)),emissionOverTime:new ConstantValue(rate*density),material,behaviors:[new SizeOverLife(new PiecewiseBezier([[new Bezier(...grow),0]])),new ColorOverLife(new Gradient(colors,[[0,0],[alpha,.13],[alpha*.8,.65],[0,1]])),motion]});systems.push(system);group.add(system.emitter);batch.addSystem(system);
 }
 switch(kind){
 case 'fire':layer({tex:'flame',rate:28,life:[.45,.85],width:[.18,.38],velocity:[.8,1.5],stretch:1.5,colors:[[white,0],[colored,.25],[new T.Vector3(.65,.035,.002),1]]});layer({style:'rise',tex:'spark',rate:6,life:[.7,1.2],width:[.025,.055],velocity:[1,1.8]});layer({tex:'cloud',rate:6,life:[1.6,2.4],width:[.4,.8],velocity:[.45,.7],additive:false,alpha:.12,grow:[.25,.8,1.4,1.8],colors:[[new T.Vector3(.22,.23,.22),0],[new T.Vector3(.3,.32,.3),1]]});break;
 case 'smoke':layer({tex:'cloud',rate:12,life:[2.4,3.8],width:[.5,.85],velocity:[.4,.65],additive:false,alpha:.19,grow:[.2,.7,1.3,1.9]});break;
 case 'mist':case 'poison':layer({style:'cloud',tex:'cloud',rate:10,life:[3,5],width:[.7,1.4],velocity:[.015,.05],additive:false,alpha:kind==='poison'?.16:.10,stretch:.65,grow:[.4,1,1.6,2]});if(kind==='poison')layer({style:'cloud',tex:'soft',rate:5,life:[1,2],width:[.025,.07],velocity:[.1,.3],alpha:.35});break;
 case 'dust':layer({style:'cloud',tex:'cloud',rate:6,life:[2,4],width:[.4,.8],velocity:[.03,.12],additive:false,alpha:.09,grow:[.3,1,1.3,1.5]});layer({style:'cloud',tex:'spark',rate:14,life:[2,4],width:[.012,.025],velocity:[.03,.1],alpha:.35});break;
 case 'rain':layer({style:'fall',tex:'streak',additive:false,rate:48,life:[.5,.7],width:[.035,.055],velocity:[5,6],stretch:9,alpha:.45,grow:[1,1,1,1]});break;
 case 'snow':layer({style:'fall',tex:'soft',additive:false,rate:14,life:[3.5,4.6],width:[.045,.085],velocity:[.7,.85],alpha:.75,grow:[.8,1,1,.5]});break;
 case 'waterfall':layer({style:'fall',tex:'streak',rate:48,life:[.65,.85],width:[.11,.18],velocity:[4.1,5],stretch:7,alpha:.28});layer({style:'cloud',tex:'cloud',rate:12,life:[.8,1.3],width:[.22,.5],velocity:[.04,.15],additive:false,alpha:.2});break;
 case 'embers':case 'sparks':layer({style:kind==='sparks'?'spray':'rise',tex:'spark',rate:kind==='sparks'?34:18,life:kind==='sparks'?[.3,.8]:[.8,1.6],width:[.025,.06],velocity:kind==='sparks'?[1.3,2.6]:[.5,1.1],stretch:kind==='sparks'?2:1,colors:[[white,0],[colored,.25],[new T.Vector3(.7,.07,.005),1]]});break;
 case 'fireflies':layer({style:'orbit',tex:'soft',rate:5,life:[2.5,4],width:[.06,.09],velocity:[0,0],swirl:true,alpha:.9});break;
 case 'magic':case 'heal':layer({style:'cloud',tex:kind==='heal'?'cross':'spark',rate:16,life:[1,2],width:[.06,.13],velocity:[.5,.9],alpha:.8});layer({style:'cloud',tex:'soft',rate:5,life:[1.2,2],width:[.4,.6],velocity:[.3,.5],alpha:.09});break;
 case 'vortex':layer({style:'orbit',tex:'streak',rate:48,life:[1.3,2],width:[.035,.07],velocity:[0,0],swirl:true,stretch:4,alpha:.7});layer({style:'orbit',tex:'cloud',rate:7,life:[1,2],width:[.3,.5],velocity:[0,0],swirl:true,alpha:.08});break;
 case 'beam':layer({style:'pillar',tex:'streak',rate:18,life:[.8,1.3],width:[.12,.25],velocity:[1.5,2.5],stretch:16,alpha:.18});layer({style:'pillar',tex:'spark',rate:12,life:[1,2],width:[.03,.06],velocity:[.7,1.3],alpha:.85});break;
 case 'lightning':layer({style:'spray',tex:'spark',rate:12,life:[.25,.6],width:[.025,.06],velocity:[.8,1.5],alpha:.75});break;
 }
 const lightning=kind==='lightning'?createLightning({color:e.color,size,height:size*3.5}):null;if(lightning)group.add(lightning.group);
 let previous=null,disposed=false;return{group,systems,batch,update(time,camera,opacity=1){if(disposed)return;let dt=previous===null?1/30:Math.min(.05,Math.max(0,time-previous));previous=time;clock+=dt*speed;attenuation=opacity;group.updateWorldMatrix(true,true);let root=group;while(root.parent)root=root.parent;if(root.isScene)batch.update(dt*speed);lightning?.update(clock,opacity);},dispose(){if(disposed)return;disposed=true;lightning?.dispose();for(const s of systems)s.dispose();for(const m of materials)m.dispose();batch.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});group.clear();}};
}

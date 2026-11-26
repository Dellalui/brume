import * as T from './vendor/three.module.min.js';
// Quarks one-shot bursts, plus a small projectile and an expanding visual ring.
// No lights, shadows, collision bodies, or changes to saved map data.
export function createThrowVisuals(factory){
 const group=new T.Group(),entries=new Map(),orbGeometry=new T.SphereGeometry(1,10,8),ringGeometry=new T.RingGeometry(.91,1,40);
 group.name='Projectiles de construction';
 function remove(id,entry){group.remove(entry.root);entry.fx?.dispose();entry.orb.material.dispose();entry.ring.material.dispose();entries.delete(id)}
 function update(list,time,camera,quality){
  const active=new Set();
  for(const p of list){
   active.add(p.id);let e=entries.get(p.id);
   if(!e){
    const root=new T.Group(),color=p.config.color,orb=new T.Mesh(orbGeometry,new T.MeshBasicMaterial({color,transparent:true,opacity:.95,depthWrite:false,toneMapped:false})),ring=new T.Mesh(ringGeometry,new T.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,toneMapped:false,blending:T.AdditiveBlending}));
    const tail=new T.Mesh(orbGeometry,orb.material);tail.scale.setScalar(.07);
    orb.scale.setScalar(.11);ring.rotation.x=-Math.PI/2;ring.visible=false;root.add(orb,tail,ring);group.add(root);e={root,orb,tail,ring,fx:null};entries.set(p.id,e);
   }
   const at=p.position;e.root.position.set(at.x,at.z,at.y);
   e.tail.position.set(p.tail.x-at.x,p.tail.z-at.z,p.tail.y-at.y);
   if(p.phase==='flight'){e.orb.visible=e.tail.visible=true;continue}
   e.orb.visible=e.tail.visible=false;
   if(!e.fx){e.fx=factory.burst({kind:'blast_'+p.config.id,color:p.config.color,size:p.config.radius,speed:1,density:1,quality});e.root.add(e.fx.group)}
   e.ring.visible=p.config.id!=='dust'&&p.age<.48;e.ring.scale.setScalar(Math.max(.08,Math.min(1,p.age/.45))*p.config.radius);e.ring.material.opacity=Math.max(0,.65*(1-p.age/.48));
   e.fx.update(time,camera,Math.min(1,Math.max(0,(1.8-p.age)/.25)));
  }
  for(const [id,e]of entries)if(!active.has(id))remove(id,e);
  return entries.size>0;
 }
 return{group,update,dispose(){for(const [id,e]of entries)remove(id,e);orbGeometry.dispose();ringGeometry.dispose()}};
}

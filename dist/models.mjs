import * as T from './vendor/three.module.min.js';
import {isSegment,PROPS,ROOFS} from './world.mjs';
const geometries={box:new T.BoxGeometry(1,1,1),sphere:new T.IcosahedronGeometry(1,1),cone:new T.ConeGeometry(1,1,8),cylinder:new T.CylinderGeometry(1,1,1,12),ring:new T.TorusGeometry(1,.15,6,16)};
// Semantic hints only: the renderer owns shared texture allocation and projection.
function modelSurface(o){
 const t=o.type;
 if(t==='build_door')return ['iron','bars'].includes(o.variant)?'metal':'wood';
 if(['door','table','bench','chair','bed','cart','shelf','barrel','fence','bridge','chest','crate','platform','balcony'].includes(t))return 'wood';
 if(['wall','stairs','statue','grave','rock','portal'].includes(t))return 'stone';
 if(t==='house')return 'sandstone';
 if(t==='well')return 'cobble';
 if(['tree','bush'].includes(t))return 'leaves';
 if(t==='grass')return 'grass';
 if(t==='crystal')return 'ice';
 if(t==='light')return 'metal';
 if(ROOFS.includes(t))return ['roof_flat','roof_dome'].includes(t)?'stone':'wood';
 return null;
}
export function makeModel(o,color){let root=new T.Group(),mats=new Map(),surface=modelSurface(o);const mat=(c,kind=surface)=>{const key=c+'|'+(kind||'plain');if(!mats.has(key)){const material=new T.MeshStandardMaterial({color:c,roughness:.92,flatShading:true});if(kind){material.userData.surfaceKind=kind;material.userData.surfaceDetailOnly=true;}mats.set(key,material)}return mats.get(key)};const part=(kind,x,y,z,sx,sy,sz,c=color,textureKind=surface)=>{let mesh=new T.Mesh(geometries[kind],mat(c,textureKind));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=o.shadow!==false;mesh.receiveShadow=true;root.add(mesh);return mesh};const box=(x,y,z,w,h,d,c=color,kind=surface)=>part('box',x,y,z,w,h,d,c,kind);const ball=(x,y,z,w,h,d,c=color,kind=surface)=>part('sphere',x,y,z,w,h,d,c,kind);const cyl=(x,y,z,r,h,c=color,kind=surface)=>part('cylinder',x,y,z,r,h,r,c,kind);let w=o.w||1,d=o.d||1,h=o.height||1,t=o.type;
 if(t==='build_door'){
  const wood=o.variant==='iron'?'#66757b':o.variant==='bars'?'#56666e':'#977047',metal='#b6b4a0',thickness=Math.max(.06,d);
  for(let x of [-w/2+.035,w/2-.035])box(x,h/2,0,.07,h,thickness*1.5,wood);box(0,h-.035,0,w,.07,thickness*1.5,wood);
  const hinge=new T.Group();hinge.position.x=-w/2+.06;root.add(hinge);
  const leaf=(x,y,z,sx,sy,sz,color=wood,kind=surface)=>{let m=box(x+w/2-.06,y,z,sx,sy,sz,color,kind);root.remove(m);hinge.add(m);return m};
  if(o.variant==='bars'){for(let i=0;i<6;i++)leaf((i/5-.5)*(w-.16),h/2,0,.035,h-.12,thickness*.55);for(let y of [.12,h-.12])leaf(0,y,0,w-.14,.06,thickness)}
  else if(o.variant==='glass'){let pane=leaf(0,h*.58,0,w-.2,h*.7,thickness*.5,'#92d0cf',null);pane.material=pane.material.clone();pane.material.transparent=true;pane.material.opacity=.32;for(let x of [-w/2+.1,w/2-.1])leaf(x,h/2,0,.055,h-.14,thickness);leaf(0,.17,0,w-.15,.26,thickness);leaf(0,h-.12,0,w-.15,.06,thickness)}
  else{for(let i=0;i<5;i++)leaf((i-2)*(w-.14)/5,h/2,0,(w-.14)/5-.008,h-.14,thickness);for(let y of [h*.22,h*.78])leaf(0,y,-thickness*.55,w-.16,.08,.025,o.variant==='iron'?metal:'#5e4833')}
  leaf(w*.28,h*.48,-thickness*.65,.06,.09,.04,metal,'metal');hinge.rotation.y=o.open?-Math.PI/2:0;return root;
 }
 if(t.startsWith('fx_'))return root;
 if(t==='stairs'){let steps=Math.max(4,Math.round(h/.22));for(let i=0;i<steps;i++){let hh=h*(i+1)/steps;box(0,hh/2,d/2-(i+.5)*d/steps,w,hh,d/steps+.01)}return root}
 if(['platform','balcony'].includes(t)){box(0,-.08,0,w,.16,d);if(t==='balcony'){for(let x of [-w/2,w/2]){for(let z=-d/2;z<=d/2;z+=.5)box(x,.45,z,.08,.9,.08);box(x,.9,0,.1,.09,d)}for(let x=-w/2;x<=w/2;x+=.5)box(x,.45,-d/2,.08,.9,.08);box(0,.9,-d/2,w,.09,.1)}return root}
 if(ROOFS.includes(t)){if(t==='roof_flat'){box(0,.1,0,w,.2,d);for(let x of [-w/2,w/2])box(x,.25,0,.1,.3,d);return root}if(t==='roof_cone'){part('cone',0,h/2,0,w/2,h,d/2);return root}if(t==='roof_dome'){let geo=new T.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),mesh=new T.Mesh(geo,mat(color));mesh.scale.set(w/2,h,d/2);mesh.userData.ownedGeometry=true;mesh.castShadow=true;root.add(mesh);return root}if(t==='roof_hip'){let mesh=new T.Mesh(new T.ConeGeometry(1,h,4),mat(color));mesh.rotation.y=Math.PI/4;mesh.scale.set(w/Math.SQRT2,1,d/Math.SQRT2);mesh.position.y=h/2;mesh.userData.ownedGeometry=true;mesh.castShadow=true;root.add(mesh);return root}let shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);if(t==='roof_shed'){shape.lineTo(w/2,h)}else shape.lineTo(0,h);shape.closePath();let geo=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});geo.translate(0,0,-d/2);let mesh=new T.Mesh(geo,mat(color));mesh.userData.ownedGeometry=true;mesh.castShadow=true;root.add(mesh);return root}
 if(isSegment(o)){let len=Math.hypot(o.x2-o.x,o.y2-o.y);if(t==='wall')box(0,h/2,0,len,h,.16);else{let hinge=new T.Group();hinge.position.x=-len/2;root.add(hinge);let leaf=box(0,h/2,0,len,.96*h,.12,'#9c774b');root.remove(leaf);leaf.position.x=len/2;hinge.add(leaf);let handle=ball(len*.8,h*.5,-.09,.05,.05,.05,'#dfc78b','metal');root.remove(handle);hinge.add(handle);hinge.rotation.y=o.open?-Math.PI/2:0;box(-len/2, h/2,0,.12,h+.12,.23,'#7f8877','stone');box(len/2,h/2,0,.12,h+.12,.23,'#7f8877','stone')}return root}
 if(t==='tree'){let r=(o.canopy||1.35)*(o.scale||1);cyl(0,h*.4,0,.13,h*.8,o.variant==='birch'?'#c7c7ac':'#786345','bark');if(o.variant==='pine'){for(let i=0;i<3;i++)part('cone',0,h*(.6+i*.15),0,r*(1-i*.2),h*.55,r*(1-i*.2),color)}else{ball(0,h*.75,0,r,h*.3,r,color);ball(-r*.35,h*.87,0,r*.65,h*.22,r*.7,'#6d8b5c');if(o.variant==='willow')for(let i=0;i<8;i++){let a=i/8*Math.PI*2;ball(Math.cos(a)*r*.7,h*.62,Math.sin(a)*r*.7,r*.25,h*.35,r*.25,color)}}return root}
 if(['table','bench','chair','bed','cart'].includes(t)){for(let x of [-w*.4,w*.4])for(let z of [-d*.4,d*.4])box(x,h*.4,z,.11,h*.8,.11,'#6e573c');box(0,h*.8,0,w,h*.14,d);if(t==='chair'){for(let z of [-d*.42,d*.42])box(-w*.4,h*.95,z,.1,h*1.4,.1);for(let y of [h*1.1,h*1.5])box(-w*.4,y,0,.1,.13,d)}if(t==='bed'){box(0,h*.98,0,w*.94,h*.24,d*.9,'#8b9c80',null);box(0,h*1.15,-d*.32,w*.8,.13,d*.2,'#d4cfaf',null)}if(t==='cart'){for(let x of [-w*.48,w*.48])box(x,h,0,.1,h*.7,d);for(let z of [-d*.3,d*.3])for(let x of [-w*.55,w*.55]){let wheel=cyl(x,.36,z,.36,.15,'#514735');wheel.rotation.z=Math.PI/2}}return root}
 if(t==='shelf'){for(let x of [-w*.46,w*.46])box(x,h/2,0,.12,h,d);for(let y=.1;y<=h;y+=.5){box(0,y,0,w,.09,d);if(y<h-.2)for(let x=-w*.4;x<w*.4;x+=.22)box(x,y+.2,0,.15,.32,d*.8,Math.floor((x+w)*10)%2?'#9f8162':'#6d866c',null)}return root}
 if(['house','tent'].includes(t)){let bottom=t==='house'?h*.65:0;if(bottom){box(0,bottom/2,0,w,bottom,d);box(0,bottom*.37,-d/2-.01,w*.22,bottom*.74,.03,'#594d3d','wood');for(let x of [-w*.3,w*.3])box(x,bottom*.65,-d/2-.02,w*.17,bottom*.23,.035,'#4d6b6a',null)}
 let shape=new T.Shape();shape.moveTo(-w*.55,bottom);shape.lineTo(w*.55,bottom);shape.lineTo(0,h);shape.closePath();let geo=new T.ExtrudeGeometry(shape,{depth:d*1.1,bevelEnabled:false,steps:1});geo.translate(0,0,-d*.55);let roof=new T.Mesh(geo,mat(t==='house'?'#74644b':color,t==='house'?'wood':null));roof.castShadow=true;roof.receiveShadow=true;roof.userData.ownedGeometry=true;root.add(roof);return root}
 if(t==='barrel'){cyl(0,h/2,0,w*.45,h);for(let y of [h*.2,h*.8]){let ring=part('ring',0,y,0,w*.45,w*.45,w*.45,'#53574b','metal');ring.rotation.x=Math.PI/2}return root}
 if(t==='well'){let ring=part('ring',0,h*.7,0,w*.42,w*.42,w*.42);ring.rotation.x=Math.PI/2;ring.scale.z=h*.8;part('cylinder',0,h*.2,0,w*.33,.03,w*.33,'#223d3b',null);return root}
 if(t==='fence'){for(let x=-w/2+.08;x<w/2;x+=.4)box(x,h/2,0,.12,h,d);for(let y of [h*.4,h*.8])box(0,y,0,w,.12,d*.55);return root}
 if(['bush','flowers','grass','mushroom'].includes(t)){for(let i=0;i<7;i++){let x=-w*.35+(i*.37)%(w*.7),z=-d*.35+(i*.29)%(d*.7),hh=h*(.6+i%3*.14);if(t==='bush')ball(x,hh/2,z,.4,hh*.7,.4);else if(t==='grass')part('cone',x,hh/2,z,.07,hh,.07);else{cyl(x,hh*.4,z,.025,hh*.8,'#758455',t==='flowers'?'leaves':null);ball(x,hh*.8,z,.14,.075,.14)}}return root}
 if(t==='crystal'){for(let i=0;i<3;i++)part('cone',(i-1)*.2,h*(.4+i*.1),0,.27,h*(.8+i*.2),.27);return root}
 if(t==='statue'){box(0,.12,0,w,.24,d);box(0,h*.45,0,w*.35,h*.55,d*.35);ball(0,h*.85,0,.24,.3,.24);return root}
 if(t==='grave'){box(0,.1,0,w,.2,d);box(0,h*.5,-d*.3,w*.65,h,.2);return root}
 if(t==='campfire'){for(let i=0;i<8;i++){let a=i/8*Math.PI*2;ball(Math.cos(a)*.4,.08,Math.sin(a)*.4,.12,.1,.12,'#7e8576','stone')}cyl(0,.06,0,.3,.1,'#c36f2d','lava');return root}
 if(['rug','bridge','pond'].includes(t)){if(t==='pond')part('cylinder',0,.025,0,w*.5,.04,d*.5);else if(t==='bridge'){for(let z=-d/2+.12;z<d/2;z+=.28)box(0,.09,z,w,.16,.24)}else{box(0,.015,0,w,.025,d);for(let z of [-d*.45,d*.45])box(0,.03,z,w*.9,.005,.08,'#c5ad7d')}return root}
 if(t==='light'){box(0,.18,0,.35,.36,.35,'#7f775a');let glow=ball(0,.55,0,.15,.2,.15,o.light?.color||'#ffdc8a',null);let original=glow.material;glow.material=original.clone();let used=false;root.traverse(child=>{if(child.material===original)used=true});if(!used)original.dispose();glow.material.emissive.set(o.light?.color||'#ffdc8a');glow.material.emissiveIntensity=1;return root}
 if(t==='portal'){let ring=part('ring',0,.08,0,.45,.45,.45,'#92bfb0');ring.rotation.x=Math.PI/2;return root}
 if(t==='rock'){ball(0,h*.4,0,w*.5,h*.55,d*.5);return root}
 if(t==='sacks'){ball(-w*.17,h*.35,0,w*.32,h*.5,d*.42);ball(w*.2,h*.3,.1,w*.3,h*.4,d*.36);return root}
 box(0,h/2,0,w*.94,h,d*.94);if(t==='chest'||t==='crate'){for(let x of [-w*.3,w*.3])box(x,h+.015,0,.06,.035,d,'#554d38');if(t==='chest')box(0,h*.55,-d*.49,.12,.18,.03,'#d8bc73','metal')}return root;
}
export function disposeModel(root){let materials=new Set();root.traverse(o=>{if(o.userData.ownedGeometry)o.geometry?.dispose();if(o.material)for(let m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});for(let m of materials){if(m.userData.ownedMap)m.map?.dispose();m.dispose()}}

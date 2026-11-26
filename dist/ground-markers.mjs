import * as T from './vendor/three.module.min.js';
import * as W from './world.mjs';
// Ground-plane indicators: constant altitude, depth-tested, cached texture content.
export function createGroundMarkers(createCanvas){
 const group=new T.Group();group.name='Noms et vie au sol';const entries=new Map(),plane=new T.PlaneGeometry(1,1),ringGeo=new T.RingGeometry(.40,.44,48);ringGeo.rotateX(-Math.PI/2);
 const right=new T.Vector3(),away=new T.Vector3(),up=new T.Vector3(0,1,0),basis=new T.Matrix4();
 function remove(id,e){group.remove(e.root);e.texture?.dispose();e.label.material.dispose();e.ring.material.dispose();entries.delete(id)}
 function create(flying=false){let root=new T.Group(),canvas=flying?null:createCanvas(),texture=null;if(canvas){canvas.width=384;canvas.height=128;texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;}
 let label=new T.Mesh(plane,new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));label.renderOrder=3;
 let ring=new T.Mesh(ringGeo,new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:1,depthWrite:false,depthTest:false,toneMapped:false,blending:T.CustomBlending,blendSrc:T.OneMinusDstColorFactor,blendDst:T.ZeroFactor,blendEquation:T.AddEquation}));ring.renderOrder=30;root.add(label,ring);group.add(root);return{root,label,ring,canvas,texture,key:null,draws:0};}
 function update(opts,objects,camera){right.setFromMatrixColumn(camera.matrixWorld,0);right.y=0;right.normalize();away.crossVectors(up,right).normalize();basis.makeBasis(right,away,up);const alive=new Set();
 for(let[id,{root}]of objects){let o=root.userData.object;if(!o)continue;let actor=W.character(o),selected=id===opts.selection,name=!!opts.showNames&&(selected||opts.hoverId===id||o.type==='portal'),health=!!o.showHealth,p=W.center(o),detail=opts.sight?.get(W.cellKey(p.x,p.y))?.detail??1;
 let flying=['fly','third'].includes(opts.map.camera.mode);if(flying?!(actor&&selected):!(name||health||actor&&selected))continue;alive.add(id);let e=entries.get(id);if(e&&!flying&&!e.texture){remove(id,e);e=null}if(!e){e=create(flying);entries.set(id,e)}
 e.root.visible=root.visible&&root.userData.alpha>=.14&&(opts.mode==='mj'||detail>=.55);if(!e.root.visible)continue;
 let altitude=W.elevation(o,opts.map);e.root.position.set(p.x,altitude+.035,p.y);e.ring.scale.set(Math.max(1,o.w||1),1,Math.max(1,o.d||1));e.ring.visible=actor&&selected;e.ring.material.opacity=Math.min(.95,root.userData.alpha);e.label.visible=(name||health)&&!opts.building&&!opts.path?.length;e.label.material.opacity=Math.min(1,root.userData.alpha);
 if(flying){e.label.visible=false;continue}
 const max=Math.max(1,o.max||20),hp=W.clamp(o.hp??max,0,max),key=JSON.stringify([name?o.name:'',health,hp,max,selected,o.type]);
 if(e.key!==key){e.key=key;e.draws++;let g=e.canvas.getContext('2d');g.clearRect(0,0,384,128);g.fillStyle='#10221ea8';g.fillRect(3,5,378,118);g.strokeStyle=selected?'#e6c782':'#6b8b78';g.lineWidth=3;g.strokeRect(4.5,6.5,375,115);g.textAlign='center';g.textBaseline='middle';
 if(name){let text=String(o.name||''),font=42;g.font='600 '+font+'px system-ui';while(font>28&&g.measureText(text).width>350){font--;g.font='600 '+font+'px system-ui'}while(text.length>1&&g.measureText(text).width>350)text=text.slice(0,-2)+'…';g.fillStyle=selected?'#ffe5a5':'#edf3e8';g.fillText(text,192,health?34:64)}
 if(health){let y=name?65:35;g.fillStyle='#633d37';g.fillRect(20,y,344,18);g.fillStyle=hp/max>.5?'#a6d192':hp/max>.25?'#e7bd6c':'#e88979';g.fillRect(20,y,344*hp/max,18);g.fillStyle='#f0eee4';g.font='500 30px system-ui';g.fillText(hp+' / '+max,192,y+37)}e.texture.needsUpdate=true;}
 if(opts.map.camera.mode==='fly')e.label.visible=false;
 if(opts.map.camera.mode==='third'&&o.id===(opts.map.camera.followId||opts.selection)){e.label.visible=false;e.ring.visible=false;}
 // Keep type readable through camera orbit without turning the plate into a billboard.
 let pixels=camera.isPerspectiveCamera?(opts.viewportWidth||1280)/(2*Math.tan(camera.fov*Math.PI/360)*Math.max(1,camera.position.distanceTo(e.root.position))):(opts.viewportWidth||1280)/(camera.right-camera.left),tilt=Math.max(.25,Math.hypot(camera.matrixWorld.elements[4],camera.matrixWorld.elements[6])),span=Math.min(2.6,Math.max(1.05,(selected?80:68)/pixels)),depth=span/3/tilt;e.label.quaternion.setFromRotationMatrix(basis);e.label.scale.set(span,depth,1);e.label.position.copy(away).multiplyScalar(-(.45+depth/2));e.label.position.y=.012;
 }
 for(let[id,e]of entries)if(!alive.has(id))remove(id,e);
 }
 return{group,entries,update,dispose(){for(let[id,e]of entries)remove(id,e);plane.dispose();ringGeo.dispose()}};
}

import * as T from './vendor/three.module.min.js';
import {ASSETS} from './asset-catalog.mjs';
// Imported meshes carry vertex colours but no UVs. Hint only a subtle projected
// material grain; mixed textiles stay untagged instead of inheriting wood grain.
function assetSurface(def){
 const source=def?.source||'';
 if(/^(rug|pillow|bear|books|bed|banner|cardboardBox|tableCloth|chairCushion)/.test(source))return null;
 if(/^(rock|fountain)/.test(source))return 'stone';
 if(/^(tree|hedge|pottedPlant|plantSmall)/.test(source))return 'leaves';
 if(source==='lantern')return 'metal';
 if(/^(stall-(red|green))$/.test(source)||source==='stall')return null;
 if(/^(chair|bench|table|stool|bookcase|cabinet|sideTable|desk|coatRack|cart|wheel|planks|poles|stall-bench|stall-stool)/.test(source))return 'wood';
 return null;
}
export function createAssetLibrary(onReady=()=>{}){
 const entries=new Map();let dead=false;
 function install(id,data){const geometry=new T.BufferGeometry();for(const k of ['position','normal','color'])geometry.setAttribute(k,new T.Float32BufferAttribute(data[k],3));geometry.computeBoundingSphere();entries.set(id,{geometry});if(!dead)onReady();}
 function request(id){if(entries.has(id)||!ASSETS[id]||dead)return;entries.set(id,{pending:true});fetch(new URL('./assets/kenney/'+id+'.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Asset '+r.status);return r.json()}).then(data=>{if(!dead)install(id,data)}).catch(()=>{entries.set(id,{error:true});if(!dead)onReady()})}
 return{install,version:id=>entries.get(id)?.geometry?1:entries.get(id)?.error?-1:0,make(o){request(o.type);const entry=entries.get(o.type),def=ASSETS[o.type],root=new T.Group();if(entry?.geometry){const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.85}),kind=assetSurface(def);if(kind){material.userData.surfaceKind=kind;material.userData.surfaceDetailOnly=true;}const mesh=new T.Mesh(entry.geometry,material);mesh.scale.set(o.w/def.w,o.height/def.height,o.d/def.d);mesh.castShadow=o.shadow!==false;mesh.receiveShadow=true;root.add(mesh)}else{let mesh=new T.Mesh(new T.BoxGeometry(o.w,o.height,o.d),new T.MeshStandardMaterial({color:entry?.error?'#a96957':'#809684',transparent:true,opacity:.3,wireframe:true}));mesh.position.y=o.height/2;mesh.userData.ownedGeometry=true;root.add(mesh)}return root},dispose(){dead=true;for(const e of entries.values())e.geometry?.dispose();entries.clear()}};
}

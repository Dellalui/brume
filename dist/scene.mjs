import {renderableImpacts} from './throw-effects.mjs';
import {doorSlabs} from './door-interaction.mjs';
import {createSurfaceLibrary,surfaceDefinition} from './surface-textures.mjs';
import {buildBlockOcclusion} from './block-occlusion.mjs';
import {createEnvironment,environmentSettings,environmentLight,seasonColor} from './environment.mjs';
import {ASSETS} from './asset-catalog.mjs';
import {createAssetLibrary} from './asset-models.mjs';
import {createRenderRegion} from './render-region.mjs';
import {indexGroundEdits,groundChunkDescriptor} from './ground-rectangles.mjs';
import * as T from './vendor/three.module.min.js';
import {perspectiveCamera,sweepCameraMotion} from './navigation.mjs';
import * as W from './world.mjs';
import {makeCarriedSource} from './carried-light.mjs';
import {buildVisionOutline} from './combat-vision-outline.mjs';
import {makeModel,disposeModel} from './models.mjs';
import {effectEnvelope} from './effect-layer.mjs';
import {createEffects} from './effects.mjs';
import {createThrowVisuals} from './throw-visuals.mjs';
import {blockCutAlpha,blockCutShader} from './block-visibility.mjs';
import {isLiquid,deriveLiquids,liquidMeshData,createLiquidCache} from './liquid-flow.mjs';
import {normalizeLiquidStyle} from './liquid-style.mjs';
import {liquidVertexHeader,liquidFragmentHeader,liquidVertexAssign,liquidColorShader,liquidEmissionShader} from './liquid-shader.mjs';
import {createGroundMarkers} from './ground-markers.mjs';
import {createBufferSizer} from './render-size.mjs';
import {createSpriteResidency} from './sprite-residency.mjs';
import {accelerateInstancePicking} from './instance-picking.mjs';
import {routeMarkers,routeMarkerGeometry} from './path-markers.mjs';
import {reliefPlan,reliefSignature} from './relief-batches.mjs';
import {isCrystal,transparentShell} from './transparent-shell.mjs';
import {makeShadowVolume,shadowVolumeGeometry,contactShadowTexture,lightingAnchor,selectSceneLights,selectLocalLights,pointShadowBudget} from './shadow-system.mjs';
const fogColor=new T.Color('#101b19');
export function createTacticalCamera(view,width,height){let camera=new T.OrthographicCamera(),pixels=Math.SQRT2*view.scale;camera.left=-view.ox/pixels;camera.right=(width-view.ox)/pixels;camera.top=view.oy/pixels;camera.bottom=-(height-view.oy)/pixels;let distance=Math.max(600,Math.max(view.cx,view.cy)*4+100);camera.near=.1;camera.far=distance*3;let a=view.angle,elevation=Math.asin(view.tilt),fx=(Math.cos(a)+Math.sin(a))/Math.SQRT2,fz=(Math.cos(a)-Math.sin(a))/Math.SQRT2;camera.position.set(view.cx+fx*Math.cos(elevation)*distance,Math.sin(elevation)*distance,view.cy+fz*Math.cos(elevation)*distance);camera.lookAt(view.cx,0,view.cy);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return camera}
export function renderer(canvas,{createRenderer=p=>new T.WebGLRenderer(p),createCanvas=()=>document.createElement('canvas')}={}){
 let gpu;try{gpu=createRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'})}catch(error){let notice=document.createElement('div');notice.className='webgl-error';notice.setAttribute('role','alert');notice.textContent='La scène 3D nécessite WebGL 2. Activez l’accélération graphique de votre navigateur puis rechargez cette page.';canvas.parentElement.append(notice);let view={cx:0,cy:0,ox:0,oy:0,scale:16,angle:0,tilt:.5};return{render:()=>{},pick:()=>null,world:(x,y)=>W.unproject(x,y,view),screen:(x,y,z=0)=>W.project(x,y,z,view),view:()=>view,error};}
 gpu.setClearColor(fogColor);gpu.outputColorSpace=T.SRGBColorSpace;gpu.toneMapping=T.ACESFilmicToneMapping;gpu.toneMappingExposure=1;gpu.shadowMap.enabled=true;gpu.shadowMap.type=T.PCFShadowMap;gpu.shadowMap.autoUpdate=false;
 const scene=new T.Scene(),objects=new T.Group(),overlays=new T.Group(),ray=new T.Raycaster(),floorPlane=new T.Plane(new T.Vector3(0,1,0),0),pointer=new T.Vector2();scene.background=fogColor;scene.add(objects,overlays);const environment=createEnvironment(scene);const groundMarkers=createGroundMarkers(createCanvas);scene.add(groundMarkers.group);
 const hemi=new T.HemisphereLight('#d6e0bf','#4a5747',1),sun=new T.DirectionalLight('#ffedcc',1),fill=new T.DirectionalLight('#bdd1ea',.26);scene.add(hemi,sun,sun.target,fill,fill.target);sun.castShadow=true;sun.shadow.autoUpdate=false;fill.castShadow=false;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;
 const cutUniforms={blockViewEye:{value:1.5},blockPlayerView:{value:0},blockCutEnabled:{value:0},blockCutOrigin:{value:new T.Vector3()},blockCutDistance:{value:0},blockCutDirection:{value:new T.Vector3()},blockCutOpacity:{value:.22},blockCutRadius:{value:1.1}};
 const pointLights=Array.from({length:8},()=>{let l=new T.PointLight('#ffd594',0,8,2);l.shadow.autoUpdate=false;l.shadow.mapSize.set(256,256);scene.add(l);return l});
 const effectsLayer=new T.Group();effectsLayer.name='Calque des effets';scene.add(effectsLayer);const fxFactory=createEffects(createCanvas),fxCache=new Map();const thrownVisuals=createThrowVisuals(fxFactory);scene.add(thrownVisuals.group);let animations=false,activeMapId=null,maskKey='',maskWasTransition=false;const cache=new Map(),textures=new Map(),tokenTextures=new Map(),floorGeo=new T.PlaneGeometry(1,1),floorMaterial=new T.MeshStandardMaterial({roughness:1}),floorMatrix=new T.Matrix4(),dummy=new T.Object3D();floorGeo.rotateX(-Math.PI/2);const terrainGeo=floorGeo.clone(),terrainChunks=new Map(),terrainGroup=new T.Group();terrainGroup.name='Terrain par secteurs';scene.add(terrainGroup);
 const spriteResidency=createSpriteResidency(textures,im=>textureFor(im),gpu);
 const proxyGeometry=shadowVolumeGeometry(),contactTexture=contactShadowTexture();
 const ghostExtras=new Map(),assetLibrary=createAssetLibrary(()=>last.onAssetReady?.());let renderRegion=null,cameraKey='',cameraMap=null;
 const carriedPoint=new T.PointLight('#ffda9e',0,5,2),carriedSpot=new T.SpotLight('#ffda9e',0,5,Math.PI/6,.35,2);scene.add(carriedPoint,carriedSpot,carriedSpot.target);carriedPoint.castShadow=false;carriedSpot.castShadow=false;
 let localLights=[];
 let lastShadowRefresh=0;let sightTexture=null,sightData=null,terrain=null,terrainKey='',terrainEpoch=-1,terrainMap=null,dimensions='',view,camera,width=1,height=1,last={},ghost=null,ghostKey='',frame=0,lightKey='',shadowDirty=true,shadowUpdates=0,terrainGeneration=0,terrainBuilds=0,terrainReuses=0,groundEditIndex=null,terrainChunksRef=null,groundDataKey='',groundBatch=null,groundBatchKey='',groundPlanes=0;
 const surfaces=createSurfaceLibrary({createCanvas,anisotropy:Math.min(8,gpu.capabilities?.getMaxAnisotropy?.()||4),onReady:()=>{shadowDirty=true;last.onAssetReady?.()}});
 const fogUniforms={tacticalSight:{value:null},tacticalSize:{value:new T.Vector2(1,1)},tacticalOrigin:{value:new T.Vector2(0,0)},tacticalMode:{value:0},tacticalGrid:{value:1},cloudShadowEnabled:{value:0},cloudShadowStrength:{value:0},cloudCoverage:{value:0},cloudTime:{value:0},cloudWind:{value:.25},cloudDirection:{value:new T.Vector2(.9,.4)}};
 const applyTacticalFog=(shader,block=false)=>{Object.assign(shader.uniforms,fogUniforms);shader.vertexShader='varying vec2 tacticalWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
vec4 tacticalP=vec4(transformed,1.0);
#ifdef USE_INSTANCING
 tacticalP=instanceMatrix*tacticalP;
#endif
 tacticalWorld=(modelMatrix*tacticalP).xz;`);shader.fragmentShader='varying vec2 tacticalWorld;\nuniform sampler2D tacticalSight;\nuniform vec2 tacticalSize;\nuniform vec2 tacticalOrigin;\nuniform float tacticalMode;\nuniform float tacticalGrid;\nuniform float cloudShadowEnabled;\nuniform float cloudShadowStrength;\nuniform float cloudCoverage;\nuniform float cloudTime;\nuniform float cloudWind;\nuniform vec2 cloudDirection;\nfloat tacticalHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat tacticalNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(tacticalHash(i),tacticalHash(i+vec2(1.0,0.0)),f.x),mix(tacticalHash(i+vec2(0.0,1.0)),tacticalHash(i+vec2(1.0,1.0)),f.x),f.y);}\nfloat tacticalFbm(vec2 p){float n=0.0,a=0.55;for(int i=0;i<4;i++){n+=tacticalNoise(p)*a;p=p*2.03+vec2(17.3,9.1);a*=0.5;}return n;}\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
vec4 tacticalSample=texture2D(tacticalSight,(tacticalWorld-tacticalOrigin)/tacticalSize);
float manualFog=texture2D(tacticalSight,(floor(tacticalWorld)-tacticalOrigin+0.5)/tacticalSize).g;
float visibility=tacticalMode>1.5?mix(1.0,0.035,manualFog):tacticalMode>0.5?mix(1.0,0.16,manualFog):tacticalSample.r*(1.0-manualFog);
vec2 cellEdge=min(fract(tacticalWorld),1.0-fract(tacticalWorld));
float gridLine=1.0-smoothstep(0.0,0.025,min(cellEdge.x,cellEdge.y));
gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*1.28,gridLine*tacticalGrid*0.35);
if(cloudShadowEnabled>0.5&&cloudShadowStrength>0.001&&cloudCoverage>0.05){vec2 cloudUv=(tacticalWorld+cloudDirection*28.0)*0.035+cloudDirection*(cloudTime*cloudWind*0.03);float cloud=tacticalFbm(cloudUv);float shadow=smoothstep(.52-cloudCoverage*.23,.62-cloudCoverage*.18,cloud)*cloudShadowStrength;gl_FragColor.rgb*=1.0-shadow;}
gl_FragColor.rgb=mix(vec3(0.0052,0.0110,0.0097),gl_FragColor.rgb,visibility);`);if(block===true){shader.vertexShader='varying vec3 tacticalFaceNormal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('tacticalWorld=(modelMatrix*tacticalP).xz;',`tacticalWorld=(modelMatrix*tacticalP).xz;\nvec3 tacticalN=normal;\n#ifdef USE_INSTANCING\n tacticalN=mat3(instanceMatrix)*tacticalN;\n#endif\n tacticalFaceNormal=normalize(mat3(modelMatrix)*tacticalN);`);shader.fragmentShader='varying vec3 tacticalFaceNormal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('vec4 tacticalSample=texture2D(tacticalSight,(tacticalWorld-tacticalOrigin)/tacticalSize);',`vec2 tacticalOutside=floor(tacticalWorld+normalize(tacticalFaceNormal).xz*.035);\nvec2 tacticalInside=floor(tacticalWorld-normalize(tacticalFaceNormal).xz*.035);\nvec4 tacticalSample=texture2D(tacticalSight,(tacticalOutside-tacticalOrigin+.5)/tacticalSize);`);shader.fragmentShader=shader.fragmentShader.replace('float manualFog=texture2D(tacticalSight,(floor(tacticalWorld)-tacticalOrigin+0.5)/tacticalSize).g;',`float manualFog=max(tacticalSample.g,texture2D(tacticalSight,(tacticalInside-tacticalOrigin+.5)/tacticalSize).g);`);}};
 floorMaterial.onBeforeCompile=applyTacticalFog;surfaces.apply(floorMaterial,{kind:'grass',face:'ground',projection:'ground',terrain:true,grassCap:false});
 const reliefGroup=new T.Group();reliefGroup.name='Relief en blocs';scene.add(reliefGroup);let reliefKey='',reliefMap=null;const blockGeo=new T.BoxGeometry(1,1,1),reliefBatches=new Map(),faceGeometries=new Map(),transparentBatches=new Map();const blockMaterials=new Map(),liquidMaterials=new Map(),liquidPickMaterial=new T.MeshBasicMaterial({visible:false}),liquidCache=createLiquidCache();
 let liquidCount=0;
 function removeReliefMesh(m){reliefGroup.remove(m);if(m.userData.liquidSurface||m.userData.transparentShell)m.geometry.dispose();else m.dispose()}
 function clearRelief(){liquidCount=0;for(let m of [...reliefGroup.children])removeReliefMesh(m);reliefBatches.clear();transparentBatches.clear()}
 function beginRelief(){liquidCount=0;for(const m of [...reliefGroup.children])if(!m.userData.reliefBatch&&!m.userData.transparentShell)removeReliefMesh(m)}
 function faceGeometry(face){let g=faceGeometries.get(face);if(g)return g;const group=blockGeo.groups[face];g=blockGeo.clone();g.clearGroups();g.setIndex(Array.from(blockGeo.index.array.slice(group.start,group.start+group.count)));faceGeometries.set(face,g);return g}
 function dropBatch(key,entry){removeReliefMesh(entry.mesh);if(entry.fade)removeReliefMesh(entry.fade);reliefBatches.delete(key)}
 function syncReliefBatches(groups){
  const wanted=new Set(),cut=!!cutUniforms.blockCutEnabled.value,full=occlusion.fullUnits||new Set();
  for(const plan of reliefPlan(groups,full,cut,k=>W.BLOCKS[k]?.opaque&&W.BLOCKS[k]?.opacity===1,Math.max(last.map.width,last.map.height)>64)){
   const {key,kind,face,cells}=plan,signature=reliefSignature(cells);wanted.add(key);
   let entry=reliefBatches.get(key);
   if(!entry||entry.mesh.instanceMatrix.count<cells.length){
    if(entry)dropBatch(key,entry);
    const material=blockMaterial(kind),geometry=face===null?blockGeo:faceGeometry(face),capacity=Math.max(1,2**Math.ceil(Math.log2(cells.length)));
    const mesh=new T.InstancedMesh(geometry,face===null?material.mats:material.mats[face],capacity);
    accelerateInstancePicking(mesh);mesh.userData.reliefBatch=key;mesh.castShadow=W.BLOCKS[kind].opacity>.8;mesh.receiveShadow=true;mesh.count=cells.length;reliefGroup.add(mesh);
    entry={mesh,fade:null,signature:null};reliefBatches.set(key,entry);
    if(cut&&face===null){entry.fade=addBlockFade(mesh,kind);entry.fade.userData.reliefBatch=key}
   }
   const {mesh,fade}=entry;mesh.userData.blocks=cells;if(fade)fade.userData.blocks=cells;
   if(entry.signature===signature)continue;
   mesh.count=cells.length;for(let i=0;i<cells.length;i++){const b=cells[i];dummy.position.set(b.x+.5,b.z+b.h/2,b.y+.5);dummy.scale.set(b.w||1,b.h,b.d||1);dummy.rotation.y=-(b.angle||0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();if(fade){fade.count=mesh.count;fade.boundingSphere=mesh.boundingSphere}
   entry.signature=signature;shadowDirty=true;
  }
  for(const [key,entry]of reliefBatches)if(!wanted.has(key)){dropBatch(key,entry);shadowDirty=true}
  dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);
 }
 function liquidMaterial(kind){
  if(liquidMaterials.has(kind))return liquidMaterials.get(kind);
  const water=kind==='water',m=new T.MeshStandardMaterial({color:'#ffffff',roughness:water?.30:.84,metalness:water?.02:0,transparent:water,opacity:1,depthWrite:!water,side:T.FrontSide,emissive:'#ffffff',emissiveIntensity:1});
  m.onBeforeCompile=shader=>{
   applyTacticalFog(shader,true);shader.uniforms.liquidTime=fogUniforms.cloudTime;
   shader.vertexShader=liquidVertexHeader+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('tacticalWorld=(modelMatrix*tacticalP).xz;','tacticalWorld=(modelMatrix*tacticalP).xz;'+liquidVertexAssign);
   shader.fragmentShader=liquidFragmentHeader+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('gridLine*tacticalGrid*0.35','0.0');
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+liquidColorShader(water));
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+liquidEmissionShader(water));
   if(water)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float liquidFresnel=pow(1.0-clamp(dot(normalize(vViewPosition),normal),0.0,1.0),3.0);
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(vLiquidA,vec3(1.0),.3),liquidFresnel*.22);
    diffuseColor.a=mix(diffuseColor.a,.92,liquidFresnel*.45);
   `);
   shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor.rgb=mix(vec3(0.0052,0.0110,0.0097),gl_FragColor.rgb,visibility);','if(tacticalMode<.5 && visibility<.025)discard;\ngl_FragColor.rgb=mix(vec3(0.0052,0.0110,0.0097),gl_FragColor.rgb,visibility);');
  };
  m.customProgramCacheKey=()=> 'brumes-liquid-v3-procedural-'+kind;liquidMaterials.set(kind,m);return m;
 }
 function renderLiquids(opts,groups,origin,size){
  const result=liquidCache(opts.map,W,opts.mode),slice=opts.blockSlice??32;
  const include=b=>b.object?(!renderRegion||renderRegion.object(b.object)):(!renderRegion||renderRegion.cell(b.x,b.y))&&b.x>=origin.x&&b.y>=origin.y&&b.x<origin.x+size.x&&b.y<origin.y+size.y;
  for(const batch of liquidMeshData(result,include,slice)){
   if(!batch.positions.length)continue;
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(batch.positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(batch.normals,3));geo.setAttribute('liquidColorA',new T.Float32BufferAttribute(batch.colorA,3));geo.setAttribute('liquidColorB',new T.Float32BufferAttribute(batch.colorB,3));geo.setAttribute('liquidStyleParams',new T.Float32BufferAttribute(batch.styleParams,3));geo.computeBoundingSphere();
   const mesh=new T.Mesh(geo,liquidMaterial(batch.kind));mesh.userData.liquidSurface=true;mesh.userData.liquidKind=batch.kind;mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};reliefGroup.add(mesh);liquidCount++;
  }
  // Picking retains only the original editable source volume. Flow meshes
  // cannot be mined, selected or stored as thousands of extra blocks.
  for(const kind of ['water','lava']){
   const cells=groups.get(kind)||[];groups.delete(kind);if(!cells.length)continue;
   const mesh=accelerateInstancePicking(new T.InstancedMesh(blockGeo,liquidPickMaterial,cells.length));mesh.userData.blocks=cells;mesh.userData.liquidSource=true;
   for(let i=0;i<cells.length;i++){const b=cells[i];dummy.position.set(b.x+.5,b.z+b.h/2,b.y+.5);dummy.scale.set(b.w||1,b.h,b.d||1);dummy.rotation.y=-(b.angle||0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}
   mesh.computeBoundingSphere();reliefGroup.add(mesh);
  }
  dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);
 }
 function crystalMaterial(kind){
  const glass=kind==='glass';
  // A single front-facing exterior surface, never a stack of ice-textured
  // glass cube faces. Standard alpha blending, not screen-door dithering.
  const m=new T.MeshStandardMaterial({color:glass?'#c1dbe4':'#b8dce8',map:null,roughness:glass?.13:.36,metalness:0,transparent:true,opacity:glass?.14:.66,depthWrite:false,side:T.FrontSide});
  m.onBeforeCompile=shader=>{
   applyTacticalFog(shader,true);
   shader.vertexShader='varying float crystalY;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('tacticalWorld=(modelMatrix*tacticalP).xz;','tacticalWorld=(modelMatrix*tacticalP).xz; crystalY=(modelMatrix*tacticalP).y;');
   shader.fragmentShader='varying float crystalY;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('gridLine*tacticalGrid*0.35','0.0');
   if(!glass)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    // Subtle world-space density variation in solid ice, no tiled image.
    vec2 iceP=tacticalWorld+vec2(.37,-.29)*crystalY;
    float frost=.72*tacticalNoise(iceP*2.3)+.28*tacticalNoise(iceP*7.0+vec2(13.0,5.0));
    diffuseColor.rgb*=.86+.20*frost;
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
    float crystalEdge=pow(1.0-clamp(abs(dot(normalize(vViewPosition),normal)),0.0,1.0),3.0);
    diffuseColor.a=mix(diffuseColor.a,${glass?'.39':'.82'},crystalEdge);
    outgoingLight+=vec3(.012,.021,.028)*(.20+.80*crystalEdge);
    #include <opaque_fragment>
   `);
   shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor.rgb=mix(vec3(0.0052,0.0110,0.0097),gl_FragColor.rgb,visibility);','if(tacticalMode<.5 && visibility<.025)discard;\ngl_FragColor.rgb=mix(vec3(0.0052,0.0110,0.0097),gl_FragColor.rgb,visibility);');
  };
  m.customProgramCacheKey=()=> 'brumes-clear-crystal-v1-'+kind;
  return m;
 }
 function renderTransparentBlocks(groups){
  const wanted=new Set();
  for(const kind of ['glass','ice']){
   const cells=groups.get(kind)||[];groups.delete(kind);
   for(const batch of transparentShell(cells)){
    const key=kind+'|'+batch.key;wanted.add(key);
    let entry=transparentBatches.get(key);
    const unchanged=entry&&entry.positions.length===batch.positions.length&&entry.positions.every((v,i)=>v===batch.positions[i]);
    if(!unchanged){
     if(entry)removeReliefMesh(entry.mesh);
     const geo=new T.BufferGeometry();
     geo.setAttribute('position',new T.Float32BufferAttribute(batch.positions,3));
     geo.setAttribute('normal',new T.Float32BufferAttribute(batch.normals,3));
     geo.computeBoundingSphere();
     // A real spatial center keeps Three's transparent ordering local.
     const center=geo.boundingSphere.center.clone();geo.translate(-center.x,-center.y,-center.z);
     const mesh=new T.Mesh(geo,blockMaterial(kind).side);mesh.position.copy(center);
     mesh.userData.transparentShell=true;mesh.userData.crystalKind=kind;
     mesh.castShadow=false;mesh.receiveShadow=true;
     const raycast=mesh.raycast;
     mesh.raycast=function(raycaster,hits){const first=hits.length;raycast.call(this,raycaster,hits);for(let i=first;i<hits.length;i++)hits[i].instanceId=hits[i].faceIndex};
     reliefGroup.add(mesh);entry={mesh,positions:batch.positions};transparentBatches.set(key,entry);
    }
    // Each exterior triangle keeps its original editable source identity.
    entry.mesh.userData.blocks=batch.faceBlocks;
   }
  }
  for(const [key,entry]of transparentBatches)if(!wanted.has(key)){removeReliefMesh(entry.mesh);transparentBatches.delete(key)}
 }
 function blockMaterial(kind){if(blockMaterials.has(kind))return blockMaterials.get(kind);let def=W.BLOCKS[kind]||W.BLOCKS.grass;
 if(isCrystal(kind)){const m=crystalMaterial(kind),mats=Array(6).fill(m),entry={mats,fadeMats:mats,tex:null,topTex:null,side:m,top:m,bottom:m,fadeSide:m,fadeTop:m,fadeBottom:m};blockMaterials.set(kind,entry);return entry}
 let tex=surfaces.texture(surfaceDefinition(kind,'side').asset),topTex=surfaces.texture(surfaceDefinition(kind,'top').asset);let make=(texture,isTop=false,pass=0,face=isTop?'top':'side')=>{let m=new T.MeshStandardMaterial({color:'#ffffff',map:texture,shadowSide:def.opaque?T.DoubleSide:null,roughness:def.pattern==='glass'?.2:1,transparent:pass===1||(def.opacity??1)<1,opacity:def.opacity??1,depthWrite:pass===0&&(def.opacity??1)>.9,emissive:def.emissive?def.top:'#000000',emissiveIntensity:def.emissive?.3:0});m.onBeforeCompile=shader=>{applyTacticalFog(shader,true);Object.assign(shader.uniforms,cutUniforms,{blockCutPass:{value:pass},blockTop:{value:isTop?1:0}});shader.vertexShader='varying vec3 blockCenter;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('tacticalWorld=(modelMatrix*tacticalP).xz;',`tacticalWorld=(modelMatrix*tacticalP).xz;\nvec4 blockMid=vec4(0.,0.,0.,1.);\n#ifdef USE_INSTANCING\n blockMid=instanceMatrix*blockMid;\n#endif\n blockCenter=(modelMatrix*blockMid).xyz;`);shader.fragmentShader='varying vec3 blockCenter; uniform float blockCutEnabled; uniform vec3 blockCutOrigin; uniform float blockCutDistance; uniform vec3 blockCutDirection; uniform float blockCutRadius; uniform float blockCutOpacity; uniform float blockCutPass;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
${blockCutShader}
`);shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
if(blockCutPass>0.5)gl_FragColor.a*=cutAlpha;`)};m.customProgramCacheKey=()=> 'block-view-'+isTop+'-'+pass;surfaces.apply(m,{kind,face,projection:'box',grassCap:kind==='grass'&&face==='side'});return m};let side=make(tex),top=make(topTex,true),fadeSide=make(tex,false,1),fadeTop=make(topTex,true,1),bottom=kind==='grass'?make(surfaces.texture('dirt'),false,0,'bottom'):side,fadeBottom=kind==='grass'?make(surfaces.texture('dirt'),false,1,'bottom'):fadeSide,mats=[side,side,top,bottom,side,side],fadeMats=[fadeSide,fadeSide,fadeTop,fadeBottom,fadeSide,fadeSide];blockMaterials.set(kind,{mats,fadeMats,tex,topTex,side,top,bottom,fadeSide,fadeTop,fadeBottom});return blockMaterials.get(kind)}
 function addBlockFade(mesh,kind){if(!cutUniforms.blockCutEnabled.value)return null;let fade=new T.InstancedMesh(blockGeo,blockMaterial(kind).fadeMats,mesh.instanceMatrix.count);fade.count=mesh.count;fade.instanceMatrix=mesh.instanceMatrix;fade.boundingSphere=mesh.boundingSphere;fade.userData={...mesh.userData,cutOverlay:true};fade.raycast=()=>{};fade.receiveShadow=true;fade.renderOrder=2;reliefGroup.add(fade);return fade}
 let occlusion={hiddenObjects:new Set(),hiddenVoxels:new Set(),candidates:0},occlusionKey='',occlusionMap=null;
 function updateOcclusion(opts){
 const m=opts.map,key=JSON.stringify([m.blockRevision,m.buildRevision,opts.terrainEpoch,renderRegion?.key,opts.blockSlice,opts.mode,!!cutUniforms.blockCutEnabled.value,m.groups.map(g=>[g.id,g.visible])]);
 if(occlusionMap===m&&occlusionKey===key)return;occlusionMap=m;occlusionKey=key;
 // A cutaway deliberately exposes the interior: do not discard its hidden geometry.
 occlusion=cutUniforms.blockCutEnabled.value?{hiddenObjects:new Set(),hiddenVoxels:new Set(),candidates:0}:buildBlockOcclusion(m,{region:renderRegion?{cell:renderRegion.cell,object:o=>{const b=W.bounds(o);for(let y=Math.floor(b.y/16);y<=Math.floor((b.y+b.h)/16);y++)for(let x=Math.floor(b.x/16);x<=Math.floor((b.x+b.w)/16);x++)if(renderRegion.chunks.has(x+','+y))return true;return false}}:null,slice:opts.blockSlice??32,mode:opts.mode});
 }
 function updateRelief(opts){let key=opts.map.id+'|'+occlusionKey+'|'+terrainGeneration+'|'+(opts.map.blockRevision||0)+'|'+(opts.map.buildRevision||0)+'|'+opts.mode+'|'+(opts.blockSlice??32)+'|'+opts.map.objects.filter(o=>o.type==='block'&&opts.images.get(o.imageId)).map(o=>o.id+o.imageId).join(',');if(reliefMap===opts.map&&key===reliefKey)return;if(reliefMap!==opts.map)clearRelief();reliefMap=opts.map;reliefKey=key;beginRelief();let groups=new Map(),origin=fogUniforms.tacticalOrigin.value,size=fogUniforms.tacticalSize.value;if(opts.map.blocks){let earth=[];for(let[k,low]of Object.entries(opts.map.ground||{})){let[x,y]=k.split(',').map(Number);if(!W.activeCell(opts.map,x,y)||x<origin.x||y<origin.y||x>=origin.x+size.x||y>=origin.y+size.y)continue;for(let[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){let high=W.groundAt(opts.map,x+dx,y+dy);if(high>low)earth.push({x:x+.5+dx*.5,y:y+.5+dy*.5,z:(low+high)/2,h:high-low,dx,dy})}}if(earth.length){let mesh=new T.InstancedMesh(blockGeo,blockMaterial('dirt').mats,earth.length);mesh.userData.earth=true;for(let i=0;i<earth.length;i++){let b=earth[i];dummy.position.set(b.x,b.z,b.y);dummy.scale.set(b.dx?.015:1,b.h,b.dy?.015:1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}dummy.scale.set(1,1,1);mesh.receiveShadow=true;mesh.castShadow=true;mesh.computeBoundingSphere();reliefGroup.add(mesh);addBlockFade(mesh,'dirt')}for(let[k,column]of Object.entries(opts.map.blocks)){let[x,y]=k.split(',').map(Number);if(renderRegion&&!renderRegion.cell(x,y))continue;if(x<origin.x||y<origin.y||x>=origin.x+size.x||y>=origin.y+size.y||!W.activeCell(opts.map,x,y))continue;for(let[z,kind]of Object.entries(column)){z=Number(z);let blockGroup=opts.map.blockGroups?.[x+','+y+','+z];if(z>=(opts.blockSlice??32)||!W.BLOCKS[kind]||opts.map.groups.find(g=>g.id===blockGroup)?.visible===false)continue;let blockH=W.blockSize(opts.map,x,y,z);if(occlusion.hiddenVoxels.has(x+','+y+','+z))continue;if(!groups.has(kind))groups.set(kind,[]);groups.get(kind).push({x,y,z,h:blockH})}}for(const o of opts.map.objects){if(renderRegion){const b=W.bounds(o);let inRegion=false;for(let y=Math.floor(b.y/16);y<=Math.floor((b.y+b.h)/16);y++)for(let x=Math.floor(b.x/16);x<=Math.floor((b.x+b.w)/16);x++)if(renderRegion.chunks.has(x+','+y))inRegion=true;if(!inRegion)continue}if(occlusion.hiddenObjects.has(o.id)||o.type!=='block'||(!isLiquid(o.material)&&opts.images.get(o.imageId))||o.visible===false||opts.map.groups.find(g=>g.id===o.group)?.visible===false||opts.mode!=='mj'&&o.secret||W.elevation(o,opts.map)>=(opts.blockSlice??32))continue;let b=W.bounds(o);if(b.x+b.w<origin.x||b.y+b.h<origin.y||b.x>origin.x+size.x||b.y>origin.y+size.y)continue;let kind=o.material||'stone';if(!groups.has(kind))groups.set(kind,[]);groups.get(kind).push({id:o.id,object:o,x:o.x+o.w/2-.5,y:o.y+o.d/2-.5,z:W.elevation(o,opts.map),h:o.height,w:o.w,d:o.d,angle:o.facing||0})}
renderLiquids(opts,groups,origin,size);renderTransparentBlocks(groups);syncReliefBatches(groups);shadowDirty=true;return;}renderTransparentBlocks(new Map());syncReliefBatches(new Map());for(let[k,b]of Object.entries(opts.map.terrain||{})){let[x,y]=k.split(',').map(Number),h=W.terrainHeight(opts.map,x,y);if(!h||!W.activeCell(opts.map,x,y)||x<origin.x||y<origin.y||x>=origin.x+size.x||y>=origin.y+size.y)continue;let kind=W.BLOCKS[b.material]?b.material:'grass';if(!groups.has(kind))groups.set(kind,[]);groups.get(kind).push({x,y,h})}for(let[k,cells]of groups){let mesh=new T.InstancedMesh(blockGeo,blockMaterial(k).mats,cells.length);for(let i=0;i<cells.length;i++){let b=cells[i];dummy.position.set(b.x+.5,b.h/2,b.y+.5);dummy.scale.set(b.w||1,b.h,b.d||1);dummy.rotation.y=-(b.angle||0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}dummy.scale.set(1,1,1);mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();reliefGroup.add(mesh)}shadowDirty=true}
 const overlayCanvas=createCanvas(),ctx=overlayCanvas.getContext('2d'),bufferSizer=createBufferSizer();overlayCanvas.className='scene-labels';overlayCanvas.style.cssText='position:absolute;inset:0;pointer-events:none;width:100%;height:100%';canvas.parentElement?.append(overlayCanvas);
 function textureFor(im){if(!textures.has(im)){let texture=new T.Texture(im);texture.colorSpace=T.SRGBColorSpace;texture.onUpdate=()=>spriteResidency.note(texture);texture.needsUpdate=true;textures.set(im,texture)}const texture=textures.get(im);textures.delete(im);textures.set(im,texture);return texture}
 function avatar(o,color){let key=o.type+color;if(tokenTextures.has(key))return tokenTextures.get(key);let c=createCanvas();c.width=128;c.height=256;let g=c.getContext('2d');g.clearRect(0,0,128,256);g.fillStyle='#182923';g.beginPath();g.ellipse(64,241,35,10,0,0,Math.PI*2);g.fill();g.fillStyle=color;g.beginPath();g.moveTo(26,236);g.lineTo(37,110);g.lineTo(64,89);g.lineTo(91,110);g.lineTo(102,236);g.closePath();g.fill();g.fillStyle='#00000027';g.beginPath();g.moveTo(64,90);g.lineTo(92,110);g.lineTo(102,236);g.lineTo(73,236);g.fill();g.fillStyle=o.type==='enemy'?'#a8b38b':'#e6caa5';g.beginPath();g.arc(64,68,22,0,Math.PI*2);g.fill();g.fillStyle='#35483a';g.beginPath();g.arc(64,62,24,Math.PI,Math.PI*2);g.fill();g.fillStyle='#d5ba7a';g.fillRect(35,171,57,7);g.strokeStyle='#ccd4c1';g.lineWidth=5;g.beginPath();g.moveTo(105,236);g.lineTo(112,111);g.stroke();let texture=new T.CanvasTexture(c);let pixels=g.getImageData?.(0,0,128,256)?.data;if(pixels)texture.userData.alphaImage={width:128,height:256,pixels};texture.colorSpace=T.SRGBColorSpace;tokenTextures.set(key,texture);return texture}
 function objectColor(o,map){return o.color||map.groups.find(g=>g.id===o.group)?.color||'#829875'}
 function sceneImage(o){return W.viewerImage(o,{x:camera.position.x,y:camera.position.z})}
 function tokenBack(o){let p=W.center(o);return Math.cos(W.bearing(camera.position.x-p.x,camera.position.z-p.y)-(o.facing||0))<0}
 function makeObject(o,map,images,isPreview=false){let root=new T.Group(),color=objectColor(o,map),im=images.get(sceneImage(o))||images.get(o.imageId),visual;if(o.type==='block'){if(isPreview||im){let material=isLiquid(o.material)?new T.MeshStandardMaterial({color:normalizeLiquidStyle(o.material,o.liquidStyle).colorA,roughness:.5,transparent:true,opacity:.7}):im?new T.MeshStandardMaterial({map:textureFor(im),color:'#ffffff',roughness:.9}):isCrystal(o.material)?crystalMaterial(o.material):blockMaterial(o.material||'stone').mats.map((m,i)=>{let c=m.clone();surfaces.apply(c,{kind:o.material||'stone',face:i===2?'top':i===3?'bottom':'side',grassCap:o.material==='grass'&&i!==2&&i!==3});return c}),mesh=new T.Mesh(new T.BoxGeometry(o.w,o.height,o.d),material);mesh.position.y=o.height/2;mesh.userData.ownedGeometry=true;root.add(mesh)}}else if(o.surface||o.mountNormal){let backing=new T.Mesh(new T.BoxGeometry(o.w||.85,o.height||.85,.045),new T.MeshStandardMaterial({color:o.color||'#8c6842',roughness:.85}));backing.userData.ownedGeometry=true;root.add(backing);let w=(o.w||.85)-.1,h=(o.height||.85)-.1;if(im){let ratio=Math.min(w/im.width,h/im.height);w=im.width*ratio;h=im.height*ratio}let face=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({color:im?'#ffffff':'#d7c9a1',map:im?textureFor(im):null,roughness:.9,transparent:!!im,alphaTest:.04,side:T.DoubleSide}));face.position.z=.028;face.userData.ownedGeometry=true;root.add(face);root.userData.surface=true;}else if((im&&!W.isSegment(o))||W.character(o)){let material;if(o.flat&&im){material=new T.MeshBasicMaterial({map:textureFor(im),transparent:true,alphaTest:.04,side:T.DoubleSide});visual=new T.Mesh(floorGeo,material);visual.scale.set(o.w||1,1,o.d||1);visual.position.y=.025;root.add(visual)}else{material=new T.MeshBasicMaterial({map:im?textureFor(im):avatar(o,color),transparent:true,alphaTest:.04,depthWrite:true,side:T.DoubleSide});let geo=new T.PlaneGeometry(1,1);geo.translate(0,.5,0);visual=new T.Mesh(geo,material);visual.userData.ownedGeometry=true;let h=(o.height||1.8)*(o.scale||1)*(im?1:1.16),ratio=im?im.width/im.height:.5;visual.scale.set(h*ratio,h,1);visual.position.y=.025;root.add(visual);let shade=new T.Mesh(new T.CircleGeometry(.44,24),new T.MeshBasicMaterial({map:contactTexture,color:'#07150d',transparent:true,opacity:.24,depthWrite:false}));shade.rotation.x=-Math.PI/2;shade.position.y=.018;shade.userData.contact=true;shade.userData.ownedGeometry=true;root.add(shade);if(!isPreview){const proxy=makeShadowVolume(o,W.character(o),proxyGeometry);root.userData.shadowVolume=proxy;root.add(proxy)}}if((!!o.flip !== !!(o.tokenFixed&&!o.flat&&tokenBack(o)))&&visual.material.map){visual.material.map=visual.material.map.clone();visual.material.map.repeat.x=-1;visual.material.map.offset.x=1;visual.material.userData.ownedMap=true}root.userData.image=im||visual.material.map?.userData.alphaImage;root.userData.sprite=visual;root.userData.isBillboard=!o.flat&&!o.tokenFixed;}else{root=ASSETS[o.type]?assetLibrary.make(o):makeModel(o,color);if(im&&W.isSegment(o)){root.userData.wallTexture=true;let replaced=new Set();root.traverse(child=>{if(!child.isMesh)return;replaced.add(child.material);let material=child.material.clone(),tex=textureFor(im).clone();tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(Math.max(.1,Math.hypot(o.x2-o.x,o.y2-o.y))/(o.textureScale||1),Math.max(.1,o.height)/(o.textureScale||1));material.map=tex;material.color.set('#ffffff');material.userData.ownedMap=true;child.material=material;});for(let material of replaced)material.dispose();}}
 const decorated=new Set();root.traverse(child=>{if(!child.isMesh)return;for(let material of Array.isArray(child.material)?child.material:[child.material]){if(decorated.has(material)||!material.userData.surfaceKind||material.userData.ownedMap)continue;decorated.add(material);surfaces.apply(material,{kind:material.userData.surfaceKind,detailOnly:!!material.userData.surfaceDetailOnly,projection:'box'})}});
 root.traverse(child=>{if(child.isMesh||child.isSprite){child.userData.objectId=o.id;child.userData.type=o.type;child.userData.materialBases=(Array.isArray(child.material)?child.material:[child.material]).map(m=>({opacity:m.opacity,color:m.color.clone()}));child.userData.pickable=!child.userData.contact&&!child.userData.shadowOnly}});return root}
 function modelKey(o,map,images){const actor=W.character(o);return JSON.stringify([assetLibrary.version(o.type),o.type,o.w,o.d,o.height,o.scale,o.variant,o.canopy,o.open,W.isSegment(o)?Math.hypot(o.x2-o.x,o.y2-o.y):null,objectColor(o,map),actor?null:sceneImage(o),actor?!!o.flat&&!!(images.get(sceneImage(o))||images.get(o.imageId)):!!images.get(sceneImage(o)),o.flat,o.tokenFixed,actor?null:o.tokenFixed&&!o.flat&&tokenBack(o),actor?null:o.flip,o.shadow,o.textureScale,o.rise,o.surface,o.material,o.mountNormal,o.liquidStyle])}
 const strengthMemo=new WeakMap(),ambientMemo=new WeakMap();
 function memoVisibility(memo,o,opts,fn){if(opts.visionEpoch===undefined)return fn(o,opts);let key=[opts.mode,opts.terrainEpoch,opts.visionEpoch,opts.visionTransition||opts.map.camera.mode==='first'?frame:0,o.x,o.y,W.elevation(o,opts.map),o.height,o.w,o.d,o.secret].join('|'),entry=memo.get(o);if(entry?.key===key&&entry.map===opts.map&&entry.sight===opts.sight&&entry.lights===opts.lights)return entry.value;let value=fn(o,opts);memo.set(o,{key,map:opts.map,sight:opts.sight,lights:opts.lights,value});return value}
 function strength(o,opts){return memoVisibility(strengthMemo,o,opts,rawStrength)}
 function ambientStrength(o,opts){if(opts.map.camera.mode==='first')return firstPersonVisible(o,opts)?1:0;return memoVisibility(ambientMemo,o,opts,W.ambientStrength)}
 function firstPersonVisible(o,opts){
  const a=opts.observers?.[0];if(!a||o.secret)return false;if(a.id===o.id)return true;
  const p=W.center(o),from=W.center(a),d=Math.hypot(p.x-from.x,p.y-from.y);
  if(d>Math.max(a.vision?.range||12,a.vision?.far??64)||opts.map.fog.includes(W.cellKey(p.x,p.y)))return false;
  const eye=W.elevation(a,opts.map)+Math.min(W.eyeHeight(a),opts.map.camera.firstEye??Infinity),target=W.elevation(o,opts.map)+Math.min(W.eyeHeight(o),1.4);
  return W.terrainLineClear(opts.map,from,p,eye,target)&&!W.sightHit(opts.map,from,p,opts.lights?.walls||[],a.id,eye,target)
 }
 // Sparse live confirmation for previously displayed characters. Cache by
 // pose/light revision instead of recasting every remembered terrain tile.
 const actorSightMemo=new WeakMap();
 function pendingActorSight(o,opts){
  const p=W.center(o),k=W.cellKey(p.x,p.y),entry=actorSightMemo.get(o);
  if(entry?.map===opts.map&&entry.lights===opts.lights&&entry.key===opts.visionKey&&entry.cell===k&&entry.epoch===opts.terrainEpoch)return entry.value;
  let value=0;
  if(!opts.map.fog.includes(k)&&opts.lights)for(const a of opts.observers||[]){
   if(W.levelOf(a)!==(opts.map.editLevel||0))continue;
   const v=W.perception(opts.map,a,Math.floor(p.x),Math.floor(p.y),opts.lights);
   if(v.allowed)value=Math.max(value,v.detail||0,v.haze||0);
  }
  actorSightMemo.set(o,{map:opts.map,lights:opts.lights,key:opts.visionKey,cell:k,epoch:opts.terrainEpoch,value});return value
 }
 function rawStrength(o,opts){if(opts.mode==='mj')return 1;if(W.levelOf(o)!==(opts.map.editLevel||0)&&!(o.type==='stairs'&&W.levelOf(o)+(o.rise||1)===(opts.map.editLevel||0)))return 0;if(o.secret)return 0;if(opts.map.transitionLevel!==undefined&&['platform','balcony','stairs'].includes(o.type)&&W.levelOf(o)<=Math.max(opts.map.editLevel||0,opts.map.transitionLevel))return .7;let p=W.center(o);
 if(opts.map.camera.mode==='first'){
  if(opts.map.fog.includes(W.cellKey(p.x,p.y)))return 0;
  // Physical geometry is depth-tested by WebGL. Hidden information still
  // needs a direct eye-to-target ray, including screen-space labels.
  if(!W.character(o))return 1;
  return firstPersonVisible(o,opts)?1:0
 }
 const character=W.character(o),cell=W.cellKey(p.x,p.y);
 if(opts.map.fog.includes(cell))return 0;
 if(character&&opts.observers?.some(a=>a.id===o.id))return 1;
 let value=(x,y)=>{const k=W.cellKey(x,y);
  if(!character)return opts.sightDisplay?.get(k)??(opts.vision?.has(k)?1:0);
  const v=opts.sight?.get(k);return Math.max(v?.detail||0,v?.haze||0);
 };if(W.isSegment(o)){let dx=o.x2-o.x,dy=o.y2-o.y,len=Math.hypot(dx,dy)||1;let visible=0,steps=Math.min(32,Math.max(1,Math.ceil(len)));for(let i=0;i<=steps;i++){let x=o.x+dx*i/steps,y=o.y+dy*i/steps;visible=Math.max(visible,value(x-dy/len*.55,y+dx/len*.55),value(x+dy/len*.55,y-dx/len*.55))}return visible}
 // A closed built door must be visible from its exposed sides, even if its
 // own opaque footprint prevents a ground ray from reaching its centre.
 if(W.isDoor(o)){
  const b=doorSlabs(opts.map,o,W)[0],c=Math.cos(b.angle),s=Math.sin(b.angle),n=Math.min(32,Math.max(1,Math.ceil(b.w))),offset=b.d/2+.4;let v=value(p.x,p.y);
  for(let i=0;i<=n;i++){const k=(i/n-.5)*b.w;v=Math.max(v,value(b.x+k*c-offset*s,b.y+k*s+offset*c),value(b.x+k*c+offset*s,b.y+k*s-offset*c))}
  return v;
 }
 let visibility=value(p.x,p.y);
 if(character&&visibility<.55&&opts.visionPending&&(opts.sightDisplay?.get(cell)||0)>.38)visibility=Math.max(visibility,pendingActorSight(o,opts));
 // A visible ground tile does not reveal an actor above a solid ceiling.
 if(visibility>0&&W.character(o)&&opts.observers?.length&&!opts.observers.some(a=>{
  if(a.id===o.id)return true;
  let from=W.center(a),eye=W.elevation(a,opts.map)+W.eyeHeight(a),target=W.elevation(o,opts.map)+W.eyeHeight(o);
  return W.terrainLineClear(opts.map,from,p,eye,target)&&!W.sightHit(opts.map,from,p,opts.lights?.walls||[],a.id,eye,target);
 }))return 0;
 return visibility}
 function updateActorImage(root,o,images){
 if(!W.character(o)||!root.userData.sprite)return;const sprite=root.userData.sprite,im=images.get(sceneImage(o))||images.get(o.imageId),flipped=!!o.flip!==!!(o.tokenFixed&&!o.flat&&tokenBack(o));
 if(root.userData.directionImage===im&&root.userData.directionFlip===flipped&&root.userData.directionReady)return;
 const material=sprite.material,source=im?textureFor(im):avatar(o,objectColor(o,last.map)),hadMap=!!material.map;
 if(material.userData.ownedMap)material.map?.dispose();material.userData.ownedMap=false;
 material.map=source;
 // Mirror the geometry, not the GPU texture.
 if(hadMap!==!!material.map)material.needsUpdate=true;
 if(!o.flat){const h=(o.height||1.8)*(o.scale||1)*(im?1:1.16);sprite.scale.set(h*(im?im.width/im.height:.5),h,1)}
 sprite.scale.x=(flipped?-1:1)*Math.abs(sprite.scale.x);root.userData.image=im||source.userData.alphaImage;root.userData.directionImage=im;root.userData.directionFlip=flipped;root.userData.directionReady=true;
 }
 function updateObject(root,o,opts,isGhost=false){updateActorImage(root,o,opts.images);let p=W.center(o),angle=W.isSegment(o)?Math.atan2(o.y2-o.y,o.x2-o.x):(o.facing||0);root.position.set(p.x,W.elevation(o,opts.map),p.y);root.rotation.y=o.tokenFixed?Math.PI-angle:-angle;if(root.userData.isBillboard)root.userData.sprite.rotation.y=Math.atan2(camera.matrixWorld.elements[8],camera.matrixWorld.elements[10])-root.rotation.y;if(o.mountNormal){const n=o.mountNormal;root.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(n.x,n.z,n.y));root.rotateZ(-angle);}else if(o.surface){let b=o.surface.block,n=o.surface.normal;root.position.set(b.x+.5+n.x*.525,b.z+W.blockSize(opts.map,b.x,b.y,b.z)/2+n.z*(W.blockSize(opts.map,b.x,b.y,b.z)/2+.025),b.y+.5+n.y*.525);root.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(n.x,n.z,n.y));root.rotateZ(-angle);}let s=strength(o,opts),fogged=opts.map.fog.includes(W.cellKey(p.x,p.y));let supportVisible=!o.surface||!!W.blockAt(opts.map,o.surface.block.x,o.surface.block.y,o.surface.block.z);let levelVisible=supportVisible&&!!(W.levelOf(o)<=Math.max(opts.map.editLevel||0,opts.map.transitionLevel||0)||(opts.mode==='mj'&&opts.map.showUpper));if(W.ROOFS.includes(o.type)&&opts.map.hideRoofs)levelVisible=false;const wasVisible=root.visible;root.visible=isGhost||(levelVisible&&o.visible!==false&&opts.map.groups.find(g=>g.id===o.group)?.visible!==false&&s>(W.character(o)?.38:.025));let alpha=(o.opacity??1)*(isGhost?.46:opts.mode==='mj'&&(o.secret||fogged)?.17:s);if(!isGhost&&opts.map.camera.mode==='first'&&o.id===opts.map.camera.followId){root.visible=false;alpha=0}const physicalAlpha=alpha;if(!isGhost&&wasVisible!==root.visible)shadowDirty=true;if(opts.brush?.sourceId===o.id)alpha*=.22;if(o.surface&&cutUniforms.blockCutEnabled.value&&cutAlphaAt(root.position)<.999)alpha*=cutUniforms.blockCutOpacity.value;
 if(!isGhost&&opts.cutaway&&W.ROOFS.includes(o.type)){let selected=opts.map.objects.find(t=>t.id===opts.selection&&W.character(t));if(selected){let c=W.center(selected),b=W.bounds(o);if(c.x>=b.x&&c.x<=b.x+b.w&&c.y>=b.y&&c.y<=b.y+b.h&&W.levelOf(selected)<=W.levelOf(o))alpha*=.12}}
 if(!camera.isPerspectiveCamera&&!isGhost&&opts.cutaway&&opts.selection!==o.id&&['wall','door','tree','column','house','tent','shelf'].includes(o.type)){let selected=opts.map.objects.find(t=>t.id===opts.selection);if(selected){let p1=screen(p.x,p.y),q=W.center(selected),p2=screen(q.x,q.y);if(W.depth(o,view)>W.depth(selected,view)&&Math.abs(p1.x-p2.x)<view.scale*(W.isSegment(o)?Math.hypot(o.x2-o.x,o.y2-o.y):Math.max(o.w||1,o.canopy||1.35))*1.5&&p1.y>p2.y-view.scale&&p1.y-p2.y<view.scale*(o.height||1))alpha*=.22}}
 if(!W.character(o)&&!o.surface&&cutUniforms.blockCutEnabled.value&&o.type!=='floor'){let sample=root.position.clone();sample.y+=(o.height||1)*.6;if(cutAlphaAt(sample)<.999)alpha*=.18;}if(opts.map.camera.mode==='third'&&o.id===(opts.map.camera.followId||opts.selection)){let eye=root.position.clone();eye.y+=1;alpha*=W.clamp((camera.position.distanceTo(eye)-.35)/1.2,0,1);}root.userData.alpha=alpha;root.userData.object=o;
 // Camera position and sprites can change without changing any mesh material.
 const materialState=[alpha,physicalAlpha>.55,root.visible,o.shadow!==false,opts.map.lighting.shadows!==false,isGhost,isGhost?!!opts.brush?.valid:true].join('|');
 if(root.userData.materialState===materialState)return root.visible;
 root.userData.materialState=materialState;root.traverse(child=>{if(!child.material)return;const casts=!isGhost&&o.shadow!==false&&root.visible&&physicalAlpha>.55&&!child.userData.contact&&(!root.userData.sprite||child.userData.shadowOnly);if(child.castShadow!==casts&&!isGhost)shadowDirty=true;child.castShadow=casts;if(child.userData.shadowOnly)return;const mats=Array.isArray(child.material)?child.material:[child.material];mats.forEach((material,i)=>{const base=child.userData.materialBases[i];material.opacity=alpha*(base.opacity??1);let transparent=!!root.userData.sprite||!!child.isSprite||isGhost||material.opacity<.995;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true}material.depthWrite=!isGhost&&!child.userData.contact&&material.opacity>.55;material.color.copy(base.color);if(isGhost&&!opts.brush.valid)material.color.lerp(new T.Color('#f08c7a'),.7)});if(child.userData.contact)child.visible=!isGhost&&o.shadow!==false&&opts.map.lighting.shadows!==false;});return root.visible;}
 function updateTerrain(opts){let map=opts.map,corners=[W.unproject(-150,-150,view),W.unproject(width+150,-150,view),W.unproject(width+150,height+150,view),W.unproject(-150,height+150,view)],extra=camera.isPerspectiveCamera?0:24;if(camera.isPerspectiveCamera){let f=new T.Vector3();camera.getWorldDirection(f);let b=renderRegion.bounds;corners=[{x:b.x0,y:b.y0},{x:b.x1,y:b.y1}]}let x0=Math.max(0,Math.min(map.width-1,Math.floor((Math.min(...corners.map(p=>p.x))-extra)/16)*16)),y0=Math.max(0,Math.min(map.height-1,Math.floor((Math.min(...corners.map(p=>p.y))-extra)/16)*16)),x1=Math.min(map.width,Math.ceil((Math.max(...corners.map(p=>p.x))+extra)/16)*16),y1=Math.min(map.height,Math.ceil((Math.max(...corners.map(p=>p.y))+extra)/16)*16);x1=Math.max(x0+1,x1);y1=Math.max(y0+1,y1);let tw=x1-x0,th=y1-y0,dim=[tw,th].join(',');if(dim!==dimensions){dimensions=dim;sightTexture?.dispose();sightData=new Uint8Array(tw*th*4);sightTexture=new T.DataTexture(sightData,tw,th,T.RGBAFormat);sightTexture.minFilter=sightTexture.magFilter=T.LinearFilter;sightTexture.generateMipmaps=false;fogUniforms.tacticalSight.value=sightTexture;fogUniforms.tacticalSize.value.set(tw,th)}fogUniforms.tacticalOrigin.value.set(x0,y0);
 const dataKey=[opts.terrainEpoch,map.blockRevision,map.width,map.height].join('|');
 const windowKey=[map.id,x0,y0,x1,y1,map.chunks.length,renderRegion?.key,map.environment?.season,dataKey].join('|');
 if(terrainMap!==map||terrainKey!==windowKey||terrainChunksRef!==map.chunks){
  if(terrainMap!==map){terrainChunks.clear();groundBatchKey=''}
  if(terrainMap!==map||groundDataKey!==dataKey||!groundEditIndex){groundEditIndex=indexGroundEdits(map);groundDataKey=dataKey}
  terrainEpoch=opts.terrainEpoch;terrainMap=map;terrainChunksRef=map.chunks;terrainKey=windowKey;terrainGeneration++;
  const wanted=new Set(),rects=[],signatures=[];let logicalCells=0;
  for(let cy=Math.floor(y0/16);cy<Math.ceil(y1/16);cy++)for(let cx=Math.floor(x0/16);cx<Math.ceil(x1/16);cx++){
   const id=cx+','+cy;if(renderRegion&&!renderRegion.chunks.has(id))continue;
   const previous=terrainChunks.get(id),entry=groundChunkDescriptor(map,cx,cy,groundEditIndex,previous);
   if(!entry){terrainChunks.delete(id);continue}
   wanted.add(id);if(entry===previous)terrainReuses++;else{terrainChunks.set(id,entry);terrainBuilds++}
   rects.push(...entry.rects);logicalCells+=entry.cells;signatures.push(entry.signature);
  }
  for(const id of terrainChunks.keys()){if(terrainChunks.size<=Math.max(128,wanted.size))break;if(!wanted.has(id))terrainChunks.delete(id)}
  // One instanced draw for the visible ground, with one rectangle for each
  // untouched chunk. World-space texture projection preserves texel density.
  const signature=signatures.join(';');
  if(groundBatchKey!==signature||!groundBatch){
   groundBatchKey=signature;const capacity=Math.max(1,2**Math.ceil(Math.log2(Math.max(1,rects.length))));
   if(!groundBatch||groundBatch.instanceMatrix.count<rects.length){
    if(groundBatch){terrainGroup.remove(groundBatch);groundBatch.dispose();groundBatch.geometry.dispose()}
    const geo=terrainGeo.clone();geo.setAttribute('surfaceGroundType',new T.InstancedBufferAttribute(new Float32Array(capacity),1));
    groundBatch=accelerateInstancePicking(new T.InstancedMesh(geo,floorMaterial,capacity));groundBatch.userData.groundChunk=true;groundBatch.receiveShadow=true;groundBatch.castShadow=false;terrainGroup.add(groundBatch);
   }
   groundBatch.count=rects.length;const types=groundBatch.geometry.attributes.surfaceGroundType,white=seasonColor('#ffffff',map.environment?.season),plain=new T.Color('#ffffff');
   for(let i=0;i<rects.length;i++){const p=rects[i];dummy.position.set(p.x+p.w/2,p.height,p.y+p.d/2);dummy.scale.set(p.w,1,p.d);dummy.rotation.set(0,0,0);dummy.updateMatrix();groundBatch.setMatrixAt(i,dummy.matrix);groundBatch.setColorAt(i,p.type===1?new T.Color(p.paint):p.type===2||p.type===3?plain:white);types.setX(i,p.type)}
   dummy.scale.set(1,1,1);types.needsUpdate=true;groundBatch.instanceMatrix.needsUpdate=true;if(groundBatch.instanceColor)groundBatch.instanceColor.needsUpdate=true;groundBatch.computeBoundingSphere();groundBatch.visible=rects.length>0;
  }
  terrain=terrainGroup;terrain.count=logicalCells;groundPlanes=rects.length;
 }

 let nextMaskKey=[map.id,x0,y0,tw,th,opts.mode,map.camera.mode,opts.visionEpoch,opts.terrainEpoch,map.editLevel].join('|');if(nextMaskKey!==maskKey||opts.visionTransition||maskWasTransition){maskKey=nextMaskKey;if(opts.mode==='mj'&&!map.fog.length){for(let i=0;i<sightData.length;i+=4){sightData[i]=255;sightData[i+1]=sightData[i+2]=0;sightData[i+3]=255}}else{const fog=new Set(map.fog);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){let k=W.cellKey(x,y),i=((y-y0)*tw+x-x0)*4,vis=opts.mode==='mj'?1:opts.sightDisplay?.get(k)??(opts.vision.has(k)?1:0);sightData[i]=Math.round(255*Math.max(vis,opts.explored.has(k)?.07:0));sightData[i+1]=fog.has(k)?255:0;sightData[i+2]=0;sightData[i+3]=255}}sightTexture.needsUpdate=true;}maskWasTransition=!!opts.visionTransition;fogUniforms.tacticalMode.value=opts.mode==='mj'?1:opts.map.camera.mode==='first'?2:0;fogUniforms.tacticalGrid.value=opts.showGrid?1:0;
 }
 function clearOverlays(){for(let child of [...overlays.children]){overlays.remove(child);child.geometry?.dispose();child.material?.dispose()}}
 function line(points,color,closed=false,depthTest=false){let ps=points.map(p=>new T.Vector3(p.x,p.z??((last.map?.editLevel||0)*(last.map?.levelHeight||W.LEVEL_HEIGHT)+(!(last.map?.editLevel)?W.terrainHeight(last.map,p.x,p.y):0)+.04),p.y));if(closed)ps.push(ps[0].clone());let g=new T.BufferGeometry().setFromPoints(ps),m=new T.LineBasicMaterial({color,transparent:true,opacity:.9,depthTest}),l=new T.Line(g,m);l.renderOrder=10;overlays.add(l)}
 function drawRouteMarkers(points,moving){
  const {border,ink}=routeMarkerGeometry(routeMarkers(points));
  for(const [positions,color,opacity,order] of [[border,'#182820',.88,11],[ink,moving?'#c0ddb0':'#efd39b',.96,12]]){
   if(!positions.length)continue;
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
   const material=new T.MeshBasicMaterial({color,transparent:true,opacity,depthTest:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
   const mesh=new T.Mesh(geometry,material);mesh.name='Route '+(order===11?'outline':'markers');mesh.userData.pathMarker=true;mesh.raycast=()=>{};mesh.renderOrder=order;overlays.add(mesh);
  }
 }
 let overlayKey='',overlayMap=null;
 const sightOutline=new T.Group();sightOutline.name='Contour de vision arcanique';scene.add(sightOutline);
 let outlineKey='',outlineMap=null;
 function clearSightOutline(){for(const mesh of [...sightOutline.children]){sightOutline.remove(mesh);mesh.geometry.dispose();mesh.material.dispose()}}
 function updateSightOutline(opts){
  const m=opts.map,a=m.combat?.active&&opts.mode!=='mj'&&m.camera.mode==='third'?(opts.observers?.find(o=>o.id===m.camera.followId)||opts.observers?.[0]):null;
  if(!a){sightOutline.visible=false;return}
  sightOutline.visible=true;
  const p=W.center(a),base=W.elevation(a,m),key=JSON.stringify([a.id,Math.round(p.x*4),Math.round(p.y*4),Math.round(base*4),Math.round((a.facing||0)*48/Math.PI),a.vision?.range,a.vision?.angle,m.editLevel,m.blockRevision,m.buildRevision,opts.terrainEpoch]);
  if(outlineMap===m&&outlineKey===key)return;
  outlineMap=m;outlineKey=key;clearSightOutline();
  const {positions,accents}=buildVisionOutline({x:p.x,y:p.y,heading:a.facing||0,range:a.vision?.range||12,angle:a.vision?.angle??180},(x,y)=>{
   if(!W.activeCell(m,x,y)||m.fog.includes(W.cellKey(x,y)))return undefined;
   return m.editLevel?(W.walkableAt(m,x,y,m.editLevel)?base:undefined):m.blocks?(W.surfaceNear(m,x,y,base,Infinity,.1)??W.groundAt(m,x,y)):W.terrainHeight(m,x,y)
  });
  if(!positions.length)return;
  const colors=[],gold=new T.Color('#e8c47d'),ivory=new T.Color('#fff0cb');
  for(const accent of accents){const color=accent?ivory:gold;colors.push(color.r,color.g,color.b,color.r,color.g,color.b)}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const outline=new T.LineSegments(geometry,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.76,depthTest:true,depthWrite:false,toneMapped:false}));outline.renderOrder=10;sightOutline.add(outline)
 }

 function drawOverlays(opts){
 const chosen=opts.map.objects.find(o=>o.id===opts.selection),visiblePath=(opts.path||[]).map(p=>opts.mode==='mj'||opts.vision.has(W.cellKey(p.x,p.y))?p:null);
 const key=JSON.stringify([opts.terrainEpoch,opts.map.blockRevision,opts.mode,opts.map.camera.mode,opts.showExtensions,opts.showChunks,opts.map.width,opts.map.height,(opts.showChunks||opts.showExtensions)?[terrainGeneration,opts.extensionStep,opts.map.chunks.length]:null,chosen?[chosen.id,chosen.x,chosen.y,chosen.x2,chosen.y2,chosen.w,chosen.d,chosen.occupancy,chosen.facing,W.elevation(chosen,opts.map),strength(chosen,opts)>.38]:null,visiblePath,opts.pathKind,opts.pathMoving,opts.brush]);
 if(overlayMap===opts.map&&overlayKey===key)return;overlayKey=key;overlayMap=opts.map;
 clearOverlays();
 if(opts.showExtensions&&opts.mode==='mj'){
  const bounds=renderRegion?.bounds||{x0:0,y0:0,x1:opts.map.width,y1:opts.map.height},margin=32;
  for(const r of W.extensionRegions(opts.map,opts.extensionStep??16)){
   const x=Math.max(r.x,bounds.x0-margin),y=Math.max(r.y,bounds.y0-margin),x1=Math.min(r.x+r.w,bounds.x1+margin),y1=Math.min(r.y+r.h,bounds.y1+margin);
   if(x1<=x||y1<=y)continue;
   const mesh=new T.Mesh(new T.PlaneGeometry(x1-x,y1-y),new T.MeshBasicMaterial({color:'#82c7a1',transparent:true,opacity:.13,side:T.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set((x+x1)/2,.015,(y+y1)/2);overlays.add(mesh);
   line([{x,y,z:.03},{x:x1,y,z:.03},{x:x1,y:y1,z:.03},{x,y:y1,z:.03}],'#9bd8b6',true,true);
  }
 }
 let selected=opts.map.objects.find(o=>o.id===opts.selection);if(selected&&strength(selected,opts)>.38){if(!W.isSegment(selected)&&!W.character(selected))line(W.footprint(selected).map(p=>({...p,z:W.elevation(selected,opts.map)+.045})),'#e8cc8e',true);if(W.character(selected)){if(selected.occupancy)for(let c of W.actorCells(selected)){let x=selected.x+c.x,y=selected.y+c.y,z=W.elevation(selected,opts.map)+.04;line([{x,y,z},{x:x+1,y,z},{x:x+1,y:y+1,z},{x,y:y+1,z}],c.kind===2?'#85c9de':'#d9c385',true)}let p=W.center(selected),a=selected.facing||0,dx=Math.sin(a),dy=-Math.cos(a);line([{x:p.x+dx*.66,y:p.y+dy*.66,z:W.elevation(selected,opts.map)+.05},{x:p.x+dx*.43-dy*.12,y:p.y+dy*.43+dx*.12,z:W.elevation(selected,opts.map)+.05},{x:p.x+dx*.43+dy*.12,y:p.y+dy*.43-dx*.12,z:W.elevation(selected,opts.map)+.05}],'#efd8a0',true,true)}}if(opts.path?.length){if(opts.pathKind==='measure'){const points=visiblePath.filter(Boolean).map(p=>({x:p.x+.5,y:p.y+.5,...(p.z!==undefined?{z:p.z+.05}:{})}));if(points.length>1)line(points,'#cbd99b');}else drawRouteMarkers(visiblePath.map(p=>p?{x:p.x+.5,y:p.y+.5,z:p.z??((opts.map.editLevel||0)*(opts.map.levelHeight||W.LEVEL_HEIGHT)+(!(opts.map.editLevel)?W.terrainHeight(opts.map,p.x+.5,p.y+.5):0))}:null),opts.pathMoving);}if(opts.brush){let b=opts.brush;if(b.target){let t=b.target,g=new T.BoxGeometry(t.w+.008,t.h+.008,t.d+.008),edges=new T.EdgesGeometry(g),outline=new T.LineSegments(edges,new T.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.9,depthTest:true}));g.dispose();outline.position.set(t.x+t.w/2,t.z+t.h/2,t.y+t.d/2);outline.rotation.y=-(t.angle||0);overlays.add(outline)}if(b.volume){let v=b.volume,g=new T.BoxGeometry(v.w,v.h,v.d),edges=new T.EdgesGeometry(g),mesh=new T.LineSegments(edges,new T.LineBasicMaterial({color:b.valid?'#b0d6b7':'#f39280',transparent:true,opacity:.65,depthTest:false}));g.dispose();mesh.position.set(v.x+v.w/2,v.z+v.h/2,v.y+v.d/2);overlays.add(mesh)}if(b.face){let geo=new T.PlaneGeometry(.85,.85),mat=new T.MeshBasicMaterial({color:'#edd39b',transparent:true,opacity:.5,side:T.DoubleSide,depthWrite:false}),mesh=new T.Mesh(geo,mat),n=b.normal;mesh.position.set(b.x+.5+n.x*.53,b.z+.5+n.z*.53,b.y+.5+n.y*.53);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(n.x,n.z,n.y));overlays.add(mesh)}else if(b.zone){let g=new T.BoxGeometry(b.w,b.h,b.d),edges=new T.EdgesGeometry(g),mesh=new T.LineSegments(edges,new T.LineBasicMaterial({color:'#dccc87',depthTest:false}));g.dispose();mesh.position.set(b.x+b.w/2,b.z+b.h/2,b.y+b.d/2);overlays.add(mesh)}else if(b.voxel){let g=new T.BoxGeometry(1.015,(b.h||1)+.015,1.015),mat=new T.MeshBasicMaterial({color:b.valid?(W.BLOCKS[b.material]?.top||'#a8dfa5'):'#ff8074',transparent:true,opacity:.45,depthWrite:false}),mesh=new T.Mesh(g,mat);mesh.position.set(b.x+.5,b.z+(b.h||1)/2,b.y+.5);overlays.add(mesh);let edges=new T.EdgesGeometry(g),outline=new T.LineSegments(edges,new T.LineBasicMaterial({color:b.valid?'#e4f3dc':'#ff8074',depthTest:false}));outline.position.copy(mesh.position);overlays.add(outline)}else if(b.blast){const radius=b.radius,positions=[];for(let axis=0;axis<3;axis++)for(let i=0;i<40;i++){for(const j of [i,i+1]){const a=j*Math.PI/20,p=[0,0,0];p[(axis+1)%3]=radius*Math.cos(a);p[(axis+2)%3]=radius*Math.sin(a);positions.push(...p)}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));const ring=new T.LineSegments(g,new T.LineBasicMaterial({color:b.color,transparent:true,opacity:.55,depthTest:true,depthWrite:false}));ring.position.set(b.x,b.z,b.y);overlays.add(ring)}else if(b.fx){let ps=[];for(let i=0;i<=48;i++){let a=i*Math.PI/24;ps.push({x:b.x+Math.cos(a)*b.radius,y:b.y+Math.sin(a)*b.radius})}line(ps,b.valid?'#b7d9ed':'#f39481');}else if(b.object){let o=b.object;if(W.isSegment(o))line([{x:o.x,y:o.y},{x:o.x2,y:o.y2}],b.valid?'#aedabb':'#f39481');else line(W.footprint(o).map(p=>({...p,z:W.elevation(o,opts.map)+.045})),b.valid?'#aedabb':'#f39481',true)}else if(b.type==='wall')line([{x:b.x,y:b.y},{x:b.x2,y:b.y2},{x:b.x2,y:b.y2,z:b.height},{x:b.x,y:b.y,z:b.height}],'#ead2a1',true);else if(!b.target)line([{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.d},{x:b.x,y:b.y+b.d}].map(p=>({...p,z:b.z??W.terrainHeight(opts.map,b.x,b.y)+.04})),'#bad2a3',true)}if(opts.showChunks&&opts.mode==='mj'){
 const positions=[],edges=new Set(),origin=fogUniforms.tacticalOrigin.value,size=fogUniforms.tacticalSize.value;
 const edge=(a,b)=>{const k=[a.join(','),b.join(',')].sort().join('|');if(edges.has(k))return;edges.add(k);positions.push(a[0],.04,a[1],b[0],.04,b[1])};
 for(let cy=Math.floor(origin.y/16);cy<Math.ceil((origin.y+size.y)/16);cy++)for(let cx=Math.floor(origin.x/16);cx<Math.ceil((origin.x+size.x)/16);cx++){
  if(renderRegion&&!renderRegion.chunks.has(cx+','+cy)||!W.activeCell(opts.map,cx*16,cy*16))continue;
  const x=cx*16,y=cy*16,x1=Math.min(opts.map.width,x+16),y1=Math.min(opts.map.height,y+16);edge([x,y],[x1,y]);edge([x1,y],[x1,y1]);edge([x1,y1],[x,y1]);edge([x,y1],[x,y]);
 }
 if(positions.length){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));const mesh=new T.LineSegments(geo,new T.LineBasicMaterial({color:'#7ba78b',transparent:true,opacity:.7,depthTest:true,depthWrite:false}));mesh.userData.chunkGrid=true;overlays.add(mesh)}
}}
 function screen(x,y,z=(last.map?.editLevel||0)*(last.map?.levelHeight||W.LEVEL_HEIGHT)+(!(last.map?.editLevel)?W.terrainHeight(last.map,x,y):0)){let p=new T.Vector3(x,z,y).project(camera);return{x:(p.x+1)*width/2,y:(1-p.y)*height/2}}
 function cutAlphaAt(point){return cutUniforms.blockCutEnabled.value?blockCutAlpha(point,cutUniforms.blockCutOrigin.value,cutUniforms.blockCutDirection.value,cutUniforms.blockCutDistance.value,cutUniforms.blockCutRadius.value,cutUniforms.blockCutOpacity.value):1}
 const cutMatrix=new T.Matrix4(),cutCenter=new T.Vector3();
 function solidHit(hit){const mesh=hit.object;if(mesh.userData.liquidSource)return !!last.building;if(mesh.userData.transparentShell)return true;if(!cutUniforms.blockCutEnabled.value)return true;if(mesh.isInstancedMesh&&hit.instanceId!==undefined){mesh.getMatrixAt(hit.instanceId,cutMatrix);cutCenter.setFromMatrixPosition(cutMatrix).applyMatrix4(mesh.matrixWorld)}else cutCenter.setFromMatrixPosition(mesh.matrixWorld);return cutAlphaAt(cutCenter)>=.999}
 function interactionRay(x,y){if(!camera||!last.map||width<=0||height<=0)return null;pointer.set(x/width*2-1,1-y/height*2);ray.setFromCamera(pointer,camera);const a=ray.ray.origin,d=ray.ray.direction;return {origin:{x:a.x,y:a.z,z:a.y},direction:{x:d.x,y:d.z,z:d.y},map:last.map}}
 function world(x,y){if(!camera||!last.map||width<=0||height<=0)return{x:-1,y:-1};pointer.set(x/width*2-1,1-y/height*2);ray.setFromCamera(pointer,camera);floorPlane.constant=-(last.map?.editLevel||0)*(last.map?.levelHeight||W.LEVEL_HEIGHT);let hit=!(last.map?.editLevel)&&ray.intersectObjects([...reliefGroup.children.filter(mesh=>mesh.visible&&!mesh.userData.cutOverlay),...[...cache.values()].filter(e=>e.root.visible&&e.root.userData.object?.type==='block'&&e.root.children.length).flatMap(e=>e.root.children)],false).find(solidHit);let surfaceHit=terrain&&ray.intersectObjects(terrainGroup.children.filter(m=>m.visible),false)[0];if(hit&&(!surfaceHit||hit.distance<=surfaceHit.distance+.001)){let n=hit.face.normal,b=hit.object.userData.blocks?.[hit.instanceId];if(!b&&hit.object.userData.type==='block'){const o=cache.get(hit.object.userData.objectId)?.root.userData.object;if(o)b={id:o.id,object:o,angle:o.facing||0}}if(b?.object){let a=hit.object.userData.transparentShell?0:b.angle||0,nx=n.x*Math.cos(a)-n.z*Math.sin(a),ny=n.x*Math.sin(a)+n.z*Math.cos(a);return{x:hit.point.x,y:hit.point.z,z:hit.point.y,normal:{x:nx,y:ny,z:n.y},placedBlock:b.object,objectId:b.id}}return{ground:!!hit.object.userData.earth,x:hit.object.userData.earth&&Math.abs(n.x)>.5?Math.round(hit.point.x):hit.point.x,y:hit.object.userData.earth&&Math.abs(n.z)>.5?Math.round(hit.point.z):hit.point.z,z:hit.point.y,normal:{x:Math.round(n.x),y:Math.round(n.z),z:Math.round(n.y)},block:b?{x:b.x,y:b.y,z:b.z}:null,adjacent:b?{x:b.x+Math.round(n.x),y:b.y+Math.round(n.z),z:n.y>0?b.z+(b.h||1):n.y<0?b.z-(last.blockHeight||1):b.z}:null}}let groundHit=!last.map?.editLevel&&surfaceHit;let p=groundHit?.point||ray.ray.intersectPlane(floorPlane,new T.Vector3());return p&&(!camera.isPerspectiveCamera||p.distanceTo(camera.position)<180)&&W.activeCell(last.map,p.x,p.z)?{x:p.x,y:p.z,z:p.y,ground:true,adjacent:{x:Math.floor(p.x),y:Math.floor(p.z),z:p.y}}:{x:-1,y:-1}}
 function paintLabels(opts,dpr){
  const hidden=!['fly','third','first'].includes(opts.map.camera.mode)||opts.building;if(overlayCanvas.hidden!==hidden)overlayCanvas.hidden=hidden;if(hidden)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);const placed=[];
  for(const o of [...opts.map.objects].sort((a,b)=>(b.id===opts.selection)-(a.id===opts.selection))){
   const root=cache.get(o.id)?.root,p=W.center(o),active=o.id===opts.selection,bars=W.displayBars(o),name=opts.showNames&&(active||W.character(o));
   if(o.labelMode==='hidden'||o.labelMode==='selected'&&!active)continue;
   if(!root?.visible||root.userData.alpha<.14||(!name&&!bars.length)||opts.mode!=='mj'&&(opts.map.camera.mode==='first'?!firstPersonVisible(o,opts):(W.character(o)?strength(o,opts)<.55:(opts.sight?.get(W.cellKey(p.x,p.y))?.detail??0)<.55)))continue;
   const point=new T.Vector3(p.x,W.elevation(o,opts.map)+.12,p.y).project(camera);if(point.z< -1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1)continue;
   // Screen-space scale comes from the projected body, not a fixed nameplate.
   const top=new T.Vector3(p.x,W.elevation(o,opts.map)+W.eyeHeight(o)*1.15,p.y).project(camera),size=Math.abs(top.y-point.y)*height/2;
   if(size<9&&!active)continue;
   const shown=opts.mode==='mj'?(active?bars.slice(0,1):[]):bars.slice(0,active?2:1),extra=0;
   const font=Math.max(9,Math.min(12,size*.16)),label=String(o.name||'');
   ctx.font='600 '+font+'px system-ui';const w=Math.min(width-12,Math.max(32,Math.min(112,ctx.measureText(label).width+14,size*1.8+20))),h=font+5+shown.length*6;
   const x=Math.max(6,Math.min(width-w-6,(point.x+1)*width/2-w/2)),y=Math.max(6,Math.min(height-h-6,(1-point.y)*height/2+12));
   if(!active&&placed.some(r=>x<r.x+r.w+5&&x+w+5>r.x&&y<r.y+r.h+5&&y+h+5>r.y))continue;
   placed.push({x,y,w,h});ctx.save();ctx.textBaseline='middle';ctx.textAlign='center';ctx.font='600 '+font+'px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#081311cc';ctx.fillStyle=active?'#f1d795':'#eeeade';if(name){ctx.strokeText(label,x+w/2,y+font/2,w);ctx.fillText(label,x+w/2,y+font/2,w)}let by=y+font+3;for(const bar of shown){ctx.fillStyle='#081311cc';ctx.fillRect(x,by,w,4);ctx.fillStyle=bar.color;ctx.fillRect(x,by,w*bar.value/bar.max,3);by+=6}ctx.restore();continue;

  }
 }

 function render(opts){last=opts;frame++;let rect=canvas.getBoundingClientRect(),dpr=Math.min(globalThis.devicePixelRatio||1,Math.max(.75,Math.min(1.5,Number(opts.map.renderSettings?.pixelRatio)||1.5)));width=rect.width;height=rect.height;if(!width||!height)return;let map=opts.map;surfaces.setQuality(map.renderSettings?.surface||'detail');if(activeMapId!==map.id){spriteResidency.reset();for(let {root}of cache.values()){objects.remove(root);disposeModel(root)}cache.clear();for(let entry of fxCache.values()){effectsLayer.remove(entry.fx.group);entry.fx.dispose()}fxCache.clear();if(ghost){objects.remove(ghost);disposeModel(ghost);ghost=null;ghostKey=''}for(let texture of textures.values())texture.dispose();textures.clear();terrainKey='';activeMapId=map.id;}let scale=Math.max(8,Math.min((width-250)/(map.width+map.height),(height-140)/((map.width+map.height)*.5)))*(map.camera.zoom||1);view={cx:map.width/2,cy:map.height/2,ox:width/2+map.camera.panX,oy:height/2+30+map.camera.panY,scale,angle:map.camera.angle,tilt:map.camera.tilt};if(opts.showExtensions&&opts.mode==='mj'&&Math.max(map.width,map.height)<=128){let regions=W.extensionRegions(map),w=Math.max(map.width,...regions.map(r=>r.x+r.w)),h=Math.max(map.height,...regions.map(r=>r.y+r.h));view.cx=w/2;view.cy=h/2;view.ox=width/2;view.oy=height/2;view.scale=Math.max(.1,Math.min((width-160)/(w+h),(height-180)/((w+h)*Math.max(.35,map.camera.tilt))))}const followed=map.objects.find(o=>o.id===(map.camera.followId||opts.selection)&&W.character(o));
 const cameraPose=map.camera.mode!=='fly'&&followed?[followed.id,followed.x,followed.y,followed.w,followed.d,W.elevation(followed,map),W.eyeHeight(followed)]:null;
 let nextCameraKey=JSON.stringify([map.camera,width,height,opts.terrainEpoch,map.blockRevision,map.buildRevision,opts.mode,opts.selection,cameraPose]);if(nextCameraKey!==cameraKey||cameraMap!==map){cameraKey=nextCameraKey;cameraMap=map;camera=(['first','third','fly'].includes(map.camera.mode)?perspectiveCamera(map,followed,width,height,{liquids:map.camera.mode==='third'?liquidCache(map,W,opts.mode):null}):null)||createTacticalCamera(view,width,height);}bufferSizer.sync(gpu,overlayCanvas,width,height,dpr);
 let viewer=followed||opts.observers?.[0];cutUniforms.blockCutEnabled.value=opts.cutaway&&!opts.building&&viewer&&(map.camera.mode!=='fly'||opts.mode!=='mj')?1:0;if(viewer){let c=W.center(viewer);cutUniforms.blockCutOrigin.value.set(c.x,W.elevation(viewer,map)+.9,c.y);cutUniforms.blockCutDirection.value.copy(camera.position).sub(cutUniforms.blockCutOrigin.value);cutUniforms.blockCutDistance.value=cutUniforms.blockCutDirection.value.length();cutUniforms.blockCutDirection.value.normalize()}cutUniforms.blockPlayerView.value=opts.mode==='mj'?0:1;cutUniforms.blockViewEye.value=viewer?W.elevation(viewer,map)+W.eyeHeight(viewer):Math.max(...(opts.observers||[]).map(o=>W.elevation(o,map)+W.eyeHeight(o)),0);cutUniforms.blockCutRadius.value=map.blockLighting?.cutRadius??1.8;cutUniforms.blockCutOpacity.value=map.blockLighting?.cutOpacity??.12;renderRegion=camera.isPerspectiveCamera?createRenderRegion(camera,map):null;updateTerrain(opts);updateOcclusion(opts);updateRelief(opts);for(let mesh of reliefGroup.children)if(mesh.userData.cutOverlay)mesh.visible=!!cutUniforms.blockCutEnabled.value;for(let[k,m]of blockMaterials){let def=W.BLOCKS[k],power=def.emissive&&map.blockLighting?.enabled!==false?(map.blockLighting?.glow??1.2):0;m.side.emissiveIntensity=m.top.emissiveIntensity=m.fadeSide.emissiveIntensity=m.fadeTop.emissiveIntensity=power;}let ids=new Set();for(let o of map.objects){if(o.type==='block'&&!opts.images.get(o.imageId)&&!o.effect?.kind&&!o.aura?.enabled||o.type==='block'&&isLiquid(o.material))continue;if(occlusion.hiddenObjects.has(o.id))continue;if(renderRegion&&!renderRegion.object(o))continue;ids.add(o.id);let key=modelKey(o,map,opts.images),item=cache.get(o.id);if(!item||item.key!==key){if(item){objects.remove(item.root);disposeModel(item.root)}item={key,root:makeObject(o,map,opts.images),transform:''};cache.set(o.id,item);objects.add(item.root);shadowDirty=true}let transform=[o.x,o.y,W.elevation(o,map),o.facing,o.visible,o.opacity,map.groups.find(g=>g.id===o.group)?.visible].join('|');if(transform!==item.transform){if(!(['first','third'].includes(map.camera.mode)&&o.id===map.camera.followId))shadowDirty=true;item.transform=transform}updateObject(item.root,o,opts)}for(let[id,item]of cache)if(!ids.has(id)){objects.remove(item.root);disposeModel(item.root);cache.delete(id);shadowDirty=true}
 if(opts.brush?.object&&opts.mode==='mj'){let o=opts.brush.object,key=modelKey(o,map,opts.images);if(!ghost||ghostKey!==key){if(ghost){objects.remove(ghost);disposeModel(ghost)}ghost=makeObject(o,map,opts.images,true);ghost.userData.ghost=true;ghostKey=key;objects.add(ghost)}updateObject(ghost,o,opts,true)}else if(ghost){objects.remove(ghost);disposeModel(ghost);ghost=null;ghostKey=''}
 const previewParts=opts.mode==='mj'?(opts.brush?.companions||[]):[],previewIds=new Set();for(let i=0;i<previewParts.length;i++){let o=previewParts[i],key=modelKey(o,map,opts.images),entry=ghostExtras.get(i);previewIds.add(i);if(!entry||entry.key!==key){if(entry){objects.remove(entry.root);disposeModel(entry.root)}entry={key,root:makeObject(o,map,opts.images,true)};ghostExtras.set(i,entry);objects.add(entry.root)}updateObject(entry.root,o,opts,true)}for(const[id,entry]of ghostExtras)if(!previewIds.has(id)){objects.remove(entry.root);disposeModel(entry.root);ghostExtras.delete(id)}
 hemi.intensity=Math.max(.5,map.lighting.ambient*2.2);sun.intensity=Math.max(.22,map.lighting.ambient)*1.55;let angle=map.lighting.sunAngle||0,anchor=lightingAnchor(map,camera);sun.color.set('#ffedcc');sun.position.set(anchor.x-Math.cos(angle)*12,18,anchor.y-Math.sin(angle)*12);sun.target.position.set(anchor.x,0,anchor.y);fill.position.set(anchor.x+Math.cos(angle)*10,10,anchor.y+Math.sin(angle)*10);fill.target.position.set(anchor.x,0,anchor.y);fill.intensity=.24+Math.max(0,map.lighting.ambient-.18)*.55;sun.shadow.radius=map.blockLighting?.softness??2;sun.shadow.normalBias=.025;sun.shadow.bias=-.0002;let quality=map.blockLighting?.quality===1?1024:2048;if(sun.shadow.mapSize.x!==quality){sun.shadow.mapSize.set(quality,quality);sun.shadow.map?.dispose();sun.shadow.map=null;shadowDirty=true}sun.shadow.intensity=W.clamp(map.lighting.sunPower??.45,0,1);let radius=Math.min(45,Math.max(16,map.width,map.height)/2);Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.1,far:90});sun.shadow.camera.updateProjectionMatrix();sun.castShadow=map.lighting.shadows!==false;
 let env=environmentSettings(map),cloudAngle=angle;if(env.enabled&&env.syncLight){let l=environmentLight(env);hemi.intensity=.32+l.ambient*1.5;sun.intensity=l.sun*1.73;sun.color.copy(l.color);const solar=new T.Vector3(Math.cos(l.angle),Math.sin(l.angle),-.25).normalize();sun.position.set(anchor.x+solar.x*48,solar.y*48,anchor.y+solar.z*48);sun.castShadow=map.lighting.shadows!==false&&l.sun>.02;fill.intensity=.20+l.ambient*.65;cloudAngle=l.angle;}fogUniforms.cloudShadowEnabled.value=env.enabled&&env.quality!=='off'&&env.cloudShadows!==false?1:0;fogUniforms.cloudShadowStrength.value=Math.sqrt(Math.max(0,env.cloudShadowStrength??.42))*.7*(env.weather==='rain'?.85:1)*Math.min(1,environmentLight(env).sun*3);fogUniforms.cloudCoverage.value=env.clouds??.45;fogUniforms.cloudWind.value=env.wind??.25;fogUniforms.cloudDirection.value.set(Math.cos(cloudAngle+.85),Math.sin(cloudAngle+.85)).normalize();let objectById=new Map(map.objects.map(o=>[o.id,o]));
 const useShadows=map.lighting.shadows!==false,tacticalMotion=map.camera.mode==='third'&&opts.mode!=='mj'&&opts.pathMoving,budget=pointShadowBudget(useShadows,map.blockLighting?.quality);
 // The controlled actor's light uses the live transform, not the cached
 // tactical light map. No moving cube-shadow render on every frame.
 const carrier=opts.mode!=='mj'?viewer:null,cp=carrier?W.center(carrier):null;
 const carried=carrier?makeCarriedSource(carrier.light,carrier.id,{x:cp.x,y:cp.y,z:W.elevation(carrier,map)+Math.min(W.eyeHeight(carrier),map.camera.firstEye??Infinity)*.88},carrier.facing||0):null;
 carriedPoint.intensity=0;carriedSpot.intensity=0;
 if(carried){const l=carried.kind==='flashlight'?carriedSpot:carriedPoint;l.position.set(carried.x,carried.z,carried.y);l.color.set(carried.color);l.distance=carried.radius;l.intensity=carried.power*12;
 if(l===carriedSpot){l.angle=carried.angle*Math.PI/360;const direction=map.camera.mode==='first'?camera.getWorldDirection(new T.Vector3()):new T.Vector3(Math.sin(carried.heading),-.12,-Math.cos(carried.heading)).normalize();l.target.position.copy(l.position).addScaledVector(direction,carried.radius);}}
 const sources=selectLocalLights((opts.lights?.sources||[]).filter(s=>!carrier||s.owner!==carrier.id),anchor,opts.mode!=='mj'&&viewer?W.center(viewer):{x:camera.position.x,y:camera.position.z},localLights,budget);localLights=sources;
 pointLights.forEach((l,i)=>{
  const source=sources[i],oldCast=l.castShadow;
  l.intensity=source?source.power*12:0;
  if(source&&objectById.get(source.owner)?.effect?.kind==='fire'){const t=(globalThis.performance?.now?.()||Date.now())/1000;l.intensity*=.9+.07*Math.sin(t*7)+.03*Math.sin(t*13)}
  l.castShadow=!!source&&useShadows;
  if(source){
   l.color.set(source.color);l.distance=source.radius;
   l.position.set(source.x,source.z??((map.editLevel||0)*(map.levelHeight||W.LEVEL_HEIGHT)+.85),source.y);
  }
  const k=l.castShadow?JSON.stringify([map.id,source.owner,l.position.toArray(),l.distance]):'';
  l.shadow.bias=-.00025;l.shadow.normalBias=.012;l.shadow.radius=map.blockLighting?.softness??2;
  if(k!==l.userData.shadowKey||oldCast!==l.castShadow){
   l.userData.shadowKey=k;
   if(l.castShadow){l.shadow.camera.near=.05;l.shadow.camera.far=Math.max(.1,l.distance||8);l.shadow.camera.updateProjectionMatrix();l.shadow.needsUpdate=true;gpu.shadowMap.needsUpdate=true}
  }
 });
 let lk=JSON.stringify([map.id,sun.position.toArray(),sun.target.position.toArray(),sun.castShadow,radius,map.blockLighting?.softness,map.blockLighting?.quality]);
 if(lk!==lightKey){lightKey=lk;if(sun.castShadow){sun.shadow.needsUpdate=true;gpu.shadowMap.needsUpdate=true}}
 let effectTime=(globalThis.performance?.now?.()||Date.now())/1000;fogUniforms.cloudTime.value=effectTime;animations=environment.update(map,camera,effectTime)||liquidCount>0;let activeFx=new Set();for(let o of map.objects){if(map.effectsVisible===false||renderRegion&&!renderRegion.object(o))continue;let item=cache.get(o.id),effect=map.effectsVisible===false||o.effect?.muted?null:o.effect;let ambient=effect&&W.AMBIENT_FX.has(effect.kind),alpha=ambient?ambientStrength(o,opts)*(o.opacity??1):item?.root.userData.alpha;if((!item?.root.visible&&!ambient)||alpha<.02||o.visible===false||map.groups.find(g=>g.id===o.group)?.visible===false||W.levelOf(o)!==(map.editLevel||0)||(!effect?.kind&&!o.aura?.enabled))continue;let p=W.center(o),at=screen(p.x,p.y,W.elevation(o,map));let margin=150+Math.min(600,(effect?.size||o.aura?.radius||1)*45);if(at.x< -margin||at.x>width+margin||at.y< -margin||at.y>height+margin)continue;activeFx.add(o.id);let quality=map.renderSettings?.effects||'balanced',key=JSON.stringify([effect,o.aura,o.height,o.scale,quality]),entry=fxCache.get(o.id);if(!entry||entry.key!==key){if(entry){effectsLayer.remove(entry.fx.group);entry.fx.dispose()}entry={key,fx:fxFactory.build(effect?{...effect,quality}:effect,o.aura,o)};fxCache.set(o.id,entry);effectsLayer.add(entry.fx.group)}entry.fx.group.position.set(p.x,W.elevation(o,map),p.y);entry.lastSeen=effectTime;entry.fx.group.visible=true;entry.fx.update(effectTime,camera,alpha);animations=true}if(map.effectsVisible!==false)for(let effect of map.effects||[]){let alpha=effectEnvelope(effect),id='layer:'+effect.id;if(renderRegion&&!renderRegion.contains(effect.x,effect.y,effect.size||1)||effect.visible===false||alpha<=0||effect.level!==(map.editLevel||0)||!W.activeCell(map,Math.floor(effect.x),Math.floor(effect.y)))continue;const proxy={x:effect.x-.5,y:effect.y-.5,w:1,d:1,level:effect.level};alpha*=W.AMBIENT_FX.has(effect.kind)?ambientStrength(proxy,opts):strength(proxy,opts);if(opts.mode!=='mj'&&map.fog.includes(W.cellKey(effect.x,effect.y)))alpha=0;if(alpha<.02)continue;let at=screen(effect.x,effect.y,W.elevation(proxy,map));if(at.x<-200||at.x>width+200||at.y<-300||at.y>height+300)continue;activeFx.add(id);let quality=map.renderSettings?.effects||'balanced',key=JSON.stringify([effect.kind,effect.size,effect.speed,effect.density,effect.color,quality]),entry=fxCache.get(id);if(!entry||entry.key!==key){if(entry){effectsLayer.remove(entry.fx.group);entry.fx.dispose()}entry={key,fx:fxFactory.build({...effect,quality},null)};fxCache.set(id,entry);effectsLayer.add(entry.fx.group)}entry.fx.group.position.set(effect.x,W.elevation(proxy,map),effect.y);entry.lastSeen=effectTime;entry.fx.group.visible=true;entry.fx.update(effectTime,camera,alpha);animations=true;}for(let[id,entry]of fxCache)if(!activeFx.has(id)){entry.fx.group.visible=false;let source=id.startsWith('layer:')?map.effects?.find(e=>'layer:'+e.id===id):objectById.get(id);if(map.effectsVisible===false||!source||(source.endsAt&&source.endsAt<=Date.now())||W.levelOf(source)!==(map.editLevel||0)||effectTime-(entry.lastSeen??0)>30||fxCache.size>128){effectsLayer.remove(entry.fx.group);entry.fx.dispose();fxCache.delete(id)}}if(thrownVisuals.update(renderableImpacts(opts),effectTime,camera,map.renderSettings?.effects||'balanced'))animations=true;
 if(shadowDirty&&(!['first','third'].includes(map.camera.mode)||!lastShadowRefresh||performance.now()-lastShadowRefresh>=(tacticalMotion?250:100))){lastShadowRefresh=performance.now();if(sun.castShadow)sun.shadow.needsUpdate=true;for(const l of pointLights)if(l.castShadow)l.shadow.needsUpdate=true;gpu.shadowMap.needsUpdate=true;shadowDirty=false}if(gpu.shadowMap.needsUpdate)shadowUpdates++;drawOverlays(opts);updateSightOutline(opts);groundMarkers.update({...opts,viewportWidth:width},cache,camera);/* WebGLRenderer.render already updates scene world matrices. */thrownVisuals.render(gpu,scene,camera);paintLabels(opts,dpr);
 spriteResidency.prepare(map,map.objects.filter(W.character),opts.images);const usedImages=new Set([...cache.values()].map(({root})=>root.userData.image).filter(Boolean));for(const o of [...map.objects,...(opts.brush?.object?[opts.brush.object]:[]),...(opts.brush?.companions||[])]){const im=opts.images.get(sceneImage(o))||opts.images.get(o.imageId);if(im)usedImages.add(im)}spriteResidency.trim(usedImages);spriteResidency.schedule();
 }
 function pick(x,y,types,frontmost=false,maxDistance=Infinity){if(!camera)return null;pointer.set(x/width*2-1,1-y/height*2);ray.setFromCamera(pointer,camera);const front=frontmost?ray.intersectObjects([...reliefGroup.children.filter(m=>m.visible&&!m.userData.cutOverlay&&!m.userData.liquidSource&&!m.userData.liquidSurface),...terrainGroup.children.filter(m=>m.visible)],false).find(hit=>hit.object.userData.groundChunk||solidHit(hit)):null;let roots=[...cache.values()].map(i=>i.root).filter(r=>r.visible&&(r.userData.alpha>=.3||r.userData.object.id===last.selection));for(let hit of ray.intersectObjects(roots,true)){if(hit.distance>maxDistance||front&&hit.distance>front.distance+.01)break;let child=hit.object,id=child.userData.objectId;if(W.levelOf(cache.get(id)?.root.userData.object)!==(last.map.editLevel||0)&&child.userData.type!=='stairs')continue;if(!child.userData.pickable||!id||types&&!types.includes(child.userData.type))continue;let item=cache.get(id),o=item.root.userData.object,p=W.center(o);if(last.mode!=='mj'&&(last.sight?.get(W.cellKey(p.x,p.y))?.detail??1)<.4)continue;let im=item.root.userData.image;if(im?.pixels&&hit.uv){let u=W.clamp((!W.character(o)&& (!!o.flip !== !!(o.tokenFixed&&!o.flat&&tokenBack(o))))?1-hit.uv.x:hit.uv.x,0,.999),v=W.clamp(1-hit.uv.y,0,.999),index=(Math.floor(v*im.height)*im.width+Math.floor(u*im.width))*4+3;if(im.pixels[index]<18)continue}return id}let p=world(x,y);if(!Number.isFinite(p.z)||Math.hypot(p.x-camera.position.x,p.y-camera.position.z,p.z-camera.position.y)>maxDistance)return null;if(p.objectId&&(!types||types.includes('block')))return p.objectId;return last.map.objects.filter(o=>o.type.startsWith('fx_')&&W.levelOf(o)===(last.map.editLevel||0)&&cache.get(o.id)?.root.visible).reverse().find(o=>{let b=W.bounds(o);return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h})?.id||null}
 return{render,pick,world,screen,interactionRay,stats:()=>({triangles:gpu.info?.render?.triangles??0,calls:gpu.info?.render?.calls??0,shadowUpdates,pointShadows:pointLights.filter(l=>l.castShadow).length,...bufferSizer.stats(),...spriteResidency.stats(),terrainBuilds,terrainReuses,terrainChunks:terrainChunks.size,residentChunks:renderRegion?.chunks.size??0,groundPlanes,groundCells:terrain?.count||0}),clipFlyMovement:(map,from,to)=>sweepCameraMotion(map,from,to,liquidCache(map,W,'mj')),hasAnimation:()=>animations,view:()=>view,debug:()=>({scene,camera,environment,renderRegion,terrainChunks,groundBatch,occlusion,assetLibrary,cache,groundMarkers,fxCache,effectsLayer,thrownVisuals,reliefGroup,overlays,ghost,gpu,terrain,sightTexture,cutUniforms,pointLights,surfaces,liquidCount}),dispose(){spriteResidency.dispose();environment.dispose();assetLibrary.dispose();groundMarkers.dispose();proxyGeometry.dispose();contactTexture.dispose();clearRelief();liquidPickMaterial.dispose();for(const m of liquidMaterials.values())m.dispose();blockGeo.dispose();for(const g of faceGeometries.values())g.dispose();for(let m of blockMaterials.values())for(let material of new Set([...m.mats,...m.fadeMats]))material.dispose();surfaces.dispose();for(let entry of fxCache.values()){entry.fx.dispose()}thrownVisuals.dispose();fxFactory.dispose();for(let {root}of cache.values())disposeModel(root);if(ghost)disposeModel(ghost);for(let entry of ghostExtras.values())disposeModel(entry.root);clearOverlays();clearSightOutline();sightTexture?.dispose();floorGeo.dispose();terrainGeo.dispose();floorMaterial.dispose();for(let t of tokenTextures.values())t.dispose();for(let t of textures.values())t.dispose();if(groundBatch){groundBatch.geometry.dispose();groundBatch.dispose()}terrainChunks.clear();gpu.dispose();overlayCanvas.remove?.()}};
}

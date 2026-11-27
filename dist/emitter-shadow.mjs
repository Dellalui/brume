import * as T from './vendor/three.module.min.js';

// A luminous opaque cube casts shadows from other lights and the sun,
// but must not occlude the point light inside itself. The shadow pass
// tests that light against each instance's actual oriented bounds.
export function injectEmitterShadow(shader,half){
 shader.uniforms.brumeEmitterHalf={value:half};
 shader.vertexShader='uniform vec3 referencePosition;\nuniform vec3 brumeEmitterHalf;\nvarying float brumeSelfEmitter;\n'+shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
mat4 emitterTransform = modelMatrix;
#ifdef USE_INSTANCING
 emitterTransform = modelMatrix * instanceMatrix;
#endif
vec3 emitterDelta = referencePosition-emitterTransform[3].xyz;
vec3 ea=emitterTransform[0].xyz, eb=emitterTransform[1].xyz, ec=emitterTransform[2].xyz;
vec3 emitterLocal=vec3(dot(emitterDelta,ea)/max(dot(ea,ea),0.000001),dot(emitterDelta,eb)/max(dot(eb,eb),0.000001),dot(emitterDelta,ec)/max(dot(ec,ec),0.000001));
brumeSelfEmitter = all(lessThan(abs(emitterLocal),brumeEmitterHalf-vec3(0.00001))) ? 1.0 : 0.0;`);
 shader.fragmentShader='varying float brumeSelfEmitter;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(brumeSelfEmitter>0.5) discard;');
}
export function createEmitterShadowMaterials(){
 const cache=new Map();
 function get(w=1,h=1,d=1){
  const key=[w,h,d].join(',');
  if(cache.has(key))return cache.get(key);
  const material=new T.MeshDistanceMaterial(),half=new T.Vector3(w/2,h/2,d/2);
  material.onBeforeCompile=shader=>injectEmitterShadow(shader,half);
  material.customProgramCacheKey=()=> 'brume-emitter-distance-v1';
  cache.set(key,material);return material;
 }
 return {get,dispose(){for(const m of cache.values())m.dispose();cache.clear()}};
}

// Both procedural shaders are world-space and share the existing tactical noise.
export const liquidVertexHeader=`
attribute vec3 liquidColorA;
attribute vec3 liquidColorB;
attribute vec3 liquidStyleParams;
varying vec3 vLiquidA;
varying vec3 vLiquidB;
varying vec3 vLiquidParams;
varying float liquidY;
`;
export const liquidFragmentHeader=`
uniform float liquidTime;
varying vec3 vLiquidA;
varying vec3 vLiquidB;
varying vec3 vLiquidParams;
varying float liquidY;
`;
export const liquidVertexAssign=`
liquidY=(modelMatrix*tacticalP).y;
vLiquidA=liquidColorA;
vLiquidB=liquidColorB;
vLiquidParams=liquidStyleParams;
`;
export function liquidColorShader(water){
 return `
float surfaceFacing=smoothstep(.15,.82,abs(normalize(tacticalFaceNormal).y));
float liquidT=liquidTime*vLiquidParams.y;
vec2 horizontal=tacticalWorld-vec2(.21,.12)*liquidT;
vec2 vertical=vec2(tacticalWorld.x*.83+tacticalWorld.y*.67,liquidY+liquidT*.8);
vec2 liquidUV=mix(vertical,horizontal,surfaceFacing);
vec2 liquidWarp=vec2(sin(liquidUV.y*2.1+liquidUV.x*.8),cos(liquidUV.x*1.8-liquidUV.y*.7))*.23;
float liquidBroad=tacticalNoise((liquidUV+liquidWarp)*1.1);
float liquidDetail=tacticalNoise(liquidUV*3.1+vec2(liquidBroad*2.5,liquidBroad*1.8));
float liquidPattern=.68*liquidBroad+.32*liquidDetail;
${water?`
 float ripple=sin(liquidUV.x*9.0+liquidUV.y*6.3+liquidDetail*6.0);
 float crest=smoothstep(.76,.98,ripple);
 diffuseColor.rgb=mix(vLiquidB,vLiquidA,smoothstep(.13,.85,liquidPattern));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),crest*.10);
 diffuseColor.a*=vLiquidParams.x;
 float liquidHeat=liquidPattern*.35;
`:`
 // Dark cooling crust with narrow, continuously shifting hot fissures.
 float ridge=abs(liquidPattern-.52);
 float crack=1.0-smoothstep(.028,.16,ridge);
 float molten=smoothstep(.57,.82,liquidPattern);
 float liquidHeat=max(crack*.9,molten);
 diffuseColor.rgb=mix(vLiquidB,vLiquidA,smoothstep(.10,.90,liquidHeat));
`}
 `;
}
export function liquidEmissionShader(water){
 return water?'totalEmissiveRadiance=vLiquidA*vLiquidParams.z*(.15+liquidHeat);':'totalEmissiveRadiance=vLiquidA*vLiquidParams.z*(.06+.94*liquidHeat);';
}

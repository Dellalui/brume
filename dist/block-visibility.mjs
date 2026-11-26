// A whole block uses one opacity, regardless of its triangle or camera-facing side.
export function blockCutAlpha(p,origin,direction,distance,radius,opacity){
 if(p.y<=origin.y-.78||!(radius>0))return 1;
 const x=p.x-origin.x,y=p.y-origin.y,z=p.z-origin.z;
 const t=x*direction.x+y*direction.y+z*direction.z;
 if(t<=0||t>=distance)return 1;
 const r=Math.hypot(x-direction.x*t,y-direction.y*t,z-direction.z*t);
 const u=Math.min(1,Math.max(0,(r/radius-.65)/.35));
 return opacity+(1-opacity)*u*u*(3-2*u);
}
export const blockCutShader=`
float cutAlpha=1.0;
if(blockCutEnabled>0.5 && blockCenter.y>blockCutOrigin.y-0.78){
 vec3 delta=blockCenter-blockCutOrigin;
 float along=dot(delta,blockCutDirection);
 if(along>0.0 && along<blockCutDistance){
  float distanceToView=length(delta-blockCutDirection*along);
  cutAlpha=mix(blockCutOpacity,1.0,smoothstep(blockCutRadius*.65,blockCutRadius,distanceToView));
 }
}
if(blockCutPass<0.5 && cutAlpha<0.999)discard;
if(blockCutPass>0.5 && cutAlpha>=0.999)discard;
`;

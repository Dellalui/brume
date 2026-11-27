import assert from 'node:assert/strict';
import {impactTexturePixels} from '../dist/throw-visuals.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)};
function noise(x,y){const a=Math.floor(x),b=Math.floor(y),u=smooth(0,1,x-a),v=smooth(0,1,y-b);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v}
function reference(kind){
 const n=128,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=(x+.5)/n*2-1,v=(y+.5)/n*2-1,r=Math.hypot(u,v),i=(y*n+x)*4,f=.55*noise(u*3.6+14,v*3.6+8)+.30*noise(u*8+4,v*8+19)+.15*noise(u*17,v*17);
  let red=255,green=255,blue=255,alpha=0;
  if(kind==='fire'){const heat=clamp(1-r*.8+(f-.5)*.68),edge=r+(f-.5)*.46;red=255;green=48+170*smooth(.15,.95,heat);blue=6+138*smooth(.68,1,heat);alpha=(1-smooth(.53,1,edge))*(.7+.3*f)}
  else if(kind==='smoke'){const edge=r+(f-.5)*.48,g=90+165*smooth(.12,.92,f);red=green=blue=g;alpha=(1-smooth(.24,1,edge))*(.38+.62*f)}
  else if(kind==='ring')alpha=smooth(.57,.79,r)*(1-smooth(.82,1,r))*(.62+.38*f);
  else alpha=Math.pow(Math.max(0,1-r),2.6);
  data[i]=red;data[i+1]=green;data[i+2]=blue;data[i+3]=Math.round(255*clamp(alpha));
 }
 return data;
}
for(const kind of ['halo','fire','smoke','ring'])assert.deepEqual(impactTexturePixels(kind),reference(kind),'identical sprite RGBA bytes');
console.log('PASS: cached lattice and noise field produce byte-identical impact textures.');

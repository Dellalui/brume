// Loading scope is independent of character vision: it never reveals hidden information.
export function createRenderRegion(camera,map){
 const chunk=16,origin={x:Math.floor(camera.position.x/chunk)*chunk+8,y:Math.floor(camera.position.z/chunk)*chunk+8},a=Math.round((map.camera.angle||0)/(Math.PI/12))*Math.PI/12;
 const fx=-(Math.cos(a)+Math.sin(a))/Math.SQRT2,fy=-(Math.cos(a)-Math.sin(a))/Math.SQRT2,near=32,far=map.renderSettings?.far??80,cone=Math.cos((map.renderSettings?.cone??110)*Math.PI/360);
 const small=Math.max(map.width,map.height)<=64;
 const contains=(x,y,r=0)=>{if(small)return x+r>=0&&y+r>=0&&x-r<=map.width&&y-r<=map.height;const dx=x-origin.x,dy=y-origin.y,d=Math.hypot(dx,dy);return d<=near+r||d<=far+r&&((dx*fx+dy*fy)/Math.max(d,.001)>=cone-r/Math.max(d,1))};
 let chunks=new Set();for(let cy=small?0:Math.max(0,Math.floor((origin.y-far)/16));cy<=(small?Math.ceil(map.height/16)-1:Math.min(Math.ceil(map.height/16)-1,Math.floor((origin.y+far)/16)));cy++)for(let cx=small?0:Math.max(0,Math.floor((origin.x-far)/16));cx<=(small?Math.ceil(map.width/16)-1:Math.min(Math.ceil(map.width/16)-1,Math.floor((origin.x+far)/16)));cx++)if(contains(cx*16+8,cy*16+8,12))chunks.add(cx+','+cy);
 const cell=(x,y)=>chunks.has(Math.floor(x/16)+','+Math.floor(y/16)),object=o=>{let w=o.w||1,d=o.d||1;return contains(o.x+w/2,o.y+d/2,Math.hypot(w,d)/2+(o.light?.radius||o.effect?.size||0))};
 return{key:small?'whole-map':[...chunks].sort().join(';'),contains,cell,object,origin,chunks,bounds:small?{x0:0,y0:0,x1:map.width,y1:map.height}:{x0:Math.max(0,origin.x-far-16),y0:Math.max(0,origin.y-far-16),x1:Math.min(map.width,origin.x+far+16),y1:Math.min(map.height,origin.y+far+16)}};
}

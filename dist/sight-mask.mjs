export function writeSightMask(data,{x0,y0,width,height,mode,sightDisplay,vision,explored,fog},delta=null){
 let visited=0,changed=false;const x1=x0+width,y1=y0+height,hidden=new Set(fog||[]);
 function write(x,y,key){if(x<x0||x>=x1||y<y0||y>=y1)return;const i=((y-y0)*width+x-x0)*4,vis=mode==='mj'?1:sightDisplay?.get(key)??(vision?.has(key)?1:0),r=Math.round(255*Math.max(vis,explored?.has(key)?.07:0)),g=hidden.has(key)?255:0;visited++;if(data[i]!==r||data[i+1]!==g||data[i+2]!==0||data[i+3]!==255){data[i]=r;data[i+1]=g;data[i+2]=0;data[i+3]=255;changed=true}}
 if(delta!==null){for(const key of delta){const comma=key.indexOf(','),x=Number(key.slice(0,comma)),y=Number(key.slice(comma+1));if(comma>=0&&Number.isInteger(x)&&Number.isInteger(y))write(x,y,key)}}
 else if(mode==='mj'&&!hidden.size){for(let i=0;i<data.length;i+=4){visited++;if(data[i]!==255||data[i+1]||data[i+2]||data[i+3]!==255){data[i]=255;data[i+1]=data[i+2]=0;data[i+3]=255;changed=true}}}
 else for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)write(x,y,x+','+y);
 return {visited,changed};
}
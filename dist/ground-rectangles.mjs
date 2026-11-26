import {activeCell} from './chunk-index.mjs';
// Natural ground is implicit. Merge identical cells within each chunk, while
// preserving every excavation, floor paint, partial edge and inactive chunk.
export function indexGroundEdits(map){
 const index=new Map();
 for(const dict of [map.floor||{},map.ground||{}])for(const key of Object.keys(dict)){
  const [x,y]=key.split(',').map(Number);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=map.width||y>=map.height)continue;
  const chunk=Math.floor(x/16)+','+Math.floor(y/16);if(!index.has(chunk))index.set(chunk,new Set());index.get(chunk).add(key);
 }
 return index;
}
export function groundChunkDescriptor(map,cx,cy,index,previous){
 const x=cx*16,y=cy*16,w=Math.min(16,map.width-x),d=Math.min(16,map.height-y);
 if(w<=0||d<=0||!activeCell(map,x,y))return null;
 const edits=[...(index.get(cx+','+cy)||[])].sort().map(key=>{const [x,y]=key.split(',').map(Number);return [x,y,Math.max(-16,Math.min(0,map.ground?.[key]??0)),map.floor?.[key]||'']}).filter(e=>e[2]!==0||!!e[3]);
 const winter=map.environment?.season==='winter',signature=JSON.stringify([x,y,w,d,map.environment?.season||'',edits]);
 if(previous?.signature===signature)return previous;
 const rects=[],base={height:0,paint:'',type:winter?3:0};
 if(!edits.length)rects.push({...base,x,y,w,d});
 else {
  const values=new Array(w*d).fill(base);
  for(const [px,py,height,paint]of edits)values[(py-y)*w+px-x]={height,paint,type:height<0?2:paint?1:winter?3:0};
  const used=new Uint8Array(w*d),same=(a,b)=>a.height===b.height&&a.type===b.type&&a.paint===b.paint;
  for(let j=0;j<d;j++)for(let i=0;i<w;i++){
   const at=j*w+i;if(used[at])continue;const value=values[at];let rw=1,rd=1;
   while(i+rw<w&&!used[at+rw]&&same(value,values[at+rw]))rw++;
   outer:while(j+rd<d){for(let k=0;k<rw;k++){const p=(j+rd)*w+i+k;if(used[p]||!same(value,values[p]))break outer}rd++}
   for(let yy=j;yy<j+rd;yy++)used.fill(1,yy*w+i,yy*w+i+rw);
   rects.push({...value,x:x+i,y:y+j,w:rw,d:rd});
  }
 }
 return {signature,rects,cells:w*d};
}

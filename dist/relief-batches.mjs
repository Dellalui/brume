const FACE_DIRS=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]];
export function reliefPlan(groups,fullUnits,cutaway,opaque){
 const out=[];
 for(const [kind,cells] of groups){
  const bins=new Map(),split=cells.length>=96;
  for(const b of cells){
   const k=split?Math.floor((b.x+.5)/16)+','+Math.floor((b.y+.5)/16):'all';
   if(!bins.has(k))bins.set(k,[]);bins.get(k).push(b);
  }
  for(const [chunk,list]of bins){
   const prefix=kind+'|'+chunk+'|'+(cutaway?'cut':'solid');
   const mask=b=>{
    if(cutaway||!opaque(kind)||b.h!==1||(b.w??1)!==1||(b.d??1)!==1||Math.abs(b.angle||0)>1e-7||![b.x,b.y,b.z].every(Number.isInteger))return 63;
    let m=0;
    for(let i=0;i<6;i++){const [dx,dy,dz]=FACE_DIRS[i];if(!fullUnits.has((b.x+dx)+','+(b.y+dy)+','+(b.z+dz)))m|=1<<i}
    return m;
   };
   const masks=list.map(mask);
   if(masks.every(m=>m===63)){out.push({key:prefix+'|box',kind,face:null,cells:list});continue}
   for(let face=0;face<6;face++){const visible=list.filter((_,i)=>masks[i]&(1<<face));if(visible.length)out.push({key:prefix+'|'+face,kind,face,cells:visible})}
  }
 }
 return out;
}
export function reliefSignature(cells){
 return JSON.stringify(cells.map(b=>[b.id??null,b.x,b.y,b.z,b.h,b.w??1,b.d??1,b.angle??0]));
}

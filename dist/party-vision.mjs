import * as W from './world.mjs';
// Invalid observers never contribute stale visibility. Cold party calculations
// can be spread over frames; the default remains synchronous for batch callers.
export function createPartyVisionCache(perceive=W.perception){
 let entries=new Map(),mapRef=null,lightRef=null,lightKey='',revision=null,cursor=0;
 return {clear(){entries.clear();cursor=0},collect(map,observers,lights,epoch,{budgetMs=Infinity}={}){
  let changed=false;
  if(lights!==lightRef){const key=JSON.stringify([lights?.sources,lights?.walls,map.lighting]);changed=key!==lightKey;lightKey=key;lightRef=lights}
  if(map!==mapRef||changed||epoch!==revision){entries.clear();mapRef=map;revision=epoch}
  const start=performance.now(),sight=new Map(),allowed=new Set(),vision=new Set(),individual=new Map();let recomputed=0,pending=false;
  const ordered=observers.map((_,i)=>observers[(i+cursor)%observers.length]);
  for(const a of ordered){
   const key=JSON.stringify([Math.round(a.x*4),Math.round(a.y*4),Math.round((a.facing||0)*24/Math.PI),Math.round(W.elevation(a,map)*10),a.w,a.d,W.eyeHeight(a),a.vision]);let entry=entries.get(a.id);
   if(!entry||entry.key!==key){
    entries.delete(a.id);
    if(recomputed>0&&performance.now()-start>=budgetMs){pending=true;continue}
    const tiles=new Map(),p=W.center(a),range=a.vision?.range||12,r=Math.max(a.vision?.near??3.5,Math.max(range,Math.min(96,a.vision?.far??64)));
    for(let x=Math.max(0,Math.floor(p.x-r-1));x<Math.min(map.width,Math.ceil(p.x+r+1));x++)for(let y=Math.max(0,Math.floor(p.y-r-1));y<Math.min(map.height,Math.ceil(p.y+r+1));y++){
     if(Math.hypot(x+.5-p.x,y+.5-p.y)>r+1)continue;
     tiles.set(W.cellKey(x,y),perceive(map,a,x,y,lights));
    }
    entry={key,tiles};entries.set(a.id,entry);recomputed++;cursor=(observers.indexOf(a)+1)%observers.length;
   }
   individual.set(a.id,entry.tiles);
   for(const[k,v]of entry.tiles){if(v.allowed)allowed.add(k);if(v.detail>0||v.haze>0){const old=sight.get(k);sight.set(k,{detail:Math.max(old?.detail||0,v.detail),haze:Math.max(old?.haze||0,v.haze)})}if(v.detail>.25||v.haze>.1)vision.add(k)}
  }
  const ids=new Set(observers.map(a=>a.id));for(const id of entries.keys())if(!ids.has(id))entries.delete(id);
  return{sight,allowed,vision,individual,recomputed,pending};
 }};
}

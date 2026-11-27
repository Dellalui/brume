import * as W from './world.mjs';
// A budget applies inside an observer's scan, not between whole observers.
// Preserve synchronous batch callers, but yield between individual rays in UI.
function visionDomain(map,actor){
 const p=W.center(actor),range=actor.vision?.range||12,r=Math.max(actor.vision?.near??3.5,Math.max(range,Math.min(96,actor.vision?.far??64)))+1;
 const cx=Math.floor(p.x),cy=Math.floor(p.y),limit=Math.ceil(r)+1;
 const cone=(actor.vision?.angle??180)*Math.PI/360,near=(actor.vision?.near??3.5)+.65,heading=actor.facing||0;
 function valid(x,y){if(x<0||y<0||x>=map.width||y>=map.height)return false;const dx=x+.5-p.x,dy=y+.5-p.y,d=Math.hypot(dx,dy);return d<=r&&(d<=near||cone>=Math.PI-.001||Math.abs(W.mod(W.bearing(dx,dy)-heading+Math.PI,W.TAU)-Math.PI)<cone)}
 return {cx,cy,limit,valid};
}
export function* visionCells(map,actor){
 const {cx,cy,limit,valid}=visionDomain(map,actor);
 // Rings give priority to the character's immediate surroundings.
 for(let n=0;n<=limit;n++){
  if(!n){if(valid(cx,cy))yield [cx,cy];continue}
  for(let i=-n;i<=n;i++){if(valid(cx+i,cy-n))yield [cx+i,cy-n];if(valid(cx+i,cy+n))yield [cx+i,cy+n]}
  for(let i=-n+1;i<n;i++){if(valid(cx-n,cy+i))yield [cx-n,cy+i];if(valid(cx+n,cy+i))yield [cx+n,cy+i]}
 }
}
export function createPartyVisionCache(perceive=W.perception,now=()=>performance.now()){
 let entries=new Map(),mapRef=null,lightRef=null,lightKey='',revision=null,cursor=0,aggregate=null;
 return {clear(){entries.clear();cursor=0;aggregate=null},collect(map,observers,lights,epoch,{budgetMs=Infinity,maxRays=Infinity}={}){
  const start=now();let changed=false;
  if(lights!==lightRef){const key=JSON.stringify([lights?.sources,lights?.walls,map.lighting]);changed=key!==lightKey;lightKey=key;lightRef=lights}
  // Topology/level/fog edits discard memory; moving lights invalidate rays only.
  if(map!==mapRef||epoch!==revision){entries.clear();aggregate=null;mapRef=map;revision=epoch}
  else if(changed){for(const e of entries.values())e.key=null;aggregate=null}
  const ids=new Set(observers.map(a=>a.id));for(const id of entries.keys())if(!ids.has(id)){entries.delete(id);aggregate=null}
  for(const a of observers){
   // Match the editor's cell-sized movement key. Snapshot the pose so a
   // partially computed mask cannot mix rays from different positions.
   const key=JSON.stringify([Math.round(a.x),Math.round(a.y),Math.round((a.facing||0)*12/Math.PI),Math.round(W.elevation(a,map)*2),a.w,a.d,W.eyeHeight(a),a.vision]);
   if(entries.get(a.id)?.key!==key){
    const snapshot={...a,vision:{...a.vision}},old=entries.get(a.id);
    // Preserve terrain presentation, never authoritative visibility.
    const display=old?.display||new Map(),{valid}=visionDomain(map,snapshot),fog=new Set(map.fog||[]);
    for(const k of display.keys()){
     const comma=k.indexOf(','),x=Number(k.slice(0,comma)),y=Number(k.slice(comma+1));
     if(!valid(x,y)||fog.has(k))display.delete(k);
    }
    entries.set(a.id,{key,actor:snapshot,tiles:new Map(),display,scan:visionCells(map,snapshot),done:false});aggregate=null;
   }
  }
  let rays=0,recomputed=0,pending=false;
  const ordered=observers.map((_,i)=>observers[(i+cursor)%observers.length]);
  // Round-robin slices keep group vision responsive too.
  while(ordered.some(a=>!entries.get(a.id).done)){
   let stopped=false;
   for(const a of ordered){const entry=entries.get(a.id);if(entry.done)continue;
    if(rays>0&&(rays>=maxRays||now()-start>=budgetMs)){stopped=true;break}
    const next=entry.scan.next();if(next.done){entry.done=true;recomputed++;continue}
    const [x,y]=next.value,k=W.cellKey(x,y),v=perceive(map,entry.actor,x,y,lights);
    entry.tiles.set(k,v);
    // Fresh results replace memory, including negative/occluded rays.
    const brightness=Math.max(v.detail||0,v.haze||0);
    if(v.allowed&&brightness>0)entry.display.set(k,brightness);else entry.display.delete(k);
    rays++;aggregate=null;
    cursor=(observers.indexOf(a)+1)%Math.max(1,observers.length);
   }
   if(stopped)break;
  }
  pending=[...entries.values()].some(e=>!e.done);
  if(!aggregate){
   const sight=new Map(),allowed=new Set(),vision=new Set(),individual=new Map();
   for(const a of observers){const tiles=entries.get(a.id).tiles;individual.set(a.id,tiles);
    for(const[k,v]of tiles){if(v.allowed)allowed.add(k);if(v.detail>0||v.haze>0){const old=sight.get(k);sight.set(k,{detail:Math.max(old?.detail||0,v.detail),haze:Math.max(old?.haze||0,v.haze)})}if(v.detail>.25||v.haze>.1)vision.add(k)}
   }
   const display=observers.length===1?entries.get(observers[0].id).display:new Map();
   if(observers.length>1)for(const a of observers)for(const [k,v]of entries.get(a.id).display)if(v>(display.get(k)||0))display.set(k,v);
   aggregate={sight,allowed,vision,individual,display};
  }
  return{...aggregate,recomputed,pending,rays,ms:now()-start};
 }};
}

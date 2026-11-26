// Keep complete small directional image sets resident, with bounded idle uploads.
const bytes=im=>Math.ceil(Math.max(1,im.width||1)*Math.max(1,im.height||1)*16/3);
export function createSpriteResidency(textures,getTexture,gpu){
 let wanted=new Set(),queue=[],cursor=0,key='',lastMap=null,lastImages=null,handle=null,done=new WeakSet(),uploads=0,evictions=0,stopped=false;
 const idle=globalThis.requestIdleCallback?.bind(globalThis);
 function cancel(){if(handle!==null)globalThis.cancelIdleCallback?.(handle);handle=null}
 function note(t){if(!done.has(t)){done.add(t);uploads++}}
 function prepare(map,actors,images){
  const k=map.buildRevision+'|'+images.size;
  if(map===lastMap&&images===lastImages&&k===key)return;
  cancel();lastMap=map;lastImages=images;key=k;wanted=new Set();let size=0;
  const groups=actors.map(o=>[...new Set([o.imageId,...Object.values(o.frames||{})].map(id=>images.get(id)).filter(Boolean))]).filter(a=>a.length>1).sort((a,b)=>a.length-b.length);
  for(const group of groups){const fresh=group.filter(im=>!wanted.has(im)),cost=fresh.reduce((n,im)=>n+bytes(im),0);if(size+cost>64*1024*1024)continue;fresh.forEach(im=>wanted.add(im));size+=cost}
  queue=[...wanted];cursor=0;
 }
 function schedule(){
  if(stopped||!idle||!gpu.initTexture||handle!==null||cursor>=queue.length)return;
  handle=idle(deadline=>{handle=null;if(stopped)return;if(deadline.timeRemaining()<3){schedule();return}
   while(cursor<queue.length){const im=queue[cursor++];let t=textures.get(im);if(t&&done.has(t))continue;
    if(!t&&[...textures.keys()].reduce((n,x)=>n+bytes(x),0)+bytes(im)>96*1024*1024)continue;
    try{t=getTexture(im);gpu.initTexture(t);note(t)}catch{}break;
   }schedule();
  });
 }
 function trim(current){let size=[...textures.keys()].reduce((n,im)=>n+bytes(im),0);for(const allow of [false,true])for(const [im,t]of textures){if(size<=96*1024*1024)break;if(current.has(im)||!allow&&wanted.has(im))continue;t.dispose();textures.delete(im);size-=bytes(im);evictions++}}
 return {prepare,schedule,trim,note,reset(){cancel();lastMap=null;queue=[];cursor=0;wanted.clear()},dispose(){stopped=true;cancel()},stats:()=>({spriteUploads:uploads,spritePending:queue.length-cursor,spriteEvictions:evictions})};
}

// The list is immutable except for append. Membership is shared by all systems.
const chunkSets=new WeakMap();
export function chunkMembership(chunks){
 let entry=chunkSets.get(chunks);
 if(!entry||entry.size!==chunks.length){entry={size:chunks.length,set:new Set(chunks)};chunkSets.set(chunks,entry)}
 return entry.set;
}
export function activeCell(map,x,y){return x>=0&&y>=0&&x<map.width&&y<map.height&&chunkMembership(map.chunks).has(Math.floor(x/16)+','+Math.floor(y/16))}

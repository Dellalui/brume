import {pathSearch} from './world.mjs';
import {applyPathSync} from './path-sync.mjs';
let generation=0,state=null;
self.onmessage=async({data})=>{
 const current=++generation;if(data.cancel)return;
 try{
  state=applyPathSync(state,data);
  const search=pathSearch(state.map,data.actor,data.destination);let r;
  do{r=search.next();if(!r.done)await new Promise(resolve=>setTimeout(resolve,0));if(current!==generation)return}while(!r.done);
  self.postMessage({id:data.id,revision:data.revision,path:r.value});
 }catch{if(current===generation)self.postMessage({id:data.id,revision:data.revision,path:[],error:true})}
};

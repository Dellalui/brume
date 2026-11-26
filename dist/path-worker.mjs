import {pathSearch} from './world.mjs';
let generation=0;
self.onmessage=async({data})=>{let current=++generation;if(data.cancel)return;let search=pathSearch(data.map,data.actor,data.destination),r;try{do{r=search.next();if(!r.done)await new Promise(resolve=>setTimeout(resolve,0));if(current!==generation)return}while(!r.done);self.postMessage({id:data.id,path:r.value})}catch{self.postMessage({id:data.id,path:[],error:true})}};

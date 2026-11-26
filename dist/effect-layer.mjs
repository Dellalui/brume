import {FX,activeCell,clamp} from './world.mjs';
export function expireEffects(world,now=Date.now()){let count=0;for(const map of world.maps){if(!map.effects?.some(e=>e.endsAt&&e.endsAt<=now))continue;const before=map.effects.length;map.effects=map.effects.filter(e=>!e.endsAt||e.endsAt>now);count+=before-map.effects.length}return count}
export function launchEffect(map,config,point,id,now=Date.now()){
 if(!FX[config.kind]||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!activeCell(map,Math.floor(point.x),Math.floor(point.y)))return{error:'Choisissez une zone active de la carte.'};
 map.effects??=[];map.effects=map.effects.filter(e=>!e.endsAt||e.endsAt>now);if(map.effects.length>=48)return{error:'48 effets maximum par carte. Arrêtez un effet avant d’en ajouter.'};
 const duration=clamp(Number(config.duration)||5,1,300),effect={id,kind:config.kind,x:point.x,y:point.y,level:map.editLevel||0,color:config.color||FX[config.kind].color,size:clamp(Number(config.size)||1,.2,12),speed:clamp(Number(config.speed)||1,.1,3),density:clamp(Number(config.density)||1,.2,3),visible:true,createdAt:now,endsAt:config.permanent?null:now+duration*1000};map.effects.push(effect);return{effect};
}
export function effectEnvelope(e,now=Date.now()){if(e.endsAt&&now>=e.endsAt)return 0;return Math.min(1,Math.max(0,(now-e.createdAt)/180),e.endsAt?Math.max(0,(e.endsAt-now)/500):1)}

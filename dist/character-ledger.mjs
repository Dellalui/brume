// Economic counters have no maximum or automatic game mechanics.
export const MONEY_ICONS=Object.freeze({coin:'Pièce',gem:'Gemme',pouch:'Bourse',token:'Jeton'});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function moneyAmount(value){
 if(value===''||value==null||!Number.isFinite(Number(value)))return null;
 const n=Number(value);if(n<0||n>1e12)return null;return Math.round(n*1000)/1000;
}
export function walletValues(actor,includeHidden=false){
 if(!Array.isArray(actor?.wallet))return [];
 return actor.wallet.filter(b=>b&&typeof b==='object'&&typeof b.id==='string'&&(includeHidden||b.visible!==false)).map(b=>({id:b.id,name:String(b.name||'Monnaie').slice(0,48),value:moneyAmount(b.value)??0,icon:Object.hasOwn(MONEY_ICONS,b.icon)?b.icon:'coin',color:/^#[0-9a-f]{6}$/i.test(b.color)?b.color:'#e2c477',visible:b.visible!==false}));
}
export function monitorConfig(map){
 const data=map?.hudMonitor||{},ids=Array.isArray(data.ids)?[...new Set(data.ids.filter(id=>typeof id==='string'))].slice(0,12):[];
 const axis=(v,d)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,0,1):d;
 return {ids,x:axis(data.x,0),y:axis(data.y,.13),collapsed:!!data.collapsed};
}
export function monitorLayout(w,h,count,config,page=0){
 const width=Math.min(258,Math.max(1,w-20)),capacity=Math.max(1,Math.min(3,Math.floor((h*.54-43)/83))),pages=Math.max(1,Math.ceil(count/capacity)),index=clamp(page,0,pages-1),start=index*capacity,length=Math.min(capacity,Math.max(0,count-start)),height=config.collapsed?37:43+length*83;
 return {x:10+Math.max(0,w-width-20)*config.x,y:10+Math.max(0,h-height-20)*config.y,w:width,h:height,start,length,index,pages};
}
export function monitorPosition(x,y,r,w,h){
 return {x:clamp((x-10)/Math.max(1,w-r.w-20),0,1),y:clamp((y-10)/Math.max(1,h-r.h-20),0,1)};
}
export const formatMoney=value=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(value);

import {formId,isForm,formIconPolygons} from './block-forms.mjs';
import {createCanvasProperties} from './canvas-properties.mjs';
import {monitorLayout,monitorPosition,formatMoney} from './character-ledger.mjs';
import {BODY_PARTS,bodyCondition,conditionColor} from './body-condition.mjs';
import {ARCANE,CATEGORY_SIGILS,arcanePanel,arcaneTile,plate,separator,sigil,texturedCube} from './arcane-theme.mjs';
// Canvas-native menus. Layout, rendering, hit testing and drag/drop share one
// coordinate system; no DOM item buttons, invisible hit targets or grid nodes.
export const HUD_FAMILIES=[
 ['construction','Construction',[['blocks','Blocs'],['doors','Portes'],['schemas','Schémas']]],
 ['nature','Nature',[['trees','Arbres'],['natural-decor','Décors naturels']]],
 ['decor','Décors',[['decor','Tous'],['decor-architecture','Architecture'],['decor-furniture','Mobilier'],['decor-camp','Campement'],['decor-utilities','Utilitaires']]],
 ['game','Jeu',[['actors','Personnages'],['effects','Effets'],['throws','À lancer']]],
 ['workshop','Atelier',[['tools','Outils'],['zone','Zone'],['settings','Réglages']]]
];
export const HUD_CATEGORIES=HUD_FAMILIES.flatMap(f=>f[2]);
export const inventoryFamilyFor=category=>HUD_FAMILIES.find(f=>f[2].some(([id])=>id===category))||HUD_FAMILIES[0];
export const contains=(r,x,y)=>x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h;
export function hitTest(regions,x,y){for(let i=regions.length-1;i>=0;i--)if(contains(regions[i],x,y))return regions[i];return null}
export function hudLayout(w,h){
 const margin=w>=500?48:24,width=Math.min(1080,Math.max(1,w-margin)),x=(w-width)/2;
 const slot=Math.max(1,Math.min(66,Math.floor((w-36)/11))),barW=slot*11+12,barX=(w-barW)/2,barY=Math.max(0,h-slot-42);
 const panel={x,y:16,w:width,h:Math.max(1,barY-74)};
 return{panel,slot,barX,barY,barW}
}
// One geometry source for drawing, hit testing, forms and browser tests.
export function playerBarLayout(w,h){
 const gap=w<420?4:7,pad=10,slot=Math.max(1,Math.min(57,Math.floor((w-40-2*pad-8*gap)/9))),width=9*slot+8*gap+2*pad;
 return{x:(w-width)/2,y:Math.max(0,h-slot-54),w:width,h:slot+2*pad,slot,gap,pad}
}
// Shared responsive geometry keeps health, resources and camera off the slots.
export function playerResourceLayout(w,h,count,page=0){
 const bar=playerBarLayout(w,h),cols=bar.w>=480?3:bar.w>=310?2:1,perPage=cols*2,pages=Math.max(1,Math.ceil(count/perPage)),index=Math.max(0,Math.min(pages-1,page)),start=index*perPage,length=Math.min(perPage,Math.max(0,count-start)),rows=Math.max(1,Math.ceil(length/cols)),height=32+rows*35;
 return{x:bar.x,y:Math.max(8,bar.y-height-9),w:bar.w,h:height,cols,rows,start,length,pages,index};
}
export function playerBodyLayout(w,h,expanded=null){
 const bar=playerBarLayout(w,h),wide=bar.x>=244&&h>=290,open=expanded??wide,width=Math.min(w-20,224),height=open?Math.min(218,Math.max(150,h-24)):29;
 return{x:10,y:wide?Math.max(8,h-height-91):10,w:width,h:height,open,wide};
}
export function inventoryLayout(p,category='blocks'){
 const pad=p.w>=560?22:12,gap=6,cols=p.w>=550?5:3;
 const rows=Math.ceil(HUD_FAMILIES.length/cols),tw=(p.w-2*pad-(cols-1)*gap)/cols,th=p.w>=550?38:29,step=th+gap;
 const tabs=HUD_FAMILIES.map((_,i)=>({x:p.x+pad+(i%cols)*(tw+gap),y:p.y+70+Math.floor(i/cols)*step,w:tw,h:th}));
 const familyTabs=inventoryFamilyFor(category)[2],subCols=Math.min(familyTabs.length,p.w>=550?5:3),subRows=Math.ceil(familyTabs.length/subCols),subW=(p.w-2*pad-(subCols-1)*gap)/subCols,subH=p.w>=550?31:26,subY=p.y+70+rows*step+3;
 const subtabs=familyTabs.map((_,i)=>({x:p.x+pad+(i%subCols)*(subW+gap),y:subY+Math.floor(i/subCols)*(subH+gap),w:subW,h:subH}));
 const top=subY+subRows*(subH+gap)+5,footerY=p.y+p.h-50,extra=category==='schemas'?34:0;
 const fw=category==='blocks'?Math.min(180,p.w*.30):0,search={x:p.x+pad,y:top,w:Math.max(1,p.w-2*pad-(fw?fw+gap:0)),h:36};
 const family={x:search.x+search.w+gap,y:top,w:fw,h:36};
 const grid={x:p.x+pad,y:top+48,w:p.w-2*pad,h:Math.max(0,footerY-top-60-extra)};
 const tileGap=10,n=Math.max(1,Math.floor((grid.w+tileGap-9)/(p.w>=550?128:91))),cw=(grid.w-9-(n-1)*tileGap)/n,ch=p.w>=550?94:85;
 const forms={x:p.x+pad,y:top+36,w:p.w-2*pad,h:Math.max(0,p.y+p.h-top-50)};
 return{pad,tabs,subtabs,top,footerY,extra,search,family,grid,n,cw,ch,tileGap,forms}
}
export function drawFormIcon(ctx,x,y,size,d,shape,imageFor){
 const faces=formIconPolygons(shape),def=d.material||{};
 ctx.save();ctx.translate(x,y);ctx.scale(size/49,size/49);ctx.translate(-32,-26);
 for(const f of faces){const points=f.points.split(' ').map(p=>p.split(',').map(Number));if(points.length<3)continue;
  ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();
  const base=(f.top?def.top:def.side)||d.color||'#81977b';ctx.fillStyle=base;ctx.fill();
  const spec=f.top?d.topTexture:d.sideTexture,img=spec?.url?imageFor(spec.url):null;
  if(img?.complete&&img.naturalWidth){ctx.save();ctx.clip();ctx.globalAlpha=spec.detailOnly?.35:.8;ctx.drawImage(img,8,0,48,52);ctx.restore()}
  ctx.fillStyle='rgba(0,0,0,'+(1-f.shade)+')';ctx.fill();ctx.strokeStyle='#ffffff35';ctx.lineWidth=.65;ctx.stroke();
 }
 ctx.restore();
}
export function mountCanvasHUD(doc,api){
 const viewport=doc.getElementById('viewport'),world=doc.getElementById('map'),win=doc.defaultView,layer=doc.createElement('canvas'),ctx=layer.getContext('2d');
 if(!viewport||!world||!ctx)return null;
 layer.id='canvasInterface';layer.setAttribute('aria-label','Inventaire et menus de construction');viewport.append(layer);doc.body.classList.add('native-canvas-ui');doc.body.classList.add('canvas-camera-dock','canvas-inspector');
 const colors=ARCANE;
 let frame=0,regions=[],cursor={x:-1,y:-1},scroll=0,maxScroll=0,grid=null,lastCategory='',lastQuery='',lastFamily='',searching=false,familyOpen=false,down=null,drag=null,active=true,origin=null,layout=null,bodyExpanded=null,resourcePage=0,playerId=null,walletOpen=false,walletPage=0,monitorPage=0,monitorDrag=null;const monitorBars=new Map();
 const images=new Map(),listeners=[];
 function on(el,name,fn,opts){el.addEventListener(name,fn,opts);listeners.push(()=>el.removeEventListener(name,fn,opts))}
 function schedule(){if(active&&!frame)frame=win.requestAnimationFrame(draw)}
 function box(r,fill,stroke=colors.edge,radius=7){plate(ctx,r,fill,stroke,radius)}
 function panel(r){arcanePanel(ctx,r)}
 function imageFor(url){let img=images.get(url);if(!img){img=new win.Image();img.decoding='async';img.onload=schedule;img.src=url;images.set(url,img)}return img}
 function text(s,x,y,width,size=12,color=colors.fg,align='left',weight=500){if(width<2)return;ctx.font=weight+' '+size+'px '+(size>=13?'Georgia, serif':'system-ui,sans-serif');ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;let v=String(s??'');if(ctx.measureText(v).width>width){while(v.length&&ctx.measureText(v+'…').width>width)v=v.slice(0,-1);v+='…'}ctx.fillText(v,x,y)}
 function region(r,id,run,extra={}){const a={...r,id,run,...extra};regions.push(a);return a}
 function button(r,id,label,run,selected=false,disabled=false){const hover=contains(r,cursor.x,cursor.y);arcaneTile(ctx,r,{selected,hover});const symbol=id.startsWith('category-')?CATEGORY_SIGILS[id.slice(9)]:null;
 if(symbol&&r.w>=120){text(symbol,r.x+20,r.y+r.h/2,22,18,colors.gold,'center',650);text(label,r.x+r.w/2+9,r.y+r.h/2,r.w-42,13,disabled?colors.muted:colors.fg,'center',selected?700:500)}else if(symbol&&r.w>=62){text(symbol,r.x+r.w/2,r.y+r.h*.31,r.w-14,13,colors.gold,'center',650);text(label,r.x+r.w/2,r.y+r.h*.73,r.w-10,10,colors.fg,'center',selected?700:500)}
 else text(label,r.x+r.w/2,r.y+r.h/2,r.w-8,Math.min(13,r.h*.46),disabled?colors.muted:colors.fg,'center',selected?700:500);if(!disabled)region(r,id,run)}
 const properties=createCanvasProperties(doc,viewport,ctx,{region,button,text,schedule,hover:r=>contains(r,cursor.x,cursor.y),close:api.closeProperties,image:imageFor});
 function icon(d,x,y,s){if(d.block){const shape=formId(d.item?.shape);if(isForm(shape)||shape==='legacy-corner'){drawFormIcon(ctx,x,y,s,d,shape,imageFor);return}texturedCube(ctx,x,y,s,d,imageFor);return}if(d.thumbnail){const img=imageFor(d.thumbnail);if(img.complete&&img.naturalWidth){const k=s/Math.max(img.naturalWidth,img.naturalHeight),w=img.naturalWidth*k,h=img.naturalHeight*k;ctx.drawImage(img,x-w/2,y-h/2,w,h);return}}
 const col=d.color||colors.gold;sigil(ctx,x,y,s*.48,col);ctx.save();ctx.shadowColor=col;ctx.shadowBlur=d.item?.kind==='throw'?7:0;text(d.symbol||'◇',x,y,s*1.5,s*.8,col,'center',700);ctx.restore()}
 function itemLabel(d,r){const value=d.name||'',width=r.w-16;ctx.font='500 12px system-ui,sans-serif';const words=value.split(' ');if(ctx.measureText(value).width<=width){text(value,r.x+r.w/2,r.y+r.h-16,width,12,colors.fg,'center');return}let first='',rest=[];for(const word of words){if(!rest.length&&ctx.measureText((first+' '+word).trim()).width<=width)first=(first+' '+word).trim();else rest.push(word)}if(!first){text(value,r.x+r.w/2,r.y+r.h-16,width,12,colors.fg,'center');return}text(first,r.x+r.w/2,r.y+r.h-26,width,12,colors.fg,'center');text(rest.join(' '),r.x+r.w/2,r.y+r.h-12,width,12,colors.fg,'center')}
 function item(r,id,d,run,selected=false,slot=null,clip=null){const hover=contains(r,cursor.x,cursor.y)&&(!clip||contains(clip,cursor.x,cursor.y));arcaneTile(ctx,r,{selected,hover,accent:d.item?.kind==='throw'?d.color:null});icon(d,r.x+r.w/2,r.y+r.h*(slot===null?.35:.53),Math.max(8,Math.min(slot===null?50:37,r.w-14,r.h*.52)));if(slot!==null)text(slot+1,r.x+8,r.y+9,14,10,colors.muted);else itemLabel(d,r);const hit=clip?{x:Math.max(r.x,clip.x),y:Math.max(r.y,clip.y),w:Math.min(r.x+r.w,clip.x+clip.w)-Math.max(r.x,clip.x),h:Math.min(r.y+r.h,clip.y+clip.h)-Math.max(r.y,clip.y)}:r;if(hit.w>0&&hit.h>0)region(hit,id,run,{item:d.item,slot,inventory:slot===null})}
 function drawBar(s,l,w){const {barX:x,barY:y,slot:z,barW}=l;panel({x:x-5,y:y-5,w:barW+10,h:z+10});button({x,y,w:z,h:z},'inventory','E',api.toggle,s.open);
  s.slots.forEach((d,i)=>item({x:x+(i+1)*z+2,y,w:z-3,h:z},'slot-'+i,d,()=>api.slot(i),i===s.active,i));
  button({x:x+z*10+2,y,w:z,h:z},'control','◉',api.control,false,!s.canControl);
  const hoveredSlot=regions.find(r=>r.slot!=null&&contains(r,cursor.x,cursor.y));const name=s.slots[hoveredSlot?.slot??s.active]?.name||'';const plaque={x:w/2-Math.min(150,barW*.25)-38,y:y-30,w:Math.min(300,barW*.5),h:24};arcaneTile(ctx,plaque,{selected:true});text(name,plaque.x+plaque.w/2,y-18,plaque.w-16,14,colors.fg,'center',650);button({x:x+barW-91,y:y-31,w:91,h:24},'settings','Réglages · R',api.settings);
  text('E : inventaire   ·   1–9 : raccourcis   ·   R : réglages   ·   Alt + molette : forme',w/2,y+z+17,w-12,10,colors.muted,'center')
 }
 function drawPlayerResources(s,w,h){
  const bars=s.player.bars||[],r=playerResourceLayout(w,h,bars.length,resourcePage);resourcePage=r.index;
  panel(r);region(r,'player-resources',()=>{});separator(ctx,r.x+12,r.y+26,r.w-24);
  const walletW=70,offset=r.pages>1?100:8;
  text('◇  '+(s.player.name||'Personnage'),r.x+14,r.y+15,Math.max(24,r.w-offset-walletW-26),15,colors.gold,'left',700);
  button({x:r.x+r.w-offset-walletW,y:r.y+4,w:walletW,h:23},'wallet-toggle','Bourse',()=>{walletOpen=!walletOpen;walletPage=0},walletOpen);
  if(r.pages>1){button({x:r.x+r.w-92,y:r.y+5,w:25,h:21},'resources-prev','‹',()=>{resourcePage=Math.max(0,resourcePage-1)},false,r.index===0);
   text((r.index+1)+'/'+r.pages,r.x+r.w-48,r.y+15,36,10,colors.muted,'center');
   button({x:r.x+r.w-30,y:r.y+5,w:24,h:21},'resources-next','›',()=>{resourcePage=Math.min(r.pages-1,resourcePage+1)},false,r.index+1===r.pages)}
  const gap=8,cw=(r.w-20-(r.cols-1)*gap)/r.cols;
  bars.slice(r.start,r.start+r.length).forEach((bar,i)=>{
   const x=r.x+10+(i%r.cols)*(cw+gap),y=r.y+29+Math.floor(i/r.cols)*35,value=bar.value+'/'+bar.max;
   ctx.font='500 11px system-ui';const vw=Math.min(cw*.48,ctx.measureText(value).width+5);
   text(bar.name,x+3,y+8,cw-vw-9,11,colors.fg);text(value,x+cw-3,y+8,vw,11,colors.fg,'right');
   box({x,y:y+17,w:cw,h:10},'#0a1717','#685d46',2);
   const fill=Math.max(0,Math.min(1,bar.value/bar.max));ctx.fillStyle=bar.color;ctx.fillRect(x+2,y+19,Math.max(0,(cw-4)*fill),6);
  });
 }
 function drawWallet(s,w,h){
  if(!walletOpen)return;const items=s.player.wallet||[],bar=playerResourceLayout(w,h,s.player.bars.length,resourcePage);
  const width=Math.min(290,w-20),perPage=Math.max(1,Math.min(5,Math.floor((bar.y-67)/32))),pages=Math.max(1,Math.ceil(items.length/perPage));walletPage=Math.min(walletPage,pages-1);
  const list=items.slice(walletPage*perPage,(walletPage+1)*perPage),height=66+Math.max(1,list.length)*32;
  const r={x:Math.max(10,bar.x+bar.w-width),y:Math.max(8,bar.y-height-9),w:width,h:height};panel(r);region(r,'wallet-panel',()=>{});
  text('◇  BOURSE',r.x+12,r.y+16,r.w-60,13,colors.gold,'left',700);button({x:r.x+r.w-35,y:r.y+5,w:26,h:24},'wallet-close','×',()=>{walletOpen=false});separator(ctx,r.x+12,r.y+31,r.w-24);
  if(!list.length)text('Aucune monnaie configurée',r.x+r.w/2,r.y+51,r.w-20,11,colors.muted,'center');
  for(const [i,item]of list.entries()){
   const y=r.y+36+i*32;plate(ctx,{x:r.x+10,y,w:r.w-20,h:28},'#142823',colors.edge,4);
   const glyph={coin:'◉',gem:'◇',pouch:'♧',token:'▣'}[item.icon];text(glyph,r.x+25,y+14,22,17,item.color,'center',700);
   const value=formatMoney(item.value),vw=Math.min(r.w*.45,Math.max(48,ctx.measureText(value).width+12));
   text(item.name,r.x+44,y+14,r.w-58-vw,12,colors.fg);text(value,r.x+r.w-18,y+14,vw,13,item.color,'right',700);
  }
  if(pages>1){const y=r.y+r.h-26;button({x:r.x+10,y,w:40,h:20},'wallet-prev','‹',()=>{walletPage--},false,walletPage===0);text((walletPage+1)+'/'+pages,r.x+r.w/2,y+10,r.w-112,10,colors.muted,'center');button({x:r.x+r.w-50,y,w:40,h:20},'wallet-next','›',()=>{walletPage++},false,walletPage===pages-1)}
 }
 function drawMonitor(s,w,h){
  const data=s.monitor;if(!data)return;const config={...data,...monitorDrag},r=monitorLayout(w,h,data.actors.length,config,monitorPage);monitorPage=r.index;
  if(r.w<100)return;panel(r);region(r,'monitor-panel',()=>{});
  const header={x:r.x+6,y:r.y+4,w:r.w-45,h:28};text('⠿  SUIVI  ·  '+data.actors.length,header.x+6,header.y+14,header.w-12,11,colors.gold,'left',700);region(header,'monitor-drag',()=>{},{monitorDrag:r});
  button({x:r.x+r.w-34,y:r.y+5,w:25,h:25},'monitor-collapse',data.collapsed?'+':'−',api.collapseMonitor);
  if(data.collapsed)return;
  for(const [i,a]of data.actors.slice(r.start,r.start+r.length).entries()){
   const card={x:r.x+7,y:r.y+34+i*83,w:r.w-14,h:78};plate(ctx,card,'#101f1c',colors.edge,5);region(card,'monitor-actor-'+a.id,()=>api.selectMonitored(a.id));
   const im=api.portrait?.(a.imageId)||(a.portrait?imageFor(a.portrait):null),iw=im?.naturalWidth||im?.width,ih=im?.naturalHeight||im?.height,ps=32;
   if(iw&&ih){const k=ps/Math.max(iw,ih);ctx.drawImage(im,card.x+5+(ps-iw*k)/2,card.y+5+(ps-ih*k)/2,iw*k,ih*k)}else{sigil(ctx,card.x+22,card.y+21,13,colors.gold);text(a.name.slice(0,1),card.x+22,card.y+21,22,15,colors.gold,'center',700)}
   text(a.name,card.x+42,card.y+13,card.w-76,12,colors.fg,'left',700);
   button({x:card.x+card.w-25,y:card.y+4,w:21,h:20},'monitor-remove-'+a.id,'×',()=>api.toggleMonitor(a.id));
   const [hp,...other]=a.bars,pages=Math.max(1,Math.ceil(other.length/2)),index=Math.min(pages-1,monitorBars.get(a.id)||0),shown=[hp,...other.slice(index*2,index*2+2)].filter(Boolean);
   shown.forEach((bar,j)=>{const xx=card.x+8,yy=card.y+31+j*14,ww=card.w-16;const value=bar.value+'/'+bar.max; text(bar.name,xx,yy,ww*.41,9,colors.muted);plate(ctx,{x:xx+ww*.43,y:yy-3,w:ww*.27,h:6},'#081513',null,1);ctx.fillStyle=bar.color;ctx.fillRect(xx+ww*.43,yy-3,ww*.27*Math.max(0,Math.min(1,bar.value/bar.max)),6);text(value,xx+ww,yy,ww*.28,9,colors.fg,'right')});
   if(pages>1)button({x:card.x+card.w-49,y:card.y+4,w:21,h:20},'monitor-bars-'+a.id,'›',()=>{monitorBars.set(a.id,(index+1)%pages)});
  }
  if(r.pages>1){const y=r.y+r.h-12;button({x:r.x+8,y:y-8,w:26,h:16},'monitor-prev','‹',()=>{monitorPage--},false,r.index===0);text((r.index+1)+'/'+r.pages,r.x+r.w/2,y,r.w-72,9,colors.muted,'center');button({x:r.x+r.w-34,y:y-8,w:26,h:16},'monitor-next','›',()=>{monitorPage++},false,r.index===r.pages-1)}
 }
 function drawBody(s,w,h){
  const r=playerBodyLayout(w,h,bodyExpanded);if(r.w<85)return;
  panel(r);region(r,'body-panel',()=>{});
  button({x:r.x+5,y:r.y+4,w:r.w-10,h:22},'body-toggle',r.open?'État du corps  ▾':'État du corps  ▸',()=>{bodyExpanded=!r.open},false);
  if(!r.open)return;
  const body=bodyCondition({bodyCondition:s.player.body}),scale=Math.min((r.h-40)/165,(r.w*.44)/86),x=r.x+r.w*.25-43*scale,y=r.y+33;
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  // Original segmented silhouette: left/right are anatomical, viewed from front.
  function shape(id,points){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();const g=ctx.createLinearGradient(0,0,86,165);g.addColorStop(0,conditionColor(body[id]));g.addColorStop(1,'#152724');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle=conditionColor(body[id]);ctx.lineWidth=1.2;ctx.stroke()}
  ctx.beginPath();ctx.ellipse(43,16,11,14,0,0,Math.PI*2);ctx.fillStyle=conditionColor(body.head);ctx.fill();ctx.strokeStyle='#e4c48b';ctx.lineWidth=.9;ctx.stroke();
  shape('torso',[[29,35],[37,32],[49,32],[57,35],[62,61],[53,88],[33,88],[24,61]]);
  shape('rightArm',[[24,36],[15,43],[8,70],[3,91],[11,95],[24,72],[30,47]]);
  shape('leftArm',[[62,36],[71,43],[78,70],[83,91],[75,95],[62,72],[56,47]]);
  shape('rightLeg',[[32,91],[42,91],[40,123],[36,155],[23,155],[23,149],[28,121]]);
  shape('leftLeg',[[44,91],[54,91],[58,121],[63,149],[63,155],[50,155],[46,123]]);
  ctx.restore();
  const listX=r.x+r.w*.50,listW=r.w*.50-12,step=(r.h-44)/6;
  BODY_PARTS.forEach(([id,label],i)=>{const yy=r.y+38+step*i;text(label,listX,yy,listW-35,11,colors.fg);text(body[id]+'%',r.x+r.w-11,yy,36,12,conditionColor(body[id]),'right',700)});
 }
 function drawInteraction(s,w,h){
  const t=s.interaction;if(!s.player||!t||s.context||s.open||w<180||h<180)return;
  const width=Math.min(286,w-20),height=t.status?52:36,resource=playerResourceLayout(w,h,s.player.bars?.length||0,resourcePage),center=t.centered;
  const x=center?(w-width)/2:Math.max(10,Math.min(w-width-10,t.x+15)),base=center?h/2+30:t.y+18,y=Math.max(8,Math.min(h-height-8,resource.y-height-7,base)),r={x,y,w:width,h:height};
  const accent=t.available?colors.gold:'#c79e81';
  // A restrained plate, not a second inventory or a glowing 3D effect.
  plate(ctx,r,'#0c1b19e8',accent,6);
  if(t.available){const key={x:r.x+7,y:r.y+7,w:29,h:22};plate(ctx,key,'#473c28',colors.gold,4);text('F',key.x+key.w/2,key.y+key.h/2,24,13,colors.gold,'center',700)}
  else text('◇',r.x+21,r.y+18,25,15,accent,'center',700);
  text(t.label,r.x+45,r.y+18,r.w-53,13,colors.fg,'left',650);
  if(t.status)text(t.status,r.x+45,r.y+37,r.w-53,11,t.available?colors.muted:accent);
 }
 function drawPlayerBar(s,w,h){
  if(playerId!==s.player.id){playerId=s.player.id;resourcePage=0;walletOpen=false;walletPage=0}
  const r=playerBarLayout(w,h);panel(r);
  for(let i=0;i<9;i++){
   const cell={x:r.x+r.pad+i*(r.slot+r.gap),y:r.y+r.pad,w:r.slot,h:r.slot};
   box(cell,'#101e1dcc','#776448',5);
   text(String(i+1),cell.x+6,cell.y+9,12,9,colors.muted);
  }
  drawPlayerResources(s,w,h);drawBody(s,w,h);drawWallet(s,w,h);
 }
 function drawCameraDock(s,w,h){
  const c=s.camera;if(!c||s.open)return;
  const player=!!s.player,first=c.mode==='first',width=Math.min(w-16,first?220:264);
  if(width<90)return;
  const bar=player?playerBarLayout(w,h):null;
  const beside=player&&w-(bar.x+bar.w)>=width+24;
  const r={x:w-width-8,y:player?(beside?Math.max(8,h-140):Math.max(8,playerResourceLayout(w,h,s.player?.bars?.length||0,resourcePage).y-86)):Math.max(8,h-140),w:width,h:78};
  if(s.building){r.x=8;r.y=65;}
  panel(r);region(r,'camera-dock',()=>{});
  text(first?'EXPLORATION':c.mode==='third'?'VUE TACTIQUE':'CAMÉRA MJ',r.x+10,r.y+12,r.w-20,10,colors.gold,'left',700);
  const keyboard={auto:'Auto',azerty:'AZERTY',qwerty:'QWERTY'}[c.keyboard]||'Auto',act=id=>()=>api.cameraAction(id);
  const gap=5,pad=8,half=(r.w-2*pad-gap)/2;
  button({x:r.x+pad,y:r.y+23,w:half,h:24},'camera-keyboard',keyboard,act('keyboard'));
  button({x:r.x+pad+half+gap,y:r.y+23,w:half,h:24},'camera-capture',c.locked?'Libérer · Échap':'Contrôler',act('captureCamera'),c.locked);
  const actions=first?[['light',s.player?.light==='flashlight'?'Torche · L':s.player?.light==='lantern'?'Lanterne · L':'Éteint · L']]:[['rotateLeft','↶'],['rotateRight','↷'],['zoomOut','−'],['zoomIn','+'],['focus','⌖']];
  if(!first&&player&&s.player.hasLight)actions.push(['light','L']);
  const sw=(r.w-2*pad-(actions.length-1)*gap)/actions.length;
  actions.forEach(([id,label],i)=>button({x:r.x+pad+i*(sw+gap),y:r.y+50,w:sw,h:21},'camera-'+id,label,act(id),false,id==='light'&&!s.player?.hasLight));
 }
 function drawInventory(s,l){const p=l.panel;if(p.h<70)return;panel(p);region(p,'inventory-panel',()=>{searching=false;familyOpen=false});
  text('◇  ATELIER DU MAÎTRE DU JEU  ◇',p.x+p.w/2,p.y+18,p.w-90,11,colors.gold,'center',700);text('Inventaire de construction',p.x+p.w/2,p.y+42,p.w-90,p.w<450?19:26,colors.fg,'center',650);separator(ctx,p.x+22,p.y+61,p.w-44);
  button({x:p.x+p.w-43,y:p.y+9,w:32,h:34},'close','×',api.close);
  const g=inventoryLayout(p,s.category);const active=inventoryFamilyFor(s.category);HUD_FAMILIES.forEach(([id,label,children],i)=>button(g.tabs[i],'category-'+id,label,()=>{searching=false;familyOpen=false;if(id!==active[0])api.category(children[0][0])},id===active[0]));
  active[2].forEach(([id,label],i)=>button(g.subtabs[i],'subcategory-'+id,label,()=>{searching=false;familyOpen=false;api.category(id)},id===s.category));
  const top=g.top,advanced=['settings','zone','trees'].includes(s.category);
  if(advanced){text(s.category==='trees'?'Générateur de végétation':s.category==='zone'?'⌗  Sélection de zone':'✧  Forge arcanique · Réglages',p.x+p.w/2,top+14,p.w-28,16,colors.gold,'center',650);return}
  const sr=g.search,fw=g.family.w;box(sr,'#0a1919',searching?colors.gold:colors.edge);
  text('⌕',sr.x+12,sr.y+18,16,15,colors.gold,'center');text(s.query||'Rechercher…',sr.x+25,sr.y+18,sr.w-32,12,s.query?colors.fg:colors.muted);region(sr,'search',()=>{searching=true;familyOpen=false;world.focus({preventScroll:true})});
  const fr=g.family;if(fw)button(fr,'family',(s.families[s.family]||'Toutes les familles')+' ▾',()=>{familyOpen=!familyOpen;searching=false});
  const {footerY,extra}=g;grid=g.grid;
  if(grid.h>0){const {n,cw,ch,tileGap:gap}=g;maxScroll=Math.max(0,Math.ceil(s.items.length/n)*(ch+gap)-gap-grid.h);scroll=Math.max(0,Math.min(maxScroll,scroll));ctx.save();ctx.beginPath();ctx.rect(grid.x,grid.y,grid.w,grid.h);ctx.clip();s.items.forEach((d,i)=>{const r={x:grid.x+(i%n)*(cw+gap),y:grid.y+Math.floor(i/n)*(ch+gap)-scroll,w:cw,h:ch};if(r.y+r.h>grid.y&&r.y<grid.y+grid.h)item(r,'item-'+i,d,()=>api.equip(d.item),JSON.stringify(d.item)===JSON.stringify(s.slots[s.active]?.item),null,grid)});if(!s.items.length)text('Aucun élément correspondant',grid.x+8,grid.y+18,grid.w-16,12,colors.muted);ctx.restore();if(maxScroll>0){const th=Math.max(18,grid.h*grid.h/(grid.h+maxScroll));box({x:grid.x+grid.w-3,y:grid.y+(grid.h-th)*scroll/maxScroll,w:3,h:th},colors.gold,null,2)}}
  if(extra)button({x:p.x+12,y:footerY-29,w:Math.min(230,p.w-24),h:26},'schema-zone','Sélectionner une zone',api.zone);
  separator(ctx,p.x+g.pad,footerY,p.w-2*g.pad);const focused=regions.findLast(r=>r.inventory&&contains(r,cursor.x,cursor.y));const detail=focused?s.items[Number(focused.id.slice(5))]:null;text(detail?detail.name+(detail.hardness!=null?' · Dureté '+String(detail.hardness).replace('.',','):''):s.items.length+' éléments · créneau '+(s.active+1),p.x+g.pad,footerY+24,p.w-170,12,colors.gold);button({x:p.x+p.w-147,y:footerY+9,w:125,h:32},'advanced','Réglages · R',api.settings);
  if(familyOpen&&fw){const opts=[['all','Toutes les familles'],...Object.entries(s.families)],r={x:fr.x,y:fr.y+fr.h+3,w:fw,h:opts.length*27+8};panel(r);region(r,'family-panel',()=>{});opts.forEach(([id,label],i)=>button({x:r.x+4,y:r.y+4+i*27,w:r.w-8,h:25},'family-'+id,label,()=>{familyOpen=false;api.family(id)},id===s.family))}
 }
 function drawSelection(s,w,h){if(!s.selection)return;const bars=s.selection.bars||[],shown=bars.slice(0,6),height=96+Math.ceil(shown.length/2)*27;const r={x:12,y:Math.max(8,h-height-24),w:Math.min(w-24,s.selection.character?350:290),h:height};if(r.w<90)return;panel(r);region(r,'selection-panel',()=>{});const left=r.x+12,space=Math.max(35,r.w-(s.selection.character?165:108));text('SÉLECTION',left,r.y+12,space,9,colors.gold,'left',700);text(s.selection.name,left,r.y+29,space,13,colors.fg,'left',650);text(s.selection.meta,left,r.y+45,space,10,colors.muted);button({x:r.x+r.w-84,y:r.y+13,w:34,h:35},'focus','⌖',api.focus);button({x:r.x+r.w-44,y:r.y+13,w:34,h:35},'inspect','☷',api.inspect);if(s.selection.character)button({x:r.x+r.w-155,y:r.y+13,w:66,h:35},'control-selection','Contrôler',api.controlSelection);const cw=(r.w-32)/2;shown.forEach((bar,i)=>{const x=r.x+12+(i%2)*(cw+8),y=r.y+62+Math.floor(i/2)*27;text(bar.name,x,y,cw*.60,10,colors.muted);text(bar.value+'/'+bar.max,x+cw,y,cw*.40,10,colors.fg,'right');box({x,y:y+8,w:cw,h:5},'#0b1818',null,2);ctx.fillStyle=bar.color;ctx.fillRect(x,y+8,cw*bar.value/bar.max,5)});const fw=(r.w-30)/2;if(s.selection.character){button({x:r.x+12,y:r.y+r.h-32,w:fw,h:24},'pin-selection',s.selection.pinned?'Retirer du suivi':'Épingler',()=>api.toggleMonitor(s.selection.id),s.selection.pinned);button({x:r.x+18+fw,y:r.y+r.h-32,w:fw,h:24},'deselect-selection','Désélectionner',api.deselect)}else button({x:r.x+12,y:r.y+r.h-32,w:r.w-24,h:24},'deselect-selection','Désélectionner',api.deselect)}
 function drawContext(s,w,h){const m=s.context;if(!m)return;const width=Math.min(245,w-12),height=35+m.actions.length*32+8,r={x:Math.max(6,Math.min(m.x,w-width-6)),y:Math.max(6,Math.min(m.y,h-height-6)),w:width,h:height};panel(r);region(r,'context-panel',()=>{});text(m.name,r.x+12,r.y+17,r.w-24,13,colors.gold,'left',650);m.actions.forEach((a,i)=>button({x:r.x+6,y:r.y+34+i*32,w:r.w-12,h:29},'context-'+i,a.label,a.run))}
 function draw(){frame=0;if(!active)return;origin=viewport.getBoundingClientRect();const w=origin.width,h=origin.height;if(w<1||h<1)return;const dpr=Math.min(2,win.devicePixelRatio||1),bw=Math.max(1,Math.round(w*dpr)),bh=Math.max(1,Math.round(h*dpr));if(layer.width!==bw||layer.height!==bh){layer.width=bw;layer.height=bh}ctx.setTransform(bw/w,0,0,bh/h,0,0);ctx.clearRect(0,0,w,h);regions=[];grid=null;maxScroll=0;
  const s=api.state();layer.style.pointerEvents=s.open?'auto':'none';layout=hudLayout(w,h);const forms=doc.getElementById('creativeForms');if(forms&&s.open&&['settings','zone','trees'].includes(s.category)){const r=inventoryLayout(layout.panel,s.category).forms;Object.assign(forms.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px',bottom:'auto',transform:'none'});}if(s.category!==lastCategory||s.query!==lastQuery||s.family!==lastFamily){scroll=0;lastCategory=s.category;lastQuery=s.query;lastFamily=s.family}if(!s.open){searching=false;familyOpen=false;drag=null}
  if(s.building)drawBar(s,layout,w);else if(s.player)drawPlayerBar(s,w,h);if(s.open)drawInventory(s,layout);else drawSelection(s,w,h);drawCameraDock(s,w,h);drawInteraction(s,w,h);if(!s.open&&!s.player)drawMonitor(s,w,h);properties.draw(s,w,h);drawContext(s,w,h);
  if(drag){ctx.globalAlpha=.9;box({x:cursor.x-30,y:cursor.y-30,w:60,h:60},colors.card,colors.gold);icon(drag,cursor.x,cursor.y,36);ctx.globalAlpha=1}
 }
 function point(e){const r=viewport.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
 function target(e){if(doc.pointerLockElement||e.target!==world&&e.target!==layer)return null;const p=point(e);return hitTest(regions,p.x,p.y)}
 function containsEvent(e){return !!target(e)}
 function consume(e){e.preventDefault();e.stopImmediatePropagation()}
 on(viewport,'pointerdown',e=>{if(properties.editing()&&(e.target===world||e.target===layer)){consume(e);properties.finish(true);return}const hit=target(e);if(!hit){searching=false;familyOpen=false;return}if(e.button!==0){consume(e);return}consume(e);cursor=point(e);down={id:hit.id,hit,x:cursor.x,y:cursor.y};if(hit.id!=='search')searching=false;try{world.setPointerCapture(e.pointerId)}catch{}schedule()},true);
 on(viewport,'pointermove',e=>{if(doc.pointerLockElement)return;const previous=hitTest(regions,cursor.x,cursor.y);cursor=point(e);if(down){consume(e);if(down.hit.monitorDrag){const r=down.hit.monitorDrag;monitorDrag=monitorPosition(r.x+cursor.x-down.x,r.y+cursor.y-down.y,r,origin.width,origin.height)}else if(down.hit.portraitDrag){api.rotatePortrait?.((cursor.x-(down.lastX??down.x))*1.2);down.lastX=cursor.x}else if(down.hit.inventory&&Math.hypot(cursor.x-down.x,cursor.y-down.y)>5){const s=api.state(),i=Number(down.id.slice(5));drag=s.items[i]||null}}else if(target(e))consume(e);if(down||previous||target(e))schedule()},true);
 on(viewport,'pointerup',e=>{if(!down)return;consume(e);cursor=point(e);const hit=hitTest(regions,cursor.x,cursor.y),start=down;down=null;if(start.hit.monitorDrag){if(monitorDrag)api.moveMonitor(monitorDrag);monitorDrag=null}else if(start.hit.portraitDrag){}else if(drag){if(hit?.slot!==null&&hit?.slot!==undefined)api.equip(drag.item,hit.slot);drag=null}else if(hit?.id===start.id)hit.run?.();try{world.releasePointerCapture(e.pointerId)}catch{}schedule()},true);
 on(viewport,'pointercancel',()=>{down=null;drag=null;monitorDrag=null;schedule()},true);
 on(viewport,'pointerleave',()=>{cursor={x:-1,y:-1};schedule()});
 on(viewport,'contextmenu',e=>{if(target(e))consume(e)},true);
 on(viewport,'wheel',e=>{if(!target(e))return;consume(e);if(properties.wheel(point(e),e.deltaY))return;if(grid&&contains(grid,...Object.values(point(e)))){scroll=Math.max(0,Math.min(maxScroll,scroll+e.deltaY));schedule()}},{capture:true,passive:false});
 on(viewport,'dragover',e=>{const hit=target(e);if(hit?.dropTarget)e.preventDefault()},true);
 on(viewport,'drop',e=>{const hit=target(e);if(hit?.dropTarget){consume(e);hit.dropTarget.ondrop?.(e);schedule()}},true);
 function handleKey(e){if(properties.key(e))return true;if(!searching||!api.state().open||['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return false;let q=api.state().query;if(e.key==='Escape'||e.key==='Enter'||e.key==='Tab'){searching=false;schedule()}else if(e.key==='Backspace')api.search(q.slice(0,-1));else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey)api.search((q+e.key).slice(0,120));else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a')api.search('');else return false;e.preventDefault();return true}
 const resize=new win.ResizeObserver(schedule);resize.observe(viewport);on(win,'resize',schedule);on(doc,'pointerlockchange',schedule);
 draw();return{schedule,containsEvent,handleKey,dispose(){active=false;if(frame)win.cancelAnimationFrame(frame);resize.disconnect();properties.dispose();for(const off of listeners)off();layer.remove();doc.body.classList.remove('native-canvas-ui','canvas-camera-dock','canvas-inspector')}};
}

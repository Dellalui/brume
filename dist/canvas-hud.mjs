import {ARCANE,CATEGORY_SIGILS,arcanePanel,arcaneTile,plate,separator,sigil,texturedCube} from './arcane-theme.mjs';
// Canvas-native menus. Layout, rendering, hit testing and drag/drop share one
// coordinate system; no DOM item buttons, invisible hit targets or grid nodes.
export const HUD_CATEGORIES=[['blocks','Blocs'],['doors','Portes'],['decor','Décors'],['actors','Personnages'],['effects','Effets'],['throws','À lancer'],['schemas','Schémas'],['tools','Outils'],['zone','Zone'],['settings','Réglages']];
export const contains=(r,x,y)=>x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h;
export function hitTest(regions,x,y){for(let i=regions.length-1;i>=0;i--)if(contains(regions[i],x,y))return regions[i];return null}
export function hudLayout(w,h){
 const margin=w>=500?48:24,width=Math.min(1080,Math.max(1,w-margin)),x=(w-width)/2;
 const slot=Math.max(1,Math.min(66,Math.floor((w-36)/11))),barW=slot*11+12,barX=(w-barW)/2,barY=Math.max(0,h-slot-42);
 const panel={x,y:16,w:width,h:Math.max(1,barY-74)};
 return{panel,slot,barX,barY,barW}
}
// One geometry source for drawing, hit testing, forms and browser tests.
export function inventoryLayout(p,category='blocks'){
 const pad=p.w>=560?22:12,gap=8,cols=p.w>=1000?10:p.w>=310?5:3;
 const rows=Math.ceil(HUD_CATEGORIES.length/cols),tw=(p.w-2*pad-(cols-1)*gap)/cols,th=p.w>=550?37:31,step=th+gap;
 const tabs=HUD_CATEGORIES.map((_,i)=>({x:p.x+pad+(i%cols)*(tw+gap),y:p.y+70+Math.floor(i/cols)*step,w:tw,h:th}));
 const top=p.y+70+rows*step+8,footerY=p.y+p.h-50,extra=category==='schemas'?34:0;
 const fw=category==='blocks'?Math.min(180,p.w*.30):0,search={x:p.x+pad,y:top,w:Math.max(1,p.w-2*pad-(fw?fw+gap:0)),h:36};
 const family={x:search.x+search.w+gap,y:top,w:fw,h:36};
 const grid={x:p.x+pad,y:top+48,w:p.w-2*pad,h:Math.max(0,footerY-top-60-extra)};
 const tileGap=10,n=Math.max(1,Math.floor((grid.w+tileGap-9)/(p.w>=550?128:91))),cw=(grid.w-9-(n-1)*tileGap)/n,ch=p.w>=550?94:85;
 const forms={x:p.x+pad,y:top+36,w:p.w-2*pad,h:Math.max(0,p.y+p.h-top-50)};
 return{pad,tabs,top,footerY,extra,search,family,grid,n,cw,ch,tileGap,forms}
}
export function mountCanvasHUD(doc,api){
 const viewport=doc.getElementById('viewport'),world=doc.getElementById('map'),win=doc.defaultView,layer=doc.createElement('canvas'),ctx=layer.getContext('2d');
 if(!viewport||!world||!ctx)return null;
 layer.id='canvasInterface';layer.setAttribute('aria-label','Inventaire et menus de construction');viewport.append(layer);doc.body.classList.add('native-canvas-ui');
 const colors=ARCANE;
 let frame=0,regions=[],cursor={x:-1,y:-1},scroll=0,maxScroll=0,grid=null,lastCategory='',lastQuery='',lastFamily='',searching=false,familyOpen=false,down=null,drag=null,active=true,origin=null,layout=null;
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
 function icon(d,x,y,s){if(d.block){texturedCube(ctx,x,y,s,d,imageFor);return}if(d.thumbnail){const img=imageFor(d.thumbnail);if(img.complete&&img.naturalWidth){const k=s/Math.max(img.naturalWidth,img.naturalHeight),w=img.naturalWidth*k,h=img.naturalHeight*k;ctx.drawImage(img,x-w/2,y-h/2,w,h);return}}
 const col=d.color||colors.gold;sigil(ctx,x,y,s*.48,col);ctx.save();ctx.shadowColor=col;ctx.shadowBlur=d.item?.kind==='throw'?7:0;text(d.symbol||'◇',x,y,s*1.5,s*.8,col,'center',700);ctx.restore()}
 function itemLabel(d,r){const value=d.name||'',width=r.w-16;ctx.font='500 12px system-ui,sans-serif';const words=value.split(' ');if(ctx.measureText(value).width<=width){text(value,r.x+r.w/2,r.y+r.h-16,width,12,colors.fg,'center');return}let first='',rest=[];for(const word of words){if(!rest.length&&ctx.measureText((first+' '+word).trim()).width<=width)first=(first+' '+word).trim();else rest.push(word)}if(!first){text(value,r.x+r.w/2,r.y+r.h-16,width,12,colors.fg,'center');return}text(first,r.x+r.w/2,r.y+r.h-26,width,12,colors.fg,'center');text(rest.join(' '),r.x+r.w/2,r.y+r.h-12,width,12,colors.fg,'center')}
 function item(r,id,d,run,selected=false,slot=null,clip=null){const hover=contains(r,cursor.x,cursor.y)&&(!clip||contains(clip,cursor.x,cursor.y));arcaneTile(ctx,r,{selected,hover,accent:d.item?.kind==='throw'?d.color:null});icon(d,r.x+r.w/2,r.y+r.h*(slot===null?.35:.53),Math.max(8,Math.min(slot===null?50:37,r.w-14,r.h*.52)));if(slot!==null)text(slot+1,r.x+8,r.y+9,14,10,colors.muted);else itemLabel(d,r);const hit=clip?{x:Math.max(r.x,clip.x),y:Math.max(r.y,clip.y),w:Math.min(r.x+r.w,clip.x+clip.w)-Math.max(r.x,clip.x),h:Math.min(r.y+r.h,clip.y+clip.h)-Math.max(r.y,clip.y)}:r;if(hit.w>0&&hit.h>0)region(hit,id,run,{item:d.item,slot,inventory:slot===null})}
 function drawBar(s,l,w){const {barX:x,barY:y,slot:z,barW}=l;panel({x:x-5,y:y-5,w:barW+10,h:z+10});button({x,y,w:z,h:z},'inventory','E',api.toggle,s.open);
  s.slots.forEach((d,i)=>item({x:x+(i+1)*z+2,y,w:z-3,h:z},'slot-'+i,d,()=>api.slot(i),i===s.active,i));
  button({x:x+z*10+2,y,w:z,h:z},'control','◉',api.control,false,!s.canControl);
  const hoveredSlot=regions.find(r=>r.slot!=null&&contains(r,cursor.x,cursor.y));const name=s.slots[hoveredSlot?.slot??s.active]?.name||'';const plaque={x:w/2-Math.min(150,barW*.25)-38,y:y-30,w:Math.min(300,barW*.5),h:24};arcaneTile(ctx,plaque,{selected:true});text(name,plaque.x+plaque.w/2,y-18,plaque.w-16,14,colors.fg,'center',650);button({x:x+barW-91,y:y-31,w:91,h:24},'settings','Réglages · R',api.settings);
  text('E : inventaire   ·   1–9 : raccourcis   ·   R : réglages',w/2,y+z+17,w-12,10,colors.muted,'center')
 }
 function drawInventory(s,l){const p=l.panel;if(p.h<70)return;panel(p);region(p,'inventory-panel',()=>{searching=false;familyOpen=false});
  text('◇  ATELIER DU MAÎTRE DU JEU  ◇',p.x+p.w/2,p.y+18,p.w-90,11,colors.gold,'center',700);text('Inventaire de construction',p.x+p.w/2,p.y+42,p.w-90,p.w<450?19:26,colors.fg,'center',650);separator(ctx,p.x+22,p.y+61,p.w-44);
  button({x:p.x+p.w-43,y:p.y+9,w:32,h:34},'close','×',api.close);
  const g=inventoryLayout(p,s.category);HUD_CATEGORIES.forEach(([id,label],i)=>button(g.tabs[i],'category-'+id,label,()=>{searching=false;familyOpen=false;api.category(id)},id===s.category));
  const top=g.top,advanced=['settings','zone'].includes(s.category);
  if(advanced){text(s.category==='zone'?'⌗  Sélection de zone':'✧  Forge arcanique · Réglages',p.x+p.w/2,top+14,p.w-28,16,colors.gold,'center',650);return}
  const sr=g.search,fw=g.family.w;box(sr,'#0a1919',searching?colors.gold:colors.edge);
  text('⌕',sr.x+12,sr.y+18,16,15,colors.gold,'center');text(s.query||'Rechercher…',sr.x+25,sr.y+18,sr.w-32,12,s.query?colors.fg:colors.muted);region(sr,'search',()=>{searching=true;familyOpen=false;world.focus({preventScroll:true})});
  const fr=g.family;if(fw)button(fr,'family',(s.families[s.family]||'Toutes les familles')+' ▾',()=>{familyOpen=!familyOpen;searching=false});
  const {footerY,extra}=g;grid=g.grid;
  if(grid.h>0){const {n,cw,ch,tileGap:gap}=g;maxScroll=Math.max(0,Math.ceil(s.items.length/n)*(ch+gap)-gap-grid.h);scroll=Math.max(0,Math.min(maxScroll,scroll));ctx.save();ctx.beginPath();ctx.rect(grid.x,grid.y,grid.w,grid.h);ctx.clip();s.items.forEach((d,i)=>{const r={x:grid.x+(i%n)*(cw+gap),y:grid.y+Math.floor(i/n)*(ch+gap)-scroll,w:cw,h:ch};if(r.y+r.h>grid.y&&r.y<grid.y+grid.h)item(r,'item-'+i,d,()=>api.equip(d.item),JSON.stringify(d.item)===JSON.stringify(s.slots[s.active]?.item),null,grid)});if(!s.items.length)text('Aucun élément correspondant',grid.x+8,grid.y+18,grid.w-16,12,colors.muted);ctx.restore();if(maxScroll>0){const th=Math.max(18,grid.h*grid.h/(grid.h+maxScroll));box({x:grid.x+grid.w-3,y:grid.y+(grid.h-th)*scroll/maxScroll,w:3,h:th},colors.gold,null,2)}}
  if(extra)button({x:p.x+12,y:footerY-29,w:Math.min(230,p.w-24),h:26},'schema-zone','Sélectionner une zone',api.zone);
  separator(ctx,p.x+g.pad,footerY,p.w-2*g.pad);const focused=regions.findLast(r=>r.inventory&&contains(r,cursor.x,cursor.y));const detail=focused?s.items[Number(focused.id.slice(5))]:null;text(detail?detail.name+(detail.hardness!=null?' · Dureté '+String(detail.hardness).replace('.',','):''):s.items.length+' éléments · créneau '+(s.active+1),p.x+g.pad,footerY+24,p.w-170,12,colors.gold);button({x:p.x+p.w-147,y:footerY+9,w:125,h:32},'advanced','Réglages · R',api.settings);
  if(familyOpen&&fw){const opts=[['all','Toutes les familles'],...Object.entries(s.families)],r={x:fr.x,y:fr.y+fr.h+3,w:fw,h:opts.length*27+8};panel(r);region(r,'family-panel',()=>{});opts.forEach(([id,label],i)=>button({x:r.x+4,y:r.y+4+i*27,w:r.w-8,h:25},'family-'+id,label,()=>{familyOpen=false;api.family(id)},id===s.family))}
 }
 function drawSelection(s,w,h){if(!s.selection)return;const r={x:12,y:Math.max(8,h-152),w:Math.min(w-24,s.selection.character?350:290),h:63};if(r.w<90)return;panel(r);region(r,'selection-panel',()=>{});const left=r.x+12,space=Math.max(35,r.w-(s.selection.character?165:108));text('SÉLECTION',left,r.y+12,space,9,colors.gold,'left',700);text(s.selection.name,left,r.y+29,space,13,colors.fg,'left',650);text(s.selection.meta,left,r.y+45,space,10,colors.muted);button({x:r.x+r.w-84,y:r.y+13,w:34,h:35},'focus','⌖',api.focus);button({x:r.x+r.w-44,y:r.y+13,w:34,h:35},'inspect','☷',api.inspect);if(s.selection.character)button({x:r.x+r.w-155,y:r.y+13,w:66,h:35},'control-selection','Contrôler',api.controlSelection)}
 function drawContext(s,w,h){const m=s.context;if(!m)return;const width=Math.min(245,w-12),height=35+m.actions.length*32+8,r={x:Math.max(6,Math.min(m.x,w-width-6)),y:Math.max(6,Math.min(m.y,h-height-6)),w:width,h:height};panel(r);region(r,'context-panel',()=>{});text(m.name,r.x+12,r.y+17,r.w-24,13,colors.gold,'left',650);m.actions.forEach((a,i)=>button({x:r.x+6,y:r.y+34+i*32,w:r.w-12,h:29},'context-'+i,a.label,a.run))}
 function draw(){frame=0;if(!active)return;origin=viewport.getBoundingClientRect();const w=origin.width,h=origin.height;if(w<1||h<1)return;const dpr=Math.min(2,win.devicePixelRatio||1),bw=Math.max(1,Math.round(w*dpr)),bh=Math.max(1,Math.round(h*dpr));if(layer.width!==bw||layer.height!==bh){layer.width=bw;layer.height=bh}ctx.setTransform(bw/w,0,0,bh/h,0,0);ctx.clearRect(0,0,w,h);regions=[];grid=null;maxScroll=0;
  const s=api.state();layer.style.pointerEvents=s.open?'auto':'none';layout=hudLayout(w,h);const forms=doc.getElementById('creativeForms');if(forms&&s.open&&['settings','zone'].includes(s.category)){const r=inventoryLayout(layout.panel,s.category).forms;Object.assign(forms.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px',bottom:'auto',transform:'none'});}if(s.category!==lastCategory||s.query!==lastQuery||s.family!==lastFamily){scroll=0;lastCategory=s.category;lastQuery=s.query;lastFamily=s.family}if(!s.open){searching=false;familyOpen=false;drag=null}
  if(s.building)drawBar(s,layout,w);if(s.open)drawInventory(s,layout);else drawSelection(s,w,h);drawContext(s,w,h);
  if(drag){ctx.globalAlpha=.9;box({x:cursor.x-30,y:cursor.y-30,w:60,h:60},colors.card,colors.gold);icon(drag,cursor.x,cursor.y,36);ctx.globalAlpha=1}
 }
 function point(e){const r=viewport.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
 function target(e){if(doc.pointerLockElement||e.target!==world&&e.target!==layer)return null;const p=point(e);return hitTest(regions,p.x,p.y)}
 function containsEvent(e){return !!target(e)}
 function consume(e){e.preventDefault();e.stopImmediatePropagation()}
 on(viewport,'pointerdown',e=>{const hit=target(e);if(!hit){searching=false;familyOpen=false;return}if(e.button!==0){consume(e);return}consume(e);cursor=point(e);down={id:hit.id,hit,x:cursor.x,y:cursor.y};if(hit.id!=='search')searching=false;try{world.setPointerCapture(e.pointerId)}catch{}schedule()},true);
 on(viewport,'pointermove',e=>{if(doc.pointerLockElement)return;const previous=hitTest(regions,cursor.x,cursor.y);cursor=point(e);if(down){consume(e);if(down.hit.inventory&&Math.hypot(cursor.x-down.x,cursor.y-down.y)>5){const s=api.state(),i=Number(down.id.slice(5));drag=s.items[i]||null}}else if(target(e))consume(e);if(down||previous||target(e))schedule()},true);
 on(viewport,'pointerup',e=>{if(!down)return;consume(e);cursor=point(e);const hit=hitTest(regions,cursor.x,cursor.y),start=down;down=null;if(drag){if(hit?.slot!==null&&hit?.slot!==undefined)api.equip(drag.item,hit.slot);drag=null}else if(hit?.id===start.id)hit.run?.();try{world.releasePointerCapture(e.pointerId)}catch{}schedule()},true);
 on(viewport,'pointercancel',()=>{down=null;drag=null;schedule()},true);
 on(viewport,'pointerleave',()=>{cursor={x:-1,y:-1};schedule()});
 on(viewport,'contextmenu',e=>{if(target(e))consume(e)},true);
 on(viewport,'wheel',e=>{if(!target(e))return;consume(e);if(grid&&contains(grid,...Object.values(point(e)))){scroll=Math.max(0,Math.min(maxScroll,scroll+e.deltaY));schedule()}},{capture:true,passive:false});
 function handleKey(e){if(!searching||!api.state().open||['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return false;let q=api.state().query;if(e.key==='Escape'||e.key==='Enter'||e.key==='Tab'){searching=false;schedule()}else if(e.key==='Backspace')api.search(q.slice(0,-1));else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey)api.search((q+e.key).slice(0,120));else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a')api.search('');else return false;e.preventDefault();return true}
 const resize=new win.ResizeObserver(schedule);resize.observe(viewport);on(win,'resize',schedule);on(doc,'pointerlockchange',schedule);
 draw();return{schedule,containsEvent,handleKey,dispose(){active=false;if(frame)win.cancelAnimationFrame(frame);resize.disconnect();for(const off of listeners)off();layer.remove();doc.body.classList.remove('native-canvas-ui')}};
}

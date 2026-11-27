// Canvas-native menus. Layout, rendering, hit testing and drag/drop share one
// coordinate system; no DOM item buttons, invisible hit targets or grid nodes.
export const HUD_CATEGORIES=[['blocks','Blocs'],['doors','Portes'],['decor','Décors'],['actors','Personnages'],['effects','Effets'],['throws','À lancer'],['schemas','Schémas'],['tools','Outils'],['zone','Zone'],['settings','Réglages']];
export const contains=(r,x,y)=>x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h;
export function hitTest(regions,x,y){for(let i=regions.length-1;i>=0;i--)if(contains(regions[i],x,y))return regions[i];return null}
export function hudLayout(w,h){const width=Math.min(850,Math.max(1,w-24)),x=(w-width)/2,slot=Math.max(17,Math.min(57,Math.floor((w-28)/11))),barW=slot*11+12,barX=(w-barW)/2,barY=Math.max(0,h-slot-45),panel={x,y:12,w:width,h:Math.max(1,barY-60)};return{panel,slot,barX,barY,barW}}
export function mountCanvasHUD(doc,api){
 const viewport=doc.getElementById('viewport'),world=doc.getElementById('map'),win=doc.defaultView,layer=doc.createElement('canvas'),ctx=layer.getContext('2d');
 if(!viewport||!world||!ctx)return null;
 layer.id='canvasInterface';layer.setAttribute('aria-label','Inventaire et menus de construction');viewport.append(layer);doc.body.classList.add('native-canvas-ui');
 const colors={bg:'#14231f',card:'#21372d',edge:'#4c6859',gold:'#e5c88a',fg:'#eff4e9',muted:'#a6bfb0',hover:'#345546'};
 let frame=0,regions=[],cursor={x:-1,y:-1},scroll=0,maxScroll=0,grid=null,lastCategory='',lastQuery='',lastFamily='',searching=false,familyOpen=false,down=null,drag=null,active=true,origin=null,layout=null;
 const images=new Map(),listeners=[];
 function on(el,name,fn,opts){el.addEventListener(name,fn,opts);listeners.push(()=>el.removeEventListener(name,fn,opts))}
 function schedule(){if(active&&!frame)frame=win.requestAnimationFrame(draw)}
 function box(r,fill,stroke=colors.edge,radius=7){if(r.w<=0||r.h<=0)return;ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,Math.min(radius,r.w/2,r.h/2));ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
 function panel(r){if(r.h<=0)return;ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=14;box(r,colors.bg,null,12);ctx.restore();const g=ctx.createLinearGradient(r.x,r.y,r.x,r.y+r.h);g.addColorStop(0,'#263d32');g.addColorStop(1,'#14231f');box(r,g,colors.edge,12)}
 function text(s,x,y,width,size=12,color=colors.fg,align='left',weight=500){if(width<2)return;ctx.font=weight+' '+size+'px system-ui,sans-serif';ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;let v=String(s??'');if(ctx.measureText(v).width>width){while(v.length&&ctx.measureText(v+'…').width>width)v=v.slice(0,-1);v+='…'}ctx.fillText(v,x,y)}
 function region(r,id,run,extra={}){const a={...r,id,run,...extra};regions.push(a);return a}
 function button(r,id,label,run,selected=false,disabled=false){const hover=contains(r,cursor.x,cursor.y);box(r,selected?colors.gold:hover?colors.hover:colors.card,selected||hover?colors.gold:colors.edge);text(label,r.x+r.w/2,r.y+r.h/2,r.w-8,Math.min(12,r.h*.46),disabled?colors.muted:selected?colors.bg:colors.fg,'center',selected?700:500);if(!disabled)region(r,id,run)}
 function cube(x,y,s,color){ctx.save();ctx.translate(x,y);function face(points,c){ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a*s,b*s):ctx.moveTo(a*s,b*s));ctx.closePath();ctx.fillStyle=c;ctx.fill();ctx.strokeStyle='#ffffff35';ctx.stroke()}const top=[[0,-.52],[.48,-.25],[0,.03],[-.48,-.25]],left=[[-.48,-.25],[0,.03],[0,.53],[-.48,.26]],right=[[0,.03],[.48,-.25],[.48,.26],[0,.53]];face(top,color);face(left,color);face(right,color);face(left,'#0003');face(right,'#0006');ctx.restore()}
 function icon(d,x,y,s){if(d.block){cube(x,y,s,d.color||'#81977b');return}if(d.thumbnail){let img=images.get(d.thumbnail);if(!img){img=new win.Image();img.onload=schedule;img.src=d.thumbnail;images.set(d.thumbnail,img)}if(img.complete&&img.naturalWidth){const k=s/Math.max(img.naturalWidth,img.naturalHeight),w=img.naturalWidth*k,h=img.naturalHeight*k;ctx.drawImage(img,x-w/2,y-h/2,w,h);return}}text(d.symbol||'◇',x,y,s*1.5,s*.8,d.color||colors.gold,'center',700)}
 function item(r,id,d,run,selected=false,slot=null,clip=null){const hover=contains(r,cursor.x,cursor.y)&&(!clip||contains(clip,cursor.x,cursor.y));box(r,selected?'#3f5547':hover?colors.hover:colors.card,selected||hover?colors.gold:colors.edge);icon(d,r.x+r.w/2,r.y+r.h*.39,Math.max(8,Math.min(42,r.w-8,r.h*.52)));if(slot!==null)text(slot+1,r.x+4,r.y+7,12,9,colors.muted);text(d.name,r.x+r.w/2,r.y+r.h-10,r.w-6,slot!==null?9:11,colors.fg,'center');const hit=clip?{x:Math.max(r.x,clip.x),y:Math.max(r.y,clip.y),w:Math.min(r.x+r.w,clip.x+clip.w)-Math.max(r.x,clip.x),h:Math.min(r.y+r.h,clip.y+clip.h)-Math.max(r.y,clip.y)}:r;if(hit.w>0&&hit.h>0)region(hit,id,run,{item:d.item,slot,inventory:slot===null})}
 function drawBar(s,l,w){const {barX:x,barY:y,slot:z,barW}=l;panel({x:x-5,y:y-5,w:barW+10,h:z+10});button({x,y,w:z,h:z},'inventory','E',api.toggle,s.open);
  s.slots.forEach((d,i)=>item({x:x+(i+1)*z+2,y,w:z-3,h:z},'slot-'+i,d,()=>api.slot(i),i===s.active,i));
  button({x:x+z*10+2,y,w:z,h:z},'control','◉',api.control,false,!s.canControl);
  const name=s.slots[s.active]?.name||'';text(name,w/2-38,y-17,Math.max(20,barW-100),12,colors.gold,'center',650);button({x:x+barW-91,y:y-31,w:91,h:24},'settings','Réglages · R',api.settings);
  text('E : inventaire   ·   1–9 : raccourcis   ·   R : réglages',w/2,y+z+17,w-12,10,colors.muted,'center')
 }
 function drawInventory(s,l){const p=l.panel;if(p.h<70)return;panel(p);region(p,'inventory-panel',()=>{searching=false;familyOpen=false});
  text('ATELIER DU MAÎTRE DU JEU',p.x+14,p.y+13,p.w-65,10,colors.gold,'left',700);text('Inventaire de construction',p.x+14,p.y+35,p.w-65,19,colors.fg,'left',650);
  button({x:p.x+p.w-43,y:p.y+9,w:32,h:34},'close','×',api.close);
  const cols=p.w>=680?10:p.w>=350?5:2,rows=Math.ceil(HUD_CATEGORIES.length/cols),tw=(p.w-24-(cols-1)*4)/cols;
  HUD_CATEGORIES.forEach(([id,label],i)=>button({x:p.x+12+(i%cols)*(tw+4),y:p.y+53+Math.floor(i/cols)*31,w:tw,h:27},'category-'+id,label,()=>{searching=false;familyOpen=false;api.category(id)},id===s.category));
  const top=p.y+53+rows*31+5,advanced=['settings','zone'].includes(s.category);
  if(advanced){text(s.category==='zone'?'Sélection de zone':'Réglages avancés',p.x+14,top+14,p.w-28,12,colors.muted);return}
  const fw=s.category==='blocks'?Math.min(155,p.w*.32):0,sr={x:p.x+12,y:top,w:p.w-24-(fw?fw+6:0),h:32};box(sr,'#10231b',searching?colors.gold:colors.edge);
  text(s.query||'Rechercher…',sr.x+9,sr.y+16,sr.w-18,12,s.query?colors.fg:colors.muted);region(sr,'search',()=>{searching=true;familyOpen=false;world.focus({preventScroll:true})});
  const fr={x:sr.x+sr.w+6,y:top,w:fw,h:32};if(fw)button(fr,'family',(s.families[s.family]||'Toutes les familles')+' ▾',()=>{familyOpen=!familyOpen;searching=false});
  const footerY=p.y+p.h-39,extra=s.category==='schemas'?30:0;grid={x:p.x+12,y:top+40,w:p.w-24,h:Math.max(0,footerY-top-42-extra)};
  if(grid.h>0){const n=Math.max(1,Math.floor(grid.w/101)),gap=6,cw=(grid.w-(n-1)*gap-5)/n,ch=77;maxScroll=Math.max(0,Math.ceil(s.items.length/n)*(ch+gap)-gap-grid.h);scroll=Math.max(0,Math.min(maxScroll,scroll));ctx.save();ctx.beginPath();ctx.rect(grid.x,grid.y,grid.w,grid.h);ctx.clip();s.items.forEach((d,i)=>{const r={x:grid.x+(i%n)*(cw+gap),y:grid.y+Math.floor(i/n)*(ch+gap)-scroll,w:cw,h:ch};if(r.y+r.h>grid.y&&r.y<grid.y+grid.h)item(r,'item-'+i,d,()=>api.equip(d.item),false,null,grid)});if(!s.items.length)text('Aucun élément correspondant',grid.x+8,grid.y+18,grid.w-16,12,colors.muted);ctx.restore();if(maxScroll>0){const th=Math.max(18,grid.h*grid.h/(grid.h+maxScroll));box({x:grid.x+grid.w-3,y:grid.y+(grid.h-th)*scroll/maxScroll,w:3,h:th},colors.gold,null,2)}}
  if(extra)button({x:p.x+12,y:footerY-29,w:Math.min(230,p.w-24),h:26},'schema-zone','Sélectionner une zone',api.zone);
  text(s.items.length+' éléments · créneau '+(s.active+1),p.x+13,footerY+18,p.w-155,11,colors.muted);button({x:p.x+p.w-137,y:footerY+4,w:125,h:29},'advanced','Réglages · R',api.settings);
  if(familyOpen&&fw){const opts=[['all','Toutes les familles'],...Object.entries(s.families)],r={x:fr.x,y:fr.y+fr.h+3,w:fw,h:opts.length*27+8};panel(r);region(r,'family-panel',()=>{});opts.forEach(([id,label],i)=>button({x:r.x+4,y:r.y+4+i*27,w:r.w-8,h:25},'family-'+id,label,()=>{familyOpen=false;api.family(id)},id===s.family))}
 }
 function drawSelection(s,w,h){if(!s.selection)return;const r={x:12,y:Math.max(8,h-152),w:Math.min(w-24,s.selection.character?350:290),h:63};if(r.w<90)return;panel(r);region(r,'selection-panel',()=>{});const left=r.x+12,space=Math.max(35,r.w-(s.selection.character?165:108));text('SÉLECTION',left,r.y+12,space,9,colors.gold,'left',700);text(s.selection.name,left,r.y+29,space,13,colors.fg,'left',650);text(s.selection.meta,left,r.y+45,space,10,colors.muted);button({x:r.x+r.w-84,y:r.y+13,w:34,h:35},'focus','⌖',api.focus);button({x:r.x+r.w-44,y:r.y+13,w:34,h:35},'inspect','☷',api.inspect);if(s.selection.character)button({x:r.x+r.w-155,y:r.y+13,w:66,h:35},'control-selection','Contrôler',api.controlSelection)}
 function drawContext(s,w,h){const m=s.context;if(!m)return;const width=Math.min(245,w-12),height=35+m.actions.length*32+8,r={x:Math.max(6,Math.min(m.x,w-width-6)),y:Math.max(6,Math.min(m.y,h-height-6)),w:width,h:height};panel(r);region(r,'context-panel',()=>{});text(m.name,r.x+12,r.y+17,r.w-24,13,colors.gold,'left',650);m.actions.forEach((a,i)=>button({x:r.x+6,y:r.y+34+i*32,w:r.w-12,h:29},'context-'+i,a.label,a.run))}
 function draw(){frame=0;if(!active)return;origin=viewport.getBoundingClientRect();const w=origin.width,h=origin.height;if(w<1||h<1)return;const dpr=Math.min(2,win.devicePixelRatio||1),bw=Math.max(1,Math.round(w*dpr)),bh=Math.max(1,Math.round(h*dpr));if(layer.width!==bw||layer.height!==bh){layer.width=bw;layer.height=bh}ctx.setTransform(bw/w,0,0,bh/h,0,0);ctx.clearRect(0,0,w,h);regions=[];grid=null;maxScroll=0;
  const s=api.state();layout=hudLayout(w,h);if(s.category!==lastCategory||s.query!==lastQuery||s.family!==lastFamily){scroll=0;lastCategory=s.category;lastQuery=s.query;lastFamily=s.family}if(!s.open){searching=false;familyOpen=false;drag=null}
  if(s.building)drawBar(s,layout,w);if(s.open)drawInventory(s,layout);else drawSelection(s,w,h);drawContext(s,w,h);
  if(drag){ctx.globalAlpha=.9;box({x:cursor.x-30,y:cursor.y-30,w:60,h:60},colors.card,colors.gold);icon(drag,cursor.x,cursor.y,36);ctx.globalAlpha=1}
 }
 function point(e){const r=viewport.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
 function target(e){if(doc.pointerLockElement||e.target!==world&&e.target!==layer)return null;const p=point(e);return hitTest(regions,p.x,p.y)}
 function containsEvent(e){return !!target(e)}
 function consume(e){e.preventDefault();e.stopImmediatePropagation()}
 on(viewport,'pointerdown',e=>{const hit=target(e);if(!hit){searching=false;familyOpen=false;return}if(e.button!==0){consume(e);return}consume(e);cursor=point(e);down={id:hit.id,hit,x:cursor.x,y:cursor.y};if(hit.id!=='search')searching=false;try{world.setPointerCapture(e.pointerId)}catch{}schedule()},true);
 on(viewport,'pointermove',e=>{if(doc.pointerLockElement)return;cursor=point(e);if(down){consume(e);if(down.hit.inventory&&Math.hypot(cursor.x-down.x,cursor.y-down.y)>5){const s=api.state(),i=Number(down.id.slice(5));drag=s.items[i]||null}}else if(target(e))consume(e);schedule()},true);
 on(viewport,'pointerup',e=>{if(!down)return;consume(e);cursor=point(e);const hit=hitTest(regions,cursor.x,cursor.y),start=down;down=null;if(drag){if(hit?.slot!==null&&hit?.slot!==undefined)api.equip(drag.item,hit.slot);drag=null}else if(hit?.id===start.id)hit.run?.();try{world.releasePointerCapture(e.pointerId)}catch{}schedule()},true);
 on(viewport,'pointercancel',()=>{down=null;drag=null;schedule()},true);
 on(viewport,'pointerleave',()=>{cursor={x:-1,y:-1};schedule()});
 on(viewport,'contextmenu',e=>{if(target(e))consume(e)},true);
 on(viewport,'wheel',e=>{if(!target(e))return;consume(e);if(grid&&contains(grid,...Object.values(point(e)))){scroll=Math.max(0,Math.min(maxScroll,scroll+e.deltaY));schedule()}},{capture:true,passive:false});
 function handleKey(e){if(!searching||!api.state().open||['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return false;let q=api.state().query;if(e.key==='Escape'||e.key==='Enter'||e.key==='Tab'){searching=false;schedule()}else if(e.key==='Backspace')api.search(q.slice(0,-1));else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey)api.search((q+e.key).slice(0,120));else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a')api.search('');else return false;e.preventDefault();return true}
 const resize=new win.ResizeObserver(schedule);resize.observe(viewport);on(win,'resize',schedule);on(doc,'pointerlockchange',schedule);
 draw();return{schedule,containsEvent,handleKey,dispose(){active=false;if(frame)win.cancelAnimationFrame(frame);resize.disconnect();for(const off of listeners)off();layer.remove();doc.body.classList.remove('native-canvas-ui')}};
}

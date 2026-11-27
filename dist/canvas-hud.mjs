// Canvas2D presentation for the construction UI. The original semantic controls
// remain the input layer (keyboard, touch, drag/drop, screen readers and IME).
// No WebGL readback, no additional 3D render and no idle animation loop.
export function mountCanvasHUD(doc){
 const viewport=doc.getElementById('viewport'),inventory=doc.getElementById('creativeInventory'),hud=doc.getElementById('creativeHud'),selection=doc.getElementById('selectionBar'),menu=doc.getElementById('contextMenu');
 if(!viewport||!inventory||!hud||!selection||!menu)return null;
 const win=doc.defaultView,layer=doc.createElement('canvas'),ctx=layer.getContext('2d');if(!ctx)return null;
 layer.id='canvasInterface';layer.setAttribute('aria-hidden','true');viewport.append(menu,layer);
 let frame=0,origin=null,hover=null,active=true;
 const roots=[inventory,hud,selection,menu];
 const theme={base:'#14221f',edge:'#456154',gold:'#e5c88a',text:'#eef2e9',muted:'#a9c0b3',card:'#21352e',hover:'#304c40'};
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.left-origin.left,y:r.top-origin.top,w:r.width,h:r.height}};
 const visible=e=>!!e&&!e.closest('[hidden]')&&e.getClientRects().length>0&&win.getComputedStyle(e).visibility!=='hidden';
 function rounded(r,radius=8){ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,Math.min(radius,r.w/2,r.h/2))}
 function box(r,fill,stroke=theme.edge,radius=8){if(r.w<=0||r.h<=0)return;rounded(r,radius);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
 function panel(r){ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=18;ctx.shadowOffsetY=6;box(r,theme.base,null,12);ctx.restore();const g=ctx.createLinearGradient(r.x,r.y,r.x,r.y+Math.max(1,r.h));g.addColorStop(0,'#263b32f5');g.addColorStop(1,'#121f1cf7');box(r,g,theme.edge,12)}
 function text(value,x,y,max,size=12,color=theme.text,align='left',weight=500){
  if(max<=0)return;ctx.font=weight+' '+size+'px system-ui, sans-serif';ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;
  let s=String(value??'').trim();if(ctx.measureText(s).width>max){while(s.length>0&&ctx.measureText(s+'…').width>max)s=s.slice(0,-1);s+='…'}ctx.fillText(s,x,y);
 }
 function line(x,y,w){ctx.fillStyle=theme.edge;ctx.fillRect(x,y,w,1)}
 function clip(e,fn){if(!visible(e))return;const r=rect(e);ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();fn(r);ctx.restore()}
 function pressed(b){return b.classList.contains('active')||b.getAttribute('aria-pressed')==='true'}
 function button(b,label=b.textContent.trim(),opts={}){
  if(!visible(b))return;const r=rect(b),on=pressed(b),focused=doc.activeElement===b,over=hover===b;
  ctx.save();ctx.globalAlpha=b.disabled?.43:1;box(r,on?'#d9c18a':over?theme.hover:theme.card,focused||over||on?theme.gold:theme.edge,7);
  text(label,r.x+(opts.left?10:r.w/2),r.y+r.h/2,r.w-14,opts.size||12,on?'#14221f':theme.text,opts.left?'left':'center',on?700:500);ctx.restore();
 }
 function cube(x,y,s,color){ctx.save();ctx.translate(x,y);const shape=(p,fill)=>{ctx.beginPath();p.forEach(([a,b],i)=>i?ctx.lineTo(a*s,b*s):ctx.moveTo(a*s,b*s));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#ffffff30';ctx.stroke()};
  shape([[0,-.52],[.48,-.25],[0,.03],[-.48,-.25]],color);
  shape([[-.48,-.25],[0,.03],[0,.53],[-.48,.26]],color);
  shape([[0,.03],[.48,-.25],[.48,.26],[0,.53]],color);
  shape([[-.48,-.25],[0,.03],[0,.53],[-.48,.26]],'#0003');shape([[0,.03],[.48,-.25],[.48,.26],[0,.53]],'#0006');ctx.restore();
 }
 function item(b,hot=false){if(!visible(b))return;const r=rect(b);if(r.y+r.h<0||r.y>origin.height)return;const on=pressed(b),over=hover===b,focus=doc.activeElement===b;
  box(r,on?'#405348':over?theme.hover:theme.card,on||over||focus?theme.gold:theme.edge,7);
  if(on){ctx.fillStyle=theme.gold;ctx.fillRect(r.x+6,r.y+2,Math.max(0,r.w-12),2)}
  const name=b.querySelector('.item-name,.slot-name')?.textContent||b.title||'',icon=b.querySelector('i'),img=b.querySelector('img'),cx=r.x+r.w/2,cy=r.y+r.h*(hot?.43:.40),s=Math.min(hot?27:44,r.w-12,r.h*.48);
  if(img&&img.complete&&img.naturalWidth){const scale=Math.min(s/img.naturalWidth,s/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,cx-w/2,cy-h/2,w,h)}
  else if(icon?.classList.contains('block-swatch')){const st=win.getComputedStyle(icon);cube(cx,cy,s,st.getPropertyValue('--block-color').trim()||st.backgroundColor||'#81977b')}
  else text(icon?.textContent||'◇',cx,cy,r.w-8,Math.max(14,s*.85),icon?.style.color||theme.gold,'center',650);
  if(hot)text(b.querySelector('kbd')?.textContent,r.x+5,r.y+8,14,9,theme.muted);
  text(name,cx,r.y+r.h-12,r.w-10,hot?10:12,theme.text,'center',500);
 }
 function drawHUD(){if(!visible(hud))return;
  const wrap=hud.querySelector('.hotbar-wrap'),bar=doc.getElementById('hotbar'),summary=hud.querySelector('.held-summary');
  if(visible(wrap))panel(rect(wrap));
  clip(bar,r=>{for(const b of bar.querySelectorAll('button'))item(b,true)});
  button(doc.getElementById('openInventory'),'Inventaire · E',{size:11});button(doc.getElementById('controlSelected'),'Contrôler',{size:11});
  if(visible(summary)){const name=doc.getElementById('heldSummary'),r=rect(name);text(name.textContent,r.x+r.w/2,r.y+r.h/2,r.w+4,13,theme.gold,'center',650);button(doc.getElementById('openHeldSettings'),'Réglages · R',{size:11})}
  const hint=doc.getElementById('creativeHint');if(visible(hint)){const r=rect(hint);text(hint.textContent,r.x+r.w/2,r.y+r.h/2,r.w,10,theme.muted,'center')}
 }
 function drawInventory(){if(!visible(inventory))return;const r=rect(inventory);panel(r);
  const head=inventory.querySelector('header'),h=rect(head);text('ATELIER DU MAÎTRE DU JEU',h.x+17,h.y+14,h.w-65,10,theme.gold,'left',700);
  text('Inventaire de construction',h.x+17,h.y+h.h*.66,h.w-65,20,theme.text,'left',650);button(doc.getElementById('closeInventory'),'×',{size:22});line(h.x,h.y+h.h-1,h.w);
  const nav=doc.getElementById('inventoryTabs');for(const b of nav.querySelectorAll('button'))button(b);const nr=rect(nav);line(nr.x+10,nr.y+nr.h-1,nr.w-20);
  const instructions=doc.getElementById('inventoryInstructions');if(visible(instructions)){const t=rect(instructions);text('Équipez un objet ou glissez-le sur un raccourci.',t.x+12,t.y+t.h/2,t.w-24,11,theme.muted)}
  const grid=doc.getElementById('inventoryItems');clip(grid,g=>{
   for(const b of grid.querySelectorAll('button')){const t=rect(b);if(t.y+t.h>=g.y&&t.y<=g.y+g.h)item(b)}
   const empty=grid.querySelector('.empty');if(empty)text(empty.textContent,g.x+16,g.y+22,g.w-32,12,theme.muted);
   if(grid.scrollHeight>grid.clientHeight){const rail=g.h-12,thumb=Math.max(20,rail*grid.clientHeight/grid.scrollHeight),offset=(rail-thumb)*grid.scrollTop/Math.max(1,grid.scrollHeight-grid.clientHeight);box({x:g.x+g.w-5,y:g.y+6,w:3,h:rail},'#354b42',null,2);box({x:g.x+g.w-5,y:g.y+6+offset,w:3,h:thumb},theme.gold,null,2)}
  });
  for(const id of ['zoneTools','schemaTools'])clip(doc.getElementById(id),()=>{for(const b of doc.getElementById(id).querySelectorAll('button'))button(b)});
  const foot=inventory.querySelector('footer');if(visible(foot)){const f=rect(foot),count=doc.getElementById('inventoryCount'),t=rect(count);line(f.x,f.y,f.w);text(count.textContent,t.x,t.y+t.h/2,t.w,11,theme.muted);button(doc.getElementById('creativeAdvanced'),'Réglages de l’outil · R')}
 }
 function drawSelection(){if(!visible(selection))return;const r=rect(selection);panel(r);
  for(const [id,size,color]of [['quickSelectionName',14,theme.text],['quickSelectionMeta',11,theme.muted]]){const el=doc.getElementById(id),t=rect(el);text(el.textContent,t.x,t.y+t.h/2,t.w,size,color)}
  const tag=selection.querySelector('small'),t=rect(tag);text('SÉLECTION',t.x,t.y+t.h/2,t.w,9,theme.gold,'left',700);
  button(doc.getElementById('quickFocus'),'⌖',{size:18});button(doc.getElementById('quickControl'),'Contrôler');button(doc.getElementById('quickInspect'),'☷',{size:18});
 }
 function drawContext(){if(!visible(menu))return;panel(rect(menu));const title=menu.querySelector('strong');if(title){const t=rect(title);text(title.textContent,t.x+4,t.y+t.h/2,t.w-8,13,theme.gold,'left',650)}
  for(const b of menu.querySelectorAll('button'))button(b,b.textContent.trim(),{left:true});
 }
 function draw(){frame=0;if(!active)return;origin=viewport.getBoundingClientRect();const w=origin.width,h=origin.height;if(w<=0||h<=0)return;
  const dpr=Math.min(2,win.devicePixelRatio||1),bw=Math.round(w*dpr),bh=Math.round(h*dpr);if(layer.width!==bw||layer.height!==bh){layer.width=bw;layer.height=bh}ctx.setTransform(bw/w,0,0,bh/h,0,0);ctx.clearRect(0,0,w,h);
  drawSelection();drawHUD();drawInventory();drawContext();
 }
 function schedule(){if(active&&!frame)frame=win.requestAnimationFrame(draw)}
 const observer=new win.MutationObserver(schedule);for(const e of roots)observer.observe(e,{subtree:true,childList:true,characterData:true,attributes:true});observer.observe(doc.body,{attributes:true,attributeFilter:['class','data-dock-left','data-dock-right']});
 const resize=new win.ResizeObserver(schedule);for(const e of [viewport,...roots])resize.observe(e);
 const listeners=[];function listen(e,type,fn,options){e.addEventListener(type,fn,options);listeners.push(()=>e.removeEventListener(type,fn,options))}
 listen(doc,'pointerover',e=>{hover=e.target.closest?.('button')||null;schedule()});listen(doc,'pointerout',()=>{hover=null;schedule()});listen(doc,'focusin',schedule);listen(doc,'focusout',schedule);listen(doc,'scroll',schedule,true);listen(doc,'load',schedule,true);listen(win,'resize',schedule);
 // Native drag/drop is preserved; make the invisible source button's ghost visible.
 listen(inventory,'dragstart',e=>{const b=e.target.closest?.('#inventoryItems button');if(!b||!e.dataTransfer)return;const ghost=b.cloneNode(true);ghost.style.cssText='position:fixed;left:-1000px;top:0;width:100px;padding:10px;display:flex;flex-direction:column;align-items:center;background:#21352e;color:#fff;border:1px solid #e5c88a;opacity:1';doc.body.append(ghost);e.dataTransfer.setDragImage(ghost,50,25);win.requestAnimationFrame(()=>ghost.remove())});
 doc.body.classList.add('canvas-ui');draw();
 return{schedule,dispose(){active=false;if(frame)win.cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();for(const off of listeners)off();layer.remove();doc.body.append(menu);doc.body.classList.remove('canvas-ui')}};
}

import {ARCANE,arcanePanel,arcaneTile,plate,separator} from './arcane-theme.mjs';
// The source inspector remains the single owner of validation, save/undo and
// actions. Canvas draws the visible UI; only the field currently being edited
// uses a native browser control (IME, keyboard, color, file/select pickers).
export function inspectorRows(root){
 const rows=[],controls='input,select,textarea';
 const labelOf=n=>n.getAttribute?.('aria-label')||n.title||n.textContent.trim()||n.id||'Commande';
 function walk(n){
  if(!n||n.hidden||n.style?.display==='none'||n.tagName==='SCRIPT'||n.tagName==='STYLE')return;
  const tag=n.tagName;
  if(tag==='DETAILS'){const summary=n.querySelector('summary');if(summary)rows.push({kind:'section',node:n,label:summary.textContent.trim()});if(n.open)for(const child of n.children)if(child!==summary)walk(child);return}
  if(tag==='LABEL'){const input=n.querySelector(controls);if(input&&!input.hidden&&input.type!=='hidden'){
   const raw=[...n.childNodes].filter(c=>c!==input&&c.nodeType!==1||c.nodeType===1&&!c.matches(controls)).map(c=>c.textContent).join('').trim();
   rows.push({kind:'field',node:input,label:raw||labelOf(input)});return}}
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'){if(n.type!=='hidden')rows.push({kind:'field',node:n,label:labelOf(n)});return}
  if(tag==='BUTTON'){rows.push({kind:'button',node:n,label:labelOf(n)});return}
  if(n.id==='actorFootprint'||n.id==='npcPresetGrid'){const buttons=[...n.querySelectorAll('button')].filter(b=>!b.hidden);if(buttons.length)rows.push({kind:'grid',node:n,buttons,cols:n.id==='actorFootprint'?Math.max(1,Number(n.style.getPropertyValue('--footprint-cols'))||1):4,footprint:n.id==='actorFootprint'});return}
  if(n.id==='imagePreview'||n.id==='sheetPreview'){const image=n.querySelector('canvas,img');if(image&&!image.hidden)rows.push({kind:'image',node:n,image,portrait:n.id==='imagePreview'});return}
  if(['H1','H2','H3','H4'].includes(tag)){rows.push({kind:'heading',label:n.textContent.trim()});return}
  if(['P','SPAN','SMALL'].includes(tag)&&!n.querySelector(controls+',button')&&n.textContent.trim()){rows.push({kind:'note',label:n.textContent.trim()});return}
  if(!n.children.length&&n.textContent.trim())rows.push({kind:'note',label:n.textContent.trim()});
  else for(const child of n.children)walk(child);
 }
 walk(root);return rows;
}
export function propertyLayout(w,h){
 const width=Math.min(410,Math.max(1,w-24)),height=Math.max(1,Math.min(660,h-92,Math.floor(h*.82)));
 return{x:Math.max(12,w-width-12),y:Math.min(62,Math.max(8,h-height-8)),w:width,h:height};
}
export function createCanvasProperties(doc,viewport,ctx,ui){
 const source=doc.getElementById('inspector'),panel=doc.getElementById('inspectorPanel'),win=doc.defaultView;
 let scroll=0,maximum=0,rect=null,body=null,tab='',selectedId=null,editing=null,shown=false;
 const C=ARCANE;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const hit=(r,x,y)=>r&&x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
 const emit=(node,type)=>node.dispatchEvent(new win.Event(type,{bubbles:true}));
 function finish(commit){
  const current=editing;if(!current)return;editing=null;
  const {control,node,initial}=current,value=control.value;
  control.remove();
  if(commit&&node.isConnected&&value!==initial){
   if(control.type==='number'&&(value===''||!control.validity.valid)){ui.schedule();return}
   node.value=value;emit(node,'input');if(node.isConnected)emit(node,'change');
  }
  ui.schedule();
 }
 function edit(node,r){
  if(node.disabled)return;finish(true);
  if(node.type==='checkbox'||node.type==='radio'){node.click();ui.schedule();return}
  if(node.type==='file'){node.click();ui.schedule();return}
  const control=node.cloneNode(true);control.removeAttribute('id');control.removeAttribute('name');control.removeAttribute('hidden');control.value=node.value;control.className='canvas-property-editor';
  Object.assign(control.style,{position:'absolute',left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});
  control.setAttribute('aria-label',node.getAttribute('aria-label')||node.id||'Modifier la propriété');
  viewport.append(control);editing={node,control,initial:node.value};
  control.addEventListener('blur',()=>{if(editing?.control===control)finish(true)});
  control.addEventListener('change',()=>{if(editing?.control===control&&(node.tagName==='SELECT'||['range','color'].includes(node.type)))finish(true)});
  control.focus({preventScroll:true});
  if(node.tagName==='SELECT'||node.type==='color'){try{control.showPicker?.()}catch{}}
  else if(!['range','number'].includes(node.type))control.select?.();
 }
 function lines(text,width){ctx.font='500 11px system-ui';const out=[];let line='';for(const word of text.split(/\s+/)){if(line&&ctx.measureText(line+' '+word).width>width){out.push(line);line=word}else line=(line+' '+word).trim()}if(line)out.push(line);return out}
 function clipped(r,area){const y=Math.max(r.y,area.y),end=Math.min(r.y+r.h,area.y+area.h);return end>y?{...r,y,h:end-y}:null}
 function clickRow(r,id,run,extra={}){const visible=clipped(r,body);if(visible)ui.region(visible,id,run,extra)}
 function draw(s,w,h){
  shown=!!(s.propertiesOpen&&!s.open&&source&&panel);if(!shown){rect=body=null;finish(false);return}
  if(editing&&!editing.node.isConnected)finish(false);
  rect=propertyLayout(w,h);const r=rect;
  if(r.h<100||r.w<100)return;
  const current=source.dataset.tab||'',id=s.propertiesId??null;
  if(tab!==current||selectedId!==id){scroll=0;tab=current;selectedId=id;finish(false)}
  arcanePanel(ctx,r);ui.region(r,'properties-panel',()=>{});
  ui.text('◇  PROPRIÉTÉS',r.x+14,r.y+15,r.w-62,10,C.gold,'left',700);
  ui.text(source.querySelector('.objecttitle')?.textContent||'Aucune sélection',r.x+14,r.y+37,r.w-62,17,C.fg,'left',700);
  ui.button({x:r.x+r.w-38,y:r.y+8,w:29,h:34},'properties-close','×',ui.close);
  const tabs=[...source.querySelectorAll('.inspector-tabs button')].filter(b=>!b.hidden),gap=5,tw=(r.w-24-(tabs.length-1)*gap)/Math.max(1,tabs.length);
  tabs.forEach((b,i)=>ui.button({x:r.x+12+i*(tw+gap),y:r.y+54,w:tw,h:30},'properties-tab-'+i,b.textContent,()=>{finish(false);b.click();scroll=0;ui.schedule()},b.getAttribute('aria-selected')==='true'));
  separator(ctx,r.x+12,r.y+91,r.w-24);
  body={x:r.x+12,y:r.y+100,w:r.w-24,h:Math.max(0,r.h-112)};
  const page=source.querySelector('.inspector-page:not([hidden])')||source,rows=inspectorRows(page);
  const width=body.w-10;
  const measured=rows.map(row=>{
   if(row.kind==='note'){row.lines=lines(row.label,width-8);return 10+row.lines.length*15}
   if(row.kind==='field')return row.node.type==='checkbox'||row.node.type==='radio'?32:48;
   if(row.kind==='grid'){row.cell=Math.min(row.footprint?30:80,(width-(row.cols-1)*4)/row.cols);return Math.ceil(row.buttons.length/row.cols)*(row.cell+4)+5}
   if(row.kind==='image')return 142;
   return row.kind==='button'?34:29;
  });
  maximum=Math.max(0,measured.reduce((a,b)=>a+b,0)-body.h);scroll=clamp(scroll,0,maximum);
  ctx.save();ctx.beginPath();ctx.rect(body.x,body.y,body.w,body.h);ctx.clip();
  let y=body.y-scroll;
  rows.forEach((row,i)=>{
   const rh=measured[i],rr={x:body.x,y,w:width,h:rh-4};y+=rh;
   if(!clipped(rr,body))return;const key='property-'+i;
   if(row.kind==='note'){row.lines.forEach((l,j)=>ui.text(l,rr.x+4,rr.y+9+j*15,rr.w-8,11,C.muted));return}
   if(row.kind==='heading'){ui.text(row.label,rr.x+4,rr.y+12,rr.w-8,13,C.gold,'left',700);return}
   if(row.kind==='section'){arcaneTile(ctx,rr,{selected:row.node.open});ui.text((row.node.open?'▾  ':'▸  ')+row.label,rr.x+9,rr.y+rr.h/2,rr.w-18,11,C.gold,'left',700);clickRow(rr,key,()=>{row.node.open=!row.node.open;ui.schedule()});return}
   if(row.kind==='button'){arcaneTile(ctx,rr,{hover:ui.hover(rr),selected:row.node.getAttribute('aria-pressed')==='true'});ui.text(row.label,rr.x+rr.w/2,rr.y+rr.h/2,rr.w-12,12,row.node.disabled?C.muted:row.node.classList.contains('danger')?'#f2a6a0':C.fg,'center');if(!row.node.disabled)clickRow(rr,key,()=>{row.node.click();ui.schedule()});return}
   if(row.kind==='grid'){row.buttons.forEach((button,i)=>{
    const br={x:rr.x+(i%row.cols)*(row.cell+4),y:rr.y+Math.floor(i/row.cols)*(row.cell+4),w:row.cell,h:row.cell};if(!clipped(br,body))return;
    arcaneTile(ctx,br,{selected:button.getAttribute('aria-pressed')==='true',hover:ui.hover(br)});
    const img=button.querySelector('img');if(img){const im=ui.image(img.src),iw=im.naturalWidth,ih=im.naturalHeight;if(iw&&ih){const k=(br.h-22)/Math.max(iw,ih);ctx.drawImage(im,br.x+(br.w-iw*k)/2,br.y+3,iw*k,ih*k)}ui.text(button.textContent,br.x+br.w/2,br.y+br.h-10,br.w-6,9,C.fg,'center')}
    else ui.text(button.textContent,br.x+br.w/2,br.y+br.h/2,br.w-4,12,C.fg,'center');
    if(!button.disabled)clickRow(br,key+'-'+i,()=>{button.click();ui.schedule()})
   });return}
   if(row.kind==='image'){plate(ctx,rr,'#0b1919',C.edge,5);const im=row.image.tagName==='IMG'?ui.image(row.image.src):row.image,iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;if(iw&&ih){const k=Math.min((rr.w-12)/iw,(rr.h-12)/ih),dx=rr.x+(rr.w-iw*k)/2,dy=rr.y+(rr.h-ih*k)/2;try{ctx.drawImage(im,dx,dy,iw*k,ih*k)}catch{}const crop=row.node.querySelector('span');if(!row.portrait&&crop){ctx.strokeStyle=C.gold;ctx.strokeRect(dx+parseFloat(crop.style.left)*iw*k/100,dy+parseFloat(crop.style.top)*ih*k/100,parseFloat(crop.style.width)*iw*k/100,parseFloat(crop.style.height)*ih*k/100)}}
    if(row.portrait)clickRow(rr,key,()=>{},{portraitDrag:true,dropTarget:row.node});return}
   const node=row.node,check=node.type==='checkbox'||node.type==='radio';
   if(check){plate(ctx,rr,'#172b26',C.edge,4);const cr={x:rr.x+7,y:rr.y+5,w:18,h:18};plate(ctx,cr,node.checked?'#ad8b55':'#0d1d1b',C.edge,2);if(node.checked)ui.text('✓',cr.x+9,cr.y+9,16,12,'#11251f','center',700);ui.text(row.label,rr.x+33,rr.y+rr.h/2,rr.w-40,11,node.disabled?C.muted:C.fg);if(!node.disabled)clickRow(rr,key,()=>edit(node,cr));return}
   ui.text(row.label,rr.x+3,rr.y+7,rr.w-6,11,C.muted);const field={x:rr.x+2,y:rr.y+17,w:rr.w-4,h:25};
   plate(ctx,field,'#0b1919',ui.hover(field)?C.gold:C.edge,3);
   let value=node.type==='file'?'Choisir un fichier…':node.tagName==='SELECT'?(node.selectedOptions?.[0]?.textContent||node.options?.[node.selectedIndex]?.textContent||node.value)+'  ▾':node.value;
   if(node.type==='color'){plate(ctx,{x:field.x+5,y:field.y+5,w:24,h:15},node.value,C.edge,2);ui.text(value,field.x+36,field.y+12,field.w-44,11,C.fg)}else ui.text(value||'—',field.x+7,field.y+12,field.w-14,11,node.disabled?C.muted:C.fg);
   if(!node.disabled&&field.y>=body.y&&field.y+field.h<=body.y+body.h)clickRow(field,key,()=>edit(node,field));
  });
  ctx.restore();
  if(maximum>0){const sh=Math.max(15,body.h*body.h/(maximum+body.h));plate(ctx,{x:body.x+body.w-4,y:body.y+(body.h-sh)*scroll/maximum,w:3,h:sh},C.gold,null,1)}
 }
 const observer=win.MutationObserver&&source?new win.MutationObserver(()=>{if(shown)ui.schedule()}):null;
 observer?.observe(source,{subtree:true,childList:true,characterData:true,attributes:true});
 return {draw,editing:()=>!!editing,finish,wheel(p,delta){if(!shown||!hit(rect,p.x,p.y))return false;finish(true);scroll=clamp(scroll+delta,0,maximum);ui.schedule();return true},
  key(e){if(editing&&['Enter','Escape'].includes(e.key)){e.preventDefault();finish(e.key==='Enter');return true}if(shown&&e.key==='Escape'&&!doc.pointerLockElement&&!editing){ui.close();return true}return false},
  dispose(){finish(false);observer?.disconnect()}
 };
}

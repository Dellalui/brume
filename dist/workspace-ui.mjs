import {setText,setHidden,setData,setAttr} from './ui-values.mjs';
// UI orchestration: existing controls keep their listeners and IDs.
export const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
export function searchCommands(entries,query,limit=80){
 const q=normalizeSearch(query),words=q.split(/\s+/).filter(Boolean);
 return entries.map((entry,index)=>{
  const title=normalizeSearch(entry.label),hay=normalizeSearch([entry.label,entry.group,entry.detail,entry.keywords].join(' '));
  const matches=words.every(w=>hay.includes(w));
  const score=!q?0:title===q?0:title.startsWith(q)?1:title.includes(q)?2:words.every(w=>title.includes(w))?3:4;
  return {entry,index,matches,score};
 }).filter(x=>x.matches&&!x.entry.disabled).sort((a,b)=>a.score-b.score||a.index-b.index).slice(0,limit).map(x=>x.entry);
}
export function syncDockState(doc){
 const panels=[...doc.querySelectorAll('.panel:not(.legacy-build-data)')],open=panels.filter(p=>!p.hidden);
 setData(doc.body,'dockLeft',open.some(p=>p.id!=='inspectorPanel'));
 setData(doc.body,'dockRight',open.some(p=>p.id==='inspectorPanel'));
}
const SCENE_TABS=[['lighting','Lumière'],['sky','Ciel astral'],['weather','Météo'],['graphics','Graphismes']];
export function organizeSceneSettings(doc){
 const body=doc.querySelector('#lightPanel .panelbody'),env=doc.getElementById('environmentSettings');
 if(!body||!env||doc.getElementById('sceneSettingsTabs'))return;
 const tabs=doc.createElement('div');tabs.id='sceneSettingsTabs';tabs.className='scene-settings-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Réglages de la scène');
 const pages={};let active='lighting';
 for(const [id,label]of SCENE_TABS){
  const button=doc.createElement('button'),page=doc.createElement('section');button.type='button';button.id='scene-tab-'+id;button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls','scene-page-'+id);
  page.id='scene-page-'+id;page.setAttribute('role','tabpanel');page.setAttribute('aria-labelledby',button.id);pages[id]=page;tabs.append(button);
  button.onclick=()=>{active=id;activate();body.scrollTop=0};
  button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...tabs.children],i=buttons.indexOf(button),n=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[n].click();buttons[n].focus()};
 }
 let target='lighting';
 for(const node of [...body.children]){
  if(node===env)continue;
  if(node.tagName==='H3'&&normalizeSearch(node.textContent).includes('lisibilite'))target='graphics';
  if(node.querySelector?.('#blockShadowQuality')||node.id==='blockShadowQuality')pages.graphics.append(node);
  else pages[target].append(node);
 }
 target='sky';
 for(const node of [...env.children]){
  if(node.tagName==='H3'&&normalizeSearch(node.textContent).includes('distance de rendu'))target='graphics';
  const weather=['env-season','env-weather','env-intensity','env-syncLight'].some(id=>node.id===id||node.querySelector?.('#'+id));
  if(weather)pages.weather.append(node);
  else if(['env-quality','env-cloudShadows','env-cloudShadowStrength'].some(id=>node.id===id||node.querySelector?.('#'+id)))pages.graphics.append(node);
  else pages[target].append(node);
 }
 const heading=doc.createElement('h3');heading.textContent='Saison et précipitations';pages.weather.prepend(heading);
 const profiles=doc.createElement('section');profiles.className='graphics-profiles';profiles.innerHTML='<h3>Qualité globale</h3><p class="micro">Appliquez un profil, puis ajustez les réglages en dessous. Le ciel et la météo restent inchangés.</p><div class="row"><button type="button" data-graphics-profile="fast">Fluide</button><button type="button" data-graphics-profile="balanced">Équilibré</button><button type="button" data-graphics-profile="high">Détaillé</button></div>';
 pages.graphics.prepend(profiles);env.hidden=true;body.replaceChildren(env,tabs,...Object.values(pages));
 function activate(){for(const [id,page]of Object.entries(pages)){page.hidden=id!==active;const button=doc.getElementById('scene-tab-'+id);button.setAttribute('aria-selected',String(id===active));button.tabIndex=id===active?0:-1}}
 activate();
}
export const GRAPHICS_PROFILES=Object.freeze({
 fast:{far:48,cone:90,effects:'low',surface:'fast',shadowQuality:1,cloudQuality:'low'},
 balanced:{far:80,cone:110,effects:'balanced',surface:'detail',shadowQuality:1,cloudQuality:'balanced'},
 high:{far:144,cone:150,effects:'high',surface:'detail',shadowQuality:2,cloudQuality:'high'}
});
export function applyGraphicsProfile(map,id){
 const p=GRAPHICS_PROFILES[id];if(!p)return false;
 Object.assign(map.renderSettings??={}, {far:p.far,cone:p.cone,effects:p.effects,surface:p.surface});
 (map.blockLighting??={}).quality=p.shadowQuality;
 if(map.environment&&map.environment.quality!=='off')map.environment.quality=p.cloudQuality;
 return true;
}
export function cameraSnapshot(camera){
 if(camera?.mode!=='fly'||!camera.fly)return null;
 const {x,y,z}=camera.fly,angle=camera.angle,tilt=camera.tilt;
 if(![x,y,z,angle,tilt].every(Number.isFinite)||Math.abs(x)>10000||Math.abs(z)>10000||y< -200||y>500)return null;
 return {mode:'fly',fly:{x,y,z},angle,tilt:Math.max(-.995,Math.min(.995,tilt))};
}
export function createBookmarkStore(storage,key='brumes-camera-bookmarks-v1'){
 let items=[];
 try{const data=JSON.parse(storage?.getItem(key)||'[]');if(Array.isArray(data))items=data.filter(b=>b&&typeof b.id==='string'&&typeof b.mapId==='string'&&typeof b.name==='string'&&cameraSnapshot(b.camera)).slice(0,40).map(b=>({id:b.id,mapId:b.mapId,name:b.name.slice(0,60),camera:cameraSnapshot(b.camera)}))}catch{}
 let persistent=true;
 const persist=()=>{try{if(!storage)throw Error('no storage');storage.setItem(key,JSON.stringify(items));persistent=true}catch{persistent=false}return persistent};
 return {list:()=>items.map(b=>({...b,camera:cameraSnapshot(b.camera)})),add({id,mapId,name,camera}){
  const view=cameraSnapshot(camera),label=String(name||'').trim().slice(0,60);
  if(!view||!label||typeof id!=='string'||typeof mapId!=='string'||items.length>=40||items.some(b=>b.id===id))return false;
  items.push({id,mapId,name:label,camera:view});persist();return true;
 },remove(id){const next=items.filter(b=>b.id!==id);if(next.length===items.length)return false;items=next;persist();return true},persistent:()=>persistent};
}
export function mountWorkspace(doc,api){
 const by=id=>doc.getElementById(id),dialog=by('commandDialog'),input=by('commandSearch'),results=by('commandResults');
 let current=[],active=0,focused=false,store,bookmarkKey=null;
 try{store=createBookmarkStore(doc.defaultView.localStorage)}catch{store=createBookmarkStore(null)}
 function setFocus(value){value=!!value;if(focused===value)return;focused=value;doc.body.classList.toggle('workspace-focus',focused);setAttr(by('focusWorkspace'),'aria-pressed',focused);setAttr(by('focusWorkspace'),'title',(focused?'Afficher les outils':'Agrandir le plateau')+' · Alt+M');syncDockState(doc);api.schedule()}
 function setActive(i,scroll=false){
  active=Math.max(0,Math.min(current.length-1,i));
  for(let j=0;j<results.children.length;j++){const el=results.children[j];if(el.getAttribute('role')==='option')el.setAttribute('aria-selected',String(j===active))}
  if(current.length){input.setAttribute('aria-activedescendant','command-result-'+active);if(scroll)results.children[active]?.scrollIntoView?.({block:'nearest'})}
  else input.removeAttribute('aria-activedescendant');
 }
 function run(index){const command=current[index];if(!command||command.disabled)return;dialog.close();api.prepare();command.run()}
 function draw(){
  current=searchCommands(api.commands(store.list()),input.value,input.value.trim()?80:18);results.replaceChildren();
  current.forEach((entry,index)=>{
   const button=doc.createElement('button'),body=doc.createElement('div'),name=doc.createElement('strong'),detail=doc.createElement('small');
   button.type='button';button.id='command-result-'+index;button.className='command-result';button.setAttribute('role','option');button.tabIndex=-1;name.textContent=entry.label;detail.textContent=[entry.group,entry.detail].filter(Boolean).join(' · ');body.append(name,detail);button.append(body);
   if(entry.shortcut){const k=doc.createElement('kbd');k.textContent=entry.shortcut;button.append(k)}
   button.onpointermove=()=>setActive(index);button.onmousedown=e=>e.preventDefault();button.onclick=()=>run(index);results.append(button);
  });
  if(!current.length){const p=doc.createElement('p');p.className='empty';p.textContent='Aucune commande ou ressource correspondante.';results.append(p)}
  by('commandCount').textContent=current.length+' résultat'+(current.length===1?'':'s');setActive(0);
 }
 function open(){
  if(dialog.open||doc.querySelector('dialog[open]'))return;
  api.prepare();input.value='';dialog.showModal();draw();input.focus();
 }
 input.oninput=draw;
 input.onkeydown=e=>{
  if(!['ArrowDown','ArrowUp','Enter','Home','End'].includes(e.key))return;
  if(e.key==='Home'||e.key==='End'){if(!e.ctrlKey&&!e.metaKey)return}
  e.preventDefault();
  if(e.key==='Enter'){run(active);return}
  setActive(e.key==='Home'?0:e.key==='End'?current.length-1:(active+(e.key==='ArrowDown'?1:-1)+current.length)%Math.max(1,current.length),true);
 };
 by('commandLauncher').onclick=open;by('commandClose').onclick=()=>dialog.close();by('focusWorkspace').onclick=()=>setFocus(!focused);
 function renderBookmarks(){
  const list=by('bookmarkList');if(!list)return;
  const items=store.list(),maps=api.maps(),key=JSON.stringify([items,maps.map(m=>[m.id,m.name])]);if(key===bookmarkKey)return;bookmarkKey=key;setText(by('bookmarkCount'),'· '+items.length+'/40');list.replaceChildren();
  if(!items.length){const p=doc.createElement('p');p.className='empty';p.textContent='Aucun repère. Placez la caméra puis mémorisez votre première vue.';list.append(p)}
  for(const item of items){
   const map=maps.find(m=>m.id===item.mapId),row=doc.createElement('div'),body=doc.createElement('div'),name=doc.createElement('strong'),meta=doc.createElement('small'),go=doc.createElement('button'),del=doc.createElement('button');
   row.className='bookmark-row';name.textContent=item.name;meta.textContent=map?.name||'Carte indisponible';body.append(name,meta);
   go.type=del.type='button';go.textContent='Aller';go.disabled=!map;go.onclick=()=>api.recall(item);del.textContent='×';del.className='danger';del.title='Supprimer ce repère';del.setAttribute('aria-label','Supprimer '+item.name);del.onclick=()=>{if(store.remove(item.id)){renderBookmarks();api.toast('Repère supprimé.')}};row.append(body,go,del);list.append(row);
  }
 }
 by('bookmarkForm').onsubmit=e=>{
  e.preventDefault();if(!api.isMJ())return;
  const map=api.map(),name=by('bookmarkName').value.trim()||'Repère '+(store.list().length+1);
  if(!store.add({id:api.uid(),mapId:map.id,name,camera:map.camera})){api.toast('Impossible de mémoriser cette vue : caméra libre requise, maximum 40 repères.');return}
  by('bookmarkName').value='';renderBookmarks();api.toast(store.persistent()?'Repère mémorisé.':'Repère mémorisé pour cette session uniquement.');
 };
 by('quickFocus').onclick=api.focusSelection;by('quickControl').onclick=api.controlSelection;by('quickInspect').onclick=()=>api.panel('inspectorPanel');
 for(const b of doc.querySelectorAll('[data-graphics-profile]'))b.onclick=()=>api.profile(b.dataset.graphicsProfile);
 const panelKeys={'1':'inspectorPanel','2':'layersPanel','3':'lightPanel','4':'effectsPanel','5':'journalPanel','6':'bookmarksPanel'};
 function handleKey(e){
  const key=String(e.key||'').toLowerCase(),editing=e.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName);
  if(doc.querySelector('dialog[open]')||editing)return false;
  let action=null;
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&key==='k')action=open;
  else if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&key==='s'&&api.isMJ())action=api.save;
  else if(e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){
   if(key==='m')action=()=>setFocus(!focused);
   const digit=/^Digit[1-6]$/.test(e.code||'')?e.code.slice(5):key;
   if(panelKeys[digit]&&api.isMJ())action=()=>api.panel(panelKeys[digit]);
  }
  if(!action)return false;e.preventDefault();if(!e.repeat)action();return true;
 }
 function refresh(){
  syncDockState(doc);const o=api.selection(),show=api.isMJ()&&api.mode()==='play'&&!!o;
  setHidden(by('selectionBar'),!show);if(show){setText(by('quickSelectionName'),o.name);setText(by('quickSelectionMeta'),api.selectionLabel(o));setHidden(by('quickControl'),!api.isCharacter(o))}
  if(!by('bookmarksPanel').hidden)renderBookmarks();
 }
 return {open,handleKey,refresh,setFocus,renderBookmarks};
}

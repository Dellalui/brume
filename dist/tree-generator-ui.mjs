import {TREE_GENERATOR_PROFILES,normalizeTreeConfig,generateLeaflessTree} from './organic-trees.mjs';
import {treeTypeConfig} from './tree-types.mjs';
export function mountTreeGenerator(root,{materials,onSave,onEquip,getSaved=()=>[]}){
 const select=root.querySelector('#treeProfile'),material=root.querySelector('#treeMaterial'),canvas=root.querySelector('#treePreview'),status=root.querySelector('#treeReport');
 const fields=['name','seed','height','radius','branches','reach','depth','spread','roots','budget','lean','curvature','taper','droop','tipStyle','variation','twigDensity','dominance','asymmetry','irregularity','flexibility','rootFlare'];
 const field=k=>root.querySelector('#tree-'+k),adapt=root.querySelector('#treeAdaptCrowns');
 for(const p of TREE_GENERATOR_PROFILES){const o=document.createElement('option');o.value=p.key;o.textContent=p.name;select.append(o)}
 for(const [id,b] of Object.entries(materials)){if(['water','lava','air'].includes(id)||b.solid===false)continue;const o=document.createElement('option');o.value=id;o.textContent=b.name||id;material.append(o)}
 function config(){return treeTypeConfig({key:select.value,material:material.value,adaptCrowns:adapt.checked,...Object.fromEntries(fields.map(k=>[k,field(k).value]))})}
 let view=0,drag=null,current=null;
 function draw(){
  const c=config(),nodes=generateLeaflessTree(c),ctx=canvas.getContext('2d');current=c;
  const project=n=>{const [x,y,z]=n.pos.map((v,i)=>v+n.offset[i]);return [x*Math.cos(view)-y*Math.sin(view),z+.5+(x*Math.sin(view)+y*Math.cos(view))*.13]};
  const points=nodes.map(project),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),maxY=Math.max(...ys),minY=Math.min(0,...ys),w=canvas.width,h=canvas.height,s=Math.min((w-50)/Math.max(1,maxX-minX),(h-40)/Math.max(1,maxY-minY)),p=n=>{const [x,y]=project(n);return [w/2+(x-(minX+maxX)/2)*s,h-20-(y-minY)*s]};
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#12211d';ctx.fillRect(0,0,w,h);ctx.lineCap='round';
  const color=materials[c.material]?.side||materials[c.material]?.top||'#92724d';
  for(const n of nodes){const a=p(n);for(const child of n.children){const b=p(child);ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,(n.radius+child.radius)*s);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke()}ctx.fillStyle=color;ctx.beginPath();ctx.arc(...a,Math.max(.6,n.radius*s),0,Math.PI*2);ctx.fill();if(n.root){ctx.strokeStyle=color;ctx.lineWidth=n.radius*2*s;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(a[0],a[1]+s*.5);ctx.stroke()}}
  status.textContent='1 objet · '+nodes.length+' points de croissance · graine '+c.seed+' · aperçu simplifié sans feuilles';
 }
 function load(){const p=TREE_GENERATOR_PROFILES.find(p=>p.key===select.value)||TREE_GENERATOR_PROFILES[0],c=treeTypeConfig(p);material.value=c.material;for(const k of fields)field(k).value=c[k];adapt.checked=c.adaptCrowns;draw()}
 select.addEventListener('change',load);material.addEventListener('change',draw);for(const k of fields)field(k).addEventListener('input',draw);adapt.addEventListener('change',draw);
 root.querySelector('#treeRandom').addEventListener('click',()=>{field('seed').value=String(Math.floor(Math.random()*4294967296));draw()});
 const saved=root.querySelector('#treeSaved'),update=root.querySelector('#treeUpdate');function refreshSaved(value=saved.value){saved.replaceChildren();const first=document.createElement('option');first.value='';first.textContent='Choisir un type enregistré';saved.append(first);for(const p of getSaved()){const opt=document.createElement('option');opt.value=p.id;opt.textContent=p.config.name;saved.append(opt)}saved.value=[...saved.options].some(o=>o.value===value)?value:'';update.disabled=!saved.value;}saved.addEventListener('focus',()=>refreshSaved());saved.addEventListener('change',()=>{const p=getSaved().find(p=>p.id===saved.value);update.disabled=!p;if(!p)return;const c=treeTypeConfig(p.config);select.value=c.key;material.value=c.material;for(const k of fields)field(k).value=c[k];adapt.checked=c.adaptCrowns;draw()});root.querySelector('#treeSave').addEventListener('click',()=>{try{refreshSaved(onSave(config()))}catch(e){status.textContent=e.message}});update.addEventListener('click',()=>{if(!saved.value)return;try{refreshSaved(onSave(config(),saved.value))}catch(e){status.textContent=e.message}});root.querySelector('#treeEquip').addEventListener('click',()=>{try{onEquip(config())}catch(e){status.textContent=e.message}});refreshSaved();
 canvas.addEventListener('pointerdown',e=>{drag=e.clientX;canvas.setPointerCapture?.(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(drag===null)return;view+=(e.clientX-drag)*.015;drag=e.clientX;draw()});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
 root.querySelector('#treeRotate').addEventListener('click',()=>{view+=Math.PI/4;draw()});
 const list=root.querySelector('#treeCatalogList'),family=root.querySelector('#treeCatalogFamily'),catalog=root.querySelector('#treeCatalog'),custom=root.querySelector('#treeCustom'),ct=root.querySelector('#treeCatalogTab'),ut=root.querySelector('#treeCustomTab');
 function show(customMode){catalog.hidden=customMode;custom.hidden=!customMode;ct.classList.toggle('primary',!customMode);ut.classList.toggle('primary',customMode);if(!customMode)renderCatalog()}
 function renderCatalog(){
  list.replaceChildren();
  const entries=family.value==='saved'?getSaved().map(p=>p.config):TREE_GENERATOR_PROFILES.filter(p=>{const a=normalizeTreeConfig(p).architecture;return family.value==='all'||(family.value==='dead'?['cut','log','dead'].includes(a):family.value==='conifer'?p.material==='pinewood'&&!['cut','log','dead'].includes(a):p.material!=='pinewood'&&!['cut','log','dead'].includes(a))});
  for(const p of entries){const c=treeTypeConfig(p),row=document.createElement('div'),name=document.createElement('strong'),info=document.createElement('small'),equip=document.createElement('button'),edit=document.createElement('button');row.className='tree-catalog-card';name.textContent=c.name;info.textContent=c.architecture==='log'?'Bois au sol':c.height+' unités · '+(c.architecture==='conifer'?'conifère sans aiguilles':'sans feuilles');equip.textContent=c.architecture==='log'?'Poser':'Planter';equip.addEventListener('click',()=>onEquip(c));edit.textContent='Personnaliser';edit.addEventListener('click',()=>{select.value=c.key;material.value=c.material;for(const k of fields)field(k).value=c[k];adapt.checked=c.adaptCrowns;saved.value='';update.disabled=true;show(true);draw()});row.append(name,info,equip,edit);list.append(row)}
  if(!entries.length)list.textContent='Aucun type personnalisé enregistré.';
 }
 ct.addEventListener('click',()=>show(false));ut.addEventListener('click',()=>{refreshSaved();show(true)});family.addEventListener('change',renderCatalog);
 load();show(false);return {draw,config,refreshSaved};
}

// Inspector organization is independent from the scene and preserves the live field handlers.
let activeTab='general',previousType='',scroll=0;
const expansion=new Map();
export function rememberInspector(root){scroll=root.scrollTop||0;for(const d of root.querySelectorAll?.('details')||[])expansion.set(d.querySelector('summary')?.textContent,d.open)}
export function organizeInspector(root,o){
 if(!root.querySelectorAll)return;
 const actor=['hero','npc','enemy'].includes(o.type),kind=actor?'actor':o.type;
 if(kind!==previousType){activeTab='general';scroll=0;previousType=kind}
 const title=root.querySelector('.objecttitle'),forms=[...root.children].filter(n=>n!==title),tabs=document.createElement('div');tabs.className='section-tabs inspector-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Propriétés de la sélection');
 const pages={};if(activeTab==='vision'&&!actor&&!o.light)activeTab='general';for(const [id,label]of [['general',actor?'Personnage':'Élément'],['appearance','Apparence'],['vision',actor?'Vision':'Lumière'],['effects','Effets']]){let page=document.createElement('div');page.id='inspector-'+id;page.className='inspector-page';page.setAttribute('role','tabpanel');page.setAttribute('aria-label',label);let button=document.createElement('button');button.type='button';button.textContent=label;button.id='inspector-tab-'+id;button.setAttribute('role','tab');button.setAttribute('aria-controls',page.id);page.setAttribute('aria-labelledby',button.id);button.onclick=()=>{activeTab=id;scroll=0;activate();root.scrollTop=0};button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...tabs.children].filter(b=>!b.hidden),i=buttons.indexOf(button),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus()};button.hidden=id==='vision'&&!actor&&!o.light;tabs.append(button);pages[id]=page;}
 // Each direct block (label, row, details) moves as a unit: IDs and event listeners stay intact.
 for(const form of forms){if(form.tagName==='BUTTON'){pages.general.append(form);continue}if(form.querySelector('#treeVariant')){pages.appearance.append(form);continue}for(const node of [...form.children]){
  let page='general';const has=id=>node.id===id||!!node.querySelector('#'+id);
  if(has('objectColor')||has('imageProperties')||has('treeVariant'))page='appearance';
  if(has('visionNear')||has('lightProperties')&&node.children.length)page='vision';
  if(has('objectEffect')||has('auraEnabled'))page='effects';
  pages[page].append(node);
 }}
 root.replaceChildren();if(title)root.append(title);root.append(tabs,...Object.values(pages));
 for(const d of root.querySelectorAll('details')){let name=d.querySelector('summary')?.textContent;d.open=expansion.has(name)?expansion.get(name):!name?.includes('BARRE DE VIE');d.ontoggle=()=>expansion.set(name,d.open)}
 // Group advanced physics/secret switches away from the common movement and health controls.
 const advanced=document.createElement('details');advanced.className='advanced-properties';advanced.innerHTML='<summary>Collision, ombre et confidentialité</summary>';
 for(const id of ['objectBlocking','objectSight','objectShadow','objectSecret']){let field=root.querySelector('#'+id)?.closest('label');if(field)advanced.append(field)}pages.general.append(advanced);
 const actions=root.querySelector('#focusObject')?.parentElement;if(actions){actions.classList.add('object-actions');pages.general.append(actions)}
 const health=root.querySelector('#healthMax')?.closest('details');if(actor&&health){health.open=true;health.querySelector('summary').textContent='Vie et affichage';const row=root.querySelector('#actorHP')?.parentElement?.parentElement;if(row)health.querySelector('summary').after(row)}
 if(!pages.vision.textContent.trim()){pages.vision.innerHTML='<p class="empty">Cet élément n’émet pas de lumière. Ajoutez une source depuis Scène, ou sélectionnez un personnage pour régler sa vision.</p>'}
 const enabled=!!o.aura?.enabled,energy=['energy','azure','crimson','flame'].includes(o.aura?.kind);
 for(const id of ['auraKind','auraColor','auraRadius','auraIntensity','auraHeight','auraSpeed','auraLightning']){const el=root.querySelector('#'+id);if(el){el.closest('label').hidden=!enabled||(['auraHeight','auraSpeed','auraLightning'].includes(id)&&!energy)}}
 for(const id of ['effectColor','effectSize','effectSpeed','effectDensity']){const el=root.querySelector('#'+id);if(el)el.closest('label').hidden=!o.effect?.kind}
 const segment=['wall','door'].includes(o.type)||!!o.surface;if(o.surface){for(let id of ['imageFlat','objectD']){let field=root.querySelector('#'+id)?.closest('label');if(field)field.hidden=true}}
 if(segment||!(o.frameCount>1)){for(const id of ['imageSlot','frameNumber']){let el=root.querySelector('#'+id);if(el)(id==='frameNumber'?el.closest('.row'):el.closest('label')||el).hidden=true}}
 if(segment){for(const id of ['frameCount','imageScale','flipImage','frameOffset','portraitAngle','portraitFront']){let el=root.querySelector('#'+id);if(el)(el.closest('label')||el).hidden=true}let upload=root.querySelector('#uploadImages');if(upload)upload.multiple=false;for(const p of root.querySelectorAll('#imageProperties .micro'))if((p.textContent.includes('puissances')||p.textContent.includes('1 image, 2'))||p.textContent.includes('Import multiple'))p.hidden=true;}
 function activate(){for(const [id,page]of Object.entries(pages)){page.hidden=id!==activeTab;let b=root.querySelector('#inspector-tab-'+id);b.setAttribute('aria-selected',String(id===activeTab));b.tabIndex=id===activeTab?0:-1;}root.dataset.tab=activeTab}
 activate();root.scrollTop=scroll;
}

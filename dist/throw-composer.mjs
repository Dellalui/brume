import {RECIPE_PRESETS,EFFECT_TYPES,SHAPES,normalizeLayers,normalizeLayer,recipeDuration,arrangeLayers} from './effect-recipes.mjs';
import {throwConfig} from './throw-effects.mjs';
export function createThrowComposer(root,{getItem,getSaved,onChange,onSave,onDelete,onPreview}){
 const doc=root.ownerDocument,node=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e};
 const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b};
 function select(items,value,change){const e=node('select');for(const [id,name]of items){const o=node('option',name);o.value=id;e.append(o)}e.value=value;e.onchange=()=>change(e.value);return e}
 function field(text,input){const l=node('label');l.append(node('span',text),input);return l}
 function input(type,value,change,min,max,step){const e=node('input');e.type=type;e.value=value;if(min!==undefined)e.min=min;if(max!==undefined)e.max=max;if(step!==undefined)e.step=step;e.onchange=()=>change(type==='number'?Number(e.value):e.value);return e}
 function edit(fn){const item=getItem();if(item?.kind!=='throw')return;item.layers=throwConfig(item).layers;fn(item);item.layers=normalizeLayers(item.layers);onChange();render()}
 function render(){const item=getItem();root.replaceChildren();if(item?.kind!=='throw')return;const cfg=throwConfig(item),saved=getSaved(),all=[...RECIPE_PRESETS,...saved.map(p=>({...p,id:'saved:'+p.id}))];
  const head=node('div');head.className='composer-toolbar';
  const library=select([['','Choisir un preset…'],...all.map(p=>[p.id,p.name])],'',id=>{const p=all.find(p=>p.id===id);if(!p)return;edit(o=>{o.layers=normalizeLayers(p.layers);o.name=p.name;o.recipeId=id.startsWith('saved:')?p.id.slice(6):null;o.preset=RECIPE_PRESETS.some(x=>x.id===p.id)?p.id:'blast';Object.assign(o,p.settings||{})})});library.setAttribute('aria-label','Bibliothèque de presets');head.append(library,button('Prévisualiser au viseur',onPreview));root.append(head);
  root.append(field('Nom du preset',input('text',cfg.name,v=>edit(o=>o.name=v))));
  const settings=Object.fromEntries(['range','speed','power','destroy','visualScale','visualQuality'].map(k=>[k,cfg[k]]));
  const actions=node('div');actions.className='composer-toolbar';actions.append(button('Enregistrer',()=>onSave({id:item.recipeId||null,name:cfg.name,layers:cfg.layers,settings})),button('Enregistrer une copie',()=>onSave({id:null,name:cfg.name+' — copie',layers:cfg.layers,settings})));
  if(item.recipeId)actions.append(button('Supprimer ce preset',()=>onDelete(item.recipeId)));root.append(actions);
  const timing=node('div');timing.className='composer-toolbar';timing.append(button('Tout ensemble',()=>edit(o=>o.layers=arrangeLayers(o.layers,false))),button('Enchaîner',()=>edit(o=>o.layers=arrangeLayers(o.layers,true))),button('+ Ajouter un effet',()=>edit(o=>o.layers.push(normalizeLayer({kind:'fire'},o.layers.length)))));root.append(timing);
  const total=recipeDuration(cfg.layers),summary=node('p',`${cfg.layers.filter(l=>l.enabled).length} effets actifs · ${total.toFixed(1)} s après l’impact`);summary.className='micro';summary.setAttribute('role','status');root.append(summary);
  const timeline=node('div');timeline.className='effect-timeline';timeline.setAttribute('aria-label','Chronologie des effets');
  cfg.layers.forEach((l,i)=>{const row=node('div');row.className='effect-track';const bar=node('span',`${i+1} · ${EFFECT_TYPES.find(t=>t.id===l.kind).name} · ${l.delay.toFixed(1)}–${(l.delay+l.duration).toFixed(1)} s`);bar.style.marginLeft=(l.delay/Math.max(.1,total)*100)+'%';bar.style.width=(l.duration/Math.max(.1,total)*100)+'%';bar.style.borderColor=l.color;bar.style.opacity=l.enabled?'1':'.35';bar.title=bar.textContent;row.append(bar);timeline.append(row)});root.append(timeline);
  cfg.layers.forEach((layer,index)=>{const card=node('fieldset');card.className='effect-layer-card';card.dataset.layer=index;const legend=node('legend',`Effet ${index+1}`);card.append(legend);
   const set=(key,value)=>edit(o=>o.layers[index][key]=value),enabled=node('input');enabled.type='checkbox';enabled.checked=layer.enabled;enabled.onchange=()=>set('enabled',enabled.checked);card.append(field('Actif',enabled));
   const grid=node('div');grid.className='effect-layer-grid';
   grid.append(field('Effet',select(EFFECT_TYPES.map(t=>[t.id,t.name]),layer.kind,v=>edit(o=>{o.layers[index].kind=v;o.layers[index].color=EFFECT_TYPES.find(t=>t.id===v).color}))),field('Forme visuelle',select(SHAPES.map(s=>[s.id,s.name]),layer.shape,v=>set('shape',v))),field('Délai (s)',input('number',layer.delay,v=>set('delay',v),0,3600,.1)),field('Durée (s)',input('number',layer.duration,v=>set('duration',v),.1,3600,.1)),field('Taille ×',input('number',layer.size,v=>set('size',v),.05,20,.05)),field('Intensité',input('number',layer.strength,v=>set('strength',v),0,3,.1)),field('Couleur',input('color',layer.color,v=>set('color',v))));card.append(grid);
   const controls=node('div');controls.className='composer-toolbar';controls.append(button('Dupliquer',()=>edit(o=>o.layers.splice(index+1,0,{...o.layers[index]}))),button('Retirer',()=>edit(o=>o.layers.splice(index,1))));card.append(controls);root.append(card);
  });
  const note=node('p','Les délais commencent à l’impact. Les formes et couches sont visuelles : les blocs sont affectés une seule fois, dans le rayon réglé au-dessus. Distorsion et trou noir gardent une lentille circulaire.');note.className='micro';root.append(note);
 }
 return{render};
}

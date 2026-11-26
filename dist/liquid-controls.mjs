import {LIQUID_PRESETS,normalizeLiquidStyle,liquidPresetName} from './liquid-style.mjs';
// Independent, reusable controls for held items and selected source objects.
export function mountLiquidControls(root,kind,style,onChange,{disabled=false}={}){
 const doc=root.ownerDocument;root.replaceChildren();root.hidden=!['water','lava'].includes(kind);if(root.hidden)return;
 const s=normalizeLiquidStyle(kind,style),section=doc.createElement('section');section.className='liquid-controls';
 const title=doc.createElement('h3');title.textContent='Apparence du liquide';section.append(title);
 const preview=doc.createElement('div');preview.className='liquid-preview';preview.style.background='linear-gradient(135deg,'+s.colorB+','+s.colorA+','+s.colorB+')';section.append(preview);
 const select=doc.createElement('select'),custom=doc.createElement('option');custom.value='custom';custom.textContent='Personnalisé';select.append(custom);
 const choices=LIQUID_PRESETS.filter(p=>p.kind===kind);
 for(const p of choices){const option=doc.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option)}
 select.value=choices.find(p=>p.name===liquidPresetName(kind,s))?.id||'custom';select.disabled=disabled;
 function label(text,el){const l=doc.createElement('label');l.textContent=text;l.append(el);return l}
 function update(next){if(!disabled)onChange(normalizeLiquidStyle(kind,next))}
 select.onchange=()=>{const p=choices.find(p=>p.id===select.value);if(p)update(p)};
 section.append(label('Preset',select));
 const colors=doc.createElement('div');colors.className='row liquid-colors';
 for(const [key,name]of [['colorA',kind==='lava'?'Matière chaude':'Reflets'],['colorB',kind==='lava'?'Croûte froide':'Teinte profonde']]){
  const el=doc.createElement('input');el.type='color';el.value=s[key];el.disabled=disabled;el.onchange=()=>update({...s,[key]:el.value});colors.append(label(name,el));
 }
 section.append(colors);
 const ranges=[['speed','Vitesse visuelle',0,2],['glow','Luminosité du matériau',0,1.5]];
 if(kind==='water')ranges.unshift(['opacity','Opacité',.12,.95]);
 for(const [key,name,min,max]of ranges){
  const el=doc.createElement('input');el.type='range';el.min=String(min);el.max=String(max);el.step='.01';el.value=String(s[key]);el.disabled=disabled;
  const caption=doc.createElement('span');caption.className='liquid-value';caption.textContent=key==='opacity'?Math.round(s[key]*100)+' %':s[key].toFixed(2);
  const l=label(name,el);l.append(caption);el.oninput=()=>{caption.textContent=key==='opacity'?Math.round(+el.value*100)+' %':(+el.value).toFixed(2)};el.onchange=()=>update({...s,[key]:Number(el.value)});section.append(l);
 }
 const note=doc.createElement('p');note.className='micro';note.textContent='Les écoulements héritent de leur source. La vitesse ne modifie pas la portée ni les collisions.';section.append(note);
 const reset=doc.createElement('button');reset.type='button';reset.textContent='Rétablir le liquide standard';reset.disabled=disabled;reset.onclick=()=>update(null);section.append(reset);root.append(section);
}

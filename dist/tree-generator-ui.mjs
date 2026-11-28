import {TREE_GENERATOR_PROFILES,normalizeTreeConfig,generateLeaflessTree} from './organic-trees.mjs';
export function mountTreeGenerator(root,{materials,onSave}){
 const select=root.querySelector('#treeProfile'),material=root.querySelector('#treeMaterial'),canvas=root.querySelector('#treePreview'),status=root.querySelector('#treeReport');
 const fields=['name','seed','height','radius','branches','reach','depth','spread','roots','budget','lean','curvature','taper','droop','tipStyle'];
 const field=k=>root.querySelector('#tree-'+k);
 for(const p of TREE_GENERATOR_PROFILES){const o=document.createElement('option');o.value=p.key;o.textContent=p.name;select.append(o)}
 for(const [id,b] of Object.entries(materials)){if(['water','lava','air'].includes(id)||b.solid===false)continue;const o=document.createElement('option');o.value=id;o.textContent=b.name||id;material.append(o)}
 function config(){return normalizeTreeConfig({key:select.value,material:material.value,...Object.fromEntries(fields.map(k=>[k,field(k).value]))})}
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
 function load(){const p=TREE_GENERATOR_PROFILES.find(p=>p.key===select.value)||TREE_GENERATOR_PROFILES[0],c=normalizeTreeConfig(p);material.value=c.material;for(const k of fields)field(k).value=c[k];draw()}
 select.addEventListener('change',load);material.addEventListener('change',draw);for(const k of fields)field(k).addEventListener('input',draw);
 root.querySelector('#treeRandom').addEventListener('click',()=>{field('seed').value=String(Math.floor(Math.random()*4294967296));draw()});
 root.querySelector('#treeSave').addEventListener('click',()=>{try{onSave(config())}catch(e){status.textContent=e.message}});
 canvas.addEventListener('pointerdown',e=>{drag=e.clientX;canvas.setPointerCapture?.(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(drag===null)return;view+=(e.clientX-drag)*.015;drag=e.clientX;draw()});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
 root.querySelector('#treeRotate').addEventListener('click',()=>{view+=Math.PI/4;draw()});
 load();return {draw,config};
}

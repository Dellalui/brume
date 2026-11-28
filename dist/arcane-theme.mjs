// Brume's original arcane design system. All ornaments and material previews
// are procedural Canvas2D artwork; no extra WebGL context or external assets.
export const ARCANE=Object.freeze({bg:'#0b1818',card:'#142724',edge:'#776448',gold:'#e8c47d',fg:'#f1e5cd',muted:'#a8bcb0',hover:'#29433c'});
export const CATEGORY_SIGILS={blocks:'◇',doors:'♜',decor:'♧',actors:'♙',effects:'✧',throws:'ϟ',schemas:'▧',trees:'♧',tools:'⚒',zone:'⌗',settings:'⚙'};
export function chamfer(ctx,r,c=6){const {x,y,w,h}=r,k=Math.max(0,Math.min(c,w/2,h/2));ctx.beginPath();ctx.moveTo(x+k,y);ctx.lineTo(x+w-k,y);ctx.lineTo(x+w,y+k);ctx.lineTo(x+w,y+h-k);ctx.lineTo(x+w-k,y+h);ctx.lineTo(x+k,y+h);ctx.lineTo(x,y+h-k);ctx.lineTo(x,y+k);ctx.closePath()}
export function diamond(ctx,x,y,s,color,filled=false){ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s,y);ctx.closePath();ctx.strokeStyle=color;ctx.fillStyle=color;if(filled)ctx.fill();else ctx.stroke()}
export function plate(ctx,r,fill,stroke=ARCANE.edge,cut=5){if(r.w<=0||r.h<=0)return;chamfer(ctx,r,cut);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function gradient(ctx,r,a,b,c){const g=ctx.createLinearGradient(r.x,r.y,r.x,r.y+r.h);g.addColorStop(0,a);if(c){g.addColorStop(.48,b);g.addColorStop(1,c)}else g.addColorStop(1,b);return g}
export function engrave(ctx,r,color='#b09560',length=14){if(r.w<20||r.h<20)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=.7;const n=Math.min(length,r.w*.22,r.h*.26);
 for(const [x,y,sx,sy] of [[r.x+4,r.y+4,1,1],[r.x+r.w-4,r.y+4,-1,1],[r.x+4,r.y+r.h-4,1,-1],[r.x+r.w-4,r.y+r.h-4,-1,-1]]){ctx.beginPath();ctx.moveTo(x,y+sy*n);ctx.lineTo(x,y+sy*5);ctx.lineTo(x+sx*5,y);ctx.lineTo(x+sx*n,y);ctx.stroke();diamond(ctx,x+sx*4,y+sy*4,2,color)}
 ctx.restore()}
export function arcanePanel(ctx,r){if(r.w<=0||r.h<=0)return;ctx.save();ctx.shadowColor='#000b';ctx.shadowBlur=16;ctx.shadowOffsetY=5;plate(ctx,r,ARCANE.bg,null,11);ctx.restore();
 plate(ctx,r,gradient(ctx,r,'#35443a','#101c1c','#162824'),'#ad8b55',11);
 const inner={x:r.x+4,y:r.y+4,w:r.w-8,h:r.h-8};if(inner.w<1||inner.h<1)return;
 plate(ctx,inner,gradient(ctx,inner,'#172c28','#0b191a','#102420'),'#62533b',8);
 ctx.save();chamfer(ctx,inner,8);ctx.clip();
 // Quiet engraved circles remain behind content.
 const x=r.x+r.w/2,y=r.y+r.h/2,s=Math.min(r.w,r.h)*.43;ctx.strokeStyle='#a3c8ac0c';ctx.lineWidth=1;
 for(const k of [.77,.9,1]){ctx.beginPath();ctx.arc(x,y,s*k,0,Math.PI*2);ctx.stroke()}
 for(let i=0;i<12;i++){const a=i*Math.PI/6;diamond(ctx,x+s*Math.cos(a),y+s*Math.sin(a),3,'#bba67419')}
 ctx.restore();engrave(ctx,r,'#c9a36a',22)}
export function arcaneTile(ctx,r,{selected=false,hover=false,accent=null}={}){if(r.w<=0||r.h<=0)return;ctx.save();
 if(selected){ctx.shadowColor='#e2ad55aa';ctx.shadowBlur=8}
 const g=selected?gradient(ctx,r,'#655037','#322f24','#7a5c31'):hover?gradient(ctx,r,'#344b40','#1a302c'):gradient(ctx,r,'#243a32','#101e1d');
 plate(ctx,r,g,selected?'#f4d58e':hover?'#b7a172':'#685d46',5);ctx.shadowBlur=0;
 if(selected||hover){const inside={x:r.x+2,y:r.y+2,w:r.w-4,h:r.h-4};chamfer(ctx,inside,3);ctx.strokeStyle=selected?'#f2c77888':'#bda16c44';ctx.stroke()}
 if(accent){ctx.fillStyle=accent;ctx.globalAlpha=.65;ctx.fillRect(r.x+r.w*.32,r.y+1,r.w*.36,2);ctx.globalAlpha=1}
 engrave(ctx,r,selected?'#f2d19a':'#8e7851',7);ctx.restore()}
export function separator(ctx,x,y,w){if(w<20)return;ctx.save();const g=ctx.createLinearGradient(x,y,x+w,y);g.addColorStop(0,'#987b4500');g.addColorStop(.45,'#bfa46c');g.addColorStop(.55,'#bfa46c');g.addColorStop(1,'#987b4500');ctx.strokeStyle=g;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w/2-7,y);ctx.moveTo(x+w/2+7,y);ctx.lineTo(x+w,y);ctx.stroke();diamond(ctx,x+w/2,y,4,'#d1b777');ctx.restore()}
export function sigil(ctx,x,y,r,color){if(r<=0)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=.7;ctx.globalAlpha=.45;
 for(const k of [1,.78]){ctx.beginPath();ctx.arc(x,y,r*k,0,Math.PI*2);ctx.stroke()}
 for(let i=0;i<6;i++){const a=i*Math.PI/3;diamond(ctx,x+Math.cos(a)*r,y+Math.sin(a)*r,1.7,color,true)}
 ctx.restore()}
export function texturedCube(ctx,x,y,size,d,imageFor){const s=size;ctx.save();ctx.translate(x,y);const def=d.material||{},liquid=d.liquid;
 function face(origin,u,v,base,spec,shade=0,top=false){ctx.save();ctx.transform(s*u[0],s*u[1],s*v[0],s*v[1],s*origin[0],s*origin[1]);ctx.fillStyle=base;ctx.fillRect(0,0,1,1);
  const img=spec?.url&&!liquid?imageFor(spec.url):null;
  if(img?.complete&&img.naturalWidth){ctx.globalAlpha=spec.detailOnly?.40:.88;ctx.drawImage(img,0,0,1,1);ctx.globalAlpha=1;if(spec.detailOnly){ctx.fillStyle=base+'66';ctx.fillRect(0,0,1,1)}}
  if(def.pattern==='log'&&top||def.pattern==='birch'&&top){ctx.strokeStyle='#5e402e88';ctx.lineWidth=.045;for(const a of [.12,.24,.36,.46]){ctx.beginPath();ctx.arc(.5,.5,a,0,Math.PI*2);ctx.stroke()}}
  if(def.accent){ctx.fillStyle=def.accent;for(let i=0;i<5;i++){const a=(i*37%89+5)/100,b=(i*59%87+5)/100;ctx.beginPath();ctx.moveTo(a,b-.04);ctx.lineTo(a+.045,b);ctx.lineTo(a,b+.055);ctx.lineTo(a-.04,b);ctx.fill()}}
  if(liquid){const g=ctx.createLinearGradient(0,0,1,1);g.addColorStop(0,liquid.colorA);g.addColorStop(1,liquid.colorB);ctx.fillStyle=g;ctx.fillRect(0,0,1,1);ctx.strokeStyle=liquid.colorA;ctx.lineWidth=.025;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(0,.15+i*.3);ctx.bezierCurveTo(.3,.03+i*.3,.6,.34+i*.3,1,.16+i*.3);ctx.stroke()}}
  if(shade){ctx.fillStyle='rgba(0,0,0,'+shade+')';ctx.fillRect(0,0,1,1)}ctx.lineWidth=.018;ctx.strokeStyle='#ffffff44';ctx.strokeRect(0,0,1,1);ctx.restore()}
 // Affine projection: every texture follows its cube face, not its bounding box.
 face([0,-.53],[.48,.27],[-.48,.27],liquid?.colorA||def.top||d.color||'#81977b',d.topTexture,0,true);
 face([-.48,-.26],[.48,.27],[0,.48],liquid?.colorB||def.side||d.color||'#81977b',d.sideTexture,.13);
 face([0,.01],[.48,-.27],[0,.48],liquid?.colorA||def.side||d.color||'#81977b',d.sideTexture,.35);
 ctx.restore()}

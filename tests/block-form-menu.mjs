import assert from 'node:assert/strict';
import {createBlockFormMenu} from '../dist/block-form-menu.mjs';
class Element{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.hidden=false;this.textContent=''}setAttribute(k,v){this.attrs[k]=v}append(...v){this.children.push(...v)}replaceChildren(...v){this.children=v}}
globalThis.document={body:new Element('body'),createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t)};
let item={kind:'block',material:'dirt',shape:'box'},active=true,changes=0;
const menu=createBlockFormMenu({getItem:()=>item,active:()=>active,materialName:i=>i.material,onChange:()=>changes++});
assert(menu.show());const root=document.body.children[0];assert(!root.hidden);assert.equal(changes,0);assert.equal(root.children[1].children.length,7);
assert(!menu.wheel({shiftKey:true,deltaY:1}));assert(menu.wheel({altKey:true,deltaY:1}));assert.equal(item.shape,'slab');assert.equal(item.material,'dirt');assert.equal(changes,1);assert.match(root.children[0].textContent,/2 \/ 38/);
assert(menu.wheel({altKey:true,deltaY:-1}));assert.equal(item.shape,'box');menu.hide();assert(root.hidden);item={kind:'block',material:'water'};assert(!menu.show());assert(root.hidden);
console.log('Alt menu: immediate open, material-preserving cycling, close and liquid gating OK');

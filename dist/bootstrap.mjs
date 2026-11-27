import * as W from './world.mjs';
import {createWorldStorage} from './world-storage.mjs';
// Import the editor only after storage selection, preventing a late load from
// replacing edits already made by the user. Legacy localStorage stays as backup.
let loaded=W.readSavedWorld(localStorage);
try{const storage=createWorldStorage(indexedDB),saved=await storage.load();if(saved){const checked=W.readSavedWorld({getItem:key=>key==='brumes-v4'?JSON.stringify(saved):null,setItem(){throw Error('Invalid indexed world')}});if(checked.recovered)throw Error('Sauvegarde IndexedDB invalide');loaded=checked}globalThis.brumesWorldStorage=storage}catch(error){console.warn('Sauvegarde locale de secours utilisée.',error)}
globalThis.brumesLoadedWorld=loaded;
// Keep the application inert until the whole editor has initialized and the
// first scheduled scene render can run. A partial import must never accept clicks.
const app=document.getElementById('app');
app.inert=true;
try{
 await import('./editor.mjs');
 await new Promise(resolve=>requestAnimationFrame(resolve));
 app.inert=false;
 document.body.dataset.editorReady='true';
}catch(error){
 console.error('Initialisation de Brume impossible',error);
 const notice=document.createElement('div');notice.setAttribute('role','alert');
 notice.style.cssText='position:fixed;inset:0;z-index:9999;display:grid;place-content:center;gap:16px;padding:24px;background:#14231f;color:#eef2e9;text-align:center';
 const title=document.createElement('strong');title.textContent='Impossible de démarrer Brume';
 const detail=document.createElement('p');detail.textContent='Rechargez la page pour récupérer la dernière version. Vos sauvegardes locales sont conservées.';
 const reload=document.createElement('button');reload.textContent='Recharger Brume';reload.onclick=()=>{const url=new URL(location.href);url.searchParams.set('reload',Date.now());location.replace(url)};
 notice.append(title,detail,reload);document.body.append(notice);
}

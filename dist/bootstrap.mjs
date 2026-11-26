import * as W from './world.mjs';
import {createWorldStorage} from './world-storage.mjs';
// Import the editor only after storage selection, preventing a late load from
// replacing edits already made by the user. Legacy localStorage stays as backup.
let loaded=W.readSavedWorld(localStorage);
try{const storage=createWorldStorage(indexedDB),saved=await storage.load();if(saved){const checked=W.readSavedWorld({getItem:key=>key==='brumes-v4'?JSON.stringify(saved):null,setItem(){throw Error('Invalid indexed world')}});if(checked.recovered)throw Error('Sauvegarde IndexedDB invalide');loaded=checked}globalThis.brumesWorldStorage=storage}catch(error){console.warn('Sauvegarde locale de secours utilisée.',error)}
globalThis.brumesLoadedWorld=loaded;
await import('./editor.mjs');

import {renderImpactBank} from './impact-samples.mjs';
const bank=renderImpactBank();
self.postMessage({bank},Object.values(bank).flat().map(s=>s.buffer));

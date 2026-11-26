import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=[...readdirSync('.').filter(n=>/^test-.+\.mjs$/.test(n)&&n!=='test-all.mjs'),...readdirSync('tests').filter(n=>n.endsWith('.mjs')).map(n=>'tests/'+n)].sort();
let failures=0;
for(const f of files){console.log('\n=== '+f+' ===');const r=spawnSync(process.execPath,[f],{stdio:'inherit',timeout:120000});if(r.status!==0){failures++;console.error('FAIL '+f,r.error||r.status)}}
console.log('\n'+(files.length-failures)+'/'+files.length+' test programs passed.');
process.exitCode=failures?1:0;

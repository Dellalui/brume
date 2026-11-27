// Roleplay-only body integrity. Missing fields in old saves mean 100%.
export const BODY_PARTS=Object.freeze([
 ['head','Tête'],['torso','Torse'],['leftArm','Bras G.'],['rightArm','Bras D.'],['leftLeg','Jambe G.'],['rightLeg','Jambe D.']
].map(Object.freeze));
export function conditionValue(value){if(value==null||value==='')return 100;const n=Number(value);return Number.isFinite(n)?Math.round(Math.max(0,Math.min(100,n))):100}
export function bodyCondition(actor){return Object.fromEntries(BODY_PARTS.map(([id])=>[id,conditionValue(actor?.bodyCondition?.[id])]))}
export function conditionColor(value){
 const p=conditionValue(value)/100,low=[211,53,61],mid=[233,181,72],high=[99,192,136],a=p<=.5?low:mid,b=p<=.5?mid:high,t=p<=.5?p*2:(p-.5)*2;
 return 'rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')+')';
}
export function setBodyPart(actor,id,value){
 if(!BODY_PARTS.some(([key])=>key===id)||value===''||value==null||!Number.isFinite(Number(value)))return false;
 actor.bodyCondition={...bodyCondition(actor),[id]:conditionValue(value)};return true;
}

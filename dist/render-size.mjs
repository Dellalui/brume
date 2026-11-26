// Stable GPU buffer sizing, independent of UI layout and browser zoom.
export function createBufferSizer(){
 let previous=null,changes=0;
 return {sync(gpu,overlay,width,height,dpr){
  if(![width,height,dpr].every(Number.isFinite)||width<=0||height<=0||dpr<=0)return false;
  // Three r180 uses Math.floor for the drawing buffer. A round/floor
  // mismatch made odd CSS widths resize on every frame at fractional DPR.
  const w=Math.max(1,Math.floor(width*dpr)),h=Math.max(1,Math.floor(height*dpr));
  if(previous&&previous.w===w&&previous.h===h&&previous.dpr===dpr)return false;
  if(typeof gpu.setDrawingBufferSize==='function')gpu.setDrawingBufferSize(width,height,dpr);
  else {if(previous?.dpr!==dpr)gpu.setPixelRatio(dpr);gpu.setSize(width,height,false)}
  if(overlay.width!==w)overlay.width=w;
  if(overlay.height!==h)overlay.height=h;
  previous={w,h,dpr};changes++;return true;
 },stats:()=>({bufferResizes:changes,bufferWidth:previous?.w||0,bufferHeight:previous?.h||0,pixelRatio:previous?.dpr||1})};
}

const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),output=process.env.BRUME_SCREENSHOTS,errors=[];
 const server=http.createServer((req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body style="margin:0"></body></html>');return}let f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';if(!f.startsWith(root+path.sep)){res.statusCode=403;res.end();return}try{res.setHeader('Content-Type',/\.m?js$/.test(f)?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':f.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(f))}catch{res.statusCode=404;res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  let executablePath=process.env.BRUME_CHROMIUM,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'];
  if(process.env.BRUME_CHROMIUM_MODULE){const {default:pack}=await import(process.env.BRUME_CHROMIUM_MODULE);executablePath=await pack.executablePath();args=pack.args}
  browser=await chromium.launch({executablePath,args,headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base+'/dist/');await page.waitForFunction(()=>globalThis.brumesWorldStorage&&document.querySelector('#map'));
  assert(await page.evaluate(()=>!!document.createElement('canvas').getContext('webgl2')));
  await page.waitForSelector('#canvasInterface',{state:'attached'});
  await page.locator('#buildMode').click();await page.keyboard.press('Escape');await page.locator('#inventoryLauncher').click();
  const geometry=await page.evaluate(async()=>{const {hudLayout,inventoryLayout}=await import('/dist/canvas-hud.mjs');const v=document.querySelector('#viewport').getBoundingClientRect();const l=hudLayout(v.width,v.height);return {left:v.left,top:v.top,...l,inventory:inventoryLayout(l.panel,'throws')}});
  const p=geometry.panel,g=geometry.inventory;
  const tab=async i=>{await page.mouse.click(geometry.left+g.tabs[i].x+g.tabs[i].w/2,geometry.top+g.tabs[i].y+g.tabs[i].h/2);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))};
  await tab(5);
  assert.equal(await page.locator('#inventoryItems,#hotbar,#creativeInventory,#selectionBar,#contextMenu').count(),0);
  assert(await page.evaluate(()=>{const c=document.querySelector('#canvasInterface'),v=c.getBoundingClientRect(),ctx=c.getContext('2d');return ctx.getImageData(Math.floor(v.width/2*c.width/v.width),Math.floor(25*c.height/v.height),1,1).data[3]>0}));
  const top=g.top;
  await page.mouse.click(geometry.left+p.x+60,geometry.top+top+16);
  await page.keyboard.type('Singularit');await page.keyboard.press('Enter');
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.mouse.click(geometry.left+g.grid.x+g.cw/2,geometry.top+g.grid.y+g.ch/2);
  await tab(9);
  await page.locator('#throwRange').fill('0');await page.locator('#throwRange').press('Tab');
  assert.equal(await page.locator('.effect-layer-card').count(),4);
  await page.getByRole('button',{name:'Tout ensemble',exact:true}).click();
  await page.locator('#throwComposer input[type="text"]').fill('Test de singularité');await page.locator('#throwComposer input[type="text"]').press('Tab');
  await page.locator('#throwComposer').getByRole('button',{name:'Enregistrer',exact:true}).click();
  await page.waitForFunction(async()=>{const w=await globalThis.brumesWorldStorage.load();return w?.throwPresets?.some(p=>p.name==='Test de singularité'&&p.settings.range===0&&p.layers.every(l=>l.delay===0))});
  if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'composer.png')})}
  await page.reload();await page.waitForFunction(()=>globalThis.brumesWorldStorage);assert(await page.evaluate(async()=>(await globalThis.brumesWorldStorage.load()).throwPresets.some(p=>p.name==='Test de singularité')));
  await page.goto(base+'/fixture');
  const metrics=await page.evaluate(async()=>{
   const T=await import('/dist/vendor/three.module.min.js'),{createEffects}=await import('/dist/effects.mjs'),{createThrowVisuals}=await import('/dist/throw-visuals.mjs'),{throwConfig,createThrowQueue}=await import('/dist/throw-effects.mjs'),{SHAPES,EFFECT_TYPES}=await import('/dist/effect-recipes.mjs');
   const gpu=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});gpu.setSize(960,720);gpu.toneMapping=T.ACESFilmicToneMapping;const copy=gpu.copyFramebufferToTexture.bind(gpu);gpu.copyFramebufferToTexture=(...args)=>{copy(...args);const error=gpu.getContext().getError();if(error)throw Error('Framebuffer copy error '+error)};document.body.append(gpu.domElement);
   const world=new T.Scene();world.background=new T.Color('#263d4a');const camera=new T.PerspectiveCamera(45,960/720,.1,200);camera.position.set(10,8,14);camera.lookAt(0,1,0);
   const floor=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshBasicMaterial({color:'#426c56'}));floor.rotation.x=-Math.PI/2;world.add(floor,new T.GridHelper(80,80,0xe2d1ac,0x819c8b));
   for(let x=-6;x<=6;x+=3){const b=new T.Mesh(new T.BoxGeometry(1,3,1),new T.MeshBasicMaterial({color:x%2?'#b87454':'#5d9eb3'}));b.position.set(x,1.5,-3);world.add(b)}
   const factory=createEffects(()=>document.createElement('canvas')),visuals=createThrowVisuals(factory);world.add(visuals.group);const position={x:0,y:0,z:.1};
   const read=()=>{const a=new Uint8Array(960*720*4);gpu.getContext().readPixels(0,0,960,720,gpu.getContext().RGBA,gpu.getContext().UNSIGNED_BYTE,a);return a};
   visuals.render(gpu,world,camera);const initial=read();
   const p={id:'hole',phase:'impact',age:1,position,tail:position,config:{...throwConfig({preset:'blackhole'}),id:'blackhole',duration:8}};
   visuals.update([p],1,camera,'balanced');visuals.render(gpu,world,camera);const refracted=read();let changed=0,cornerDelta=0;
   for(let i=0;i<initial.length;i+=4)if(Math.abs(initial[i]-refracted[i])+Math.abs(initial[i+1]-refracted[i+1])+Math.abs(initial[i+2]-refracted[i+2])>6)changed++;
   for(let y=0;y<30;y++)for(let x=0;x<30;x++)for(let c=0;c<3;c++){let i=(y*960+x)*4+c;cornerDelta=Math.max(cornerDelta,Math.abs(initial[i]-refracted[i]))}
   if(changed<100)throw Error('Lens did not alter the background');if(cornerDelta>3)throw Error('Optical copy changed unaffected pixels: '+cornerDelta);
   // A nearer object must retain its pixels: lenses share the scene depth buffer.
   const wall=new T.Mesh(new T.BoxGeometry(3,3,.4),new T.MeshBasicMaterial({color:'#dd4838'}));const center=new T.Vector3(0,.1+p.config.radius*p.config.visualScale*.6,0);wall.position.copy(center).lerp(camera.position,.4);wall.quaternion.copy(camera.quaternion);world.add(wall);const projected=center.clone().project(camera),px=Math.floor((projected.x*.5+.5)*960),py=Math.floor((projected.y*.5+.5)*720),sample=(py*960+px)*4;
   visuals.update([],2,camera,'balanced');visuals.render(gpu,world,camera);const wallBefore=read();visuals.update([p],2,camera,'balanced');visuals.render(gpu,world,camera);const wallAfter=read();for(let c=0;c<3;c++)if(Math.abs(wallBefore[sample+c]-wallAfter[sample+c])>2)throw Error('Lens drawn over foreground wall');world.remove(wall);wall.geometry.dispose();wall.material.dispose();
   window.visualFixture={gpu,world,camera,visuals,p,factory};
   let cases=0;for(const type of EFFECT_TYPES)for(const shape of SHAPES){const cfg=throwConfig({preset:'blast'}),e={...p,id:type.id+shape.id,age:.5,config:{...cfg,id:type.id,duration:3,shape:shape.id,color:type.color,radius:2,strength:1}};visuals.update([e],cases*.1,camera,'low');visuals.render(gpu,world,camera);cases++}
   visuals.update([p],100,camera,'balanced');visuals.render(gpu,world,camera);
   gpu.getContext().finish();return{capture:gpu.domElement.toDataURL('image/png'),shaderCases:cases,changedPixels:changed,unchangedCornerMaxDelta:cornerDelta,glError:gpu.getContext().getError(),renderer:gpu.getContext().getParameter(gpu.getContext().RENDERER)};
  });
  assert.equal(metrics.glError,0);if(output)fs.writeFileSync(path.join(output,'blackhole.png'),Buffer.from(metrics.capture.split(',')[1],'base64'));delete metrics.capture;
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',storage:'IndexedDB reload',ui:'24 presets and timed composer',webgl:metrics},null,2));
 }catch(error){console.error(JSON.stringify({errors}));throw error}finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

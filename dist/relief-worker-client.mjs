// At most one active request and one latest replacement. Rapid impacts
// cannot build an unbounded worker backlog or publish stale revisions.
export function createReliefWorkerClient(factory){
 let worker=null,running=null,queued=null,serial=0,failed=false,submitted=0,completed=0,dropped=0;
 try{worker=factory?.()||null}catch{failed=true}
 function fail(){
  failed=true;worker?.terminate();worker=null;
  const jobs=[running,queued];running=queued=null;
  for(const job of jobs)job?.callback?.(null);
 }
 function pump(){
  if(!worker||running||!queued)return;
  running=queued;queued=null;
  try{worker.postMessage({id:running.id,payload:running.payload});submitted++;running.payload=null}catch{fail()}
 }
 if(worker){
  worker.onmessage=({data})=>{
   if(!running||data.id!==running.id)return;
   const job=running;running=null;
   if(data.error||!Array.isArray(data.results)){job.callback?.(null);fail();return}
   completed++;job.callback?.(data.results);pump();
  };
  worker.onerror=fail;worker.onmessageerror=fail;
 }
 return {
  get available(){return !!worker&&!failed},
  submit(payload,callback){if(!worker)return false;if(queued){dropped++;queued=null}if(running?.callback){running.callback=null;dropped++}queued={id:++serial,payload,callback};pump();return true},
  cancel(){if(queued){queued=null;dropped++}if(running?.callback){running.callback=null;dropped++}},
  stats:()=>({reliefWorkerSubmitted:submitted,reliefWorkerCompleted:completed,reliefWorkerDropped:dropped,reliefWorkerBusy:!!running}),
  dispose(){running=queued=null;worker?.terminate();worker=null;failed=true}
 };
}

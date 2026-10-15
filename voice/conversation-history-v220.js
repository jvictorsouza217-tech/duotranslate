/* DuoTranslate 2.20: persistent local transcript and diagnostics for connected conversations.
 * Written to IndexedDB per event; a recent excerpt also feeds the existing History view.
 * Does not store recordings, API secrets, invitation tokens or raw microphone samples.
 */
(()=>{
'use strict';
const DB='duotranslate.voice-conversation.v220',STORE='events',LOCAL='duotranslate.local.history.v1';
let dbPromise;
function open(){
 if(!('indexedDB' in window))return Promise.reject(Error('IndexedDB indisponível'));
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
  const req=window.indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Falha ao abrir histórico local'));
 }).catch(e=>{dbPromise=null;throw e;});
 return dbPromise;
}
function sanitize(value,max){return String(value??'').slice(0,max);}
function eventId(){
 if(window.crypto?.randomUUID)return window.crypto.randomUUID();
 const bytes=new Uint8Array(12);window.crypto.getRandomValues(bytes);
 return Date.now()+'-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function normalize(entry){
 const direction=['sent','received','system'].includes(entry.direction)?entry.direction:'system';
 return {id:eventId(),at:new Date().toISOString(),mode:'connected',direction,
  session:sanitize(entry.session,20),speaker:sanitize(entry.speaker,45),
  stage:sanitize(entry.stage,36),source:sanitize(entry.source,12),target:sanitize(entry.target,12),
  original:sanitize(entry.original,1100),translation:sanitize(entry.translation,1200),
  error:sanitize(entry.error,260),provider:sanitize(entry.provider,60),
  playback:sanitize(entry.playback,45)};
}
function existingHistory(event){
 // Keep compatibility with the existing History button. IndexedDB is the full journal.
 try{
  if(localStorage.getItem('duotranslate.history.enabled.v1')==='false')return;
  const list=JSON.parse(localStorage.getItem(LOCAL)||'[]');
  if(!Array.isArray(list))return;
  const item={...event};
  list.unshift(item);
  // The legacy History UI caps other modes at 250. Keep its existing compatibility behavior.
  localStorage.setItem(LOCAL,JSON.stringify(list.slice(0,250)));
 }catch{/* IndexedDB remains the canonical persistent conversation log. */}
}
async function add(entry){
 const event=normalize(entry||{});
 try{
  const db=await open();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).put(event);
   tx.oncomplete=resolve;
   tx.onerror=()=>reject(tx.error||Error('Falha ao gravar evento'));
   tx.onabort=()=>reject(tx.error||Error('Gravação cancelada'));
  });
  existingHistory(event);
  return {saved:true,event};
 }catch(error){
  // Try the normal history store when IndexedDB is blocked; never claim a full archive.
  existingHistory(event);
  return {saved:false,event,error:String(error.message||error).slice(0,140)};
 }
}
async function all(){
 const db=await open();
 const rows=await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly');
  const request=tx.objectStore(STORE).getAll();
  request.onsuccess=()=>resolve(request.result||[]);
  request.onerror=()=>reject(request.error||Error('Falha ao consultar histórico'));
 });
 return rows.sort((a,b)=>a.at.localeCompare(b.at));
}
function csv(rows){
 const cols=['at','session','direction','speaker','stage','source','target','original','translation','provider','playback','error'];
 const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 return '\ufeff'+cols.map(quote).join(',')+'\r\n'+rows.map(r=>cols.map(k=>quote(r[k])).join(',')).join('\r\n');
}
async function download(kind='json'){
 const rows=await all();
 if(!rows.length)throw Error('Nenhum registro de conversa encontrado neste aparelho.');
 const isCsv=kind==='csv';
 const data=isCsv?csv(rows):JSON.stringify({application:'DuoTranslate',version:'2.20',exportedAt:new Date().toISOString(),events:rows},null,2);
 const blob=new Blob([data],{type:isCsv?'text/csv;charset=utf-8':'application/json;charset=utf-8'});
 const uri=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=uri;a.download='DuoTranslate-Historico-Conversacao-'+new Date().toISOString().slice(0,10)+(isCsv?'.csv':'.json');
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),2000);
 return rows.length;
}
window.DuoVoiceHistory220={add,all,download,dbName:DB};
})();

/* Access wiring only: no new screens, CSS, microphone or playback changes. */
(() => {
'use strict';
const API='https://duotranslate-ai.jvictorsouza217.workers.dev';
const VOICE='https://duotranslate.jvictorsouza217.workers.dev';
const KEY='duotranslate.access.session.v1',KEEP='duotranslate.access.remember.v1';
const TRUSTED='duotranslate.trusted.access.v210',DEFAULTS='duotranslate.eleven.defaults.v210';
const MARKER='duo-individual-session';
const AI_CONFIG='duotranslate.provider.v1',VOICE_CONFIG='duotranslate.premium.voice.v1';
const AI_PIN='duotranslate.pin.session.v1',VOICE_PIN='duotranslate.voice.pin.session';
const nativeFetch=window.fetch.bind(window);
let session=null,error='',adminPending=null,providerPreference;
function read(store,key,fallback=null) {try {return JSON.parse(store.getItem(key)||'null')||fallback;}catch(e){return fallback;}}
function get(store,key) {try {return store.getItem(key)||'';}catch(e){return '';}}
function put(store,key,value) {try {store.setItem(key,value);}catch(e){}}
function remove(store,key) {try {store.removeItem(key);}catch(e){}}
function realPin(value) {return typeof value==='string' && value.trim() && value!==MARKER && value.length<=200;}
function restoreCodes() {
 const saved=read(localStorage,TRUSTED,{});
 for(const [kind,key] of [['gemini',AI_PIN],['voice',VOICE_PIN]]) {
  if(realPin(saved[kind]) && !realPin(get(sessionStorage,key)))put(sessionStorage,key,saved[kind]);
 }
}
function notify() {
 renderStatus();
 const frame=document.getElementById('duoRealFrame');
 try {if(frame?.contentDocument)renderStatus(frame.contentDocument);}catch(e){}
 if(typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('duo-access-changed'));
}
function prefs() {
 const value=read(localStorage,VOICE_CONFIG,{});
 return {voices:value.voices||{},voiceEnabled:value.enabled===true};
}
function saveSession(value) {
 session=value;
 put(sessionStorage,KEY,JSON.stringify(value));
 if(get(localStorage,KEEP)!=='0')put(localStorage,KEY,JSON.stringify(value));
 applyServices();
 notify();
}
function clearSession() {
 session=null;remove(localStorage,KEY);remove(sessionStorage,KEY);
 for(const key of [AI_PIN,VOICE_PIN])if(get(sessionStorage,key)===MARKER)remove(sessionStorage,key);
}
function applyServices() {
 // Service URLs are public. Shared access codes and API keys are never supplied to guests.
 const ai=read(localStorage,AI_CONFIG,{}),voice=read(localStorage,VOICE_CONFIG,{});
 put(localStorage,AI_CONFIG,JSON.stringify({provider:providerPreference==='mymemory'?'mymemory':session?'gemini':ai.provider==='gemini'?'gemini':'mymemory',url:API}));
 const firstDefaults=get(localStorage,DEFAULTS)!=='1';
 if(firstDefaults){
  put(localStorage,KEEP,'1');
  const saved=read(localStorage,TRUSTED,{});
  for(const [kind,key] of [['gemini',AI_PIN],['voice',VOICE_PIN]]){
   const value=get(sessionStorage,key);if(realPin(value))saved[kind]=value;
  }
  if(Object.values(saved).some(realPin))put(localStorage,TRUSTED,JSON.stringify(saved));
 }
 put(localStorage,VOICE_CONFIG,JSON.stringify({...voice,url:VOICE,
  enabled:firstDefaults?true:typeof voice.enabled==='boolean'?voice.enabled:true,
  voices:{...(session?.preferences?.voices||{}),...(voice.voices||{})}}));
 put(localStorage,DEFAULTS,'1');
 if(session)for(const key of [AI_PIN,VOICE_PIN])if(!get(sessionStorage,key))put(sessionStorage,key,MARKER);
}
async function call(path,body,options={}) {
 const headers={'Content-Type':'application/json'};
 if(options.pin)headers['X-Duo-Pin']=options.pin;
 else if(session?.token)headers.Authorization='Bearer '+session.token;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 let response;
 try {response=await nativeFetch(API+path,{method:body===undefined?'GET':'POST',headers,
  body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,
  cache:'no-store',credentials:'omit',redirect:'error'});}
 finally {clearTimeout(timer);}
 let value;try {value=await response.json();}catch(e){throw new Error('O serviço de acesso ainda não está disponível.');}
 if(!response.ok){const e=new Error(value.error||'Não foi possível liberar seu acesso.');e.status=response.status;throw e;}
 return value;
}
function developerPin() {
 const configured=read(localStorage,AI_CONFIG,{}).url;
 if(configured && configured.replace(/\/+$/,'')!==API)return '';
 const value=get(sessionStorage,AI_PIN)||read(localStorage,'duotranslate.trusted.access.v210',{}).gemini||'';
 return typeof value==='string' && value!==MARKER?value:'';
}
async function loginAdmin() {
 const pin=developerPin();
 if(!pin)throw new Error('Configure seu acesso de administrador na seção Gemini antes de criar convites.');
 const value=await call('/access/admin/login',{preferences:prefs()},{pin});
 saveSession(value);error='';
 return value;
}
async function configure(values={}) {
 providerPreference=read(localStorage,AI_CONFIG,{}).provider;
 // The developer explicitly enters these once; guests only receive individual sessions.
 const saved=read(localStorage,TRUSTED,{});let changed=false;
 for(const [kind,key,value] of [['gemini',AI_PIN,values.geminiPin],['voice',VOICE_PIN,values.voicePin]]) {
  if(realPin(value)){saved[kind]=value.trim();put(sessionStorage,key,value.trim());changed=true;}
 }
 if(changed){put(localStorage,TRUSTED,JSON.stringify(saved));put(localStorage,KEEP,'1');}
 restoreCodes();applyServices();
 if(session && get(localStorage,KEEP)!=='0')put(localStorage,KEY,JSON.stringify(session));
 if(session?.user?.role!=='admin' && developerPin()) {
  if(!adminPending)adminPending=loginAdmin().finally(()=>{adminPending=null;});
  try {await adminPending;}catch(e){notify();throw e;}
 }
 notify();return !!session;
}
async function initialize() {
 providerPreference=read(localStorage,AI_CONFIG,{}).provider;
 restoreCodes();applyServices();
 const hash=new URLSearchParams(location.hash.slice(1)),invite=hash.get('duo-invite');
 if(invite!==null) {
  // The fragment is not sent to the web host and is removed before other app scripts run.
  hash.delete('duo-invite');const url=new URL(location.href);url.hash=hash.toString();
  history.replaceState(null,'',url.href);
  if(!/^[a-f0-9]{64}$/.test(invite)){error='Convite inválido. Peça um novo convite.';return;}
  try {
   const value=await call('/access/redeem',{invite});
   saveSession(value);error='';
  } catch(e) {error=e.message||'Não foi possível ativar o convite. Reabra o link para tentar novamente.';}
  return;
 }
 const stored=read(sessionStorage,KEY)||read(localStorage,KEY);
 if(stored && /^[a-f0-9]{64}$/.test(stored.token||'')) {
  session=stored;
  try {
   const value=await call('/access/session');saveSession({...value,token:stored.token});
  } catch(e) {
   if(e.status===401||e.status===403){clearSession();error=e.message;}
   else {applyServices();error='Não foi possível conferir seu acesso agora. Verifique a conexão.';}
  }
  if(session)return;
 }
 if(stored)clearSession();
 if(developerPin()) {
  try {await loginAdmin();}catch(e) { /* Existing developer setup keeps working until deployment is ready. */ }
 }
}
function renderStatus(doc=document) {
 const member=session?.user?.role==='member';
 for(const id of ['premiumUrl','premiumPin','aiWorkerUrl','aiWorkerPin']) {
  const field=doc.getElementById(id);if(field){
   field.readOnly=member;
   if(id.endsWith('Url')&&!field.value)field.value=id==='premiumUrl'?VOICE:API;
   if(id.endsWith('Pin')&&!field.value)field.value=get(sessionStorage,id==='premiumPin'?VOICE_PIN:AI_PIN);
  }
 }
 doc.defaultView?.DuoAI?.refreshAccess?.();
 if(error){const target=doc.getElementById('gateChoice')||doc.getElementById('aiSetupStatus');if(target)target.textContent=error;}
}
async function signedFetch(input,init={}) {
 await access.ready;
 const url=new URL(typeof input==='string' || input instanceof URL ? String(input):input.url,location.href);
 const trusted=(url.origin===API && ['/translate','/analyze'].includes(url.pathname)) ||
  (url.origin===VOICE && ['/tts','/voices','/stream-tts'].includes(url.pathname));
 if(!trusted || !session?.token)return nativeFetch(input,init);
 const headers=new Headers(init.headers || (input instanceof Request?input.headers:undefined));
 headers.delete('X-Duo-Pin');headers.set('Authorization','Bearer '+session.token);
 const response=await nativeFetch(input,{...init,headers,credentials:'omit',redirect:'error'});
 if(response.status===401){clearSession();error='Seu acesso expirou ou foi revogado. Peça um novo convite.';renderStatus();}
 return response;
}
async function invite(room,options={}) {
 await access.ready;
 if(!session)await loginAdmin();
 const url=new URL('/duotranslate/preview/v2.10/',location.href);
 if(/^[A-Z0-9]{8}$/.test(room||''))url.searchParams.set('room',room);
 if(session.user.role==='admin') {
  const value=await call('/access/invites',{label:options.label||'Convidado',expiresInHours:options.expiresInHours||24,preferences:prefs()});
  url.hash='duo-invite='+value.invite;
 }
 return url.href;
}
async function copyInvite(room,options={}) {
 const link=invite(room,options);
 try {
  if(window.ClipboardItem&&window.navigator?.clipboard?.write) {
   await window.navigator.clipboard.write([new window.ClipboardItem({'text/plain':link.then(value=>new Blob([value],{type:'text/plain'}))})]);
  }else {await window.navigator.clipboard.writeText(await link);}
  return true;
 }catch(e){const value=await link;window.prompt('Copie este convite individual para compartilhar:',value);return false;}
}
const access={fetch:signedFetch,invite,renderStatus,
 configure,copyInvite,
 openRealtime(language){if(!session?.token)throw new Error('Ative seu acesso individual em Configurações antes de iniciar.');const url=new URL(VOICE+'/realtime');url.protocol='wss:';url.searchParams.set('language',language.slice(0,2));return new WebSocket(url,['duo-v1','duo-access-'+session.token]);},
 async syncName(name){await access.ready;if(!session||session.user.label===name)return;const value=await call('/access/profile',{name});saveSession({...session,user:value.user});},
 get active(){return !!session;},get role(){return session?.user?.role||'';},
 get remembered(){return !!get(localStorage,KEY)||Object.values(read(localStorage,TRUSTED,{})).some(realPin);},
 get voiceUrl(){return VOICE;},
 remember(){put(localStorage,KEEP,'1');if(session)put(localStorage,KEY,JSON.stringify(session));},
 forget(){put(localStorage,KEEP,'0');remove(localStorage,KEY);remove(localStorage,TRUSTED);},
 admin:{login:loginAdmin,users:()=>call('/access/users'),revoke:userId=>call('/access/revoke',{userId})}
};
// The shared legacy engine only opts in when embedded by the 2.10 access-enabled app.
try {
 if(window.parent!==window && window.parent.DuoAccess) {
  window.DuoAccess=window.parent.DuoAccess;
  document.addEventListener('DOMContentLoaded',()=>window.DuoAccess.renderStatus(document),{once:true});
  return;
 }
}catch(e){}
if(!/\/preview\/v2\.10\/?$/.test(location.pathname))return;
window.DuoAccess=access;
access.ready=initialize().catch(()=>{error='Não foi possível conferir seu acesso. Tente novamente.';});
})();

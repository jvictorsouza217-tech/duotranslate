/* Access wiring only: no new screens, CSS, microphone or playback changes. */
(() => {
'use strict';
const API='https://duotranslate-ai.jvictorsouza217.workers.dev';
const VOICE='https://duotranslate.jvictorsouza217.workers.dev';
const KEY='duotranslate.access.session.v1',KEEP='duotranslate.access.remember.v1';
const MARKER='duo-individual-session';
const AI_CONFIG='duotranslate.provider.v1',VOICE_CONFIG='duotranslate.premium.voice.v1';
const AI_PIN='duotranslate.pin.session.v1',VOICE_PIN='duotranslate.voice.pin.session';
const nativeFetch=window.fetch.bind(window);
let session=null,error='';
function read(store,key,fallback=null) {try {return JSON.parse(store.getItem(key)||'null')||fallback;}catch(e){return fallback;}}
function get(store,key) {try {return store.getItem(key)||'';}catch(e){return '';}}
function put(store,key,value) {try {store.setItem(key,value);}catch(e){}}
function remove(store,key) {try {store.removeItem(key);}catch(e){}}
function prefs() {
 const value=read(localStorage,VOICE_CONFIG,{});
 return {voices:value.voices||{},voiceEnabled:value.enabled===true};
}
function saveSession(value) {
 session=value;
 put(sessionStorage,KEY,JSON.stringify(value));
 if(get(localStorage,KEEP)!=='0')put(localStorage,KEY,JSON.stringify(value));
 applyServices();
}
function clearSession() {
 session=null;remove(localStorage,KEY);remove(sessionStorage,KEY);
 for(const key of [AI_PIN,VOICE_PIN])if(get(sessionStorage,key)===MARKER)remove(sessionStorage,key);
}
function applyServices() {
 if(!session)return;
 // Service URLs are public. Shared access codes and API keys are never supplied to guests.
 const ai=read(localStorage,AI_CONFIG,{}),voice=read(localStorage,VOICE_CONFIG,{});
 put(localStorage,AI_CONFIG,JSON.stringify({provider:ai.provider==='mymemory'?'mymemory':'gemini',url:API}));
 put(localStorage,VOICE_CONFIG,JSON.stringify({...voice,url:VOICE,
  enabled:typeof voice.enabled==='boolean'?voice.enabled:session.preferences?.voiceEnabled===true,
  voices:{...(session.preferences?.voices||{}),...(voice.voices||{})}}));
 for(const key of [AI_PIN,VOICE_PIN])if(!get(sessionStorage,key))put(sessionStorage,key,MARKER);
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
async function initialize() {
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
 if(stored && /^[a-f0-9]{64}$/.test(stored.token||'') && stored.expiresAt>Date.now()) {
  session=stored;
  try {
   const value=await call('/access/session');saveSession({...value,token:stored.token});
  } catch(e) {
   if(e.status===401||e.status===403){clearSession();error=e.message;}
   else {applyServices();error='Não foi possível conferir seu acesso agora. Verifique a conexão.';}
  }
  return;
 }
 if(stored)clearSession();
 if(developerPin()) {
  try {await loginAdmin();}catch(e) { /* Existing developer setup keeps working until deployment is ready. */ }
 }
}
function renderStatus(doc=document) {
 const member=session?.user?.role==='member';
 for(const id of ['premiumUrl','premiumPin','aiWorkerUrl','aiWorkerPin']) {
  const field=doc.getElementById(id);if(field)field.readOnly=member;
 }
 if(error){const target=doc.getElementById('gateChoice')||doc.getElementById('aiSetupStatus');if(target)target.textContent=error;}
}
async function signedFetch(input,init={}) {
 await access.ready;
 const url=new URL(typeof input==='string' || input instanceof URL ? String(input):input.url,location.href);
 const trusted=(url.origin===API && ['/translate','/analyze'].includes(url.pathname)) ||
  (url.origin===VOICE && ['/tts','/voices'].includes(url.pathname));
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
const access={fetch:signedFetch,invite,renderStatus,
 get active(){return !!session;},get role(){return session?.user?.role||'';},
 remember(){put(localStorage,KEEP,'1');if(session)put(localStorage,KEY,JSON.stringify(session));},
 forget(){put(localStorage,KEEP,'0');remove(localStorage,KEY);},
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

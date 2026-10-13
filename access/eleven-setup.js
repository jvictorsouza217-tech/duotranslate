/* Shared ElevenLabs selection for the existing onboarding and translator controls. */
(() => {
'use strict';
const KEY='duotranslate.premium.voice.v1',DIRECTORY='duotranslate.eleven.voices.v29',PIN='duotranslate.voice.pin.session';
const LANGS=['pt-BR','fr-FR','en-US','es-ES','it-IT','de-DE','ar-SA','zh-CN','nl-NL','pl-PL','ro-RO','uk-UA','ru-RU','tr-TR'];
const valid=id=>typeof id==='string'&&/^[a-zA-Z0-9]{12,40}$/.test(id);
let loading=null,lastError='',retryAfter=0;
function read(key,fallback) {try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch(e){return fallback;}}
function pin() {try{return sessionStorage.getItem(PIN)||'';}catch(e){return '';}}
function get() {
 const cfg=read(KEY,{});
 return {...cfg,url:window.DuoAccess?.voiceUrl||'https://duotranslate.jvictorsouza217.workers.dev',voices:cfg.voices&&typeof cfg.voices==='object'?cfg.voices:{}};
}
function sync(cfg) {
 const value={...cfg,pin:pin()};
 window.DuoPremiumVoice?.configure(value);
 try{document.getElementById('duoRealFrame')?.contentWindow?.DuoPremiumVoice?.configure(value);}catch(e){}
}
function selectVoice(lang,id,enabled=true) {
 if(!LANGS.includes(lang)||!valid(id))return false;
 const cfg=get();cfg.enabled=enabled;cfg.voices={...cfg.voices,[lang]:id};
 // Keep every previously chosen language voice; use this voice for empty defaults.
 for(const key of LANGS)if(!valid(cfg.voices[key]))cfg.voices[key]=id;
 try{localStorage.setItem(KEY,JSON.stringify(cfg));}catch(e){}
 sync(cfg);return true;
}
function directory() {
 const entries=read(DIRECTORY,[]);
 return Array.isArray(entries)?entries.filter(v=>valid(v?.id)).map(v=>({id:v.id,name:String(v.name||'Voz ElevenLabs').slice(0,120)})).slice(0,250):[];
}
function choices(lang) {
 const cfg=get(),list=directory(),ids=new Set(list.map(v=>v.id));
 for(const id of Object.values(cfg.voices))if(valid(id)&&!ids.has(id)){list.push({id,name:'Voz ElevenLabs configurada'});ids.add(id);}
 let selected=valid(cfg.voices[lang])?cfg.voices[lang]:Object.values(cfg.voices).find(valid)||list[0]?.id||'';
 if(selected&&!valid(cfg.voices[lang]))selectVoice(lang,selected,cfg.enabled!==false);
 return {voices:list,selected};
}
function render(select,lang) {
 const data=choices(lang);select.replaceChildren();
 if(!data.voices.length){const option=document.createElement('option');option.value='';option.textContent='Selecione uma voz ElevenLabs';select.append(option);}
 for(const v of data.voices){const option=document.createElement('option');option.value=v.id;option.textContent=v.name;select.append(option);}
 select.value=data.selected;select.disabled=!data.voices.length;
 return data;
}
function available() {return !!pin()||window.DuoAccess?.active===true;}
async function loadVoices(force=false) {
 if(!force&&directory().length)return directory();
 if(loading)return loading;
 if(Date.now()<retryAfter)throw new Error(lastError);
 if(!available())throw new Error('Ative seu acesso uma vez em Configurações. Quem recebeu um convite não precisa informar códigos.');
 loading=Promise.resolve().then(async()=>{
  try{await window.DuoAccess?.configure();}catch(e){/* A remembered developer voice code can still be used independently. */}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),17000);
  let response;
  try{response=await (window.DuoAccess?.fetch||fetch)(get().url+'/voices',{
   method:'POST',headers:{'Content-Type':'application/json','X-Duo-Pin':pin()},body:'{}',signal:controller.signal});}
  finally{clearTimeout(timer);}
  let data;try{data=await response.json();}catch(e){throw new Error('Não foi possível carregar as vozes.');}
  if(!response.ok)throw new Error(data.error||'Lista de vozes indisponível.');
  const list=Array.isArray(data.voices)?data.voices.filter(v=>valid(v?.id)).map(v=>({id:v.id,name:String(v.name||'Voz ElevenLabs').slice(0,120)})):[];
  if(!list.length)throw new Error('Nenhuma voz disponível no serviço. A voz que já foi salva continua selecionada.');
  try{localStorage.setItem(DIRECTORY,JSON.stringify(list));}catch(e){}
  lastError='';retryAfter=0;return list;
 }).catch(e=>{lastError=String(e.message||e);retryAfter=Date.now()+15000;throw e;}).finally(()=>{loading=null;});
 return loading;
}
window.DuoEleven={get,pin,available,directory,choices,render,selectVoice,loadVoices,sync:()=>sync(get())};
})();

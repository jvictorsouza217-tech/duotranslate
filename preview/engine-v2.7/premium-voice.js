/* DuoTranslate optional ElevenLabs voice playback (test mode only).
   API key remains in separate Cloudflare Worker. No hidden API calls.
   This module reads the configured Worker address and session-only access PIN.
*/
(() => {
'use strict';
const KEY='duotranslate.premium.voice.v1', PIN='duotranslate.voice.pin.session';
let conf={enabled:false,url:'',voices:{}};
try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&typeof v==='object'){conf.enabled=v.enabled===true;conf.url=String(v.url||'').slice(0,300);conf.voices=(v.voices&&typeof v.voices==='object')?v.voices:{}}}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(conf))}catch(e){}};
const pin=()=>{try{return sessionStorage.getItem(PIN)||''}catch(e){return ''}};
function endpoint(){
 const u=new URL(conf.url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('URL segura do Worker inválida.');
 return u.href.replace(/\/+$/,'');
}
function enabled(lang){
 return conf.enabled===true&&!!conf.url&&!!pin()&&!!conf.voices[lang];
}
async function speak(text,lang){
 if(!enabled(lang))throw Error('Voz ElevenLabs não configurada para o idioma.');
 if(text.length>220)throw Error('Frase longa para o limite experimental; usando voz do dispositivo.');
 const u=endpoint(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),17000);
 let r;
 try{r=await fetch(u+'/tts',{method:'POST',headers:{'Content-Type':'application/json','X-Duo-Pin':pin()},body:JSON.stringify({text,lang,voiceId:conf.voices[lang]}),signal:controller.signal})}
 finally{clearTimeout(timer)}
 if(!r.ok){let d;try{d=await r.json()}catch(e){}throw Error(d?.error||'Serviço de voz indisponível (HTTP '+r.status+').')}
 const audioBlob=await r.blob();const obj=URL.createObjectURL(audioBlob);
 try{await new Promise((resolve,reject)=>{const audio=new Audio(obj);audio.onended=resolve;audio.onerror=()=>reject(new Error('Erro na reprodução MP3'));audio.play().catch(reject)})}
 finally{URL.revokeObjectURL(obj)}
}
window.DuoPremiumVoice={
 enabled,speak,
 get:()=>({...conf,pinConfigured:!!pin()}),
 configure(config){conf.enabled=config.enabled===true;conf.url=String(config.url||'').trim();conf.voices={...config.voices};if(typeof config.pin==='string'){try{sessionStorage.setItem(PIN,config.pin)}catch(e){}}save()},
 async voices(){const r=await fetch(endpoint()+'/voices',{method:'POST',headers:{'Content-Type':'application/json','X-Duo-Pin':pin()},body:'{}'});const d=await r.json();if(!r.ok)throw Error(d.error||'Failed loading voices');return d.voices||[]}
};
})();
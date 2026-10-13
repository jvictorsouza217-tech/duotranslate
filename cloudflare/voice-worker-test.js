/** Optional DuoTranslate 2.7 voice TEST Worker.
 * Deploy as a SEPARATE Cloudflare Worker. The existing Gemini Worker is never modified.
 * Secrets (Cloudflare): ELEVENLABS_API_KEY, DUO_ACCESS_CODE, ENABLE_VOICE_TEST="yes".
 * Binding VOICE_LIMITER is REQUIRED; do not deploy without 4/min shared rate limit.
 * ElevenLabs calls use credits, including free-tier credits. Privacy: audio/text sent to ElevenLabs.
 */
import {realtimeVoice} from './realtime-voice.js';
import {individualAccess} from './access-auth.js';
const ORIGIN='https://jvictorsouza217-tech.github.io';
const API='https://api.elevenlabs.io';
const LANGS=new Set(['pt-BR','fr-FR','en-US','es-ES','it-IT','de-DE','ar-SA','zh-CN','nl-NL','pl-PL','ro-RO','uk-UA','ru-RU','tr-TR']);
function cors(){return {'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'Content-Type, X-Duo-Pin, Authorization','Access-Control-Allow-Methods':'POST,OPTIONS,GET','Vary':'Origin','Cache-Control':'no-store'}}
function json(obj,status=200){return new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json; charset=utf-8',...cors()}})}
async function validPin(got,expected){
 if(!got||!expected||got.length>200||expected.length>200)return false;
 const e=new TextEncoder(),[a,b]=await Promise.all([got,expected].map(async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',e.encode(x)))));
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
export default {
 async fetch(req,env){
  const origin=req.headers.get('Origin');
  if(origin && origin!==ORIGIN)return new Response('Forbidden',{status:403});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
  const path=new URL(req.url).pathname;
  if(path==='/realtime')return realtimeVoice(req,env);
  if(req.method==='GET'&&path==='/health')return json({service:'DuoTranslate optional ElevenLabs test',configured:!!(env.ELEVENLABS_API_KEY&&env.DUO_ACCESS_CODE&&env.ENABLE_VOICE_TEST==='yes'&&env.VOICE_LIMITER),maxCharacters:220,ratePerMinute:4,individualAccess:!!env.DUO_ACCESS_SERVICE,accessVersion:1});
  if(req.method!=='POST'||!['/tts','/voices','/stream-tts'].includes(path))return json({error:'Not found.'},404);
  if(!env.ELEVENLABS_API_KEY||!env.DUO_ACCESS_CODE||env.ENABLE_VOICE_TEST!=='yes'||!env.VOICE_LIMITER)return json({error:'ElevenLabs não ativado ou limite de uso não configurado.'},503);
  const access=await individualAccess(req,env,true);
  if(access?.error)return json({error:access.error},access.status);
  if(!access && !await validPin(req.headers.get('X-Duo-Pin'),env.DUO_ACCESS_CODE))return json({error:'Código de acesso inválido.'},401);
  if(path==='/stream-tts'&&!access?.user)return json({error:'Ative o acesso individual.'},401);
  const limiter=path==='/stream-tts'?env.STREAM_VOICE_LIMITER:env.VOICE_LIMITER;
  if(!limiter)return json({error:'Limite de tradução contínua não configurado.'},503);
  const allowed=await limiter.limit({key:path==='/stream-tts'?'duotranslate-voice-stream-shared':'duotranslate-voice-demo-shared'});
  if(!allowed.success)return json({error:'Limite de testes de voz: aguarde um minuto.'},429);
  if(!String(req.headers.get('Content-Type')||'').includes('application/json'))return json({error:'Expected JSON.'},415);
  if(Number(req.headers.get('Content-Length')||0)>1500)return json({error:'Request too long.'},413);
  let input;try{const body=await req.text();if(body.length>3000)return json({error:'Request too long.'},413);input=JSON.parse(body)}catch(e){return json({error:'Invalid JSON.'},400)}
  if(path==='/voices'){
   const response=await fetch(API+'/v2/voices?page_size=50',{headers:{'xi-api-key':env.ELEVENLABS_API_KEY}});
   if(!response.ok)return json({error:'Lista de vozes indisponível na sua conta (HTTP '+response.status+').'},502);
   const obj=await response.json();
   return json({voices:(obj.voices||[]).map(v=>({id:v.voice_id,name:v.name,preview:typeof v.preview_url==='string'&&/^https:\/\/(storage\.googleapis\.com|[^/]*\.elevenlabs\.io)\//.test(v.preview_url)?v.preview_url:''})).filter(x=>x.id&&x.name).slice(0,50)});
  }
  const text=String(input?.text||'').trim(), voiceId=String(input?.voiceId||''),lang=String(input?.lang||'');
  if(!text||text.length>(path==='/stream-tts'?900:220)||!LANGS.has(lang)||!/^[a-zA-Z0-9]{12,40}$/.test(voiceId))
   return json({error:'Informe uma frase dentro do limite, idioma e ID de voz válida.'},400);
  const c=new AbortController(),tid=setTimeout(()=>c.abort(),14000);
  let res;
  try{res=await fetch(API+'/v1/text-to-speech/'+encodeURIComponent(voiceId)+'?output_format=mp3_22050_32',{
   method:'POST',headers:{'xi-api-key':env.ELEVENLABS_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({text,model_id:'eleven_flash_v2_5',language_code:lang.slice(0,2)}),signal:c.signal
  });}catch(e){return json({error:'Timeout ou falha de rede na ElevenLabs.'},504)}
  finally{clearTimeout(tid)}
  if(res.status===429)return json({error:'Cota da ElevenLabs esgotada.'},429);
  if(!res.ok)return json({error:'Falha na ElevenLabs (HTTP '+res.status+'). Confira chave, créditos e voz.'},502);
  const blob=await res.arrayBuffer();
  if(blob.byteLength>1000000)return json({error:'Áudio grande demais.'},502);
  return new Response(blob,{status:200,headers:{...cors(),'Content-Type':'audio/mpeg','X-Duo-Source':'ElevenLabs Flash v2.5'}});
 }
};

/** Optional DuoTranslate 2.7 voice TEST Worker.
 * Deploy as a SEPARATE Cloudflare Worker. The existing Gemini Worker is never modified.
 * Secrets (Cloudflare): ELEVENLABS_API_KEY, DUO_ACCESS_CODE, ENABLE_VOICE_TEST="yes".
 * Binding VOICE_LIMITER is REQUIRED; do not deploy without 4/min shared rate limit.
 * ElevenLabs calls use credits, including free-tier credits. Privacy: audio/text sent to ElevenLabs.
 */
const ORIGIN='https://jvictorsouza217-tech.github.io';
const API='https://api.elevenlabs.io';
const LANGS=new Set(['pt-BR','fr-FR','en-US','es-ES','it-IT','de-DE','ar-SA','zh-CN','nl-NL','pl-PL','ro-RO','uk-UA','ru-RU','tr-TR']);
function cors(){return {'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'Content-Type, X-Duo-Pin','Access-Control-Allow-Methods':'POST,OPTIONS,GET','Vary':'Origin','Cache-Control':'no-store'}}
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
  if(req.method==='GET'&&path==='/health')return json({service:'DuoTranslate optional ElevenLabs test',configured:!!(env.ELEVENLABS_API_KEY&&env.DUO_ACCESS_CODE&&env.ENABLE_VOICE_TEST==='yes'&&env.VOICE_LIMITER),maxCharacters:220,ratePerMinute:4});
  if(req.method!=='POST'||!['/tts','/voices'].includes(path))return json({error:'Not found.'},404);
  if(!env.ELEVENLABS_API_KEY||!env.DUO_ACCESS_CODE||env.ENABLE_VOICE_TEST!=='yes'||!env.VOICE_LIMITER)return json({error:'ElevenLabs não ativado ou limite de uso não configurado.'},503);
  if(!await validPin(req.headers.get('X-Duo-Pin'),env.DUO_ACCESS_CODE))return json({error:'Código de acesso inválido.'},401);
  const allowed=await env.VOICE_LIMITER.limit({key:'duotranslate-voice-demo-shared'});
  if(!allowed.success)return json({error:'Limite de testes de voz: aguarde um minuto.'},429);
  if(!String(req.headers.get('Content-Type')||'').includes('application/json'))return json({error:'Expected JSON.'},415);
  if(Number(req.headers.get('Content-Length')||0)>1500)return json({error:'Request too long.'},413);
  let input;try{input=await req.json()}catch(e){return json({error:'Invalid JSON.'},400)}
  if(path==='/voices'){
   const response=await fetch(API+'/v2/voices?page_size=50',{headers:{'xi-api-key':env.ELEVENLABS_API_KEY}});
   if(!response.ok)return json({error:'Lista de vozes indisponível na sua conta (HTTP '+response.status+').'},502);
   const obj=await response.json();
   return json({voices:(obj.voices||[]).map(v=>({id:v.voice_id,name:v.name})).filter(x=>x.id&&x.name).slice(0,50)});
  }
  const text=String(input?.text||'').trim(), voiceId=String(input?.voiceId||''),lang=String(input?.lang||'');
  if(!text||text.length>220||!LANGS.has(lang)||!/^[a-zA-Z0-9]{12,40}$/.test(voiceId))
   return json({error:'Informe frase com até 220 caracteres, idioma e ID de voz válida.'},400);
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
/* Experimental Google Live Translate token issuer: OFF by default.
 * The primary Gemini translator/other access routes are unchanged. */
import {individualAccess} from './access-auth.js';
const model='gemini-3.5-live-translate-preview';
const languages=new Set(['pt-BR','fr-FR','en-US','es-ES','it-IT','de-DE','ar-SA','zh-CN','nl-NL','pl-PL','ro-RO','uk-UA','ru-RU','tr-TR']);
const languageTargets={'zh-CN':'zh-Hans','pt-BR':'pt-BR'};
const cors={'Access-Control-Allow-Origin':'https://jvictorsouza217-tech.github.io','Access-Control-Allow-Headers':'Content-Type, Authorization','Cache-Control':'no-store'};
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...cors,'Content-Type':'application/json'}});
export async function createLiveToken(request,env){
 // Must be an explicit opt-in on the server AND a logged-in administrator.
 if(env.ENABLE_LIVE_TRANSLATE!=='yes')return reply({error:'Piloto Gemini Live desligado no servidor. Nenhuma chamada paga foi iniciada.'},503);
 const access=await individualAccess(request,env);
 if(!access?.user||access.user.role!=='admin')return reply({error:'Somente o administrador pode testar o piloto.'},403);
 if(!env.GEMINI_API_KEY||!env.AI_RATE_LIMITER)return reply({error:'Configuração de credenciais/limites incompleta.'},503);
 let input;try{input=await request.json();}catch{return reply({error:'JSON inválido.'},400);}
 const target=String(input?.target||'');
 if(!languages.has(target))return reply({error:'Idioma inválido.'},400);
 const allowed=await env.AI_RATE_LIMITER.limit({key:'duo-live-experiment-token'});
 if(!allowed.success)return reply({error:'Limite de testes atingido. Aguarde um minuto.'},429);
 const now=Date.now();
 const config={
  uses:1,
  newSessionExpireTime:new Date(now+60000).toISOString(),
  expireTime:new Date(now+5*60000).toISOString(),
  liveConnectConstraints:{
   model:'models/'+model,
   config:{responseModalities:['AUDIO'],inputAudioTranscription:{},outputAudioTranscription:{},
    translationConfig:{targetLanguageCode:languageTargets[target]||target.split('-')[0],echoTargetLanguage:false}}
  }
 };
 let upstream;
 try{
  upstream=await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens',{
   method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
   body:JSON.stringify(config),signal:AbortSignal.timeout(12000)
  });
 }catch{return reply({error:'Não foi possível consultar Google Live. Confira a rede e as permissões.'},504);}
 if(!upstream.ok){return reply({error:'A conta Gemini não autorizou Live Translate (HTTP '+upstream.status+'). Verifique disponibilidade/cota antes de habilitar.'},503);}
 const answer=await upstream.json().catch(()=>({}));
 if(typeof answer.name!=='string'||!answer.name.startsWith('auth_tokens/'))return reply({error:'Token temporário inválido retornado pelo Google.'},502);
 return reply({token:answer.name,model,validForSeconds:300});
}

import {individualAccess} from './access-auth.js';
const ORIGIN='https://jvictorsouza217-tech.github.io';
const LANGS=new Set(['pt','fr','en','es','it','de','ar','zh','nl','pl','ro','uk','ru','tr']);
export async function realtimeVoice(req,env){
 const fail=(error,status)=>new Response(JSON.stringify({error}),{status,headers:{'Content-Type':'application/json'}});
 if(req.headers.get('Origin')!==ORIGIN)return fail('Origem não permitida.',403);
 if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return fail('WebSocket required.',426);
 const protocols=(req.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(v=>v.trim());
 const credential=protocols.find(v=>/^duo-access-[a-f0-9]{64}$/.test(v));
 if(!protocols.includes('duo-v1')||!credential)return fail('Ative seu acesso individual antes de iniciar.',401);
 const authRequest=new Request(req.url,{headers:{Authorization:'Bearer '+credential.slice(11),Origin:ORIGIN}});
 const access=await individualAccess(authRequest,env,true);
 if(!access?.user)return fail(access?.error||'Acesso inválido.',access?.status||401);
 if(!env.ELEVENLABS_API_KEY||env.ENABLE_VOICE_TEST!=='yes'||!env.REALTIME_LIMITER)return fail('Tradução contínua indisponível.',503);
 const lang=new URL(req.url).searchParams.get('language');if(!LANGS.has(lang))return fail('Idioma inválido.',400);
 if(!(await env.REALTIME_LIMITER.limit({key:'duo-realtime-shared'})).success)return fail('Aguarde um minuto antes de iniciar outra sessão.',429);
 const url=new URL('https://api.elevenlabs.io/v1/speech-to-text/realtime');
 for(const [key,value] of Object.entries({model_id:'scribe_v2_realtime',audio_format:'pcm_16000',language_code:lang,commit_strategy:'vad',vad_silence_threshold_secs:'0.7'}))url.searchParams.set(key,value);
 let response;try{response=await fetch(url,{headers:{Upgrade:'websocket','xi-api-key':env.ELEVENLABS_API_KEY},signal:AbortSignal.timeout(12000)});}catch{return fail('Falha ao iniciar a transcrição.',502);}
 const upstream=response.webSocket;if(!upstream)return fail('ElevenLabs não liberou a transcrição. Confira créditos e permissão de Speech to Text.',502);
 const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.accept();upstream.accept();
 let closed=false,bytes=0,started=Date.now(),checking=false;
 const shutdown=(reason='Sessão encerrada')=>{if(closed)return;closed=true;clearTimeout(expiry);clearInterval(check);try{server.close(1000,reason);}catch{}try{upstream.close(1000,reason);}catch{}};
 const expiry=setTimeout(()=>shutdown('Limite de 20 minutos. Inicie outra sessão.'),20*60*1000);
 const check=setInterval(async()=>{if(checking||closed)return;checking=true;try{const value=await individualAccess(authRequest,env,true);if(!value?.user)shutdown('Acesso expirado ou revogado.');}catch{shutdown('Não foi possível validar o acesso.');}finally{checking=false;}},30000);
 server.addEventListener('message',event=>{
  if(closed)return;
  if(typeof event.data!=='string'||event.data.length>24000){shutdown('Bloco de áudio inválido.');return;}
  let data;try{data=JSON.parse(event.data);}catch{shutdown('Áudio inválido.');return;}
  if(data.message_type!=='input_audio_chunk'||typeof data.audio_base_64!=='string'||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.audio_base_64)){shutdown('Áudio inválido.');return;}
  bytes+=data.audio_base_64.length*.75;
  if(bytes>32000*((Date.now()-started)/1000+5)){shutdown('Velocidade de áudio inválida.');return;}
  try{upstream.send(JSON.stringify({message_type:'input_audio_chunk',audio_base_64:data.audio_base_64,sample_rate:16000,commit:data.commit===true}));}catch{shutdown();}
 });
 upstream.addEventListener('message',event=>{if(closed)return;try{if(typeof event.data==='string'&&event.data.length<=64000)server.send(event.data);else shutdown('Resposta inválida.');}catch{shutdown();}});
 for(const socket of [server,upstream]){socket.addEventListener('close',()=>shutdown());socket.addEventListener('error',()=>shutdown('Falha na conexão de áudio.'));}
 return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'duo-v1'}});
}

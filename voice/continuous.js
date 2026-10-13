/* Independent capture, ordered translation and audio playback. No provider key in the browser. */
(() => {
'use strict';
const moduleBase=new URL('.',document.currentScript.src);
function split(text,max=500){const chunks=[];let value=text.trim();while(value.length>max){let end=value.lastIndexOf(' ',max);if(end<max/2)end=max;chunks.push(value.slice(0,end));value=value.slice(end).trim();}if(value)chunks.push(value);return chunks;}
function create({status,caption,result,translate,onState,failure=()=>{}}){
 let run=null;
 function stop(message='Tradução contínua parada.'){
  const r=run;if(!r)return;run=null;r.cancel.abort();clearInterval(r.flushTimer);clearInterval(r.commitTimer);clearTimeout(r.connectTimer);r.socket?.close();r.stream?.getTracks().forEach(t=>t.stop());r.node?.disconnect();r.source?.disconnect();try{r.playing?.stop();}catch{}r.ctx?.close().catch(()=>{});onState(false);status(message);
 }
 async function start(source,target,voiceId){
  if(run)stop();if(source===target)throw new Error('Escolha idiomas diferentes.');if(!voiceId)throw new Error('Escolha uma voz ElevenLabs.');
  const r={cancel:new AbortController(),pending:[],queue:[],busy:false,ready:false,sourceLanguage:source,targetLanguage:target,voiceId};run=r;onState(true);
  try{
   r.ctx=new (window.AudioContext||window.webkitAudioContext)();await r.ctx.resume();status('Conectando a transcrição contínua…');
   await window.DuoAccess.configure();if(run!==r)return;
   r.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(run!==r){r.stream.getTracks().forEach(t=>t.stop());return;}
   await r.ctx.audioWorklet.addModule(new URL('pcm-worklet.js?v=1',moduleBase));if(run!==r)return;
   r.socket=window.DuoAccess.openRealtime(source);
   r.connectTimer=setTimeout(()=>{if(run===r)stop('Não foi possível iniciar a transcrição. Confira o acesso e tente novamente.');},15000);
   r.socket.onmessage=event=>{
    if(run!==r)return;let data;try{data=JSON.parse(event.data);}catch{return;}
    if(data.message_type==='session_started'){
     clearTimeout(r.connectTimer);r.ready=true;
     r.source=r.ctx.createMediaStreamSource(r.stream);r.node=new AudioWorkletNode(r.ctx,'duo-pcm');r.source.connect(r.node);r.node.connect(r.ctx.destination);
     r.node.port.onmessage=e=>{if(run!==r||r.socket.readyState!==1)return;if(r.socket.bufferedAmount>96000){stop('Conexão lenta: captação interrompida para não acumular atraso.');return;}const bytes=new Uint8Array(e.data);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);r.socket.send(JSON.stringify({message_type:'input_audio_chunk',audio_base_64:btoa(binary),sample_rate:16000,commit:r.commitPending===true}));r.commitPending=false;};
     status('Ouvindo continuamente. As traduções serão reproduzidas em sequência.');
     r.flushTimer=setInterval(()=>flush(r),2500);
     // Commit a long uninterrupted utterance periodically instead of waiting forever for silence.
     r.commitTimer=setInterval(()=>{if(run===r)r.commitPending=true;},5000);
    }else if(data.message_type==='partial_transcript'){caption(data.text||'');if(data.text?.trim())status('Reconhecendo fala… aguardando o fim do trecho para traduzir.');}
    else if(data.message_type==='committed_transcript'&&data.text?.trim()){
     caption(data.text);r.pending.push(data.text.trim());status('Fala reconhecida. Preparando a tradução…');
     if(r.pending.join(' ').length>1800)stop('A transcrição acumulou atraso. Pare a fonte de áudio e inicie novamente.');
    }else if(data.error||/error|quota|rate_limited|overflow|exhausted/.test(data.message_type||'')){stop('Transcrição interrompida: '+String(data.error||data.message_type).slice(0,180));}
   };
   r.socket.onerror=()=>{if(run===r)stop('Falha na transcrição contínua. Confira a conexão, os créditos e a permissão Speech to Text da ElevenLabs.');};
   r.socket.onclose=e=>{if(run===r)stop(e.reason||'A conexão de transcrição foi encerrada.');};
  }catch(e){if(run===r)stop('Não foi possível iniciar: '+e.message);}
 }
 function flush(r){if(run!==r||!r.pending.length)return;const chunks=split(r.pending.join(' '));r.pending=[];r.queue.push(...chunks);if(r.queue.length>4){stop('A tradução acumulou atraso. Captação interrompida; confira a conexão e reinicie.');return;}pump(r);}
 async function pump(r){
  if(run!==r||r.busy||!r.queue.length)return;r.busy=true;
  const original=r.queue.shift();let translatedResult=false;
  try{
   status('Traduzindo com Gemini…');
   const translated=await translate(original,r.sourceLanguage,r.targetLanguage);if(run!==r)return;
   result(original,translated);translatedResult=true;status('Tradução pronta. Preparando áudio ElevenLabs…');
   for(const phrase of split(translated,800)){
    if(run!==r)return;
    const response=await window.DuoAccess.fetch(window.DuoAccess.voiceUrl+'/stream-tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:phrase,lang:r.targetLanguage,voiceId:r.voiceId}),signal:typeof AbortSignal.any==='function'&&typeof AbortSignal.timeout==='function'?AbortSignal.any([r.cancel.signal,AbortSignal.timeout(18000)]):r.cancel.signal});
    if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||'Falha ao reproduzir a tradução.');}
    const bytes=await response.arrayBuffer();if(run!==r)return;const buffer=await r.ctx.decodeAudioData(bytes);if(run!==r)return;
    await r.ctx.resume();if(run!==r)return;status('Reproduzindo a tradução. A captação continua ativa…');
    await new Promise(resolve=>{const audio=r.ctx.createBufferSource();audio.buffer=buffer;audio.connect(r.ctx.destination);r.playing=audio;audio.onended=resolve;audio.start();});
   }
   if(run===r)status('Ouvindo continuamente. Pronto para o próximo trecho.');
  }catch(e){if(run===r){
    if(!translatedResult)failure(original,String(e.message||e));
    status((translatedResult?'Tradução exibida, mas o áudio falhou: ':'Trecho não traduzido: ')+String(e.message||e).slice(0,140)+'. Continuando a escutar.');
   }}
  finally{r.busy=false;if(run===r)pump(r);}
 }
 return {start,stop,get active(){return !!run;}};
}
window.DuoContinuous={create,split};
})();

/* Opt-in preview adapter for Gemini Live Translate. No provider API key in the page.
 * Only used when ?livePilot=1 and server ENABLE_LIVE_TRANSLATE=yes. */
(() => {
'use strict';
const base=new URL('.',document.currentScript.src);
function create({status,caption,result,onState}){
 let current=null;
 function stop(message='Piloto simultâneo encerrado.'){
  const r=current;if(!r)return;current=null;
  clearTimeout(r.limit);r.socket?.close();r.stream?.getTracks().forEach(track=>track.stop());
  r.node?.disconnect();r.source?.disconnect();
  for(const item of r.playing||[])try{item.stop();}catch{}
  r.ctx?.close().catch(()=>{});onState(false);status(message);
 }
 function play(r,base64){
  // Google Live Translate returns raw mono 24 kHz signed PCM16 (not MP3).
  const binary=atob(base64),length=Math.floor(binary.length/2);if(!length||length>240000)return;
  const buf=r.ctx.createBuffer(1,length,24000),data=buf.getChannelData(0);
  for(let i=0;i<length;i++){let v=binary.charCodeAt(i*2)|(binary.charCodeAt(i*2+1)<<8);if(v>32767)v-=65536;data[i]=v/32768;}
  const source=r.ctx.createBufferSource();source.buffer=buf;source.connect(r.ctx.destination);
  r.nextPlay=Math.max(r.ctx.currentTime+.06,r.nextPlay||0);
  const start=r.nextPlay;r.nextPlay+=buf.duration;r.playing.add(source);
  source.onended=()=>r.playing.delete(source);source.start(start);
 }
 async function start(target){
  if(current)stop();if(!window.DuoAccess?.active||window.DuoAccess.role!=='admin')throw Error('O piloto está disponível somente para o administrador.');
  const r={ctx:null,socket:null,stream:null,playing:new Set(),input:'',output:'',nextPlay:0};current=r;onState(true);
  try{
   r.ctx=new (window.AudioContext||window.webkitAudioContext)();await r.ctx.resume();
   status('Pedindo autorização temporária ao Gemini Live…');
   const response=await window.DuoAccess.fetch(window.DuoAccess.aiUrl+'/live-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target})});
   const info=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(info.error||'Piloto bloqueado pelo servidor.');
   if(current!==r)return;
   r.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   await r.ctx.audioWorklet.addModule(new URL('pcm-live-worklet.js?v=1',base));
   if(current!==r)return;
   const socketUrl='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(info.token);
   r.socket=new WebSocket(socketUrl);
   r.socket.onopen=()=>{
    // The backend creates a token locked to exactly this model and target.
    r.socket.send(JSON.stringify({setup:{model:'models/'+info.model,generationConfig:{
     responseModalities:['AUDIO'],inputAudioTranscription:{},outputAudioTranscription:{},
     translationConfig:{targetLanguageCode:target==='zh-CN'?'zh-Hans':target==='pt-BR'?'pt-BR':target.split('-')[0],echoTargetLanguage:false}
    }}}));
    status('Conectado ao Gemini Live. Aguardando a abertura do áudio…');
   };
   r.socket.onmessage=event=>{
    if(current!==r)return;let msg;try{msg=JSON.parse(event.data);}catch{return;}
    if(msg.error){stop('Gemini Live: '+String(msg.error.message||msg.error).slice(0,170));return;}
    if(msg.setupComplete){
     r.source=r.ctx.createMediaStreamSource(r.stream);
     r.node=new AudioWorkletNode(r.ctx,'duo-live-pcm');
     r.source.connect(r.node);r.node.connect(r.ctx.destination);
     r.node.port.onmessage=e=>{
      if(current!==r||r.socket.readyState!==1)return;
      if(r.socket.bufferedAmount>96000){stop('Internet lenta demais para tradução simultânea.');return;}
      const bytes=new Uint8Array(e.data);let binary='';for(const v of bytes)binary+=String.fromCharCode(v);
      r.socket.send(JSON.stringify({realtimeInput:{audio:{data:btoa(binary),mimeType:'audio/pcm;rate=16000'}}}));
     };
     status('Ouvindo e traduzindo com Gemini Live. Use fones para evitar eco.');
    }
    const content=msg.serverContent;
    if(!content)return;
    if(content.inputTranscription?.text){r.input=String(content.inputTranscription.text);caption(r.input);}
    if(content.outputTranscription?.text){r.output=String(content.outputTranscription.text);status('Recebendo tradução simultânea…');}
    for(const part of content.modelTurn?.parts||[]){if(part.inlineData?.data&&/audio\/pcm/i.test(part.inlineData.mimeType||'audio/pcm'))play(r,part.inlineData.data);}
    if(content.turnComplete||content.generationComplete){
     if(r.input.trim()&&r.output.trim())result(r.input,r.output);
     r.input='';r.output='';
    }
   };
   r.socket.onerror=()=>{if(current===r)stop('Falha na conexão Gemini Live. Verifique cota e rede.');};
   r.socket.onclose=e=>{if(current===r)stop('Conexão Gemini Live encerrada: '+String(e.reason||e.code).slice(0,90));};
   // Safety stop: this is only a short proof-of-concept; no unattended usage.
   r.limit=setTimeout(()=>{if(current===r)stop('Limite experimental de 4 minutos atingido.');},240000);
  }catch(e){if(current===r)stop('Piloto indisponível: '+String(e.message||e).slice(0,160));}
 }
 return {start,stop,get active(){return !!current;}};
}
window.DuoLiveTranslate={create};
})();
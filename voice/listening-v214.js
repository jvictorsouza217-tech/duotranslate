/* DuoTranslate 2.14 — isolated listening experiment.
   Browser Translator runs on-device when supported. Existing Gemini/MyMemory
   is an EXPLICIT alternative; ElevenLabs requests only occur when selected.
   Microphone recognition may use browser servers unless on-device is required.
   Do not silently change the chosen translation or voice provider. */
(() => {
 'use strict';
 const LANGS=[['pt-BR','🇧🇷 Português'],['fr-FR','🇫🇷 Francês'],['en-US','🇬🇧 Inglês'],['es-ES','🇪🇸 Espanhol'],['it-IT','🇮🇹 Italiano'],['de-DE','🇩🇪 Alemão'],['nl-NL','🇳🇱 Neerlandês'],['ar-SA','🇸🇦 Árabe'],['zh-CN','🇨🇳 Chinês'],['pl-PL','🇵🇱 Polonês'],['ro-RO','🇷🇴 Romeno'],['uk-UA','🇺🇦 Ucraniano'],['ru-RU','🇷🇺 Russo'],['tr-TR','🇹🇷 Turco']];
 const SHORT=l=>l==='zh-CN'?'zh-Hans':String(l||'').split('-')[0];
 const CLEAN=x=>String(x||'').replace(/\s+/g,' ').trim();
 const $=id=>document.getElementById('duoListen214'+id);
 const clock=()=>performance.now();
 const RECOGNITION=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
 let ui=null,mounted=false,visible=false,listening=false,recognition=null,userStopped=true,run=0;
 let restartCount=0,restartTimer=null,localTranslator=null,localPair='',prepareRun=0;
 let finalQueue=[],draining=false,playingAudio=null,pendingFetch=null,voiceURI='',partialTimer=null,partialVersion=0;
 let recognitionStartedAt=0,firstInterimAt=0,lastInterim='',historyCount=0,voiceOptionsLoaded=false,cancelPlayback=null;
 const pair=()=>SHORT(ui.from.value)+'>'+SHORT(ui.to.value);
 const status=x=>{if(ui)ui.status.textContent=x;};
 const info=x=>{if(ui)ui.info.textContent=x;};
 function saveSettings(){
  if(!ui)return;
  try{localStorage.setItem('duotranslate.listening214.settings',JSON.stringify({
   from:ui.from.value,to:ui.to.value,engine:ui.engine.value,output:ui.output.value,
   voiceId:ui.premium.value,voiceURI:ui.localVoice.value,deviceOnly:ui.deviceOnly.checked
  }));}catch(e){}
 }
 function currentSettings(){
  try{return JSON.parse(localStorage.getItem('duotranslate.listening214.settings')||'{}')||{};}
  catch(e){return {};}
 }
 function closeTranslator(){
  ++prepareRun;
  if(localTranslator?.destroy)try{localTranslator.destroy();}catch(e){}
  localTranslator=null;localPair='';
 }
 function clearPartial(){clearTimeout(partialTimer);partialTimer=null;++partialVersion;if(ui)ui.partial.textContent='';}
 function stopAudio(){
  pendingFetch?.abort();pendingFetch=null;
  const cancel=cancelPlayback;cancelPlayback=null;
  if(cancel)try{cancel();}catch(e){}
  if(playingAudio){try{playingAudio.pause();playingAudio.currentTime=0;}catch(e){}playingAudio=null;}
  try{window.speechSynthesis?.cancel();}catch(e){}
 }
 function stop(message='Escuta parada.'){
  ++run;userStopped=true;listening=false;clearPartial();
  clearTimeout(restartTimer);restartTimer=null;restartCount=0;finalQueue=[];
  const prev=recognition;recognition=null;
  if(prev){prev.onend=null;try{prev.abort();}catch(e){}}
  stopAudio();
  if(ui){ui.listen.textContent='Iniciar escuta';ui.listen.setAttribute('aria-pressed','false');}
  if(message)status(message);
 }
 function setVisible(next){
  if(visible&&!next)stop('');
  visible=!!next;
 }
 function localReady(){return !!localTranslator&&localPair===pair();}
 function isLocal(){return ui.engine.value==='local';}
 function validate(){
  if(ui.from.value===ui.to.value){status('Selecione dois idiomas diferentes.');return false;}
  if(ui.engine.value==='local'&&!localReady()){
   info('Chrome Translator ainda não foi preparado para este par de idiomas. Frases rápidas funcionam, mas frases livres exigem Preparar tradução local.');
  }
  return true;
 }
 function renderLocalVoices(){
  const voices=window.speechSynthesis?.getVoices?.()||[];
  const lang=SHORT(ui.to.value),matched=voices.filter(v=>SHORT(v.lang)===lang),wanted=voiceURI||ui.localVoice.value;
  ui.localVoice.replaceChildren();
  const defaultVoice=document.createElement('option');defaultVoice.value='';defaultVoice.textContent='Voz padrão do navegador';ui.localVoice.append(defaultVoice);
  for(const v of matched){const option=document.createElement('option');option.value=v.voiceURI;option.textContent=v.name+' · '+v.lang;ui.localVoice.append(option);}
  ui.localVoice.value=matched.some(v=>v.voiceURI===wanted)?wanted:'';
  voiceURI=ui.localVoice.value;
 }
 function renderPremiumVoices(){
  const entries=window.DuoEleven?.directory?.()||[];
  const prev=ui.premium.value||currentSettings().voiceId||'';
  ui.premium.replaceChildren();
  const place=document.createElement('option');place.value='';place.textContent='Selecione uma voz ElevenLabs';ui.premium.append(place);
  for(const v of entries){const o=document.createElement('option');o.value=v.id;o.textContent=v.name;ui.premium.append(o);}
  ui.premium.value=entries.some(v=>v.id===prev)?prev:'';
  if(!ui.premium.value)ui.premium.value=window.DuoEleven?.choices?.(ui.to.value)?.selected||'';
 }
 async function listVoices(){
  if(!window.DuoEleven?.available?.()){
   status('ElevenLabs não autorizada neste aparelho. Ative o acesso em Configurações antes de consultar as vozes.');return;
  }
  ui.browse.disabled=true;info('Consultando vozes ElevenLabs disponíveis neste acesso…');
  try{
   const entries=await window.DuoEleven.loadVoices(true);
   if(!visible)return;
   voiceOptionsLoaded=true;renderPremiumVoices();
   info(entries.length+' vozes ElevenLabs encontradas. Escolha uma voz e lembre-se de que o áudio usa créditos.');
  }catch(e){info('Não foi possível listar as vozes ElevenLabs: '+String(e.message||e).slice(0,140));}
  finally{ui.browse.disabled=false;}
 }
 function renderAudioOptions(){
  const paid=ui.output.value==='eleven';
  ui.premiumRow.hidden=!paid;ui.localRow.hidden=paid;
  ui.cost.textContent=paid?'ElevenLabs usa créditos da conta autorizada. Se falhar, NÃO trocaremos a voz pelo sistema.':
   'A voz do dispositivo não usa créditos da ElevenLabs. O reconhecimento do navegador pode usar servidores do fabricante.';
  if(paid&&!voiceOptionsLoaded){renderPremiumVoices();}
 }
 async function prepareLocal(){
  if(!validate())return;
  if(!window.Translator?.create){
   info('Chrome Translator local indisponível neste navegador. Frases rápidas continuam gratuitas; para frases livres, selecione Motor atual.');
   return;
  }
  stop('Preparando motor de tradução local…');
  closeTranslator();const epoch=prepareRun,requested=pair(),options={sourceLanguage:SHORT(ui.from.value),targetLanguage:SHORT(ui.to.value)};
  ui.prepare.disabled=true;
  info('Preparando o modelo local; o Chrome pode baixar o idioma pela primeira vez.');
  try{
   // Call create directly inside a real click, prior to other awaits.
   const translator=await window.Translator.create({...options,monitor(m){
    m.addEventListener('downloadprogress',event=>{
     if(epoch===prepareRun)info('Baixando idiomas no Chrome: '+Math.round((event.loaded||0)*100)+'%');
    });
   }});
   if(epoch!==prepareRun||pair()!==requested){translator?.destroy?.();return;}
   localTranslator=translator;localPair=requested;
   info('Chrome Translator local pronto para '+ui.from.value+' → '+ui.to.value+'. Não faz chamadas à API de tradução paga.');
   status('Motor local preparado. Clique em Iniciar escuta ou teste digitando.');
  }catch(e){info('Chrome Translator local indisponível: '+String(e.message||e).slice(0,160)+'. Tente Motor atual para frases livres.');}
  finally{ui.prepare.disabled=false;}
 }
 function record(original,translation,provider,translationMs,error='',details={}){
  if(localStorage.getItem('duotranslate.history.enabled.v1')==='false')return;
  try{
   const key='duotranslate.local.history.v1',items=JSON.parse(localStorage.getItem(key)||'[]');
   if(!Array.isArray(items))return;
   const id=window.crypto?.randomUUID?.()||'listen214-'+Date.now()+'-'+(++historyCount);
   items.unshift({id,
    at:new Date().toISOString(),mode:'listening',direction:'sent',source:ui.from.value,
    target:ui.to.value,original,translation:translation||'',provider,translationMs:Math.round(translationMs||0),
    error,duo214:{...details}});
   localStorage.setItem(key,JSON.stringify(items.slice(0,250)));
   return id;
   try{document.getElementById('duoRealFrame')?.contentWindow?.DuoHistory?.refresh?.();}catch(e){}
  }catch(e){status('Tradução pronta; falha ao salvar Histórico: '+String(e.message||e).slice(0,90));}
 }
 function markAudio(id,stage,error=''){
 if(!id)return;
 try{
  const key='duotranslate.local.history.v1',entries=JSON.parse(localStorage.getItem(key)||'[]');
  if(!Array.isArray(entries))return;
  const entry=entries.find(x=>x.id===id);if(!entry)return;
  entry.duo214={...(entry.duo214||{}),audioStatus:stage};
  if(error)entry.error='Falha de áudio: '+error;
  localStorage.setItem(key,JSON.stringify(entries));
  try{document.getElementById('duoRealFrame')?.contentWindow?.DuoHistory?.refresh?.();}catch(e){}
 }catch(e){/* Voice status remains visible even if storage is unavailable. */}
}
async function translation(text){
  const phrase=window.DuoPhrasebook?.translate?.(text,ui.from.value,ui.to.value);
  if(phrase!==null&&phrase!==undefined)return {text:CLEAN(phrase),provider:'Frases rápidas locais'};
  if(isLocal()){
   if(!localReady())throw Error('Chrome Translator local não preparado. Clique em Preparar tradução local para frases livres.');
   return {text:CLEAN(await localTranslator.translate(text)),provider:'Chrome Translator local'};
  }
  if(!window.DuoReliable?.translate)throw Error('Motor Gemini/MyMemory não carregou.');
  const result=await window.DuoReliable.translate(text,ui.from.value,ui.to.value);
  return {text:CLEAN(result.text),provider:result.provider||'Gemini/MyMemory'};
 }
 function selectDeviceVoice(){
  const all=window.speechSynthesis?.getVoices?.()||[],choice=ui.localVoice.value;
  if(!choice)return all.find(v=>SHORT(v.lang)===SHORT(ui.to.value))||null;
  const found=all.find(v=>v.voiceURI===choice);
  if(!found)throw Error('Voz selecionada do dispositivo indisponível. Escolha uma voz válida.');
  return found;
 }
 async function playLocal(text,token,onStarted){
  const synth=window.speechSynthesis;
  if(!synth||typeof window.SpeechSynthesisUtterance!=='function')throw Error('Voz do dispositivo indisponível.');
  const voice=selectDeviceVoice();
  await new Promise((resolve,reject)=>{
   if(run!==token){resolve();return;}
   const u=new window.SpeechSynthesisUtterance(text);u.lang=ui.to.value;
   if(voice)u.voice=voice;
   const timeout=setTimeout(()=>{synth.cancel();reject(Error('A voz do dispositivo não terminou a reprodução.'));},65000);
   let settled=false;
   const end=(error)=>{if(settled)return;settled=true;clearTimeout(timeout);cancelPlayback=null;error?reject(error):resolve();};
   cancelPlayback=()=>end(Error('Reprodução interrompida.'));
   u.onstart=()=>{if(run===token)onStarted();};
   u.onend=()=>end();u.onerror=e=>end(Error('Voz do dispositivo falhou: '+String(e.error||'erro')));
   try{synth.speak(u);}catch(e){end(e);}
  });
 }
 async function playEleven(text,token,onStarted){
  if(!window.DuoAccess?.active)throw Error('Para ElevenLabs é necessário acesso individual ativado nas Configurações.');
  const voiceId=ui.premium.value;
  if(!/^[A-Za-z0-9]{12,40}$/.test(voiceId))throw Error('Selecione uma voz ElevenLabs válida.');
  if(text.length>900)throw Error('Frase longa demais para ElevenLabs. Reduza o trecho.');
  const endpoint=window.DuoAccess.voiceUrl;
  if(!/^https:\/\/[a-z0-9.-]+$/i.test(endpoint))throw Error('Endereço de voz do DuoTranslate inválido.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),17000);
  pendingFetch=controller;
  let response;
  try{
   response=await window.DuoAccess.fetch(endpoint+'/stream-tts',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text,lang:ui.to.value,voiceId}),signal:controller.signal
   });
  }finally{clearTimeout(timer);if(pendingFetch===controller)pendingFetch=null;}
  if(!response.ok){
   let error=null;try{error=await response.json();}catch(e){}
   throw Error(error?.error||'ElevenLabs não respondeu (HTTP '+response.status+').');
  }
  const data=await response.blob();
  if(run!==token)return;
  const objectURL=URL.createObjectURL(data),audio=new Audio(objectURL);
  playingAudio=audio;
  try{
   await new Promise((resolve,reject)=>{
    let finished=false;
    const end=(error)=>{if(finished)return;finished=true;cancelPlayback=null;error?reject(error):resolve();};
    cancelPlayback=()=>end(Error('Reprodução interrompida.'));
    audio.onplaying=()=>{if(run===token)onStarted();};
    audio.onended=()=>end();
    audio.onerror=()=>end(Error('O áudio ElevenLabs não pôde ser reproduzido.'));
    audio.play().catch(end);
   });
  }finally{if(playingAudio===audio)playingAudio=null;URL.revokeObjectURL(objectURL);}
 }
 async function speak(text,token,onStarted){
  if(ui.output.value==='eleven')return playEleven(text,token,onStarted);
  return playLocal(text,token,onStarted);
 }
 function appendResult(text,translated,provider,error){
  const row=document.createElement('div');row.className='duo-listen214-result';
  const original=document.createElement('p');original.textContent=text;
  const result=document.createElement('strong');result.textContent=error?'Falha: '+error:translated;
  const badge=document.createElement('small');badge.textContent=provider;
  row.append(original,result,badge);ui.results.prepend(row);
  while(ui.results.children.length>15)ui.results.lastChild.remove();
 }
 function queueFinal(text){
  const clean=CLEAN(text);if(!clean)return;
  clearPartial();
  if(finalQueue.length>=12){
   stop('A fila acumulou mais de 12 frases. Escuta pausada para evitar perda silenciosa. Recomece após verificar a rede.');
   return;
  }
  finalQueue.push({text:clean,seenAt:clock(),sttMs:firstInterimAt?clock()-firstInterimAt:null});
  firstInterimAt=0;ui.partial.textContent='Reconhecido: '+clean;
  void drain();
 }
 async function drain(){
  if(draining)return;
  draining=true;const token=run;
  try{while(finalQueue.length&&token===run){
   const item=finalQueue.shift(),started=clock();
   ui.original.textContent=item.text;ui.translation.textContent='Traduzindo…';
   const source=ui.from.value,target=ui.to.value,providerChoice=ui.engine.value,audioChoice=ui.output.value;
   let translated='',provider=providerChoice==='local'?'Chrome Translator local':'Gemini/MyMemory';
   try{
    const value=await translation(item.text);
    if(run!==token)return;
    translated=CLEAN(value.text);provider=value.provider;
    if(!translated)throw Error('Motor retornou tradução vazia.');
   }catch(e){
    if(run!==token)return;
    const message=String(e.message||e);
    appendResult(item.text,'',provider,message);
    record(item.text,'',provider,clock()-started,message,{speechToTextMs:item.sttMs,output:audioChoice});
    ui.translation.textContent='Erro: '+message;status('Tradução não concluída: '+message);continue;
   }
   const translationMs=Math.round(clock()-started);
   ui.translation.textContent=translated;
   ui.metrics.textContent='Tradução: '+translationMs+' ms'+(item.sttMs===null?'':' · Primeira parcial → frase final: '+Math.round(item.sttMs)+' ms')+' · Áudio aguardando início';
   appendResult(item.text,translated,provider,'');
   const historyId=record(item.text,translated,provider,translationMs,'',{speechToTextMs:item.sttMs,output:audioChoice,audioStatus:'pending'});
   const ttsAt=clock(),startFromFirstInterim=item.sttMs===null?null:item.seenAt-item.sttMs;
   let startedAudio=false;
   status('Tradução pronta em '+translationMs+' ms; preparando '+(audioChoice==='eleven'?'ElevenLabs':'voz do dispositivo')+'…');
   try{
    await speak(translated,token,()=>{
     if(run!==token)return;
     startedAudio=true;
     ui.metrics.textContent='Tradução: '+translationMs+' ms'+
      (item.sttMs===null?'':' · Reconhecimento (1ª parcial → final): '+Math.round(item.sttMs)+' ms')+
      ' · Tradução → reprodução iniciada: '+Math.round(clock()-ttsAt)+' ms'+
      (startFromFirstInterim===null?'':' · 1ª parcial → reprodução iniciada: '+Math.round(clock()-startFromFirstInterim)+' ms');
     status('Reproduzindo em '+(audioChoice==='eleven'?'ElevenLabs':'voz do dispositivo')+'.');
    });
    if(run!==token)return;
    if(!startedAudio){markAudio(historyId,'unconfirmed');status('Áudio solicitado, mas o navegador não confirmou o início da reprodução.');}
    else{markAudio(historyId,'started');status('Pronto. Escutando próximas frases.');}
   }catch(e){
    if(run!==token)return;
    const message=String(e.message||e);
    markAudio(historyId,'failed',message);
    status('Texto traduzido, mas a voz '+(audioChoice==='eleven'?'ElevenLabs':'do dispositivo')+' falhou: '+message+'. Nenhuma troca automática de voz.');
    ui.metrics.textContent='Tradução: '+translationMs+' ms · Falha de áudio: '+message;
   }
  }}finally{draining=false;if(finalQueue.length)void drain();}
 }
 function stableWord(a,b){
  if(window.DuoFreeLab?.stablePrefix)return window.DuoFreeLab.stablePrefix(a,b);
  const x=CLEAN(a),y=CLEAN(b);let j=0;while(j<x.length&&j<y.length&&x[j]===y[j])j++;
  const prefix=y.slice(0,j),pos=prefix.lastIndexOf(' ');
  return pos<0?'':prefix.slice(0,pos).trim();
 }
 function preview(text){
  const item=CLEAN(text),previous=lastInterim;lastInterim=item;
  ui.partial.textContent=item?'Ouvindo: '+item:'';
  clearTimeout(partialTimer);const version=++partialVersion,word=stableWord(previous,item);
  if(!word||!isLocal()||!localReady())return;
  partialTimer=setTimeout(async()=>{
   try{
    const partial=await localTranslator.translate(word);
    if(version===partialVersion&&visible&&listening)ui.partial.textContent='Prévia provisória: '+CLEAN(partial);
   }catch(e){/* Interim preview failure never affects finalized translation. */}
  },550);
 }
 function beginRecognition(){
  if(!listening||!visible)return;
  const R=RECOGNITION();if(!R){stop('Reconhecimento de fala indisponível neste navegador. Use o teste digitado.');return;}
  const token=run;
  let rec;
  try{
   rec=new R();recognition=rec;rec.lang=ui.from.value;rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
   if(ui.deviceOnly.checked){
    if(!('processLocally'in rec)){stop('Reconhecimento no dispositivo não suportado neste navegador. Desmarque a opção para usar o serviço do navegador.');return;}
    rec.processLocally=true;
   }
   let known=new Set();
   rec.onresult=event=>{
    if(run!==token||!listening)return;
    let interim='';
    for(let i=event.resultIndex;i<event.results.length;i++){
     const segment=event.results[i],text=CLEAN(segment?.[0]?.transcript);
     if(!text)continue;
     if(segment.isFinal){if(!known.has(i)){known.add(i);queueFinal(text);}}
     else interim=text;
    }
    if(interim){if(!firstInterimAt)firstInterimAt=clock();preview(interim);}
   };
   rec.onerror=event=>{
    if(run!==token)return;
    const error=String(event.error||'erro desconhecido');
    if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(error)){
     stop('Microfone/idioma indisponível: '+error+'. Verifique as permissões.');
    }else status('Reconhecimento do navegador: '+error+'. Verificando recuperação.');
   };
   rec.onend=()=>{
    if(run!==token||!listening||userStopped||!visible)return;
    if(++restartCount>6){stop('O navegador encerrou a escuta várias vezes. Inicie novamente manualmente.');return;}
    status('Escuta interrompida pelo navegador. Tentativa de reconexão '+restartCount+'/6…');
    clearTimeout(restartTimer);
    restartTimer=setTimeout(()=>{if(run===token&&listening&&visible)beginRecognition();},Math.min(400*restartCount,2300));
   };
   rec.onstart=()=>{if(run===token){restartCount=0;recognitionStartedAt=clock();status('Escutando '+ui.from.value+'. Continue falando normalmente.');}};
   rec.start();
  }catch(e){if(run===token)stop('Não foi possível iniciar o reconhecimento: '+String(e.message||e));}
 }
 function toggleListening(){
  if(listening){stop();return;}
  if(!validate())return;
  if(!RECOGNITION()){status('Microfone indisponível neste navegador. Use o teste digitado.');return;}
  userStopped=false;listening=true;++run;restartCount=0;firstInterimAt=0;lastInterim='';
  ui.listen.textContent='Parar escuta';ui.listen.setAttribute('aria-pressed','true');
  beginRecognition();
 }
 function manual(){
  if(!validate())return;
  const text=CLEAN(ui.manualText.value);if(!text)return;
  queueFinal(text);
 }
 function changeConfig(){
  stop('Configuração alterada. Inicie uma nova escuta para usar os novos parâmetros.');
  saveSettings();
  ui.original.textContent='—';ui.translation.textContent='—';ui.metrics.textContent='';
 }
 function changeLanguages(){
  changeConfig();closeTranslator();voiceURI='';
  renderLocalVoices();renderPremiumVoices();
  info('Idiomas alterados. Prepare novamente o Chrome Translator se optar por tradução local.');
 }
 function mount(defaults={}){
  if(mounted)return;
  mounted=true;
  const ids=['Panel','From','To','Engine','Output','Prepare','Listen','Info','Cost','Status','Partial',
   'Original','Translation','Metrics','Results','ManualText','Manual','Premium','Browse','PremiumRow',
   'LocalVoice','LocalRow','DeviceOnly'];
  ui={};for(const id of ids)ui[id[0].toLowerCase()+id.slice(1)]=$(id);
  for(const name of ['from','to'])for(const [value,label] of LANGS){const opt=document.createElement('option');opt.value=value;opt.textContent=label;ui[name].append(opt);}
  const saved=currentSettings();
  ui.from.value=LANGS.some(x=>x[0]===saved.from)?saved.from:(defaults.from||'pt-BR');
  ui.to.value=LANGS.some(x=>x[0]===saved.to)?saved.to:(defaults.to||'fr-FR');
  ui.engine.value=['local','existing'].includes(saved.engine)?saved.engine:'local';
  ui.output.value=['device','eleven'].includes(saved.output)?saved.output:'device';
  ui.deviceOnly.checked=saved.deviceOnly===true;
  voiceURI=saved.voiceURI||'';
  renderLocalVoices();renderPremiumVoices();renderAudioOptions();
  ui.prepare.addEventListener('click',prepareLocal);
  ui.listen.addEventListener('click',toggleListening);
  ui.manual.addEventListener('click',manual);
  ui.manualText.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();manual();}});
  for(const select of [ui.from,ui.to])select.addEventListener('change',changeLanguages);
  for(const select of [ui.engine,ui.deviceOnly])select.addEventListener('change',changeConfig);
  ui.output.addEventListener('change',()=>{changeConfig();renderAudioOptions();});
  ui.localVoice.addEventListener('change',()=>{voiceURI=ui.localVoice.value;saveSettings();});
  ui.premium.addEventListener('change',saveSettings);
  ui.browse.addEventListener('click',listVoices);
  window.speechSynthesis?.addEventListener?.('voiceschanged',renderLocalVoices);
  window.addEventListener('pagehide',()=>stop(''));
  if(window.Translator?.create)info('Chrome Translator encontrado. Clique em Preparar tradução local para validar os idiomas.');
  else info('Chrome Translator local indisponível aqui. Frases rápidas continuam; escolha Motor atual para traduzir frases livres.');
 }
 window.DuoListening214={mount,setVisible,stop,get state(){return {listening,visible,localReady:localReady(),queue:finalQueue.length,engine:ui?.engine.value,output:ui?.output.value};}};
})();

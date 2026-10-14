/* DuoTranslate 2.11 free lab.
 * Original implementation inspired by public descriptions of streaming ASR / stable captions.
 * Explicitly no network API fetch, paid provider, third-party SDK or copied proprietary code.
 * Chrome built-in Translator may download on-device language packs after user clicks Prepare.
 * Web Speech Recognition may use a browser-managed online service (varies by browser).
 */
(() => {
 'use strict';
 const LANGS=[
  ['pt-BR','Português'],['fr-FR','Français'],['en-US','English'],['es-ES','Español'],
  ['it-IT','Italiano'],['de-DE','Deutsch'],['nl-NL','Nederlands'],['ar-SA','العربية'],
  ['zh-CN','中文'],['pl-PL','Polski'],['ro-RO','Română'],['uk-UA','Українська'],
  ['ru-RU','Русский'],['tr-TR','Türkçe']
 ];
 const RECOGNIZER=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
 const short=lang=>lang==='zh-CN'?'zh-Hans':String(lang).split('-')[0];
 const tidy=value=>String(value||'').replace(/\s+/g,' ').trim();
 const stablePrefix=(oldText,newText)=>{
  const a=tidy(oldText),b=tidy(newText);if(!a||!b)return '';
  let n=0;while(n<a.length&&n<b.length&&a[n]===b[n])n++;
  return b.slice(0,n).replace(/\s+\S*$/,'').trim();
 };
 let mounted=false,visible=false,ui=null,recognizer=null,active=false,userStopped=false,session=0;
 let translator=null,translatorKey='',running=false,previewTimer=null,previewEpoch=0;
 let firstInterimAt=0,lastFinal='',restartAttempts=0,restartTimer=null,prepared=false,voiceURI='',finalEpoch=0;
 const $=id=>document.getElementById(id);
 const pair=()=>short(ui.from.value)+'>'+short(ui.to.value);
 const status=(message)=>{if(ui)ui.status.textContent=message;};
 const report=(message)=>{if(ui)ui.compat.textContent=message;};
 const safeNow=()=>Math.round(performance.now());
 const canTranslate=()=>!!translator&&translatorKey===pair();
 function destroyTranslator(){if(translator?.destroy)try{translator.destroy();}catch{} translator=null;translatorKey='';prepared=false;}
 function stop(message='Escuta parada.'){
  userStopped=true;active=false;session++;previewEpoch++;
  clearTimeout(previewTimer);clearTimeout(restartTimer);previewTimer=null;restartTimer=null;
  const old=recognizer;recognizer=null;if(old){try{old.onend=null;old.abort();}catch{}}
  if(window.speechSynthesis)try{window.speechSynthesis.cancel();}catch{}
  if(ui){ui.listen.textContent='Iniciar escuta';ui.listen.setAttribute('aria-pressed','false');}
  if(message)status(message);
 }
 function setVisible(value){const wasVisible=visible;visible=!!value;if(wasVisible&&!visible)stop('');}
 function voices(){
  const selected=voiceURI||ui.voice.value;
  const list=(window.speechSynthesis?.getVoices?.()||[]);
  ui.voice.replaceChildren();
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Voz padrão do navegador';ui.voice.append(placeholder);
  for(const v of list){const opt=document.createElement('option');opt.value=v.voiceURI;opt.textContent=v.name+' · '+v.lang;ui.voice.append(opt);}
  ui.voice.value=list.some(v=>v.voiceURI===selected)?selected:'';
 }
 function translateChoice(text){
  if(window.DuoPhrasebook?.translate){
   const phrase=window.DuoPhrasebook.translate(text,ui.from.value,ui.to.value);
   if(phrase!==null&&phrase!==undefined)return {text:phrase,provider:'Frases locais'};
  }
  return null;
 }
 async function translateText(text,epoch,partial=false){
  const original=tidy(text);if(!original||ui.from.value===ui.to.value)return;
  const selectedPair=pair(),local=translateChoice(original),started=safeNow();
  let output='',provider='';
  if(local){output=local.text;provider=local.provider;}
  else if(canTranslate()){
   try{output=tidy(await translator.translate(original));provider='Chrome Translator local';}
   catch(e){if((partial?epoch===previewEpoch:epoch===finalEpoch))status('O modelo local falhou: '+String(e.message||e).slice(0,110));return;}
  }else{
   if(!partial&&epoch===finalEpoch)status('Esta frase não está no vocabulário local. Clique em Preparar tradução local para testar frases livres; não usamos serviços pagos.');
   return;
  }
  if((partial?epoch!==previewEpoch:epoch!==finalEpoch)||selectedPair!==pair()||!visible)return;
  if(!output){if(!partial)status('O tradutor local não produziu uma tradução.');return;}
  if(partial){ui.preview.textContent='Prévia ainda sujeita a revisão: '+output;return;}
  const ms=safeNow()-started;
  ui.original.textContent=original;ui.translated.textContent=output;
  ui.preview.textContent='';ui.metrics.textContent='Tradução: '+ms+' ms · '+provider+
   (firstInterimAt?' · Desde a primeira transcrição parcial: '+(safeNow()-firstInterimAt)+' ms':'');
  status('Tradução pronta em '+provider+'.');
  firstInterimAt=0;
  const row=document.createElement('div');row.className='free-row';
  const a=document.createElement('p');a.textContent=original;
  const b=document.createElement('strong');b.textContent=output;row.append(a,b);
  ui.results.prepend(row);while(ui.results.children.length>12)ui.results.lastChild.remove();
  // Same local history format. No microphone audio is retained.
  if(localStorage.getItem('duotranslate.history.enabled.v1')!=='false'){
   try{
    const key='duotranslate.local.history.v1',arr=JSON.parse(localStorage.getItem(key)||'[]');
    if(Array.isArray(arr)){arr.unshift({id:window.crypto?.randomUUID?.()||'free-'+Date.now(),
     at:new Date().toISOString(),mode:'continuous',direction:'sent',source:ui.from.value,
     target:ui.to.value,original,translation:output,provider:provider+' · 2.11',translationMs:ms,error:''});
     localStorage.setItem(key,JSON.stringify(arr.slice(0,250)));}
   }catch(e){status('Tradução pronta, mas não foi possível salvar o histórico: '+String(e.message||e).slice(0,80));}
  }
  if(ui.speak.checked)readAloud(output);
 }
 function readAloud(text){
  const synth=window.speechSynthesis;if(!synth||!window.SpeechSynthesisUtterance){status('Texto pronto, mas não há leitura de voz neste navegador.');return;}
  const all=synth.getVoices?.()||[],chosen=voiceURI?all.find(v=>v.voiceURI===voiceURI):all.find(v=>short(v.lang)===short(ui.to.value));
  if(voiceURI&&!chosen){status('A voz selecionada não existe mais neste dispositivo. Nenhuma voz foi substituída.');return;}
  if(ui.interrupt.checked)synth.cancel();
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang=ui.to.value;
  if(chosen)utterance.voice=chosen;
  utterance.rate=1;
  utterance.onerror=()=>{status('Texto traduzido, mas a reprodução de voz do navegador falhou.');};
  try{synth.speak(utterance);}catch(e){status('Áudio do navegador indisponível: '+String(e.message||e));}
 }
 async function prepare(){
  const selection=pair();if(ui.from.value===ui.to.value){status('Escolha dois idiomas diferentes.');return;}
  if(!window.Translator||typeof window.Translator.create!=='function'){
   report('Chrome Translator local indisponível neste navegador/dispositivo. Frases rápidas continuam gratuitas.');return;
  }
  destroyTranslator();ui.prepare.disabled=true;ui.prepare.textContent='Preparando idiomas…';
  report('Preparando modelo local… pode ser necessário baixar pacotes de idioma (sem API paga).');
  const options={sourceLanguage:short(ui.from.value),targetLanguage:short(ui.to.value)};
  try{
   // Called directly by the user's click, before awaiting availability:
   // downloadable models can require a transient user activation.
   const created=await window.Translator.create({...options,monitor(m){
    m.addEventListener('downloadprogress',event=>{
     if(selection===pair())report('Baixando modelo local: '+Math.round((event.loaded||0)*100)+'%');
    });
   }});
   if(selection!==pair()){created?.destroy?.();return;}
   translator=created;translatorKey=selection;prepared=true;
   report('Motor local ativo para '+ui.from.value+' → '+ui.to.value+'. Nenhuma API comercial será chamada.');
   status('Pronto: fale ou digite uma frase para traduzir.');
  }catch(e){
   report('Motor local indisponível para esta combinação ou dispositivo: '+String(e.message||e).slice(0,130)+'. Teste frases rápidas ou outro Chrome desktop.');
  }finally{ui.prepare.disabled=false;ui.prepare.textContent='Preparar tradução local';}
 }
 async function finalSentence(text){
  const value=tidy(text);if(!value)return;
  clearTimeout(previewTimer);previewEpoch++;finalEpoch++;lastFinal=value;
  const epoch=finalEpoch;
  ui.original.textContent=value;ui.preview.textContent='';
  await translateText(value,epoch,false);
 }
 function schedulePreview(value,old){
  clearTimeout(previewTimer);const text=tidy(value),epoch=++previewEpoch;
  if(text.length<9||!canTranslate()){ui.preview.textContent=text?'Reconhecendo: '+text:'';return;}
  const stable=stablePrefix(old,text)||text;
  ui.preview.textContent='Ouvindo: '+text;
  previewTimer=setTimeout(()=>{if(epoch===previewEpoch)translateText(stable,epoch,true);},650);
 }
 function startRecognition(){
  if(!active||!visible)return;
  const R=RECOGNIZER();if(!R){stop('Este navegador não oferece reconhecimento de fala. Use o teste digitado.');return;}
  const token=session;let rec;
  try{rec=new R();recognizer=rec;rec.lang=ui.from.value;rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
   if(ui.deviceOnly.checked&&'processLocally'in rec)rec.processLocally=true;
   else if(ui.deviceOnly.checked){stop('Reconhecimento offline não é suportado neste navegador. Desative a opção ou teste digitando.');return;}
   let lastInterim='',handled=new Set();
   rec.onresult=e=>{
    if(token!==session||!active)return;
    let partial='';
    for(let i=e.resultIndex;i<e.results.length;i++){
     const item=e.results[i],transcript=tidy(item?.[0]?.transcript);
     if(!transcript)continue;
     if(item.isFinal){
      if(!handled.has(i)){handled.add(i);finalSentence(transcript);}
     }else{partial=transcript;}
    }
    if(partial){
     if(!firstInterimAt)firstInterimAt=safeNow();
     schedulePreview(partial,lastInterim);lastInterim=partial;
    }
   };
   rec.onerror=e=>{
    const code=String(e.error||'erro desconhecido');
    if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(code)){
     stop('Microfone ou idioma indisponível: '+code+'. Verifique a permissão e tente novamente.');return;
    }
    status('Reconhecimento: '+code+'. Tentando recuperar se permitido.');
   };
   rec.onend=()=>{
    if(token!==session||!active||userStopped||!visible)return;
    if(++restartAttempts>6){stop('O navegador interrompeu a escuta repetidamente. Inicie novamente manualmente.');return;}
    status('A sessão do navegador terminou; tentando reconectar ('+restartAttempts+'/6)…');
    clearTimeout(restartTimer);
    restartTimer=setTimeout(()=>{if(token===session&&active&&visible)startRecognition();},Math.min(350*restartAttempts,2200));
   };
   rec.onstart=()=>{if(token===session){restartAttempts=0;status('Escutando '+ui.from.value+'. Tradução local, sem créditos de API.');}};
   rec.start();
  }catch(e){if(token===session){stop('Não foi possível iniciar o microfone: '+String(e.message||e));}}
 }
 function listen(){
  if(active){stop();return;}
  if(ui.from.value===ui.to.value){status('Escolha idiomas diferentes.');return;}
  if(!RECOGNIZER()){status('Reconhecimento de fala indisponível; use o campo de texto.');return;}
  userStopped=false;active=true;session++;restartAttempts=0;firstInterimAt=0;
  ui.listen.textContent='Parar escuta';ui.listen.setAttribute('aria-pressed','true');
  startRecognition();
 }
 function mount(){
  if(mounted)return;mounted=true;
  ui={from:$('freeFrom'),to:$('freeTo'),prepare:$('freePrepare'),listen:$('freeListen'),
   input:$('freeInput'),manual:$('freeManual'),voice:$('freeVoice'),deviceOnly:$('freeDeviceOnly'),
   speak:$('freeSpeak'),interrupt:$('freeInterrupt'),status:$('freeStatus'),compat:$('freeCompat'),
   original:$('freeOriginal'),translated:$('freeTranslated'),preview:$('freePreview'),
   metrics:$('freeMetrics'),results:$('freeResults')};
  for(const select of [ui.from,ui.to])for(const [id,name] of LANGS){
   const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option);
  }
  ui.from.value='pt-BR';ui.to.value='fr-FR';
  report(window.Translator?'Chrome Translator detectado; clique em Preparar para validar os idiomas.':'Sem Chrome Translator local: somente frases rápidas neste dispositivo.');
  ui.prepare.addEventListener('click',prepare);
  ui.listen.addEventListener('click',listen);
  ui.manual.addEventListener('click',()=>finalSentence(ui.input.value));
  ui.input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finalSentence(ui.input.value);}});
  for(const node of [ui.from,ui.to])node.addEventListener('change',()=>{
   stop('Idiomas alterados. Prepare novamente o motor de tradução local.');
   destroyTranslator();report('Par de idiomas alterado. Clique em Preparar tradução local.');
   ui.original.textContent='';ui.translated.textContent='';ui.preview.textContent='';
  });
  ui.voice.addEventListener('change',()=>{voiceURI=ui.voice.value;});
  window.speechSynthesis?.addEventListener?.('voiceschanged',voices);voices();
  window.addEventListener('pagehide',()=>stop(''));
 }
 window.DuoFreeLab={mount,setVisible,stop,stablePrefix,short,get state(){return {active,prepared,visible,translatorKey};}};
})();

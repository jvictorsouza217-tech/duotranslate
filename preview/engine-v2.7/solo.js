/* DuoTranslate 1.1 — testes individuais, sem sala */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const ui = {
 source:$('soloSource'), target:$('soloTarget'), toggle:$('soloToggle'), status:$('soloStatus'),
 sample:$('soloSample'), replay:$('soloReplay'), form:$('soloForm'),
 input:$('soloText'), results:$('soloResults'), tip:$('soloTip')
};
if (!ui.toggle) return;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const languages = window.DuoLanguages || {};
const s = {enabled:false,busy:false,rec:null,timer:null,epoch:0,errors:0,last:null,utterance:null};
const target = () => ui.target.value;
const example = () => languages[ui.source.value]?.example||'Bom dia! Como você está?';
function status(message){ui.status.textContent=window.DuoI18n?.localizeStatus(message)||message;}
function render(){
 ui.toggle.textContent=s.enabled?(window.DuoI18n?.t('stopListening')||'■ Parar de ouvir'):(window.DuoI18n?.t('startListening')||'🎙 Começar a ouvir');
 ui.toggle.classList.toggle('solo-on',s.enabled);
 ui.sample.disabled=s.busy;
 ui.replay.disabled=!s.last || s.busy;
 ui.form.querySelector('button').disabled=s.busy;
 ui.source.disabled=s.busy;ui.target.disabled=s.busy;
 ui.toggle.disabled=!Recognition && !s.enabled;
 if(!Recognition && !s.enabled)status('Reconhecimento de voz não disponível neste navegador. Use a frase de exemplo.');
}
let releaseVoiceProfile=()=>{};
function stopCapture(){
 releaseVoiceProfile();
 clearTimeout(s.timer); s.timer=null;
 const r=s.rec;
 if(r){try{r.abort();}catch(e){}}
 s.rec=null;
}
function stop(){
 s.enabled=false; s.epoch++; stopCapture();
 if(s.utterance){try{speechSynthesis.cancel();}catch(e){}s.utterance=null;}
 s.busy=false;
 status('Modo teste pausado. Você pode testar uma frase sem o microfone.');
 render();
}
function addResult(original,translated,error,translationMs=null){
 const empty=ui.results.querySelector('.solo-empty');if(empty)empty.remove();
 const card=document.createElement('div');
 card.className='solo-result'+(error?' solo-error':'');
 const a=document.createElement('small');a.textContent='OUVIDO / ORIGINAL';
 const b=document.createElement('p');b.textContent=original;
 const c=document.createElement('small');c.textContent=error?'ERRO':'TRADUÇÃO';
 const d=document.createElement('strong');d.textContent=translated;
 card.append(a,b,c,d);
 if(Number.isFinite(translationMs) && translationMs>=0){const latency=document.createElement('small');latency.className='solo-latency';latency.textContent='Tempo de tradução: '+(translationMs/1000).toFixed(2)+' s (não inclui reconhecer a fala nem reproduzir a voz)';card.append(latency);}
 ui.results.prepend(card);
 while(ui.results.children.length>8)ui.results.lastElementChild.remove();
}
async function translate(text,from,to){
  if(window.DuoReliable){const value=await window.DuoReliable.translate(text,from,to);return value.text;}
 const quick=window.DuoPhrasebook?.translate(text,from,to);if(quick!==null&&quick!==undefined)return quick;
 if(window.DuoAI?.enabled())return window.DuoAI.translate(text,from,to);
 const url=new URL('https://api.mymemory.translated.net/get');
 url.searchParams.set('q',text);
 url.searchParams.set('langpair',languages[from].api+'|'+languages[to].api);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 let response;
 try{response=await fetch(url,{signal:controller.signal});}
 finally{clearTimeout(timeout);}
 if(!response.ok)throw Error('Serviço de tradução indisponível (HTTP '+response.status+').');
 const data=await response.json();
 if(Number(data.responseStatus)!==200 || !data.responseData || !data.responseData.translatedText)
  throw Error(String(data.responseDetails||'Não foi possível traduzir.'));
 const html=String(data.responseData.translatedText);
 if(/MYMEMORY WARNING|USAGE LIMIT|DAILY LIMIT|QUERY LENGTH LIMIT/i.test(html))
  throw Error('Limite gratuito do tradutor atingido.');
 const out=new DOMParser().parseFromString(html,'text/html').body.textContent.trim();
 window.DuoUsage?.record({engine:'mymemory',ok:true});
 return out;
}
function speak(text,language,complete){
 if(window.DuoPremiumVoice?.enabled(language)){
  window.DuoPremiumVoice.speak(text,language).then(complete).catch(error=>{
   if(document.body.dataset.duoContext){
    status('ElevenLabs não reproduziu: '+String(error?.message||error)+'. A voz do aparelho não será usada automaticamente.');complete();
   }else{status('ElevenLabs indisponível: '+String(error?.message||error)+'. Usando voz do aparelho.');speakLocal(text,language,complete);}
  });return;
 }
 if(document.body.dataset.duoContext&&window.DuoPremiumVoice?.configuredFor?.(language)){
  status('ElevenLabs selecionada, mas sem acesso ativo. Verifique a sessão; outra voz não foi utilizada.');complete();return;
 }
 speakLocal(text,language,complete);
}
function speakLocal(text,language,complete){
 if(!window.speechSynthesis || !window.SpeechSynthesisUtterance){
  status('Tradução pronta, mas este navegador não oferece leitura em voz alta.');
  complete();return;
 }
 let finished=false;
 const synth=window.speechSynthesis;
 const u=new SpeechSynthesisUtterance(text);
 s.utterance=u;u.lang=language;u.rate=window.DuoVoiceSettings?.rate() ?? .94;
 const voices=synth.getVoices();
 u.voice=window.DuoVoiceSettings?.voice(language) || voices.find(v=>v.lang.toLowerCase()===language.toLowerCase()) ||
  voices.find(v=>v.lang.toLowerCase().startsWith(language.slice(0,2).toLowerCase())) || null;
 let timeout;
 const finish=(erro)=>{
  if(finished)return;finished=true;clearTimeout(timeout);
  if(s.utterance===u)s.utterance=null;
  if(erro)status('Texto traduzido. Se não ouviu, toque em Repetir tradução e confira o Bluetooth.');
  complete();
 };
 u.onend=()=>finish(false);
 u.onerror=()=>finish(true);
 timeout=setTimeout(()=>{try{synth.cancel();}catch(e){}finish(true);},Math.min(35000,Math.max(7000,text.length*180)));
 try{synth.cancel();synth.speak(u);}
 catch(e){finish(true);}
}
function scheduleRestart(){
 if(!s.enabled || s.busy)return;
 clearTimeout(s.timer);
 s.timer=setTimeout(startCapture,700);
}
function startCapture(){
 if(!s.enabled || s.busy || s.rec)return;
 if(!Recognition){stop();return;}
 const rec=new Recognition();
 s.rec=rec;
 rec.lang=ui.source.value;
 rec.continuous=false;
 rec.interimResults=false;
 rec.maxAlternatives=1;
 rec.onstart=()=>{if(s.rec===rec)status('Ouvindo '+languages[ui.source.value].name+'... reproduza uma fala perto do celular.');};
 rec.onspeechend=()=>{
  if(s.enabled && s.rec===rec && window.DuoVoiceSettings?.fast()){
   try{rec.stop();}catch(e){}
  }
 };
 rec.onresult=e=>{
  if(s.rec!==rec || !s.enabled)return;
  for(let i=e.resultIndex;i<e.results.length;i++){
   if(e.results[i].isFinal){
    const heard=String(e.results[i][0]?.transcript||'').trim();
    if(heard){s.errors=0;process(heard);break;}
   }
  }
 };
 rec.onerror=e=>{
  if(s.rec!==rec || !s.enabled)return;
  if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(e.error)){
   stop();status('Microfone indisponível ou sem permissão: '+e.error+'. Confira as permissões do Chrome.');
  }else if(e.error==='network'){
   s.errors++;
   if(s.errors>=3){stop();status('Falha de rede no reconhecimento de fala. Teste a frase de exemplo.');}
  }
 };
 rec.onend=()=>{
  if(s.rec!==rec)return;
  s.rec=null;
  scheduleRestart();
 };
 if(window.DuoAccess&&document.body.dataset.duoContext==='solo')releaseVoiceProfile=window.DuoVoiceProfile?.attach(rec)||(()=>{});
 try{rec.start();}
 catch(e){s.rec=null;stop();status('Não foi possível iniciar o microfone. Tente novamente.');}
}
async function process(input){
 const original=String(input||'').trim().slice(0,350);
 if(!original || s.busy)return;
 if(ui.source.value===ui.target.value){status('Origem e destino são iguais. Escolha idiomas diferentes antes de traduzir.');return;}
 s.busy=true;const epoch=s.epoch;
 stopCapture();render();status('Traduzindo frase...');
 try{
  const startTranslate=performance.now();
  const out=await translate(original,ui.source.value,target());
  const translationMs=Math.round(performance.now()-startTranslate);
  if(epoch!==s.epoch)return;
  s.last={text:out,lang:target()};
  addResult(original,out,false,translationMs);
  const direction=$('soloDirection');if(direction)direction.textContent=languages[ui.source.value].flag+' '+languages[ui.source.value].name+' → '+languages[target()].flag+' '+languages[target()].name;
  window.DuoHistory?.add({mode:document.body.dataset.duoContext==='listening'?'listening':'solo',direction:'sent',source:ui.source.value,target:target(),original,translation:out,translationMs,provider:window.DuoReliable?.lastProvider()||(window.DuoAI?.label()||'MyMemory')});
  status('Tradução concluída. Reproduzindo em '+languages[target()].name+'...');
  render();
  speak(out,target(),()=>{
   if(epoch!==s.epoch)return;
   s.busy=false;render();
   if(s.enabled){status('Tradução reproduzida. Ouvindo novamente...');scheduleRestart();}
   else status('Tradução concluída. Use Repetir tradução para ouvir de novo.');
  });
 }catch(e){
  if(epoch!==s.epoch)return;
  const message=e.name==='AbortError'?'Serviço de tradução demorou demais.':String(e.message||e);
  addResult(original,message,true);
  s.busy=false;render();
  if(s.enabled){status('Erro de tradução: '+message+' Tentando ouvir novamente...');scheduleRestart();}
  else status('Erro de tradução: '+message);
 }
}
ui.toggle.addEventListener('click',()=>{
 if(s.enabled){stop();return;}
 // Não deixe dois microfones de reconhecimento ligados em paralelo.
 const badge=$('micBadge'), duo=$('listenBtn');
 if(badge && badge.classList.contains('active') && duo)duo.click();
 s.enabled=true;s.epoch++;s.errors=0;render();
 status('Pedindo permissão para o microfone...');startCapture();
});
function changedLanguage(){
 // A seleção do usuário é soberana: nunca reverter silenciosamente ao par PT/FR.
 if(s.enabled)stop();
 s.last=null;ui.replay.disabled=true;
 ui.input.placeholder='Digite uma frase em '+(languages[ui.source.value]?.name||'outro idioma')+'...';
 const same=ui.source.value===ui.target.value;
 status(same
  ?'Origem e destino são iguais. Escolha idiomas diferentes antes de traduzir.'
  :'Direção selecionada: '+languages[ui.source.value].name+' → '+languages[ui.target.value].name+'.');
 const direction=$('soloDirection');
 if(direction)direction.textContent=languages[ui.source.value].flag+' '+languages[ui.source.value].name+' → '+languages[ui.target.value].flag+' '+languages[ui.target.value].name+(same?' ⚠️':'');
}
ui.source.addEventListener('change',changedLanguage);
ui.target.addEventListener('change',changedLanguage);
ui.sample.addEventListener('click',()=>process(example()));
ui.form.addEventListener('submit',e=>{e.preventDefault();if(s.busy)return;const t=ui.input.value.trim();if(t)process(t);});
ui.replay.addEventListener('click',()=>{
 if(!s.last || s.busy)return;
 const saved=s.last,epoch=s.epoch;
 s.busy=true;stopCapture();render();status('Repetindo a tradução...');
 speak(saved.text,saved.lang,()=>{
  if(epoch!==s.epoch)return;
  s.busy=false;render();
  if(s.enabled){status('Ouvindo novamente...');scheduleRestart();}
  else status('Áudio reproduzido. Você pode testar outra frase.');
 });
});
// A função de conversa com dois celulares continua independente.
['listenBtn','createBtn','joinBtn'].forEach(id=>{
 const button=$(id);
 if(button)button.addEventListener('click',()=>{if(s.enabled || s.busy)stop();},{capture:true});
});
window.addEventListener('pagehide',()=>{s.enabled=false;s.epoch++;stopCapture();});
render();changedLanguage();
})();
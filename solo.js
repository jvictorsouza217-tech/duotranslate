/* DuoTranslate 1.1 — testes individuais, sem sala */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const ui = {
 source:$('soloSource'), toggle:$('soloToggle'), status:$('soloStatus'),
 sample:$('soloSample'), replay:$('soloReplay'), form:$('soloForm'),
 input:$('soloText'), results:$('soloResults'), tip:$('soloTip')
};
if (!ui.toggle) return;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const languages = {'fr-FR':{code:'fr',name:'francês'},'pt-BR':{code:'pt',name:'português'}};
const s = {enabled:false,busy:false,rec:null,timer:null,epoch:0,errors:0,last:null,utterance:null};
const target = () => ui.source.value==='fr-FR'?'pt-BR':'fr-FR';
const example = () => ui.source.value==='fr-FR'
 ? 'Bonjour ! Comment allez-vous aujourd’hui ? Je voudrais vous poser une question.'
 : 'Olá! Como você está hoje? Gostaria de fazer uma pergunta.';
function status(message){ui.status.textContent=message;}
function render(){
 ui.toggle.textContent=s.enabled?'■ Parar de ouvir':'🎙 Começar a ouvir';
 ui.toggle.classList.toggle('solo-on',s.enabled);
 ui.sample.disabled=s.busy;
 ui.replay.disabled=!s.last || s.busy;
 ui.form.querySelector('button').disabled=s.busy;
 ui.source.disabled=s.busy;
 ui.toggle.disabled=!Recognition && !s.enabled;
 if(!Recognition && !s.enabled)status('Reconhecimento de voz não disponível neste navegador. Use a frase de exemplo.');
}
function stopCapture(){
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
function addResult(original,translated,error){
 const empty=ui.results.querySelector('.solo-empty');if(empty)empty.remove();
 const card=document.createElement('div');
 card.className='solo-result'+(error?' solo-error':'');
 const a=document.createElement('small');a.textContent='OUVIDO / ORIGINAL';
 const b=document.createElement('p');b.textContent=original;
 const c=document.createElement('small');c.textContent=error?'ERRO':'TRADUÇÃO';
 const d=document.createElement('strong');d.textContent=translated;
 card.append(a,b,c,d);ui.results.prepend(card);
 while(ui.results.children.length>8)ui.results.lastElementChild.remove();
}
async function translate(text,from,to){
 const url=new URL('https://api.mymemory.translated.net/get');
 url.searchParams.set('q',text);
 url.searchParams.set('langpair',languages[from].code+'|'+languages[to].code);
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
 return new DOMParser().parseFromString(html,'text/html').body.textContent.trim();
}
function speak(text,language,complete){
 if(!window.speechSynthesis || !window.SpeechSynthesisUtterance){
  status('Tradução pronta, mas este navegador não oferece leitura em voz alta.');
  complete();return;
 }
 let finished=false;
 const synth=window.speechSynthesis;
 const u=new SpeechSynthesisUtterance(text);
 s.utterance=u;u.lang=language;u.rate=.94;
 const voices=synth.getVoices();
 u.voice=voices.find(v=>v.lang.toLowerCase()===language.toLowerCase()) ||
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
 try{rec.start();}
 catch(e){s.rec=null;stop();status('Não foi possível iniciar o microfone. Tente novamente.');}
}
async function process(input){
 const original=String(input||'').trim().slice(0,350);
 if(!original || s.busy)return;
 s.busy=true;const epoch=s.epoch;
 stopCapture();render();status('Traduzindo frase...');
 try{
  const out=await translate(original,ui.source.value,target());
  if(epoch!==s.epoch)return;
  s.last={text:out,lang:target()};
  addResult(original,out,false);
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
ui.source.addEventListener('change',()=>{
 if(s.enabled)stop();
 s.last=null;ui.replay.disabled=true;ui.input.placeholder=ui.source.value==='fr-FR'
  ? 'Digite uma frase em francês...' : 'Digite uma frase em português...';
 status('Escolha um teste: ouvir pelo microfone ou traduzir uma frase.');
});
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
render();
})();
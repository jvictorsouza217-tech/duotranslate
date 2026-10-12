/* DuoTranslate 1.2 — ajustes gratuitos de voz e modo rápido (sem API paga) */
(() => {
'use strict';
const byId=id=>document.getElementById(id);
const ui={pt:byId('voicePt'),fr:byId('voiceFr'),otherLang:byId('voiceOtherLang'),otherVoice:byId('voiceOther'),otherStatus:byId('voiceOtherStatus'),tryOther:byId('tryVoiceOther'),rate:byId('voiceRate'),rateOut:byId('voiceRateOut'),fast:byId('fastSpeech'),status:byId('voiceSettingsStatus'),tryPt:byId('tryVoicePt'),tryFr:byId('tryVoiceFr')};
const synth=window.speechSynthesis;
const storageKey='duotranslate.voice.v1';
let config={voices:{'pt-BR':'','fr-FR':''},rate:1,fast:false};
try {
 const stored=JSON.parse(localStorage.getItem(storageKey)||'null');
 if(stored && typeof stored==='object'){
  if(stored.voices && typeof stored.voices==='object'){
   for(const lang of Object.keys(window.DuoLanguages||{})) if(typeof stored.voices[lang]==='string')config.voices[lang]=stored.voices[lang];
  }
  const rate=Number(stored.rate);
  if(Number.isFinite(rate)&&rate>=.75&&rate<=1.25)config.rate=rate;
  config.fast=stored.fast===true;
 }
}catch(e){}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(config));}catch(e){}}
function voices(){try{return synth?synth.getVoices():[];}catch(e){return [];}}
function getVoice(lang){
 const list=voices();
 const key=config.voices[lang];
 if(!key)return null;
 return list.find(v=>(v.voiceURI+'|'+v.name+'|'+v.lang)===key)||null;
}
window.DuoVoiceSettings={
 voice:getVoice, rate:()=>config.rate, fast:()=>config.fast
};
function populate(select,lang){
 if(!select)return;
 const list=voices().filter(v=>v.lang && v.lang.toLowerCase().startsWith(lang.slice(0,2).toLowerCase()));
 const prev=config.voices[lang];
 select.replaceChildren();
 const automatic=document.createElement('option');
 automatic.value='';automatic.textContent='Automática (voz do celular)';
 select.append(automatic);
 list.forEach(v=>{
  const option=document.createElement('option');
  option.value=v.voiceURI+'|'+v.name+'|'+v.lang;
  option.textContent=v.name+' ('+v.lang+')'+(v.localService?' · local':'');
  select.append(option);
 });
 select.value=list.some(v=>(v.voiceURI+'|'+v.name+'|'+v.lang)===prev)?prev:'';
}
function refresh(){
 populate(ui.pt,'pt-BR');populate(ui.fr,'fr-FR');
 if(ui.otherLang && ui.otherVoice){
  const lang=ui.otherLang.value;
  populate(ui.otherVoice,lang);
  const found=voices().filter(v=>v.lang?.toLowerCase().replace('_','-').startsWith(lang.slice(0,2).toLowerCase()));
  ui.otherStatus.textContent=found.length
   ?found.length+' voz(es) encontrada(s) para '+(window.DuoLanguages?.[lang]?.name||lang)+'.'
   :'Nenhuma voz específica para '+(window.DuoLanguages?.[lang]?.name||lang)+' encontrada neste dispositivo. O áudio automático pode não funcionar. Para voz neural futura, testaremos ElevenLabs.';
 }
 if(ui.status){
  const found=voices().filter(v=>/^(fr|pt)(-|_)/i.test(v.lang||''));
  ui.status.textContent=found.length
   ?'Vozes encontradas neste celular: '+found.length+'. A lista pode ser diferente no iPhone.'
   :'Aguardando o navegador carregar as vozes. Se permanecer vazio, use a voz automática.';
 }
}
if(ui.rate){
 ui.rate.value=config.rate;ui.rateOut.textContent=config.rate.toFixed(2)+'×';
 ui.rate.addEventListener('input',()=>{
  config.rate=Number(ui.rate.value);ui.rateOut.textContent=config.rate.toFixed(2)+'×';save();
 });
}
if(ui.fast){
 ui.fast.checked=config.fast;
 ui.fast.addEventListener('change',()=>{config.fast=ui.fast.checked;save();});
}
for(const [select,lang] of [[ui.pt,'pt-BR'],[ui.fr,'fr-FR']]){
 if(select)select.addEventListener('change',()=>{config.voices[lang]=select.value;save();});
}
function test(lang){
 if(!synth||!window.SpeechSynthesisUtterance){ui.status.textContent='Leitura em voz alta não disponível neste navegador.';return;}
 if(byId('micBadge')?.classList.contains('active')||byId('soloToggle')?.classList.contains('solo-on')){
  ui.status.textContent='Pare a escuta antes de testar uma voz, para evitar eco.';return;
 }
 const sample=lang==='fr-FR'
  ?'Bonjour ! Je suis votre nouvelle voix française. Comment allez-vous ?'
  :'Olá! Esta é uma amostra da minha voz em português. Tudo bem com você?';
 const utterance=new SpeechSynthesisUtterance(sample);
 utterance.lang=lang;utterance.rate=config.rate;
 utterance.voice=getVoice(lang);
 utterance.onerror=()=>{ui.status.textContent='Se não ouviu a voz, confira o volume e a saída Bluetooth.';};
 ui.status.textContent='Reproduzindo amostra na saída de áudio do celular...';
 try{synth.cancel();synth.speak(utterance);}catch(e){ui.status.textContent='Não foi possível iniciar esta voz no navegador.';}
}
ui.tryPt?.addEventListener('click',()=>test('pt-BR'));
ui.tryFr?.addEventListener('click',()=>test('fr-FR'));
if(ui.otherLang){
 ui.otherLang.addEventListener('change',refresh);
 ui.otherVoice?.addEventListener('change',()=>{config.voices[ui.otherLang.value]=ui.otherVoice.value;save();});
 ui.tryOther?.addEventListener('click',()=>{
  const lang=ui.otherLang.value;
  if(!window.DuoLanguages?.[lang])return;
  if(!synth||!window.SpeechSynthesisUtterance){ui.otherStatus.textContent='Este navegador não oferece síntese de voz.';return;}
  if(byId('micBadge')?.classList.contains('active')||byId('soloToggle')?.classList.contains('solo-on')){
    ui.otherStatus.textContent='Pare o microfone antes de testar para evitar eco.';return;
  }
  const u=new SpeechSynthesisUtterance(window.DuoLanguages[lang].sample);
  u.lang=lang;u.rate=config.rate;u.voice=getVoice(lang);
  if(!u.voice)u.voice=voices().find(v=>v.lang?.toLowerCase().replace('_','-').startsWith(lang.slice(0,2)))||null;
  u.onerror=()=>{ui.otherStatus.textContent='Não foi possível reproduzir este idioma. Teste outro aparelho ou voz instalada.';};
  ui.otherStatus.textContent='Testando '+window.DuoLanguages[lang].name+' na saída de áudio atual...';
  try{synth.cancel();synth.speak(u);}catch(e){ui.otherStatus.textContent='Não foi possível reproduzir a voz.';}
 });
}
if(synth){
 if(typeof synth.addEventListener==='function')synth.addEventListener('voiceschanged',refresh);
 else {const old=synth.onvoiceschanged;synth.onvoiceschanged=(e)=>{if(typeof old==='function')old(e);refresh();};}
}
refresh();
setTimeout(refresh,900);
setTimeout(refresh,3000);
})();
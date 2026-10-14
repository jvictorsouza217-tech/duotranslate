/* DuoTranslate 2.17: private 2-device conversation. No PeerJS or repeated room steps. */
(()=>{
'use strict';
const API='https://duotranslate-ai.jvictorsouza217.workers.dev';
const LANGS=[['pt-BR','Português 🇧🇷'],['fr-FR','Français 🇫🇷'],['en-US','English 🇬🇧'],['es-ES','Español 🇪🇸'],['nl-NL','Nederlands 🇳🇱'],['de-DE','Deutsch 🇩🇪'],['it-IT','Italiano 🇮🇹'],['ar-SA','العربية'],['zh-CN','中文'],['pl-PL','Polski'],['ro-RO','Română'],['uk-UA','Українська'],['ru-RU','Русский'],['tr-TR','Türkçe']];
const names=new Set(LANGS.map(x=>x[0])),params=new URLSearchParams(location.search);
const ticket=String(params.get('duoRoom')||''),guest=params.get('duoGuest')==='1'&&/^[a-f0-9]{32}$/.test(ticket);
const labels={
 pt:{title:'Conversa por voz',sub:'Fale no seu idioma e ouça a tradução.',name:'Seu nome',speak:'Eu falo',hear:'Quero ouvir',voice:'Voz da tradução',join:'Entrar e conversar',copy:'Copiar convite',exit:'Sair',pause:'Pausar microfone',resume:'Retomar microfone',waiting:'Sala criada. Envie o convite.',connecting:'Conectando os aparelhos…',connected:'Conectados! Fale naturalmente.',mic:'Autorize o microfone para começar.',denied:'Microfone não permitido. Autorize no navegador.',copied:'Convite copiado!',voiceError:'Falha no áudio escolhido:',permission:'ElevenLabs não autorizada; use a voz gratuita.',noPremium:'Sala pronta. Convite sem ElevenLabs: voz gratuita disponível.',retry:'Reconectando…'},
 fr:{title:'Conversation vocale',sub:'Parlez votre langue et écoutez la traduction.',name:'Votre nom',speak:'Je parle',hear:'Je veux entendre',voice:'Voix de traduction',join:'Entrer et parler',copy:"Copier l'invitation",exit:'Quitter',pause:'Couper le micro',resume:'Activer le micro',waiting:'Salon prêt. Envoyez le lien.',connecting:'Connexion des appareils…',connected:'Connectés! Parlez normalement.',mic:'Autorisez le microphone.',denied:'Microphone bloqué. Autorisez-le dans le navigateur.',copied:'Invitation copiée!',voiceError:'Erreur de lecture de la voix :',permission:'ElevenLabs non autorisé ; voix gratuite disponible.',noPremium:'Lien créé sans ElevenLabs. Voix gratuite disponible.',retry:'Reconnexion…'},
 en:{title:'Voice conversation',sub:'Speak your language and hear the translation.',name:'Your name',speak:'I speak',hear:'I want to hear',voice:'Translation voice',join:'Join and talk',copy:'Copy invite',exit:'Leave',pause:'Pause microphone',resume:'Resume microphone',waiting:'Room ready. Send the invitation.',connecting:'Connecting devices…',connected:'Connected! Speak naturally.',mic:'Allow microphone access.',denied:'Microphone blocked. Enable microphone access.',copied:'Invitation copied!',voiceError:'Voice playback error:',permission:'ElevenLabs not authorized; device voice available.',noPremium:'Room ready; invite without ElevenLabs. Device voice available.',retry:'Reconnecting…'}
};
let panel=null,s=null,language='pt',guestReady=false;
const $=id=>document.getElementById(id),t=k=>labels[language]?.[k]||labels.pt[k]||k;
const stored=()=>{try{return JSON.parse(localStorage.getItem('duotranslate.integration.v2')||'{}')||{};}catch{return {};}};
const selected=(x,fallback)=>names.has(x)?x:fallback;
function setStatus(value){if($('duo217Status'))$('duo217Status').textContent=value;}
function setCaption(value){if($('duo217Caption'))$('duo217Caption').textContent=value;}
function setup(){
 if(panel)return;
 const style=document.createElement('style');
 style.textContent="#duo217{position:fixed;inset:0;z-index:9999;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;background:#faf8f5;padding:13px;color:#17365d;font-family:Inter,Arial,sans-serif}#duo217[hidden]{display:none!important}#duo217 .card{width:min(100%,610px);background:white;border:1px solid #e7e0db;border-radius:22px;margin:20px auto;padding:clamp(20px,4vw,32px);box-shadow:0 18px 54px #17365d10}#duo217 h2{font-size:25px;margin:0}#duo217 p{font-size:13px;line-height:1.55;color:#676777}#duo217 label{display:block;margin:14px 0 7px;font-size:13px;font-weight:700}#duo217 input,#duo217 select{display:block;width:100%;min-width:0;min-height:44px;padding:9px 12px;border:1px solid #d7d2db;background:white;border-radius:11px;color:#17365d;font:inherit;font-size:15px}#duo217 .cols{display:grid;grid-template-columns:1fr 1fr;gap:11px}#duo217 button{padding:11px 16px;background:white;color:#17365d;border:1px solid #ded7e2;border-radius:12px;font:inherit;font-weight:700;min-height:46px;cursor:pointer}#duo217 button.primary{background:#17365d;color:#fff}#duo217 button:disabled{opacity:.45}#duo217 .actions{display:flex;flex-wrap:wrap;gap:9px;margin:17px 0}#duo217 .status{background:#f6f4fa;border:1px solid #e5dfee;border-radius:12px;padding:13px;margin-top:13px;font-size:14px}#duo217 .caption{color:#686c76}#duo217 .bubble{border-radius:12px;padding:10px 12px;margin:8px 0;background:#f6f2fb;font-size:14px;line-height:1.45}#duo217 .bubble.mine{background:#eef3fa}#duo217 .bubble strong{display:block;margin-top:5px}#duo217 .messages{max-height:37vh;overflow-y:auto}#duo217 .hide{display:none!important}@media(max-width:420px){#duo217{padding:7px}#duo217 .card{margin:5px auto}#duo217 .cols{grid-template-columns:1fr}}";
 document.head.append(style);
 panel=document.createElement('section');panel.id='duo217';panel.hidden=true;
 panel.innerHTML='<div class="card"><h2 id="duo217Title"></h2><p id="duo217Sub"></p><label id="duo217NameLabel" for="duo217Name"></label><input id="duo217Name" maxlength="40" autocomplete="nickname"><div class="cols"><div><label id="duo217SpeakLabel" for="duo217Speak"></label><select id="duo217Speak"></select></div><div><label id="duo217HearLabel" for="duo217Hear"></label><select id="duo217Hear"></select></div></div><label id="duo217VoiceLabel" for="duo217Voice"></label><select id="duo217Voice"></select><p id="duo217Status" class="status" role="status" aria-live="polite"></p><p id="duo217Caption" class="caption" aria-live="polite"></p><div id="duo217Messages" class="messages"></div><div class="actions"><button class="primary" id="duo217Join"></button><button class="primary hide" id="duo217Copy"></button><button class="hide" id="duo217Pause"></button><button id="duo217Close"></button></div><p style="font-size:12px">O microfone permanece no seu aparelho. Só frases traduzidas são transmitidas; vozes ElevenLabs utilizam créditos do anfitrião.</p></div>';
 document.body.append(panel);
 for(const id of ['duo217Speak','duo217Hear'])for(const [code,label] of LANGS){const option=document.createElement('option');option.value=code;option.textContent=label;$(id).append(option);}
 for(const [id,key] of [['duo217Title','title'],['duo217Sub','sub'],['duo217NameLabel','name'],['duo217SpeakLabel','speak'],['duo217HearLabel','hear'],['duo217VoiceLabel','voice'],['duo217Join','join'],['duo217Copy','copy'],['duo217Close','exit']])$(id).textContent=t(key);
 $('duo217Join').onclick=()=>{void enterGuest();};
 $('duo217Copy').onclick=()=>{void copyLink();};
 $('duo217Close').onclick=close;
 $('duo217Pause').onclick=()=>{if(!s)return;s.paused=!s.paused;s.paused?haltRecognition():listen();$('duo217Pause').textContent=t(s.paused?'resume':'pause');};
 $('duo217Hear').onchange=()=>{if(s){s.hear=$('duo217Hear').value;sendHello();}void loadVoices($('duo217Hear').value);};
 $('duo217Speak').onchange=()=>{if(s){s.speak=$('duo217Speak').value;haltRecognition();sendHello();listen();}};
 $('duo217Voice').onchange=()=>{if(!s)return;s.voice=$('duo217Voice').value;if(s.voice!=='local')window.DuoEleven?.selectVoice(s.hear,s.voice,true);};
 $('duo217Name').onchange=()=>{if(s){s.name=$('duo217Name').value.trim().slice(0,40)||'Convidado';sendHello();}};
}
async function loadVoices(lang){
 const select=$('duo217Voice'),value=s?.voice;
 select.replaceChildren();const opt=document.createElement('option');opt.value='local';opt.textContent='Voz do dispositivo · gratuita';select.append(opt);
 let list=window.DuoEleven?.choices?.(lang)?.voices||[];
 if(window.DuoAccess?.active){try{list=await window.DuoEleven.loadVoices();}catch(e){setCaption(t('permission'));}}
 for(const voice of list){const o=document.createElement('option');o.value=voice.id;o.textContent='ElevenLabs · '+voice.name;select.append(o);}
 const preferred=value||window.DuoEleven?.choices?.(lang)?.selected||'local';
 select.value=[...select.options].some(x=>x.value===preferred)?preferred:'local';
 if(s)s.voice=select.value;
}
function randomTicket(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
function createState(role,ticket,name,speak,hear){return {role,ticket,name,speak,hear,voice:(window.DuoAccess?.active&&window.DuoEleven?.choices?.(hear)?.selected)||'local',active:true,paired:false,peer:null,ws:null,retries:0,
 permission:false,paused:false,rec:null,restart:null,reconnect:null,audio:null,playing:false,sound:null,pending:0,playlist:[],link:''};}
function makeLink(){
 const url=new URL('/duotranslate/preview/v2.17/',location.origin);
 url.searchParams.set('duoGuest','1');url.searchParams.set('duoRoom',s.ticket);
 url.searchParams.set('from',s.name);url.searchParams.set('speaks',s.speak);url.searchParams.set('hears',s.counterpart||s.peer?.speaks||'fr-FR');
 return url;
}
function send(packet){if(s?.ws?.readyState===WebSocket.OPEN)s.ws.send(JSON.stringify(packet));}
function sendHello(){if(s)send({type:'hello',name:s.name,speaks:s.speak,hears:s.hear});}
function socketUrl(){const url=new URL(API);url.protocol='wss:';url.pathname='/room/v217';url.searchParams.set('ticket',s.ticket);url.searchParams.set('role',s.role);return url.href;}
function connect(){
 const session=s;if(!session?.active)return;
 let ws;
 try{ws=new WebSocket(socketUrl());}catch(e){setStatus('Erro de WebSocket: '+String(e.message||e));return;}
 session.ws=ws;session.paired=false;setStatus(t('connecting'));
 ws.onopen=()=>{if(s!==session)return;sendHello();};
 ws.onmessage=e=>{
  if(s!==session)return;let msg;try{msg=JSON.parse(e.data);}catch{return;}
  if(msg.type==='ready')sendHello();
  if(msg.type==='waiting'){session.paired=false;haltRecognition();setStatus(t('waiting'));}
  if(msg.type==='paired'){session.paired=true;session.retries=0;session.peer=msg.peer;setStatus(t('connected'));listen();}
  if(msg.type==='speech'&&msg.target===session.hear){display(msg.original,msg.translation,false);session.playlist.push(msg.translation);void playQueue();}
  if(msg.type==='error')setStatus(String(msg.message||'Erro de conexão'));
 };
 ws.onerror=()=>{if(s===session)setStatus('Canal de conexão indisponível. '+t('retry'));};
 ws.onclose=()=>{if(s!==session||!session.active)return;session.paired=false;haltRecognition();
  if(session.retries++>=6){setStatus('Não foi possível reconectar. Abra novamente o convite.');return;}
  setStatus(t('retry')+' '+session.retries+'/6');
  session.reconnect=setTimeout(()=>{if(s===session)connect();},Math.min(12000,700*Math.pow(2,session.retries)));
 };
}
function display(original,translation,mine){
 const el=document.createElement('div');el.className='bubble'+(mine?' mine':'');
 const a=document.createElement('span'),b=document.createElement('strong');a.textContent=original;b.textContent=translation;
 el.append(a,b);$('duo217Messages').append(el);while($('duo217Messages').children.length>14)$('duo217Messages').firstElementChild.remove();
 $('duo217Messages').scrollTop=$('duo217Messages').scrollHeight;
}
async function unlockMicrophone(){
 const session=s;if(!session)return;
 if(!window.SpeechRecognition&&!window.webkitSpeechRecognition){setStatus('Reconhecimento de fala não disponível neste navegador. Teste Chrome atualizado.');return;}
 let media;
 try{
  if(window.AudioContext||window.webkitAudioContext)session.audio=new (window.AudioContext||window.webkitAudioContext)();
  // Request microphone permission inside the real click gesture, without an intervening await.
  const permission=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
  const resumed=session.audio?session.audio.resume().catch(()=>{}):Promise.resolve();
  media=await permission;await resumed;
  media.getTracks().forEach(track=>track.stop());session.permission=true;listen();
 }catch(e){media?.getTracks().forEach(track=>track.stop());session.permission=false;setStatus(t('denied')+' '+String(e.message||e).slice(0,60));}
}
function haltRecognition(){if(!s)return;clearTimeout(s.restart);const r=s.rec;s.rec=null;try{r?.abort();}catch{}}
function listen(){
 const session=s;if(!session?.paired||!session.permission||session.paused||session.playing||session.rec)return;
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;
 const r=new SR();session.rec=r;r.lang=session.speak;r.continuous=true;r.interimResults=true;
 r.onresult=e=>{if(s!==session||session.playing||!session.paired)return;for(let i=e.resultIndex;i<e.results.length;i++){
   const row=e.results[i],spoken=String(row[0]?.transcript||'').trim();
   if(!spoken)continue;
   if(row.isFinal){setCaption('');void translate(spoken);}else setCaption('🎙 '+spoken.slice(0,160));
 }};
 r.onerror=e=>{if(s!==session)return;
  if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){session.permission=false;setStatus(t('denied'));}
  else setCaption('Microfone: '+e.error);
 };
 r.onend=()=>{if(s!==session||session.rec!==r)return;session.rec=null;
  if(session.paired&&!session.paused&&!session.playing&&session.permission)session.restart=setTimeout(listen,650);
 };
 try{r.start();}catch(e){session.rec=null;setStatus('Não foi possível iniciar o microfone: '+String(e.message||e));}
}
async function translate(original){
 const session=s;if(!session?.paired||!session.peer||session.pending>=3)return;session.pending++;
 try{
  const result=await window.DuoReliable.translate(original,session.speak,session.peer.hears);
  if(s!==session||!session.paired)return;
  display(original,result.text,true);
  send({type:'speech',original:original.slice(0,600),translation:result.text.slice(0,900),provider:result.provider,target:session.peer.hears});
 }catch(e){if(s===session)setStatus('Falha de tradução: '+String(e.message||e).slice(0,135));}
 finally{session.pending--;}
}
function localSpeech(text){
 return new Promise((resolve,reject)=>{
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){reject(Error('Voz do dispositivo indisponível'));return;}
  const u=new SpeechSynthesisUtterance(text);u.lang=s.hear;u.rate=1;
  const voices=window.speechSynthesis.getVoices(),v=voices.find(x=>x.lang===s.hear)||voices.find(x=>x.lang?.slice(0,2)===s.hear.slice(0,2));if(v)u.voice=v;
  u.onend=resolve;u.onerror=e=>reject(Error(e.error||'Falha na voz'));window.speechSynthesis.speak(u);
 });
}
async function premiumSpeech(text){
 const session=s;
 if(!window.DuoAccess?.active)throw Error(t('permission'));
 if(!session.audio)throw Error('Áudio não autorizado');
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),20000);
 let result;try{result=await window.DuoAccess.fetch(window.DuoAccess.voiceUrl+'/tts',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang:session.hear,voiceId:session.voice}),signal:abort.signal
 });}finally{clearTimeout(timer);}
 if(!result.ok){const error=await result.json().catch(()=>({}));throw Error(error.error||'ElevenLabs HTTP '+result.status);}
 const audio=await session.audio.decodeAudioData(await result.arrayBuffer());await session.audio.resume();
 return new Promise(resolve=>{const playing=session.audio.createBufferSource();playing.buffer=audio;playing.connect(session.audio.destination);playing.onended=resolve;session.sound=playing;playing.start();});
}
async function playQueue(){
 const session=s;if(!session||session.playing||!session.playlist.length)return;
 session.playing=true;haltRecognition();
 try{while(s===session&&session.playlist.length){
  const text=session.playlist.shift();
  if(session.voice==='local')await localSpeech(text);
  else for(let i=0;i<text.length;i+=200)await premiumSpeech(text.slice(i,i+200));
 }}catch(e){if(s===session)setStatus(t('voiceError')+' '+String(e.message||e).slice(0,140));}
 finally{if(s===session){session.playing=false;listen();}}
}
async function premiumInvite(){
 const session=s;if(!session||session.role!=='host')return;
 const url=makeLink();
 try{
  await window.DuoAccess?.ready;
  const invite=await window.DuoAccess.invite('',{label:'Convidado',expiresInHours:24});
  const fragment=new URL(invite).hash;
  if(!/^#duo-invite=[a-f0-9]{64}$/.test(fragment))throw Error('Convite premium não autorizado.');
  url.hash=fragment;
  if(s===session){session.link=url.href;if(!session.paired)setStatus(t('waiting'));}
 }catch(e){if(s===session){session.link=url.href;setStatus(t('noPremium'));}}
 if(s===session)$('duo217Copy').disabled=false;
}
function fill(name,speak,hear){
 setup();panel.hidden=false;
 $('duo217Name').value=name;$('duo217Speak').value=speak;$('duo217Hear').value=hear;void loadVoices(hear);
}
async function openHost(){
 close();
 const defaults=stored(),host=window.DuoInviteHost?.()||{};
 language=String(defaults.ui||navigator.language||'pt').slice(0,2);if(!labels[language])language='pt';
 const speak=selected(host.speak||defaults.speak,'pt-BR'),counterpart=selected(host.hear||defaults.hear,'fr-FR'),hear=speak;
 const name=String(host.name||defaults.name||'Anfitrião').trim().slice(0,40);
 fill(name,speak,hear);
 s=createState('host',randomTicket(),name,speak,hear);s.counterpart=counterpart;
 $('duo217Join').classList.add('hide');$('duo217Copy').classList.remove('hide');$('duo217Copy').disabled=true;
 $('duo217Pause').classList.remove('hide');$('duo217Pause').textContent=t('pause');
 setStatus(t('connecting'));const permission=unlockMicrophone();connect();void premiumInvite();await permission;
}
async function enterGuest(){
 if(!s||s.role!=='guest')return;
 s.name=$('duo217Name').value.trim().slice(0,40)||'Convidado';
 s.speak=$('duo217Speak').value;s.hear=$('duo217Hear').value;s.voice=$('duo217Voice').value;
  if(s.voice!=='local'&&!window.DuoAccess?.active){setStatus(t('permission'));return;}
 if(s.voice!=='local')window.DuoEleven?.selectVoice(s.hear,s.voice,true);
 $('duo217Join').classList.add('hide');$('duo217Pause').classList.remove('hide');$('duo217Pause').textContent=t('pause');
 const permission=unlockMicrophone();connect();await permission;
}
async function copyLink(){
 if(!s||s.role!=='host')return;
 const link=s.link||makeLink().href;
 try{await navigator.clipboard.writeText(link);setStatus(t('copied'));}
 catch(e){window.prompt('Copie o convite:',link);}
}
function close(){
 const previous=s;s=null;
 if(previous){previous.active=false;clearTimeout(previous.restart);clearTimeout(previous.reconnect);
  try{previous.rec?.abort();}catch{}try{previous.ws?.close(1000,'Closed');}catch{}
  try{previous.sound?.stop();}catch{}try{previous.audio?.close();}catch{}
 }
 if(panel){panel.hidden=true;$('duo217Messages').replaceChildren();
  $('duo217Join').classList.remove('hide');$('duo217Copy').classList.add('hide');$('duo217Pause').classList.add('hide');}
}
async function initGuest(){
 if(!guest||guestReady)return;guestReady=true;
 await window.DuoAccess?.ready;
 language=String(navigator.language||'fr').slice(0,2);if(!labels[language])language='fr';
 const speak=selected(params.get('hears'),'fr-FR'),hear=speak;
 fill('',speak,hear);s=createState('guest',ticket,'',speak,hear);
 $('duo217Join').classList.remove('hide');$('duo217Copy').classList.add('hide');
 $('duo217Pause').classList.add('hide');setStatus(t('join'));
 void loadVoices(hear);
}
window.DuoConnected217={openHost,stop:close,get active(){return !!s?.active;}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void initGuest();},{once:true});
else void initGuest();
})();
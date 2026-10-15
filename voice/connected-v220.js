/* DuoTranslate 2.20: connected speech journaling, voice sampling and echo controls. */
(()=>{
'use strict';
const API='https://duotranslate-ai.jvictorsouza217.workers.dev';
const LANGS=[['pt-BR','Português 🇧🇷'],['fr-FR','Français 🇫🇷'],['en-US','English 🇬🇧'],['es-ES','Español 🇪🇸'],['nl-NL','Nederlands 🇳🇱'],['de-DE','Deutsch 🇩🇪'],['it-IT','Italiano 🇮🇹'],['ar-SA','العربية'],['zh-CN','中文'],['pl-PL','Polski'],['ro-RO','Română'],['uk-UA','Українська'],['ru-RU','Русский'],['tr-TR','Türkçe']];
const names=new Set(LANGS.map(x=>x[0])),params=new URLSearchParams(location.search);
const ticket=String(params.get('duoRoom')||''),guest=params.get('duoGuest')==='1'&&/^[a-f0-9]{32}$/.test(ticket);
const labels={
 pt:{title:'Conversa por voz',sub:'Fale no seu idioma e ouça a tradução.',name:'Seu nome',speak:'Meu idioma (falo e escuto)',hear:'Idioma de reprodução',voice:'Voz que quero ouvir',join:'Entrar e conversar',copy:'Copiar convite',exit:'Sair',pause:'Pausar microfone',resume:'Retomar microfone',waiting:'Sala criada. Envie o convite.',connecting:'Conectando os aparelhos…',connected:'Conectados! Fale naturalmente.',mic:'Autorize o microfone para começar.',denied:'Microfone não permitido. Autorize no navegador.',copied:'Convite copiado!',voiceError:'Falha no áudio escolhido:',permission:'ElevenLabs não autorizada; use a voz gratuita.',noPremium:'Sala pronta. Convite sem ElevenLabs: voz gratuita disponível.',retry:'Reconectando…',activate:'Ativar microfone',busy:'Falas chegando rápido: aguardando tradução…'},
 fr:{title:'Conversation vocale',sub:'Parlez votre langue et écoutez la traduction.',name:'Votre nom',speak:'Ma langue (je parle et j’écoute)',hear:'Langue de lecture',voice:'Voix que je veux entendre',join:'Entrer et parler',copy:"Copier l'invitation",exit:'Quitter',pause:'Couper le micro',resume:'Activer le micro',waiting:'Salon prêt. Envoyez le lien.',connecting:'Connexion des appareils…',connected:'Connectés! Parlez normalement.',mic:'Autorisez le microphone.',denied:'Microphone bloqué. Autorisez-le dans le navigateur.',copied:'Invitation copiée!',voiceError:'Erreur de lecture de la voix :',permission:'ElevenLabs non autorisé ; voix gratuite disponible.',noPremium:'Lien créé sans ElevenLabs. Voix gratuite disponible.',retry:'Reconnexion…',activate:'Activer le micro',busy:'Paroles rapides : traduction en attente…'},
 en:{title:'Voice conversation',sub:'Speak your language and hear the translation.',name:'Your name',speak:'My language (speak and listen)',hear:'Playback language',voice:'Voice I want to hear',join:'Join and talk',copy:'Copy invite',exit:'Leave',pause:'Pause microphone',resume:'Resume microphone',waiting:'Room ready. Send the invitation.',connecting:'Connecting devices…',connected:'Connected! Speak naturally.',mic:'Allow microphone access.',denied:'Microphone blocked. Enable microphone access.',copied:'Invitation copied!',voiceError:'Voice playback error:',permission:'ElevenLabs not authorized; device voice available.',noPremium:'Room ready; invite without ElevenLabs. Device voice available.',retry:'Reconnecting…',activate:'Enable microphone',busy:'Speech queue busy: translating…'}
};
let panel=null,s=null,language='pt',guestReady=false;
const normalizeSpeech=text=>String(text||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
function setHistoryState(message){if($('duo217HistoryState'))$('duo217HistoryState').textContent=message;}
function journal(session,stage,data={}){
 if(!session)return;
 const input={session:session.ticket?.slice(0,8)||'',speaker:data.speaker||session.name||session.role||'',
  stage,direction:data.direction||'system',source:data.source||session.speak||'',target:data.target||session.peer?.speaks||'',
  original:data.original||'',translation:data.translation||'',error:data.error||'',provider:data.provider||'',playback:data.playback||''};
 window.DuoVoiceHistory220?.add(input)?.then(r=>{
  if(!r.saved)setHistoryState('Aviso: histórico completo não pôde ser salvo neste navegador; exporte os registros.');
 }).catch(()=>setHistoryState('Falha ao salvar histórico da conversa.'));
}
function rememberOutput(session,text){
 const value=normalizeSpeech(text);if(!session||!value)return;
 session.outputs.push({value,at:Date.now()});
 session.outputs=session.outputs.filter(v=>Date.now()-v.at<40000).slice(-20);
}
function rejectSpeech(session,text,confidence){
 const normalized=normalizeSpeech(text),now=Date.now();
 if(normalized.length<4)return 'Fala muito curta ou vazia';
 if(session.playing||session.previewing||now<(session.outputMuteUntil||0))return 'Reprodução de áudio em andamento';
 if(typeof confidence==='number'&&confidence>0&&confidence<.45)return 'Baixa confiança do reconhecimento';
 if(session.recentSpeech.some(v=>v.value===normalized&&now-v.at<10000))return 'Fala duplicada';
 if(session.outputs.some(v=>v.value===normalized||(normalized.length>12&&v.value.includes(normalized))))return 'Possível eco da voz reproduzida';
 return '';
}
const $=id=>document.getElementById(id),t=k=>labels[language]?.[k]||labels.pt[k]||k;
const stored=()=>{try{return JSON.parse(localStorage.getItem('duotranslate.integration.v2')||'{}')||{};}catch{return {};}};
const selected=(x,fallback)=>names.has(x)?x:fallback;
function setStatus(value){if($('duo217Status'))$('duo217Status').textContent=value;}
function setCaption(value){if($('duo217Caption'))$('duo217Caption').textContent=value;}
function setVoiceState(value){if($('duo217VoiceState'))$('duo217VoiceState').textContent=value;}
function setup(){
 if(panel)return;
 const style=document.createElement('style');
 style.textContent="#duo217{position:fixed;inset:0;z-index:9999;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;background:#faf8f5;padding:13px;color:#17365d;font-family:Inter,Arial,sans-serif}#duo217[hidden]{display:none!important}#duo217 .card{width:min(100%,610px);background:white;border:1px solid #e7e0db;border-radius:22px;margin:20px auto;padding:clamp(20px,4vw,32px);box-shadow:0 18px 54px #17365d10}#duo217 h2{font-size:25px;margin:0}#duo217 p{font-size:13px;line-height:1.55;color:#676777}#duo217 label{display:block;margin:14px 0 7px;font-size:13px;font-weight:700}#duo217 input,#duo217 select{display:block;width:100%;min-width:0;min-height:44px;padding:9px 12px;border:1px solid #d7d2db;background:white;border-radius:11px;color:#17365d;font:inherit;font-size:15px}#duo217 .cols{display:grid;grid-template-columns:1fr 1fr;gap:11px}#duo217 button{padding:11px 16px;background:white;color:#17365d;border:1px solid #ded7e2;border-radius:12px;font:inherit;font-weight:700;min-height:46px;cursor:pointer}#duo217 button.primary{background:#17365d;color:#fff}#duo217 button:disabled{opacity:.45}#duo217 .actions{display:flex;flex-wrap:wrap;gap:9px;margin:17px 0}#duo217 .status{background:#f6f4fa;border:1px solid #e5dfee;border-radius:12px;padding:13px;margin-top:13px;font-size:14px}#duo217 .caption{color:#686c76}#duo217 .bubble{border-radius:12px;padding:10px 12px;margin:8px 0;background:#f6f2fb;font-size:14px;line-height:1.45}#duo217 .bubble.mine{background:#eef3fa}#duo217 .bubble strong{display:block;margin-top:5px}#duo217 .messages{max-height:37vh;overflow-y:auto}#duo217 .hide{display:none!important}@media(max-width:420px){#duo217{padding:7px}#duo217 .card{margin:5px auto}#duo217 .cols{grid-template-columns:1fr}}";
 document.head.append(style);
 panel=document.createElement('section');panel.id='duo217';panel.hidden=true;
 panel.innerHTML='<div class="card"><h2 id="duo217Title"></h2><p id="duo217Sub"></p><label id="duo217NameLabel" for="duo217Name"></label><input id="duo217Name" maxlength="40" autocomplete="nickname"><div class="cols"><div><label id="duo217SpeakLabel" for="duo217Speak"></label><select id="duo217Speak"></select></div><div><label id="duo217HearLabel" for="duo217Hear"></label><select id="duo217Hear"></select></div></div><label id="duo217VoiceLabel" for="duo217Voice"></label><select id="duo217Voice"></select><p id="duo217Status" class="status" role="status" aria-live="polite"></p><p id="duo217Caption" class="caption" aria-live="polite"></p><p id="duo217VoiceState" class="caption" aria-live="polite"></p><div class="actions"><button id="duo217Preview" type="button">▶ Ouvir exemplo</button></div><div id="duo217Messages" class="messages"></div><p id="duo217HistoryState" class="caption" role="status">Histórico salvo neste aparelho (sem gravar áudio). O histórico de cada participante é local.</p><div class="actions"><button id="duo217ExportJson" type="button">Exportar histórico JSON</button><button id="duo217ExportCsv" type="button">Exportar CSV</button></div><div class="actions"><button class="primary" id="duo217Join"></button><button class="primary hide" id="duo217Copy"></button><button class="hide" id="duo217Pause"></button><button id="duo217Close"></button></div><p style="font-size:12px">O áudio não é transmitido entre os celulares pelo DuoTranslate. O reconhecimento pode usar serviços do navegador; vozes ElevenLabs utilizam créditos do anfitrião.</p></div>';
 document.body.append(panel);
 for(const id of ['duo217Speak','duo217Hear'])for(const [code,label] of LANGS){const option=document.createElement('option');option.value=code;option.textContent=label;$(id).append(option);}
 $('duo217Hear').parentElement.hidden=true;
 for(const [id,key] of [['duo217Title','title'],['duo217Sub','sub'],['duo217NameLabel','name'],['duo217SpeakLabel','speak'],['duo217HearLabel','hear'],['duo217VoiceLabel','voice'],['duo217Join','join'],['duo217Copy','copy'],['duo217Close','exit']])$(id).textContent=t(key);
 $('duo217Preview').onclick=()=>{void previewVoice();};
 for(const [id,format] of [['duo217ExportJson','json'],['duo217ExportCsv','csv']])$(id).onclick=async()=>{
  try{const count=await window.DuoVoiceHistory220.download(format);
   setHistoryState(count+' registros exportados do histórico deste aparelho.');
  }catch(e){setHistoryState('Falha na exportação: '+String(e.message||e).slice(0,130));}
 };
 $('duo217Join').onclick=()=>{void enterGuest();};
 $('duo217Copy').onclick=()=>{void copyLink();};
 $('duo217Close').onclick=close;
 $('duo217Pause').onclick=()=>{if(!s)return;if(!s.permission){void unlockMicrophone();return;}s.paused=!s.paused;s.paused?haltRecognition():listen();$('duo217Pause').textContent=t(s.paused?'resume':'pause');};
 // Both spoken and heard translation use the participant's chosen native language.
 $('duo217Speak').onchange=()=>{
  const selected=$('duo217Speak').value;$('duo217Hear').value=selected;
  if(s){s.speak=selected;s.hear=selected;haltRecognition();sendHello();listen();}
  void loadVoices(selected);
 };
 $('duo217Voice').onchange=()=>{if(!s)return;s.voice=$('duo217Voice').value;if(s.voice!=='local')window.DuoEleven?.selectVoice(s.hear,s.voice,true);};
 $('duo217Name').onchange=()=>{if(s){s.name=$('duo217Name').value.trim().slice(0,40)||'Convidado';sendHello();}};
}
async function loadVoices(lang){
 const select=$('duo217Voice'),currentSession=s;
 const old=select.value,preferred=currentSession?.voice||old;
 select.replaceChildren();
 const local=document.createElement('option');local.value='local';local.textContent='Voz do dispositivo · gratuita';select.append(local);
 if(!window.DuoAccess?.active){
  select.value='local';
  if(s)s.voice='local';
  setVoiceState('ElevenLabs não autorizada neste aparelho. O convite deve incluir acesso individual.');
  return;
 }
 setVoiceState('Verificando vozes disponíveis na ElevenLabs…');
 let list=[];
 try{
  list=await window.DuoEleven.loadVoices(!currentSession?.voicesVerified);
  if(s!==currentSession && currentSession!==null)return;
  if($('duo217Hear')?.value!==lang)return;
 }catch(e){
  setVoiceState('Não foi possível carregar vozes: '+String(e.message||e).slice(0,160));
  select.value='local';if(s)s.voice='local';return;
 }
 if(!Array.isArray(list)||!list.length){setVoiceState('Sua conta não retornou vozes ElevenLabs.');return;}
 if(currentSession)currentSession.voicesVerified=true;
 for(const item of list){
  if(!/^[a-zA-Z0-9]{12,40}$/.test(item?.id||''))continue;
  const option=document.createElement('option');option.value=item.id;option.textContent='ElevenLabs · '+item.name;select.append(option);
  if(currentSession&&item.preview?.startsWith('https://')){currentSession.voicePreviews[item.id]=item.preview;}
 }
 const savedVoice=window.DuoEleven?.choices?.(lang)?.selected;
 const chosen=[preferred,savedVoice].find(v=>v&&v!=='local'&&[...select.options].some(o=>o.value===v));
 select.value=chosen||'local';if(s)s.voice=select.value;
 setVoiceState((select.options.length-1)+' vozes ElevenLabs disponíveis e acesso individual autorizado.');
}
async function previewVoice(){
 const session=s,voice=$('duo217Voice')?.value;if(!session||session.playing||session.previewing)return;
 session.previewing=true;haltRecognition();session.outputMuteUntil=Date.now()+60000;
 $('duo217Preview').disabled=true;setVoiceState('Reproduzindo exemplo da voz escolhida…');
 const example=({pt:'Olá! Este é um exemplo da minha voz.',fr:'Bonjour ! Voici un exemple de ma voix.',en:'Hello! Here is my voice sample.'})[session.hear.slice(0,2)]||'Hello! This is a voice sample.';
 try{
  if(voice==='local')await localSpeech(example);
  else{
   if(!window.DuoAccess?.active)throw Error('Acesso ElevenLabs indisponível.');
   const uri=session.voicePreviews?.[voice];
   if(uri){
    const audio=new Audio(uri);session.previewAudio=audio;
    await new Promise((resolve,reject)=>{audio.onended=resolve;audio.onerror=()=>reject(Error('Prévia da voz indisponível.'));audio.play().catch(reject);});
   }else{
    if(!session.audio){session.audio=new (window.AudioContext||window.webkitAudioContext)();await session.audio.resume();}
    await premiumSpeech(example.slice(0,120),voice);
   }
  }
  setVoiceState('Exemplo reproduzido. Pode trocar de voz e ouvir outro exemplo.');
 }catch(e){setVoiceState('Não foi possível ouvir: '+String(e.message||e).slice(0,140));
  journal(session,'preview-error',{error:String(e.message||e)});
 }finally{if(s===session){session.previewing=false;session.outputMuteUntil=Date.now()+1800;
  $('duo217Preview').disabled=false;setTimeout(listen,1950);}}
}
function randomTicket(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
function createState(role,ticket,name,speak,hear){return {role,ticket,name,speak,hear,voice:'local',voicesVerified:false,lastVoiceAccess:null,active:true,paired:false,peer:null,ws:null,retries:0,
 permission:false,paused:false,rec:null,restart:null,reconnect:null,heartbeat:null,lastPong:Date.now(),audio:null,playing:false,sound:null,pending:0,utterances:[],translating:false,playlist:[],outputs:[],recentSpeech:[],outputMuteUntil:0,previewing:false,voicePreviews:{},link:''};}
function makeLink(){
 const url=new URL('/duotranslate/preview/v2.20/',location.origin);
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
 ws.onopen=()=>{if(s!==session)return;
  session.lastPong=Date.now();clearInterval(session.heartbeat);
  session.heartbeat=setInterval(()=>{
   if(s!==session||session.ws!==ws||ws.readyState!==WebSocket.OPEN)return;
   if(Date.now()-session.lastPong>45000){ws.close();return;}
   ws.send(JSON.stringify({type:'ping',stamp:String(Date.now())}));
  },15000);
  sendHello();
 };
 ws.onmessage=e=>{
  if(s!==session)return;let msg;try{msg=JSON.parse(e.data);}catch{return;}
  if(msg.type==='pong')session.lastPong=Date.now();
  if(msg.type==='ready')sendHello();
  if(msg.type==='waiting'){session.paired=false;haltRecognition();setStatus(t('waiting'));}
  if(msg.type==='paired'){session.paired=true;session.retries=0;session.peer=msg.peer;journal(session,'connected',{speaker:msg.peer?.name});setStatus(t('connected')+(session.permission?'':' '+t('mic')));listen();}
  if(msg.type==='speech'&&msg.target===session.hear){
   display(msg.original,msg.translation,false);
   rememberOutput(session,msg.translation);
   journal(session,'received',{direction:'received',speaker:session.peer?.name||'Outro dispositivo',
    original:msg.original,translation:msg.translation,source:msg.source||session.peer?.speaks,
    target:session.hear,provider:msg.provider});
   setCaption('Tradução recebida. Reproduzindo no idioma '+session.hear+'…');
   session.playlist.push(msg.translation);void playQueue();
  }
  if(msg.type==='error')setStatus(String(msg.message||'Erro de conexão'));
 };
 ws.onerror=()=>{if(s===session)setStatus('Canal de conexão indisponível. '+t('retry'));};
 ws.onclose=()=>{if(s!==session||!session.active||session.ws!==ws)return;clearInterval(session.heartbeat);session.heartbeat=null;session.paired=false;haltRecognition();
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
  media.getTracks().forEach(track=>track.stop());if(s!==session)return;
  session.permission=true;session.paused=false;
  $('duo217Pause').textContent=t('pause');
  if(session.paired)setStatus(t('connected'));
  listen();
 }catch(e){media?.getTracks().forEach(track=>track.stop());if(s!==session)return;
  session.permission=false;$('duo217Pause').textContent=t('activate');
  setStatus(t('denied')+' '+String(e.message||e).slice(0,60));
 }
}
function haltRecognition(){if(!s)return;clearTimeout(s.restart);const r=s.rec;s.rec=null;try{r?.abort();}catch{}}
function listen(){
 const session=s;if(!session?.paired||!session.permission||session.paused||session.playing||session.previewing||session.rec||Date.now()<(session.outputMuteUntil||0))return;
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;
 const r=new SR();session.rec=r;r.lang=session.speak;r.continuous=true;r.interimResults=true;
 r.onresult=e=>{if(s!==session||session.playing||!session.paired)return;for(let i=e.resultIndex;i<e.results.length;i++){
   const row=e.results[i],spoken=String(row[0]?.transcript||'').trim();
   if(!spoken)continue;
   if(row.isFinal){
    const confidence=Number(row[0]?.confidence)||0;
    journal(session,'recognized',{direction:'sent',original:spoken,provider:'Browser SpeechRecognition'});
    const reason=rejectSpeech(session,spoken,confidence);
    if(reason){setCaption('Fala ignorada: '+reason);
     journal(session,'rejected',{original:spoken,error:reason});continue;}
    session.recentSpeech.push({value:normalizeSpeech(spoken),at:Date.now()});
    session.recentSpeech=session.recentSpeech.filter(v=>Date.now()-v.at<30000).slice(-15);
    setCaption('Fala reconhecida: '+spoken.slice(0,100));queueSpeech(spoken);
   }else if(!session.playing&&Date.now()>=session.outputMuteUntil)setCaption('🎙 Ouvindo: '+spoken.slice(0,160));
 }};
 r.onerror=e=>{if(s!==session)return;
  if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){session.permission=false;setStatus(t('denied'));}
  else setCaption('Microfone: '+e.error);
 };
 r.onend=()=>{if(s!==session||session.rec!==r)return;session.rec=null;
  if(session.paired&&!session.paused&&!session.playing&&session.permission)session.restart=setTimeout(listen,650);
 };
 r.onstart=()=>{if(s===session&&session.paired)setCaption('🎙 Microfone ouvindo em '+session.speak+'.');};
 try{r.start();}catch(e){session.rec=null;setStatus('Não foi possível iniciar o microfone: '+String(e.message||e));}
}
function queueSpeech(text){
 const session=s;if(!session?.paired||!text)return;
 if(session.utterances.length>=12){setStatus(t('busy'));return;}
 session.utterances.push(text);void drainSpeechQueue(session);
}
async function drainSpeechQueue(session){
 if(session.translating)return;session.translating=true;
 try{
  while(s===session&&session.active&&session.paired&&session.utterances.length){
   const phrase=session.utterances.shift();
   await translate(phrase);
  }
 }finally{session.translating=false;}
}
async function translate(original){
 const session=s;if(!session?.paired||!session.peer)return;session.pending++;
 try{
  // Translate to the OTHER person's spoken language. The listener never has to choose a second language.
  const target=session.peer.speaks;
  if(!names.has(target)||target===session.speak){
   setCaption('Tradução interrompida: confira os idiomas de cada aparelho.');
   return;
  }
  setCaption('Traduzindo '+session.speak+' → '+target+'…');
  const result=await window.DuoReliable.translate(original,session.speak,target);
  if(s!==session||!session.paired)return;
  display(original,result.text,true);
  journal(session,'translated',{direction:'sent',original,translation:result.text,target,provider:result.provider});
  send({type:'speech',original:original.slice(0,600),translation:result.text.slice(0,900),provider:result.provider,target});
  setCaption('Tradução pronta e enviada para '+target+'.');
 }catch(e){if(s===session){setStatus('Falha de tradução: '+String(e.message||e).slice(0,135));
   journal(session,'translation-error',{direction:'sent',original,error:String(e.message||e)});}}
 finally{session.pending--;}
}
function localSpeech(text){
 return new Promise((resolve,reject)=>{
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){reject(Error('Voz do dispositivo indisponível'));return;}
  const session=s;if(!session){reject(Error('Conversa encerrada'));return;}
  const u=new window.SpeechSynthesisUtterance(text);u.lang=session.hear;u.rate=1;
  const voices=window.speechSynthesis.getVoices(),v=voices.find(x=>x.lang===session.hear)||voices.find(x=>x.lang?.slice(0,2)===session.hear.slice(0,2));if(v)u.voice=v;
  let done=false;
  const finish=error=>{if(done)return;done=true;clearTimeout(watchdog);error?reject(error):resolve();};
  const watchdog=setTimeout(()=>{try{window.speechSynthesis.cancel();}catch{}finish(Error('A voz do aparelho excedeu 45 segundos.'));},45000);
  u.onend=()=>finish();u.onerror=e=>finish(Error(e.error||'Falha na voz'));
  try{window.speechSynthesis.speak(u);}catch(e){finish(e);}
 });
}
async function premiumSpeech(text,voiceOverride){
 const session=s;
 if(!window.DuoAccess?.active)throw Error(t('permission'));
 if(!session.audio)throw Error('Áudio não autorizado');
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),20000);
 let result;try{result=await window.DuoAccess.fetch(window.DuoAccess.voiceUrl+'/stream-tts',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang:session.hear,voiceId:voiceOverride||session.voice}),signal:abort.signal
 });}finally{clearTimeout(timer);}
 if(!result.ok){const error=await result.json().catch(()=>({}));throw Error(error.error||'ElevenLabs HTTP '+result.status);}
 const audio=await session.audio.decodeAudioData(await result.arrayBuffer());await session.audio.resume();
 return new Promise(resolve=>{const playing=session.audio.createBufferSource();playing.buffer=audio;playing.connect(session.audio.destination);playing.onended=resolve;session.sound=playing;playing.start();});
}
async function playQueue(){
 const session=s;if(!session||session.playing||!session.playlist.length)return;
 session.playing=true;haltRecognition();session.outputMuteUntil=Date.now()+60000;
 try{while(s===session&&session.playlist.length){
  const text=session.playlist.shift();
  let played=false;
  try{
   if(session.voice==='local')await localSpeech(text);
   else for(let i=0;i<text.length;i+=200)await premiumSpeech(text.slice(i,i+200));
   played=true;
  }catch(e){
   if(s===session){
    journal(session,'playback-error',{direction:'received',original:text,error:String(e.message||e),playback:'failed'});
    setStatus(t('voiceError')+' '+String(e.message||e).slice(0,140));
    setCaption('Texto recebido, mas áudio não reproduzido.');
   }
  }
  if(s===session&&played){journal(session,'played',{direction:'received',original:text,playback:session.voice==='local'?'device':'ElevenLabs'});
   setCaption('Áudio reproduzido no idioma '+session.hear+'.');}
 }}
 finally{if(s===session){session.playing=false;session.outputMuteUntil=Date.now()+1800;setTimeout(listen,1950);}}
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
  if(s===session){session.link=url.href;session.premiumInvite=true;
   $('duo217Copy').textContent=t('copy');
   if(!session.paired)setStatus(t('waiting')+' ElevenLabs autorizada para o convidado.');
  }
 }catch(e){if(s===session){
  session.link=url.href;session.premiumInvite=false;
  session.inviteError=String(e.message||e).slice(0,130);
  $('duo217Copy').textContent=t('copy')+' · sem ElevenLabs';
  setStatus(t('noPremium')+' Motivo: '+session.inviteError);
 }}
 if(s===session)$('duo217Copy').disabled=false;
}
function fill(name,speak,hear){
 setup();panel.hidden=false;
 $('duo217Name').value=name;$('duo217Speak').value=speak;$('duo217Hear').value=speak;
}
async function openHost(){
 close();
 const defaults=stored(),host=window.DuoInviteHost?.()||{};
 language=String(defaults.ui||navigator.language||'pt').slice(0,2);if(!labels[language])language='pt';
 const speak=selected(host.speak||defaults.speak,'pt-BR'),counterpart=selected(host.hear||defaults.hear,'fr-FR'),hear=speak;
 const name=String(host.name||defaults.name||'Anfitrião').trim().slice(0,40);
 fill(name,speak,hear);
 s=createState('host',randomTicket(),name,speak,hear);s.counterpart=counterpart;
 void loadVoices(speak);
 $('duo217Join').classList.add('hide');$('duo217Copy').classList.remove('hide');$('duo217Copy').disabled=true;
 $('duo217Pause').classList.remove('hide');$('duo217Pause').textContent=t('pause');
 setStatus(t('connecting'));const permission=unlockMicrophone();connect();void premiumInvite();await permission;
}
async function enterGuest(){
 if(!s||s.role!=='guest')return;
 s.name=$('duo217Name').value.trim().slice(0,40)||'Convidado';
 s.speak=$('duo217Speak').value;s.hear=s.speak;$('duo217Hear').value=s.speak;s.voice=$('duo217Voice').value;
  if(s.voice!=='local'&&!window.DuoAccess?.active){setStatus(t('permission'));return;}
 if(s.voice!=='local')window.DuoEleven?.selectVoice(s.hear,s.voice,true);
 $('duo217Join').classList.add('hide');$('duo217Pause').classList.remove('hide');$('duo217Pause').textContent=t('pause');
 const permission=unlockMicrophone();connect();await permission;
}
async function copyLink(){
 if(!s||s.role!=='host')return;
 const link=s.link||makeLink().href;
 try{await navigator.clipboard.writeText(link);setStatus(t('copied')+(s.premiumInvite?' · ElevenLabs autorizada.':' · ElevenLabs não foi autorizada neste convite.'));}
 catch(e){window.prompt('Copie o convite:',link);}
}
function close(){
 const previous=s;s=null;
 if(previous){journal(previous,'session-end');previous.active=false;clearTimeout(previous.restart);clearTimeout(previous.reconnect);clearInterval(previous.heartbeat);
  try{previous.rec?.abort();}catch{}try{previous.ws?.close(1000,'Closed');}catch{}
  try{previous.sound?.stop();}catch{}try{previous.previewAudio?.pause();}catch{}try{window.speechSynthesis?.cancel();}catch{}try{previous.audio?.close();}catch{}
 }
 if(panel){panel.hidden=true;$('duo217Messages').replaceChildren();
  $('duo217Join').classList.remove('hide');$('duo217Copy').classList.add('hide');$('duo217Pause').classList.add('hide');}
}
async function initGuest(){
 if(!guest||guestReady)return;guestReady=true;
 language=String(navigator.language||'fr').slice(0,2);if(!labels[language])language='fr';
 const speak=selected(params.get('hears'),'fr-FR'),hear=speak;
 fill('',speak,hear);s=createState('guest',ticket,'',speak,hear);
 $('duo217Join').classList.remove('hide');$('duo217Copy').classList.add('hide');
 $('duo217Pause').classList.add('hide');setStatus(t('join'));
 // Show the one-screen guest form immediately, even while individual access is being redeemed.
 await window.DuoAccess?.ready;
 void loadVoices(hear);
}
window.DuoConnected217={openHost,stop:close,get active(){return !!s?.active;}};
window.addEventListener('duo-access-changed',()=>{
 if(!s||!panel||panel.hidden)return;
 const active=!!window.DuoAccess?.active;
 if(s.lastVoiceAccess===active)return;
 s.lastVoiceAccess=active;void loadVoices(s.hear);
});
document.addEventListener('visibilitychange',()=>{if(!s)return;if(document.hidden)haltRecognition();else if(s.paired&&s.permission&&!s.paused)setTimeout(listen,300);});
window.addEventListener('pagehide',()=>{if(s)close();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void initGuest();},{once:true});
else void initGuest();
})();
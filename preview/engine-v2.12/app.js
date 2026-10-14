/* DuoTranslate 1.0 — prototipo experimental: sem backend privado */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const el = {
 create: $('createBtn'), join: $('joinBtn'), code: $('codeInput'), roomSetup: $('roomSetup'),
 roomActive: $('roomActive'), roomCode: $('roomCode'), roomLabel: $('roomLabel'),
 roomHelp: $('roomHelp'), connection: $('connectionState'), copy: $('copyBtn'), hearSelect:$('duoHearLanguage'), direction:$('duoDirection'),
 leave: $('leaveBtn'), listen: $('listenBtn'), listenStatus: $('listenStatus'),
 micBadge: $('micBadge'), micOrb: $('micOrb'), audio: $('testAudioBtn'),
 form: $('textForm'), input: $('textInput'), send: $('sendBtn'),
 messages: $('messages'), clear: $('clearBtn'), toast: $('toast'),
 connectionPhase:$('duoConnectPhase'),connectionDetail:$('duoConnectDetail'),retry:$('duoRetryBtn'),ping:$('duoPingBtn'),pingStatus:$('duoPingStatus')
};
const LANG = window.DuoLanguages || {};
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const state = {
 language:'pt-BR', hearLanguage:'fr-FR', other:null, otherHear:null, peer:null, conn:null, room:'', host:false,
 listen:false, recognizing:false, instance:null, speaking:false, queue:[],
 restart:null, toastTimer:null, transQueue:Promise.resolve(), session:0, netErrors:0,
 connectionPhase:'idle',connectionMessage:'',connectionTimer:null,pingTimer:null,
 pingId:'',pingStarted:0,peerReady:false,handshakeReceived:false
};
function connected(){return !!(state.conn && state.conn.open && state.other && state.otherHear);}
function status(s){el.listenStatus.textContent=window.DuoI18n?.localizeStatus(s)||s;}
function notify(s, error=false){
 clearTimeout(state.toastTimer);
 el.toast.textContent=s;
 el.toast.classList.toggle('error',error);
 el.toast.classList.remove('hidden');
 state.toastTimer=setTimeout(()=>el.toast.classList.add('hidden'),5000);
}
function renderDiagnostics(){
 const phase=connected()?'connected':state.connectionPhase;
 const heading={
  idle:'Nenhuma conexão iniciada',
  registering:'1/3 · Registrando sala no servidor',
  waiting:'1/3 · Sala pronta — aguardando a outra pessoa',
  searching:'1/3 · Localizando a sala',
  connecting:'2/3 · Abrindo canal entre aparelhos',
  handshake:'3/3 · Confirmando idiomas e comunicação',
  connected:'Conectados · comunicação confirmada',
  reconnecting:'Conexão interrompida · tentando recuperar',
  failed:'Falha na conexão',
 }[phase]||'Verificando conexão';
 if(el.connectionPhase)el.connectionPhase.textContent=heading;
 if(el.connectionDetail)el.connectionDetail.textContent=state.connectionMessage||
  'O segundo aparelho ainda não respondeu.';
 if(el.ping)el.ping.disabled=!connected();
 if(el.retry){el.retry.disabled=!state.room||connected();el.retry.textContent=state.host?'Recriar sala':'Tentar novamente';}
}
function clearConnectionTimers(){
 clearTimeout(state.connectionTimer);clearTimeout(state.pingTimer);
 state.connectionTimer=null;state.pingTimer=null;
}
function setConnectionPhase(phase,message){
 state.connectionPhase=phase;state.connectionMessage=message;
 renderDiagnostics();
 if(state.room)view();
}
function watchdog(delay,phase,errorMessage){
 clearTimeout(state.connectionTimer);
 const token=state.session;
 state.connectionTimer=setTimeout(()=>{
  if(state.session!==token||connected()||state.connectionPhase!==phase)return;
  setConnectionPhase('failed',errorMessage+' Tente novamente; se você criou a sala, gere um novo código.');
 },delay);
}
function retryConnection(){
 if(!state.room)return;
 if(state.host){createRoom();return;}
 el.code.value=state.room;joinRoom();
}
function sendDiagnostic(){
 if(!connected())return;
 clearTimeout(state.pingTimer);
 const token=state.session,identifier=String(Date.now())+'-'+Math.random().toString(36).slice(2,9);
 state.pingId=identifier;state.pingStarted=performance.now();
 if(el.pingStatus)el.pingStatus.textContent='Teste enviado. Aguardando confirmação do outro aparelho…';
 if(!transmit({type:'duo-test',id:identifier})){
  if(el.pingStatus)el.pingStatus.textContent='Não foi possível enviar o teste pelo canal.';
  return;
 }
 state.pingTimer=setTimeout(()=>{
  if(state.session!==token||state.pingId!==identifier)return;
  state.pingId='';
  if(el.pingStatus)el.pingStatus.textContent='Teste sem resposta após 8 segundos. O canal pode estar bloqueado.';
 },8000);
}
function view(){
 const inRoom=!!state.room, ok=connected();
 if(el.direction){
  const to=ok?state.otherHear:state.hearLanguage;
  el.direction.textContent='🎙 '+LANG[state.language].flag+' '+LANG[state.language].name+
   ' → '+LANG[to].flag+' '+LANG[to].name+' · 🎧 '+LANG[state.hearLanguage].flag+' '+LANG[state.hearLanguage].name;
 }
 if(el.hearSelect)el.hearSelect.value=state.hearLanguage;
 el.roomSetup.classList.toggle('hidden',inRoom);
 el.roomActive.classList.toggle('hidden',!inRoom);
 el.create.disabled=inRoom; el.join.disabled=inRoom;
 el.listen.disabled=!ok || !Recognition;
 el.send.disabled=!ok;
 el.micOrb.classList.toggle('active',state.listen);
 el.micBadge.classList.toggle('active',state.listen);
 el.micBadge.textContent=window.DuoI18n?.t(state.listen?'micOn':'micOff')||(state.listen?'Microfone ligado':'Microfone desligado');
 el.listen.textContent=state.listen?(window.DuoI18n?.t('stopDuo')||'■ Parar conversa'):(window.DuoI18n?.t('startDuo')||'🎙 Ativar conversa');
 el.connection.classList.toggle('connected',ok);
 el.connection.replaceChildren();
 const dot=document.createElement('span');
 dot.className='state-dot';
 el.connection.append(dot,document.createTextNode(ok?'Conectados':state.connectionPhase==='failed'?'Falha':state.connectionPhase==='waiting'?'Aguardando':state.connectionPhase==='reconnecting'?'Reconectando':'Conectando'));
 renderDiagnostics();
 if(inRoom){
  el.roomCode.textContent=state.room;
  el.roomLabel.textContent=state.host?'Código da sua sala':'Sala conectada';
  el.roomHelp.textContent=ok
   ?'A outra pessoa fala '+LANG[state.other].name+'. Ativem o microfone nos dois celulares.'
   :state.host?'No outro celular, abra o mesmo site e digite este código.':'Tentando estabelecer a conexão...';
 }
 if(!ok) status(inRoom?'Esperando o outro celular conectar...':'Conecte os dois celulares para começar.');
 else if(!Recognition) status('Reconhecimento de fala indisponível neste navegador. Teste enviando texto.');
 else if(!state.listen && !state.speaking) status('Conectados! Toque em Ativar conversa em cada aparelho.');
}
function randomRoom(){
 if(!window.crypto || !window.crypto.getRandomValues) throw Error('Abra por HTTPS.');
 const b=new Uint8Array(8);window.crypto.getRandomValues(b);
 return Array.from(b,n=>alphabet[n%alphabet.length]).join('');
}
function normalized(s){return String(s||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,8);}
function peerId(room){return 'duo-'+room.toLowerCase()+'-host';}
function canStart(){
 if(typeof window.Peer!=='function'){notify('PeerJS não carregou. Confira sua conexão e recarregue.',true);return false;}
 if(!window.isSecureContext){notify('O aplicativo precisa ser aberto em HTTPS.',true);return false;}
 return true;
}
function transmit(data){
 if(!state.conn || !state.conn.open) return false;
 try{state.conn.send(data);return true;}catch(e){console.warn(e);return false;}
}
let releaseVoiceProfile=()=>{};
function haltMic(){
 releaseVoiceProfile();
 clearTimeout(state.restart);
 if(state.instance){try{state.instance.abort();}catch(e){}}
 state.recognizing=false;
}
function stopMic(){state.listen=false;haltMic();view();}
function exitRoom(){
 stopMic();state.session++;clearConnectionTimers();
 state.room='';state.other=null;state.otherHear=null;state.host=false;
 state.peerReady=false;state.handshakeReceived=false;state.connectionPhase='idle';
 state.connectionMessage='';state.pingId='';state.pingStarted=0;
 state.queue.length=0;state.speaking=false;
 try{window.speechSynthesis && window.speechSynthesis.cancel();}catch(e){}
 try{state.conn && state.conn.close();}catch(e){}
 try{state.peer && state.peer.destroy();}catch(e){}
 state.conn=null;state.peer=null;view();
}
function bindPeer(peer){
 state.peer=peer;
 peer.on('error',e=>{
  if(state.peer!==peer)return;
  const type=String(e?.type||'desconhecido');
  const details={
   'unavailable-id':'Código de sala já em uso no servidor público. Recrie a sala.',
   'peer-unavailable':'Sala não encontrada. Confira os 8 caracteres e se o criador mantém a página aberta.',
   'network':'Falha de rede ao alcançar o servidor de sinalização PeerJS.',
   'server-error':'O serviço público de sinalização recusou a conexão.',
   'socket-error':'Falha no canal de sinalização.',
   'socket-closed':'O servidor de sinalização fechou o canal.',
   'browser-incompatible':'Este navegador não disponibiliza WebRTC.'
  };
  const message=(details[type]||'Erro PeerJS: '+type)+' Se continuar, tentem outra rede.';
  clearTimeout(state.connectionTimer);
  setConnectionPhase('failed',message);notify(message,true);
 });
 peer.on('disconnected',()=>{
  if(state.peer!==peer||!state.room||connected())return;
  setConnectionPhase('reconnecting','Sinalização interrompida. Tentando recuperar a comunicação por até 12 segundos.');
  watchdog(12000,'reconnecting','Não foi possível retomar a sinalização PeerJS.');
  try{peer.reconnect();}catch(e){setConnectionPhase('failed','Falha ao reconectar ao servidor: '+String(e.message||e));}
 });
}
function createRoom(){
 if(!canStart())return;
 exitRoom();state.room=randomRoom();state.host=true;
 setConnectionPhase('registering','Registrando o código no servidor público. Aguarde a confirmação antes de compartilhá-lo.');
 watchdog(12000,'registering','O servidor não confirmou a abertura da sala em 12 segundos.');
 let peer;
 try{peer=new window.Peer(peerId(state.room));}catch(e){setConnectionPhase('failed','Não foi possível abrir o PeerJS: '+String(e.message||e));return;}
 bindPeer(peer);
 peer.on('open',()=>{
  if(peer!==state.peer||state.connectionPhase==='failed')return;
  state.peerReady=true;clearTimeout(state.connectionTimer);
  setConnectionPhase('waiting','Sala registrada. Compartilhe o código de 8 caracteres. O outro aparelho deve entrar nesta mesma sala.');
 });
 peer.on('connection',conn=>{
  if(peer!==state.peer||state.connectionPhase==='failed'){try{conn.close();}catch(e){}return;}
  if(state.conn && state.conn.open){conn.on('open',()=>conn.close());return;}
  setConnectionPhase('connecting','Outro aparelho localizado. Abrindo o canal WebRTC…');
  watchdog(15000,'connecting','O outro aparelho respondeu, mas o canal não abriu em 15 segundos. Rede/NAT/firewall podem bloquear.');
  useConnection(conn);
 });
}
function joinRoom(){
 if(!canStart())return;
 const room=normalized(el.code.value);
 if(room.length!==8){notify('Digite o código completo de 8 caracteres.',true);return;}
 exitRoom();state.room=room;state.host=false;
 setConnectionPhase('searching','Consultando o servidor público para localizar a sala '+room+'…');
 watchdog(15000,'searching','Não foi possível consultar o servidor de salas em 15 segundos.');
 let peer;
 try{peer=new window.Peer();}catch(e){setConnectionPhase('failed','Não foi possível abrir o PeerJS: '+String(e.message||e));return;}
 bindPeer(peer);
 peer.on('open',()=>{
  if(state.peer!==peer||state.connectionPhase==='failed')return;
  state.peerReady=true;
  setConnectionPhase('connecting','Servidor acessível. Procurando o criador da sala e abrindo o canal WebRTC…');
  watchdog(20000,'connecting','O outro aparelho não respondeu em 20 segundos. Confiram código, rede e se a página permanece aberta.');
  try{useConnection(peer.connect(peerId(room),{reliable:true}));}
  catch(e){setConnectionPhase('failed','Falha ao conectar à sala: '+String(e.message||e));}
 });
}
function useConnection(conn){
 if(state.conn && state.conn!==conn){try{state.conn.close();}catch(e){}}
 state.conn=conn;
 conn.on('open',()=>{
  if(state.conn!==conn)return;
  setConnectionPhase('handshake','Canal aberto. Esperando a confirmação dos idiomas do outro aparelho…');
  watchdog(10000,'handshake','O canal abriu, mas os idiomas não foram confirmados em 10 segundos.');
  transmit({type:'hello',lang:state.language,hear:state.hearLanguage});view();
  notify('Canal WebRTC aberto. Confirmando os idiomas…');
 });
 conn.on('data',data=>{
  if(!data || typeof data!=='object' || state.conn!==conn)return;
  if(data.type==='hello'){
   if(!Object.prototype.hasOwnProperty.call(LANG,data.lang))return;
   const otherHear=Object.prototype.hasOwnProperty.call(LANG,data.hear)?data.hear:data.lang; // aparelhos ainda em v1.5
   state.other=data.lang;state.otherHear=otherHear;state.handshakeReceived=true;
   if(connected()){
    clearTimeout(state.connectionTimer);
    setConnectionPhase('connected','Os aparelhos confirmaram a comunicação e os idiomas. Envie agora o teste gratuito antes de ativar o microfone.');
    notify('Comunicação entre aparelhos confirmada.');
   }else view();
  }else if(data.type==='duo-test' && typeof data.id==='string' && data.id.length<100){
   if(el.pingStatus)el.pingStatus.textContent='Teste recebido do outro aparelho. Respondendo sem IA ou serviços de voz.';
   transmit({type:'duo-test-ack',id:data.id});
  }else if(data.type==='duo-test-ack' && data.id===state.pingId){
   clearTimeout(state.pingTimer);state.pingId='';
   const elapsed=Math.round(performance.now()-state.pingStarted);
   if(el.pingStatus)el.pingStatus.textContent='Teste aprovado: ida e volta em '+elapsed+' ms. Sem tradução ou créditos de API.';
  }else if(data.type==='speech' && typeof data.translation==='string'){
   if(data.target!==state.hearLanguage)return;
   const translated=data.translation.trim().slice(0,600);
   if(!translated)return;
   bubble('theirs',String(data.original||'').slice(0,600),translated,false,Number(data.translationMs));
   window.DuoHistory?.add({mode:'duo',direction:'received',source:state.other,target:state.hearLanguage,original:String(data.original||'').slice(0,600),translation:translated,translationMs:data.translationMs,provider:String(data.provider||'Outro aparelho')});
   state.queue.push({text:translated,lang:state.hearLanguage});playQueue();
  }
 });
 conn.on('close',()=>{
  if(state.conn!==conn)return;
  state.conn=null;state.other=null;state.otherHear=null;stopMic();
  if(state.room){
   setConnectionPhase('failed','O canal WebRTC foi fechado. Tente novamente nos dois aparelhos.');
   notify('O outro aparelho se desconectou.',true);
  }else view();
 });
 conn.on('error',e=>{
  if(state.conn!==conn)return;
  setConnectionPhase('failed','Falha no canal WebRTC: '+String(e?.message||e?.type||'erro desconhecido')+'. Tente novamente.');
  notify('Erro de comunicação entre os aparelhos.',true);
 });
}
function bubble(side,original,translation,error=false,translationMs=null){
 const empty=el.messages.querySelector('.empty-messages');
 if(empty)empty.remove();
 const node=document.createElement('div');node.className='bubble '+side;
 const heading=document.createElement('small');
 heading.textContent=side==='mine'?'VOCÊ DISSE':'A OUTRA PESSOA DISSE';
 const line=document.createElement('div');line.className='transcript';line.textContent=original;
 const result=document.createElement('div');result.className='translation'+(error?' failed':'');
 result.textContent=(error?'⚠ ':'↳ ')+translation;
 node.append(heading,line,result);
 if(Number.isFinite(translationMs) && translationMs>=0){const measure=document.createElement('small');measure.textContent='Tradução: '+(translationMs/1000).toFixed(2)+' s (sem incluir reconhecimento e voz)';measure.className='translation-measure';node.append(measure);}
 el.messages.appendChild(node);
 while(el.messages.children.length>35)el.messages.firstElementChild.remove();
 el.messages.scrollTop=el.messages.scrollHeight;
}
async function translate(text,source,target){
  if(window.DuoReliable){const value=await window.DuoReliable.translate(text,source,target);return value.text;}
 const quick=window.DuoPhrasebook?.translate(text,source,target);if(quick!==null&&quick!==undefined)return quick;
 if(window.DuoAI?.enabled())return window.DuoAI.translate(text,source,target);
 if(source===target)return text;
 const chunks=[];
 let remaining=text.trim();
 const encoder=new TextEncoder();
 while(remaining){
  let length=Math.min(remaining.length,300);
  while(length>1 && encoder.encode(remaining.slice(0,length)).length>450)length--;
  let cut=length;
  if(remaining.length>length){
   const part=remaining.slice(0,length);
   const space=Math.max(part.lastIndexOf('. '),part.lastIndexOf(' '),part.lastIndexOf(', '));
   if(space>length/2)cut=space+1;
  }
  chunks.push(remaining.slice(0,cut).trim());remaining=remaining.slice(cut).trim();
 }
 const output=[];
 for(const part of chunks){
  const url=new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q',part);
  url.searchParams.set('langpair',LANG[source].api+'|'+LANG[target].api);
  const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),15000);
  let resp;
  try{resp=await fetch(url,{signal:ctrl.signal});}finally{clearTimeout(timeout);}
  if(!resp.ok)throw Error('Tradutor indisponível (HTTP '+resp.status+').');
  const data=await resp.json();
  if(Number(data.responseStatus)!==200 || !data.responseData || !data.responseData.translatedText)
   throw Error(data.responseDetails||'O serviço recusou a tradução.');
  const t=String(data.responseData.translatedText);
  if(/MYMEMORY WARNING|USAGE LIMIT|DAILY LIMIT/i.test(t))throw Error('Limite gratuito atingido.');
  output.push(new DOMParser().parseFromString(t,'text/html').body.textContent || t);
 }
 const translated=output.join(' ').trim();
 window.DuoUsage?.record({engine:'mymemory',ok:true});
 return translated;
}
function phrase(text){
 const original=String(text||'').trim().slice(0,400);
 if(!original)return;
 if(!connected()){notify('Conecte os dois celulares primeiro.',true);return;}
 if(state.otherHear===state.language){notify('O idioma falado e o destino no outro celular são iguais. Escolham línguas diferentes.',true);return;}
 const session=state.session;
 state.transQueue=state.transQueue.catch(()=>{}).then(async()=>{
  if(session!==state.session || !connected())return;
  status('Traduzindo...');
  try{
   const translationStart=performance.now();
   const result=await translate(original,state.language,state.otherHear);
   const translationMs=Math.round(performance.now()-translationStart);
   if(session!==state.session || !connected())return;
   if(!transmit({type:'speech',original:original,translation:result,target:state.otherHear,translationMs,provider:window.DuoReliable?.lastProvider()||(window.DuoPhrasebook?.lastHit()?'Vocabulário local':(window.DuoAI?.label()||'MyMemory'))}))
    throw Error('Não foi possível enviar a tradução.');
   bubble('mine',original,result,false,translationMs);
   window.DuoHistory?.add({mode:'duo',direction:'sent',source:state.language,target:state.otherHear,original,translation:result,translationMs,provider:window.DuoReliable?.lastProvider()||(window.DuoPhrasebook?.lastHit()?'Vocabulário local':(window.DuoAI?.label()||'MyMemory'))});
   status(state.listen?'Ouvindo...':'Tradução enviada ao outro celular.');
  }catch(e){
   if(session!==state.session)return;
   const reason=e.name==='AbortError'?'A tradução demorou demais.':String(e.message||e);
   bubble('mine',original,reason,true);notify(reason,true);
   status('Falha ao traduzir. Tente novamente.');
  }
 });
}
function startRecognition(){
 if(!state.listen || state.speaking || !connected() || state.recognizing)return;
 if(!Recognition){notify('Este navegador não reconhece voz. Use o campo de texto.',true);stopMic();return;}
 try{
  const instance=new Recognition();state.instance=instance;
  instance.lang=state.language;instance.continuous=false;
  instance.interimResults=false;instance.maxAlternatives=1;
  instance.onstart=()=>{if(state.instance===instance)state.recognizing=true;};
  instance.onspeechend=()=>{
   if(state.instance===instance && state.listen && window.DuoVoiceSettings?.fast()){
    try{instance.stop();}catch(e){}
   }
  };
  instance.onresult=e=>{
   if(state.instance!==instance || !state.listen)return;
   for(let i=e.resultIndex;i<e.results.length;i++){
    if(e.results[i].isFinal){
     const heard=String(e.results[i][0] && e.results[i][0].transcript||'').trim();
     if(heard){state.netErrors=0;phrase(heard);}
    }
   }
  };
  instance.onerror=e=>{
   if(state.instance!==instance)return;
   if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(e.error)){
    notify('Falha no microfone: '+e.error,true);stopMic();
   }else if(e.error==='network'){
    state.netErrors++;
    if(state.netErrors>=3){notify('Erro repetido de rede no reconhecimento de voz.',true);stopMic();}
   }
  };
  instance.onend=()=>{
   if(state.instance!==instance)return;
   state.recognizing=false;
   if(state.listen && !state.speaking && connected()){
    clearTimeout(state.restart);state.restart=setTimeout(startRecognition,650);
   }
  };
  releaseVoiceProfile=window.DuoAccess?window.DuoVoiceProfile?.attach(instance)||(()=>{}):()=>{};
  instance.start();status('Ouvindo... fale normalmente.');
 }catch(e){console.warn(e);notify('Não foi possível iniciar o microfone neste navegador.',true);stopMic();}
}
function speak(text,lang,done){
 if(window.DuoPremiumVoice?.enabled(lang)){
  window.DuoPremiumVoice.speak(text,lang).then(done).catch(error=>{
   if(document.body.dataset.duoContext){
    notify('ElevenLabs não reproduziu: '+String(error?.message||error)+'. Nenhuma outra voz foi utilizada.',true);done();
   }else{notify('ElevenLabs indisponível: '+String(error?.message||error)+'. Usando voz do aparelho.',true);speakLocal(text,lang,done);}
  });return;
 }
 if(document.body.dataset.duoContext&&window.DuoPremiumVoice?.configuredFor?.(lang)){
  notify('ElevenLabs selecionada, mas sem acesso ativo. Nenhuma outra voz foi usada.',true);done();return;
 }
 speakLocal(text,lang,done);
}
function speakLocal(text,lang,done){
 if(!window.speechSynthesis || !window.SpeechSynthesisUtterance){
  notify('Voz sintetizada indisponível.',true);done();return;
 }
 let finished=false;
 const end=()=>{if(finished)return;finished=true;clearTimeout(watchdog);done();};
 const utterance=new SpeechSynthesisUtterance(text);
 utterance.lang=lang;utterance.rate=window.DuoVoiceSettings?.rate() ?? 1;
 const voices=window.speechSynthesis.getVoices();
 utterance.voice=window.DuoVoiceSettings?.voice(lang) || voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase()) ||
  voices.find(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2).toLowerCase())) || null;
 utterance.onend=end;utterance.onerror=end;
 const watchdog=setTimeout(end,Math.min(45000,Math.max(7000,text.length*190)));
 try{window.speechSynthesis.speak(utterance);}catch(e){end();}
}
function playQueue(){
 if(state.speaking)return;
 const next=state.queue.shift();if(!next)return;
 state.speaking=true;haltMic();status('Reproduzindo tradução no fone...');
 speak(next.text,next.lang,()=>{
  state.speaking=false;
  if(state.queue.length)playQueue();
  else if(state.listen){status('Ouvindo... pode responder.');startRecognition();}
 });
}
function testAudio(){
 if(!window.speechSynthesis){notify('Este navegador não suporta leitura de áudio.',true);return;}
 window.speechSynthesis.cancel();state.queue.length=0;
 state.speaking=true;haltMic();
 speak(LANG[state.language].sample,state.language,()=>{
  state.speaking=false;if(state.listen)startRecognition();
 });
}
document.querySelectorAll('.language').forEach(button=>button.addEventListener('click',()=>{
 state.language=button.dataset.lang;
 document.querySelectorAll('.language').forEach(b=>{
  const yes=b===button;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));
 });
 if(state.listen)haltMic();
 transmit({type:'hello',lang:state.language,hear:state.hearLanguage});view();
 if(state.listen)startRecognition();
}));
if(el.hearSelect){
 el.hearSelect.addEventListener('change',()=>{
  const next=el.hearSelect.value;
  if(!Object.prototype.hasOwnProperty.call(LANG,next))return;
  state.hearLanguage=next;
  state.queue.length=0;
  transmit({type:'hello',lang:state.language,hear:state.hearLanguage});
  view();
 });
}
el.create.addEventListener('click',createRoom);
el.join.addEventListener('click',joinRoom);
el.retry?.addEventListener('click',retryConnection);
el.ping?.addEventListener('click',sendDiagnostic);
el.code.addEventListener('input',()=>{el.code.value=normalized(el.code.value);});
el.code.addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});
el.leave.addEventListener('click',exitRoom);
el.copy.addEventListener('click',async()=>{
 // Sharing a room does not require a paid API, a login or an invitation token.
 const roomLink=new URL('../v2.12/?room='+encodeURIComponent(state.room),location.href).href;
 try{
  if(!navigator.clipboard?.writeText)throw Error('Clipboard indisponível');
  await navigator.clipboard.writeText(roomLink);
  notify('Link da sala copiado. O teste entre aparelhos não utiliza IA ou créditos.');
 }catch(e){
  window.prompt('Copie este link para convidar a outra pessoa (sem acesso a serviços pagos):',roomLink);
 }
});
el.listen.addEventListener('click',()=>{
 if(state.listen){stopMic();return;}
 if(!connected()){notify('Conecte os dois celulares primeiro.',true);return;}
 if(state.language===state.otherHear){notify('A outra pessoa selecionou para ouvir o mesmo idioma que você fala. Ajustem a língua de destino.',true);return;}
 state.listen=true;view();startRecognition();
});
el.audio.addEventListener('click',testAudio);
el.clear.addEventListener('click',()=>{
 el.messages.replaceChildren();
 const empty=document.createElement('div');empty.className='empty-messages';
 empty.textContent='As próximas traduções aparecerão aqui.';el.messages.append(empty);
});
el.form.addEventListener('submit',e=>{
 e.preventDefault();const text=el.input.value.trim();if(!text)return;
 el.input.value='';phrase(text);
});
window.addEventListener('pagehide',()=>{
 stopMic();try{state.peer && state.peer.destroy();}catch(e){}
});
const initial=normalized(new URLSearchParams(location.search).get('room'));
if(initial.length===8)el.code.value=initial;
window.DuoConnectionStatus={get phase(){return state.connectionPhase;},
 get connected(){return connected();},get message(){return state.connectionMessage;}};
view();
})();

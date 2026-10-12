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
 messages: $('messages'), clear: $('clearBtn'), toast: $('toast')
};
const LANG = window.DuoLanguages || {};
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const state = {
 language:'pt-BR', hearLanguage:'fr-FR', other:null, otherHear:null, peer:null, conn:null, room:'', host:false,
 listen:false, recognizing:false, instance:null, speaking:false, queue:[],
 restart:null, toastTimer:null, transQueue:Promise.resolve(), session:0, netErrors:0
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
 el.connection.append(dot,document.createTextNode(ok?'Conectados':'Aguardando'));
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
function haltMic(){
 clearTimeout(state.restart);
 if(state.instance){try{state.instance.abort();}catch(e){}}
 state.recognizing=false;
}
function stopMic(){state.listen=false;haltMic();view();}
function exitRoom(){
 stopMic();state.session++;
 state.room='';state.other=null;state.otherHear=null;state.host=false;
 state.queue.length=0;state.speaking=false;
 try{window.speechSynthesis && window.speechSynthesis.cancel();}catch(e){}
 try{state.conn && state.conn.close();}catch(e){}
 try{state.peer && state.peer.destroy();}catch(e){}
 state.conn=null;state.peer=null;view();
}
function bindPeer(peer){
 state.peer=peer;
 peer.on('error',e=>{
  const type=e && e.type;
  if(type==='unavailable-id'){notify('Sala ocupada. Crie outro código.',true);exitRoom();}
  else if(type==='peer-unavailable'){notify('Sala não encontrada. Confira o código.',true);exitRoom();}
  else notify('Erro de conexão: '+(type||'tente de novo'),true);
 });
 peer.on('disconnected',()=>{
  if(state.peer===peer){notify('Reconectando ao servidor...',true);try{peer.reconnect();}catch(e){}}
 });
}
function createRoom(){
 if(!canStart())return;
 exitRoom();state.room=randomRoom();state.host=true;view();
 const peer=new window.Peer(peerId(state.room));bindPeer(peer);
 peer.on('open',()=>{if(peer===state.peer)status('Sala aberta! Compartilhe o código.');});
 peer.on('connection',conn=>{
  if(state.conn && state.conn.open){conn.on('open',()=>conn.close());return;}
  useConnection(conn);
 });
}
function joinRoom(){
 if(!canStart())return;
 const room=normalized(el.code.value);
 if(room.length!==8){notify('Digite o código completo de 8 caracteres.',true);return;}
 exitRoom();state.room=room;state.host=false;view();
 const peer=new window.Peer();bindPeer(peer);
 peer.on('open',()=>{if(state.peer===peer)useConnection(peer.connect(peerId(room),{reliable:true}));});
}
function useConnection(conn){
 if(state.conn && state.conn!==conn){try{state.conn.close();}catch(e){}}
 state.conn=conn;
 conn.on('open',()=>{
  if(state.conn!==conn)return;
  transmit({type:'hello',lang:state.language,hear:state.hearLanguage});view();notify('Celulares conectados!');
 });
 conn.on('data',data=>{
  if(!data || typeof data!=='object' || state.conn!==conn)return;
  if(data.type==='hello'){
   if(!Object.prototype.hasOwnProperty.call(LANG,data.lang))return;
   const otherHear=Object.prototype.hasOwnProperty.call(LANG,data.hear)?data.hear:data.lang; // aparelhos ainda em v1.5
   state.other=data.lang;state.otherHear=otherHear;view();
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
  state.conn=null;state.other=null;state.otherHear=null;stopMic();view();
  if(state.room)notify('O segundo celular desconectou.',true);
 });
 conn.on('error',()=>notify('Falha na comunicação entre celulares.',true));
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
   if(!transmit({type:'speech',original:original,translation:result,target:state.otherHear,translationMs,provider:window.DuoPhrasebook?.lastHit()?'Vocabulário local':(window.DuoAI?.label()||'MyMemory')}))
    throw Error('Não foi possível enviar a tradução.');
   bubble('mine',original,result,false,translationMs);
   window.DuoHistory?.add({mode:'duo',direction:'sent',source:state.language,target:state.otherHear,original,translation:result,translationMs,provider:window.DuoPhrasebook?.lastHit()?'Vocabulário local':(window.DuoAI?.label()||'MyMemory')});
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
  instance.start();status('Ouvindo... fale normalmente.');
 }catch(e){console.warn(e);notify('Não foi possível iniciar o microfone neste navegador.',true);stopMic();}
}
function speak(text,lang,done){
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
el.code.addEventListener('input',()=>{el.code.value=normalized(el.code.value);});
el.code.addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});
el.leave.addEventListener('click',exitRoom);
el.copy.addEventListener('click',async()=>{
 const invite=new URL('../v2.7/?room='+encodeURIComponent(state.room),location.href).href;
 try{await navigator.clipboard.writeText(invite);notify('Convite copiado!');}
 catch(e){notify('Compartilhe o código '+state.room);}
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
view();
})();

/* DuoTranslate 2.13 - guest direct entry. The established access client provides individual authorization. */
(() => {
'use strict';
const LANGS=[['pt-BR','🇧🇷 Português'],['fr-FR','🇫🇷 Français'],['en-US','🇬🇧 English'],['es-ES','🇪🇸 Español'],['it-IT','🇮🇹 Italiano'],['de-DE','🇩🇪 Deutsch'],['nl-NL','🇳🇱 Nederlands'],['ar-SA','🇸🇦 العربية'],['zh-CN','🇨🇳 中文'],['pl-PL','🇵🇱 Polski'],['ro-RO','🇷🇴 Română'],['uk-UA','🇺🇦 Українська'],['ru-RU','🇷🇺 Русский'],['tr-TR','🇹🇷 Türkçe']];
const params=new URLSearchParams(location.search),room=String(params.get('room')||'').toUpperCase();
const isGuest=params.get('guest')==='1'&&/^[A-HJ-NP-Z2-9]{8}$/.test(room);
const $=id=>document.getElementById(id);
let autoJoin=false,entered=false;
const nameOf=lang=>LANGS.find(x=>x[0]===lang)?.[1]||lang;
function showError(message){if($('inviteError'))$('inviteError').textContent=message;}
function create(){
 const style=document.createElement('style');style.textContent="#duoInviteCover{position:fixed;inset:0;z-index:9999;overflow-y:auto;background:#f8f7fb;padding:24px 14px 48px;display:flex;align-items:flex-start;justify-content:center;font-family:inherit}#duoInviteCover[hidden]{display:none!important}#duoInviteCard{width:min(100%,540px);box-sizing:border-box;display:grid;gap:18px;background:#fff;padding:clamp(22px,5vw,38px);border:1px solid #e8e3ef;border-radius:23px;box-shadow:0 12px 48px #17365d14;color:#17365d}.duo-invite-brand{display:flex;align-items:center;gap:12px;font-size:19px;font-weight:750}.duo-invite-logo{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#19375f,#7651a8);color:white}#duoInviteCard h1{font-size:clamp(23px,5vw,29px);margin:0;line-height:1.2}.duo-invite-source{display:flex;gap:12px;align-items:center;background:#f5f1fa;border-radius:14px;padding:15px}.duo-invite-avatar{border-radius:50%;width:42px;height:42px;display:grid;place-items:center;background:#e8dff1;flex:none}.duo-invite-source p{font-size:13px;color:#5e5872;margin:3px 0 0}.duo-invite-note{font-size:12px;line-height:1.55;color:#6d7080;margin:0}.duo-invite-field{display:grid;gap:7px}.duo-invite-field label{font-weight:650;font-size:13px}.duo-invite-field input,.duo-invite-field select{box-sizing:border-box;width:100%;min-height:46px;padding:10px 12px;border:1px solid #d8d4e3;border-radius:12px;background:#fff;font:inherit;color:#17365d}.duo-invite-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.duo-invite-submit{border:0;border-radius:12px;min-height:49px;background:#19375f;color:#fff;font:inherit;font-weight:700;cursor:pointer}.duo-invite-submit:disabled{opacity:.55;cursor:not-allowed}.duo-invite-msg{font-size:13px;line-height:1.5;margin:0;color:#7651a8}@media(max-width:420px){#duoInviteCover{padding:12px}#duoInviteCard{border-radius:18px}.duo-invite-cols{grid-template-columns:1fr}}";document.head.append(style);
 const cover=document.createElement('section');cover.id='duoInviteCover';cover.hidden=true;cover.setAttribute('aria-labelledby','inviteTitle');cover.innerHTML="<div id=\"duoInviteCard\"><div class=\"duo-invite-brand\"><span class=\"duo-invite-logo\">D</span>DuoTranslate</div><h1 id=\"inviteTitle\">Você foi convidado para conversar!</h1><div class=\"duo-invite-source\"><span class=\"duo-invite-avatar\" aria-hidden=\"true\">◉</span><div><strong id=\"inviteHost\">Anfitrião</strong> enviou este convite.<p id=\"inviteHostLang\"></p></div></div><p class=\"duo-invite-note\">Sala <strong id=\"inviteRoom\"></strong> · Entrada rápida, sem configurar todo o aplicativo</p><div class=\"duo-invite-field\"><label for=\"inviteName\">Seu nome (opcional)</label><input id=\"inviteName\" maxlength=\"40\" placeholder=\"Como podemos chamar você?\"></div><div class=\"duo-invite-cols\"><div class=\"duo-invite-field\"><label for=\"inviteSpeak\">Eu falo</label><select id=\"inviteSpeak\"></select></div><div class=\"duo-invite-field\"><label for=\"inviteHear\">Quero ouvir</label><select id=\"inviteHear\"></select></div></div><div class=\"duo-invite-field\"><label for=\"inviteVoice\">Voz da tradução</label><select id=\"inviteVoice\"><option value=\"local\">Voz do dispositivo (gratuita)</option></select></div><p id=\"inviteVoicesStatus\" class=\"duo-invite-msg\" role=\"status\" aria-live=\"polite\">Verificando vozes…</p><button id=\"inviteEnter\" class=\"duo-invite-submit\" type=\"button\">Entrar na conversa →</button><p id=\"inviteError\" class=\"duo-invite-msg\" role=\"alert\"></p><p class=\"duo-invite-note\">As vozes ElevenLabs utilizam créditos do anfitrião. O microfone será ativado apenas com sua autorização. Uma voz premium escolhida nunca será trocada silenciosamente.</p></div>";document.body.prepend(cover);
 for(const key of ['inviteSpeak','inviteHear'])for(const [code,name] of LANGS){
  const option=document.createElement('option');option.value=code;option.textContent=name;$(key).append(option);
 }
}
async function voices(){
 const select=$('inviteVoice'),message=$('inviteVoicesStatus'),prev=select.value;
 select.replaceChildren();
 const base=document.createElement('option');base.value='local';base.textContent='Voz gratuita do dispositivo';select.append(base);
 if(!window.DuoAccess?.active){
  message.textContent='Este link não concedeu acesso à ElevenLabs. Peça ao anfitrião um convite autorizado.';return;
 }
 message.textContent='Carregando vozes ElevenLabs…';
 try{
  const list=await window.DuoEleven.loadVoices();
  for(const item of list){const o=document.createElement('option');o.value='eleven:'+item.id;o.textContent='ElevenLabs · '+item.name;select.append(o);}
  if([...select.options].some(o=>o.value===prev))select.value=prev;
  message.textContent=list.length+' vozes ElevenLabs disponíveis. Escolha livremente.';
 }catch(e){message.textContent='Não foi possível carregar as vozes ElevenLabs: '+String(e.message||e).slice(0,120)+'. A voz gratuita continua disponível.';}
}
function enter(){
 if(entered)return;
 const speak=$('inviteSpeak').value,hear=$('inviteHear').value,voice=$('inviteVoice').value;
 if(speak===hear||!LANGS.some(x=>x[0]===speak)||!LANGS.some(x=>x[0]===hear)){showError('Escolha idiomas diferentes para falar e ouvir.');return;}
 if(voice.startsWith('eleven:')){
  if(!window.DuoAccess?.active){showError('Para usar ElevenLabs, peça um convite individual autorizado ao anfitrião.');return;}
  if(!window.DuoEleven?.selectVoice(hear,voice.slice(7),true)){showError('Voz ElevenLabs inválida. Escolha outra voz.');return;}
 }else{
  const cfg=window.DuoEleven?.get?.()||{};
  try{localStorage.setItem('duotranslate.premium.voice.v1',JSON.stringify({...cfg,enabled:false}));}catch(e){}
  window.DuoEleven?.sync?.();
 }
 if(typeof window.DuoGuestEnter!=='function'){showError('O aplicativo ainda está carregando. Tente novamente em alguns segundos.');return;}
 entered=true;$('inviteEnter').disabled=true;
 const name=$('inviteName').value.trim().slice(0,40)||'Convidado';
 if(window.DuoAccess?.active&&name!=='Convidado')window.DuoAccess.syncName(name).catch(()=>{});
 autoJoin=true;$('duoInviteCover').hidden=true;
 window.DuoGuestEnter({complete:true,ui:speak,name,speak,hear,voiceURI:'',updated:new Date().toISOString()});
}
function onFrameReady(doc){
 if(!doc||doc.__duoInviteAttached)return;
 doc.__duoInviteAttached=true;
 doc.addEventListener('click',async event=>{
  const button=event.target?.closest?.('#copyBtn');if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  const status=doc.getElementById('roomHelp'),code=doc.getElementById('roomCode')?.textContent||'';
  const host=window.DuoInviteHost?.()||{};
  try{
   if(!window.DuoAccess?.inviteGuest)throw new Error('Convites indisponíveis.');
   status.textContent='Criando convite com acesso individual à ElevenLabs…';
   const invitation=window.DuoAccess.inviteGuest(code,{hostName:host.name,hostSpeak:host.speak,hostHear:host.hear});
   try{
    if(window.ClipboardItem&&navigator.clipboard?.write){
     await navigator.clipboard.write([new window.ClipboardItem({
      'text/plain':invitation.then(link=>new Blob([link],{type:'text/plain'}))
     })]);
    }else await navigator.clipboard.writeText(await invitation);
    status.textContent='Convite copiado. Envie o link personalizado ao convidado.';
   }catch(e){
    const link=await invitation;
    window.prompt('Copie este link de convite:',link);
    status.textContent='Convite criado. Copie o link exibido e envie ao convidado.';
   }
  }catch(e){status.textContent='Não foi possível criar o convite: '+String(e.message||e).slice(0,180);}
 },true);
 if(autoJoin){
  autoJoin=false;
  const input=doc.getElementById('codeInput'),join=doc.getElementById('joinBtn');
  if(input&&join&&!join.disabled){input.value=room;join.click();}
  else showError('A sala ainda não carregou. Aguarde e tente entrar pelo código.');
 }
}
async function init(){
 if(!isGuest)return;
 create();$('duoInviteCover').hidden=false;
 const source=String(params.get('speaks')||'pt-BR'),target=String(params.get('hears')||'fr-FR');
 $('inviteHost').textContent=String(params.get('from')||'Anfitrião').slice(0,60);
 $('inviteHostLang').textContent='Fala '+nameOf(source)+' (informação do convite)';
 $('inviteRoom').textContent=room;
 $('inviteSpeak').value=LANGS.some(x=>x[0]===target)?target:'fr-FR';
 $('inviteHear').value=LANGS.some(x=>x[0]===source)?source:'pt-BR';
 $('inviteEnter').addEventListener('click',enter);
 await window.DuoAccess?.ready;await voices();
}
window.DuoGuestInvites={onFrameReady,get isGuest(){return isGuest;}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void init();},{once:true});
else void init();
})();

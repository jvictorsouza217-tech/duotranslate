/* DuoTranslate 1.5 — contadores locais. Não representam a franquia oficial do provedor. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const ui={day:$('usageToday'),api:$('usageGemini'),other:$('usageMyMemory'),tokens:$('usageTokens'),errors:$('usageErrors'),reset:$('usageReset'),details:$('usageStatus')};
if(!ui.day)return;
const KEY='duotranslate.usage.v1';
let days={};
try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))days=v;}catch(e){}
const date=()=>new Date().toLocaleDateString('en-CA',{timeZone:'UTC'});
function record(info){
 if(!info||typeof info!=='object')return;
 const d=date();const current=days[d]||{gemini:0,mymemory:0,failures:0,inputTokens:0,outputTokens:0,analysis:0};
 if(info.engine==='gemini'){
  current.gemini++;
  if(info.action==='analysis')current.analysis++;
  if(info.usage){
   current.inputTokens+=Math.max(0,Number(info.usage.inputTokens)||0);
   current.outputTokens+=Math.max(0,Number(info.usage.outputTokens)||0);
  }
 }else if(info.engine==='mymemory')current.mymemory++;
 if(info.ok===false)current.failures++;
 days[d]=current;
 const keys=Object.keys(days).sort();
 while(keys.length>30)delete days[keys.shift()];
 try{localStorage.setItem(KEY,JSON.stringify(days));}catch(e){ui.details.textContent='O navegador bloqueou o armazenamento dos contadores.';}
 render();
}
function render(){
 const today=days[date()]||{gemini:0,mymemory:0,failures:0,inputTokens:0,outputTokens:0,analysis:0};
 ui.day.textContent='Hoje, UTC · '+date();
 ui.api.textContent=String(today.gemini||0);
 ui.other.textContent=String(today.mymemory||0);
 ui.tokens.textContent=Number(today.inputTokens||0).toLocaleString('pt-BR')+' / '+Number(today.outputTokens||0).toLocaleString('pt-BR');
 ui.errors.textContent=String(today.failures||0);
}
ui.reset.addEventListener('click',()=>{
 if(!window.confirm('Zerar apenas os contadores locais deste navegador? Isso não reinicia a cota do Gemini ou da Cloudflare.'))return;
 days={};try{localStorage.removeItem(KEY);}catch(e){}render();
 ui.details.textContent='Contador local zerado. A cota real dos provedores não foi alterada.';
});
window.DuoUsage={record,render};
render();
})();
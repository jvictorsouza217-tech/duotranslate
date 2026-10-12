/* DuoTranslate 1.4: histórico LOCAL, exportação e revisão sob demanda.
   Não armazena áudio, senha de acesso, chave da API nem sincroniza registros. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const ui={
 enabled:$('historyEnabled'),filter:$('historyFilter'),count:$('historyCount'),
 list:$('historyEntries'),status:$('historyStatus'),csv:$('exportCsv'),
 json:$('exportJson'),clear:$('eraseHistory')
};
if(!ui.list)return;
const DATA_KEY='duotranslate.local.history.v1';
const PREF_KEY='duotranslate.history.enabled.v1';
const MAX=250;
let records=[],enabled=true,storageOk=true;
try{
 const raw=JSON.parse(localStorage.getItem(DATA_KEY)||'[]');
 if(Array.isArray(raw))records=raw.filter(x=>x&&typeof x==='object'&&typeof x.original==='string'&&typeof x.translation==='string').slice(0,MAX);
 enabled=localStorage.getItem(PREF_KEY)!=='false';
}catch(e){storageOk=false;}
const busy=new Set();
const datefmt=timestamp=>{
 try{return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(timestamp));}
 catch(e){return 'Data desconhecida';}
};
const lang=x=>x==='fr-FR'?'Francês':'Português';
const type=x=>x==='duo'?'Conversa em dupla':'Teste individual';
function info(message,error=false){
 ui.status.textContent=message;ui.status.classList.toggle('history-error',error);
}
function persist(){
 try{localStorage.setItem(DATA_KEY,JSON.stringify(records));storageOk=true;return true;}
 catch(e){storageOk=false;info('Sem espaço ou permissão para salvar neste navegador. Exporte os dados antes de fechar.',true);return false;}
}
function savePref(){try{localStorage.setItem(PREF_KEY,String(enabled));}catch(e){}}
function item(node,text,tag='span',cls=''){
 const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;node.append(el);return el;
}
function button(node,text,act,id){
 const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.action=act;b.dataset.id=id;
 b.disabled=busy.has(id);b.className='history-action';node.append(b);return b;
}
function render(){
 ui.enabled.checked=enabled;
 ui.count.textContent=records.length+' registro'+(records.length===1?'':'s')+' neste navegador';
 const filtered=records.filter(x=>ui.filter.value==='all'||x.mode===ui.filter.value);
 ui.list.replaceChildren();
 if(!filtered.length){item(ui.list,'Nenhuma tradução salva nesta seleção. O histórico começa a registrar novas traduções a partir de agora.','div','history-empty');return;}
 for(const r of filtered.slice(0,65)){
  const card=document.createElement('article');card.className='history-entry';
  const head=document.createElement('div');head.className='history-entry-head';
  item(head,datefmt(r.at)+' · '+type(r.mode),'span');
  item(head,(r.source==='fr-FR'?'FR → PT':'PT → FR')+' · '+(r.provider||'Tradutor'), 'span','history-tag');
  card.append(head);
  item(card,'ORIGINAL','small','history-label');
  item(card,r.original,'p','history-original');
  item(card,'TRADUÇÃO','small','history-label');
  item(card,r.translation,'p','history-translation');
  const ms=Number(r.translationMs);
  item(card,(Number.isFinite(ms)&&ms>=0?'Tradutor: '+(ms/1000).toFixed(2)+' s · ':'')+'Somente tempo de processamento da tradução','small','history-metric');
  if(r.comparison){
   const c=document.createElement('div');c.className='history-comparison';
   item(c,'COMPARAÇÃO — Gemini × MyMemory','small','history-label');
   for(const [key,name] of [['gemini','Gemini'],['mymemory','MyMemory']]){
    const v=r.comparison[key];
    item(c,name+': '+(v?.text||'Indisponível')+(Number.isFinite(v?.ms)?' ('+(v.ms/1000).toFixed(2)+' s)':''),'p');
   }
   card.append(c);
  }
  if(r.analysis){
   const a=document.createElement('div');a.className='history-analysis';
   item(a,'AVALIAÇÃO DA IA · ORIENTATIVA','small','history-label');
   item(a,r.analysis.text,'p');
   card.append(a);
  }
  const actions=document.createElement('div');actions.className='history-actions';
  button(actions,'Comparar tradutores','compare',r.id);
  button(actions,'Analisar qualidade com IA','analyze',r.id);
  button(actions,'Excluir','delete',r.id);
  card.append(actions);
  const state=document.createElement('p');state.className='history-row-status';state.id='history-status-'+r.id;
  if(busy.has(r.id))state.textContent='Processando solicitação...';
  card.append(state);
  ui.list.append(card);
 }
 if(filtered.length>65)item(ui.list,'Mostrando os 65 registros mais recentes. A exportação inclui todos os '+records.length+' registros.','p','history-extra');
}
function add(entry){
 if(!enabled)return;
 const original=String(entry?.original||'').trim().slice(0,650);
 const translation=String(entry?.translation||'').trim().slice(0,1000);
 if(!original||!translation)return;
 const record={
  id:(window.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),
  at:new Date().toISOString(),
  mode:entry.mode==='duo'?'duo':'solo',
  direction:entry.direction==='received'?'received':'sent',
  source:entry.source==='fr-FR'?'fr-FR':'pt-BR',
  target:entry.target==='fr-FR'?'fr-FR':'pt-BR',
  original,translation,
  provider:String(entry.provider||'MyMemory').slice(0,45),
  translationMs:Number.isFinite(Number(entry.translationMs))?Math.max(0,Number(entry.translationMs)):null
 };
 records.unshift(record);
 if(records.length>MAX)records.length=MAX;
 persist();render();
}
function safeName(){return 'duotranslate-historico-'+new Date().toISOString().slice(0,10);}
function download(content,type,name){
 const blob=new Blob([content],{type});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function quote(value){return '"'+String(value??'').replaceAll('"','""')+'"';}
function exportCsv(){
 if(!records.length){info('Ainda não há registros para exportar.',true);return;}
 const cols=['at','mode','direction','source','target','original','translation','provider','translationMs','gemini','geminiMs','mymemory','mymemoryMs','qualityAnalysis'];
 const values=records.map(r=>[
 r.at,r.mode,r.direction,r.source,r.target,r.original,r.translation,r.provider,r.translationMs,
 r.comparison?.gemini?.text||'',r.comparison?.gemini?.ms??'',
 r.comparison?.mymemory?.text||'',r.comparison?.mymemory?.ms??'',
 r.analysis?.text||''
 ]);
 download('\uFEFF'+[cols.map(quote).join(','),...values.map(row=>row.map(quote).join(','))].join('\r\n'),'text/csv;charset=utf-8',safeName()+'.csv');
 info('CSV criado com '+records.length+' registros. Ele contém suas frases completas: compartilhe apenas se desejar.');
}
function exportJson(){
 if(!records.length){info('Ainda não há registros para exportar.',true);return;}
 download(JSON.stringify({app:'DuoTranslate',version:'1.4',exportedAt:new Date().toISOString(),records},null,2),'application/json;charset=utf-8',safeName()+'.json');
 info('JSON criado com '+records.length+' registros, incluindo comparações e análises.');
}
async function memoryTranslate(text,source,target){
 const url=new URL('https://api.mymemory.translated.net/get');
 url.searchParams.set('q',text.slice(0,350));
 url.searchParams.set('langpair',(source==='fr-FR'?'fr':'pt')+'|'+(target==='fr-FR'?'fr':'pt'));
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
 let resp;
 try{resp=await fetch(url,{signal:ctrl.signal,cache:'no-store'});}finally{clearTimeout(timer);}
 if(!resp.ok)throw Error('MyMemory HTTP '+resp.status);
 const data=await resp.json();
 if(Number(data.responseStatus)!==200||!data.responseData?.translatedText)throw Error(String(data.responseDetails||'MyMemory sem resposta.'));
 const str=String(data.responseData.translatedText);
 if(/MYMEMORY WARNING|USAGE LIMIT|DAILY LIMIT/i.test(str))throw Error('Limite gratuito do MyMemory atingido.');
 return new DOMParser().parseFromString(str,'text/html').body.textContent.trim();
}
function rowStatus(id,txt,error=false){
 const node=document.getElementById('history-status-'+id);
 if(node){node.textContent=txt;node.classList.toggle('history-error',error);}
}
async function compare(r){
 if(!window.DuoAI?.translate){rowStatus(r.id,'Gemini ainda não disponível.',true);return;}
 busy.add(r.id);render();
 rowStatus(r.id,'Comparando os dois motores de tradução...');
 const comparison={at:new Date().toISOString(),gemini:null,mymemory:null};
 const works=[
  ['gemini',()=>window.DuoAI.translate(r.original,r.source,r.target)],
  ['mymemory',()=>memoryTranslate(r.original,r.source,r.target)]
 ];
 // Reaproveita o texto original do motor já utilizado, evitando consumir outra chamada gratuita.
 if((r.provider||'').toLowerCase().includes('gemini'))comparison.gemini={text:r.translation,ms:r.translationMs};
 if((r.provider||'').toLowerCase().includes('mymemory'))comparison.mymemory={text:r.translation,ms:r.translationMs};
 let error='';
 for(const [engine,fn] of works){
  if(comparison[engine])continue;
  const start=performance.now();
  try{comparison[engine]={text:await fn(),ms:Math.round(performance.now()-start)};}
  catch(e){error+=(engine==='gemini'?'Gemini':'MyMemory')+': '+String(e.message||e)+'; ';}
 }
 r.comparison=comparison;
 persist();busy.delete(r.id);render();
 rowStatus(r.id,error?'Comparação parcial. '+error:'Comparação concluída. Veja as versões acima.',!!error);
}
async function analyze(r){
 if(!window.DuoAI?.analyze){rowStatus(r.id,'Atualize a página para habilitar a análise por IA.',true);return;}
 busy.add(r.id);render();rowStatus(r.id,'Gemini avaliando fidelidade e naturalidade...');
 try{
  const start=performance.now();
  const content=await window.DuoAI.analyze(r.original,r.translation,r.source,r.target);
  r.analysis={text:String(content).slice(0,2400),at:new Date().toISOString(),ms:Math.round(performance.now()-start)};
  persist();busy.delete(r.id);render();rowStatus(r.id,'Análise concluída. A nota é estimativa da IA; não verifica o áudio original.');
 }catch(e){busy.delete(r.id);render();rowStatus(r.id,'Não foi possível analisar: '+String(e.message||e),true);}
}
ui.enabled.addEventListener('change',()=>{enabled=ui.enabled.checked;savePref();info(enabled?'Histórico local ativado.':'Histórico pausado; seus registros existentes permanecem salvos.');});
ui.filter.addEventListener('change',render);
ui.csv.addEventListener('click',exportCsv);
ui.json.addEventListener('click',exportJson);
ui.clear.addEventListener('click',()=>{
 if(!records.length)return;
 if(!window.confirm('Excluir permanentemente todos os registros deste navegador? Esta ação não pode ser desfeita.'))return;
 records=[];persist();render();info('Histórico deste navegador excluído.');
});
ui.list.addEventListener('click',e=>{
 const b=e.target.closest('button[data-action]');if(!b)return;
 const r=records.find(x=>x.id===b.dataset.id);if(!r||busy.has(r.id))return;
 if(b.dataset.action==='delete'){
  records=records.filter(x=>x.id!==r.id);persist();render();info('Registro excluído.');
 }else if(b.dataset.action==='compare')compare(r);
 else if(b.dataset.action==='analyze')analyze(r);
});
window.DuoHistory={add,count:()=>records.length};
render();
if(!storageOk)info('O navegador bloqueou o armazenamento local. Seus testes podem não permanecer após fechar a página.',true);
else info('Os registros ficam somente neste navegador e não são sincronizados pelo aplicativo. Evite salvar conversas sensíveis.');
})();
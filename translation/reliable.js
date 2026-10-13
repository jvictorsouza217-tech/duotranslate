/* DuoTranslate 2.10: shared resilient translation for the preview only.
 * Never exposes provider keys, never replays provider calls indefinitely.
 * Existing MyMemory service remains the no-key fallback with its own public limits. */
(() => {
 'use strict';
 const languageCodes={'pt-BR':'pt','fr-FR':'fr','en-US':'en','es-ES':'es','it-IT':'it','de-DE':'de','ar-SA':'ar','zh-CN':'zh-CN','nl-NL':'nl','pl-PL':'pl','ro-RO':'ro','uk-UA':'uk','ru-RU':'ru','tr-TR':'tr'};
 let failedUntil=0,lastProvider='';const GEMINI_COOLDOWN=120000;
 function normError(e){return String(e?.message||e||'Falha desconhecida').slice(0,180);}
 function preferGemini(){
  if(!window.DuoAccess?.active)return false;
  try{const provider=JSON.parse(localStorage.getItem('duotranslate.provider.v1')||'{}');return provider.provider!=='mymemory';}catch{return true;}
 }
 async function gemini(text,source,target){
  const url=window.DuoAccess?.aiUrl;
  if(!url||!window.DuoAccess.active)throw Error('Acesso ao Gemini indisponível.');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),9500);
  try{
   const r=await window.DuoAccess.fetch(url+'/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,source,target}),signal:abort.signal,cache:'no-store'});
   const body=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(body.error||'Gemini HTTP '+r.status);
   if(!String(body.translation||'').trim())throw Error('Gemini não retornou uma tradução.');
   return String(body.translation).trim();
  }finally{clearTimeout(timer);}
 }
 function chunks(text){
  const out=[];let remain=text;
  while(remain.length){let n=Math.min(remain.length,280);while(n>1&&new TextEncoder().encode(remain.slice(0,n)).length>450)n--;const space=remain.lastIndexOf(' ',n);if(remain.length>n&&space>n/2)n=space;out.push(remain.slice(0,n).trim());remain=remain.slice(n).trim();}
  return out.filter(Boolean);
 }
 async function memory(text,source,target){
  if(!languageCodes[source]||!languageCodes[target])throw Error('Idioma não disponível.');
  const output=[];
  for(const part of chunks(text)){
   const url=new URL('https://api.mymemory.translated.net/get');
   url.searchParams.set('q',part);url.searchParams.set('langpair',languageCodes[source]+'|'+languageCodes[target]);
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
   try{
    const response=await fetch(url.href,{signal:abort.signal});
    if(!response.ok)throw Error('MyMemory HTTP '+response.status);
    const value=await response.json();
    const translated=String(value?.responseData?.translatedText||'');
    if(Number(value.responseStatus)!==200||!translated||/MYMEMORY WARNING|USAGE LIMIT|DAILY LIMIT|QUERY LENGTH LIMIT/i.test(translated))throw Error(value?.responseDetails||'Limite ou erro do MyMemory.');
    output.push(typeof DOMParser==='function'?(new DOMParser().parseFromString(translated,'text/html').body.textContent||translated):translated);
   }finally{clearTimeout(timer);}
  }
  return output.join(' ').trim();
 }
 async function translate(original,source,target){
  const text=String(original||'').trim().slice(0,600);
  if(!text||!languageCodes[source]||!languageCodes[target])throw Error('Texto ou idioma inválido.');
  if(source===target)return {text,provider:'Sem tradução'};
  const local=window.DuoPhrasebook?.translate(text,source,target);
  if(local!==null&&local!==undefined){lastProvider='Vocabulário local';return {text:local,provider:lastProvider};}
  let reason='';
  if(preferGemini()&&Date.now()>=failedUntil){
   try{const result=await gemini(text,source,target);lastProvider='Gemini';return {text:result,provider:lastProvider};}
   catch(e){reason=normError(e);failedUntil=Date.now()+GEMINI_COOLDOWN;}
  }
  try{const result=await memory(text,source,target);lastProvider=reason?'MyMemory (reserva)':'MyMemory';return {text:result,provider:lastProvider,geminiError:reason};}
  catch(e){throw Error('Gemini indisponível'+(reason?' ('+reason+')':'')+'; MyMemory indisponível ('+normError(e)+').');}
 }
 window.DuoReliable={translate,memory,gemini,lastProvider:()=>lastProvider,geminiCoolingDown:()=>Date.now()<failedUntil};
})();
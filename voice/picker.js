(() => {
'use strict';
const mounts=new WeakMap();let audio=null;
function stop(){if(audio){audio.pause();audio.src='';audio=null;}}
function mount(select,lang,help,preview){
 let view=mounts.get(select);
 if(!view){
  const root=document.createElement('div'),search=document.createElement('input'),list=document.createElement('div'),more=document.createElement('button');
  root.className='duo-voice-picker';search.className='int-select';search.type='search';search.placeholder='Buscar voz';search.setAttribute('aria-label','Buscar voz ElevenLabs');more.type='button';more.className='int-ghost';more.textContent='Mostrar mais vozes';
  root.append(search,list,more);select.after(root);select.hidden=true;select.style.display='none';
  view={root,search,list,more,limit:6};mounts.set(select,view);
  search.oninput=()=>{view.limit=6;draw(view);};more.onclick=()=>{view.limit+=6;draw(view);};
 }
 Object.assign(view,{select,lang,help,preview});draw(view);
}
function draw(v){
 const data=window.DuoEleven.choices(v.lang),query=v.search.value.trim().toLocaleLowerCase();
 const filtered=data.voices.filter(x=>x.name.toLocaleLowerCase().includes(query));
 filtered.sort((a,b)=>(b.id===data.selected)-(a.id===data.selected));v.list.replaceChildren();
 for(const voice of filtered.slice(0,v.limit)){
  const button=document.createElement('button');button.type='button';button.className='int-ghost';button.style.cssText='display:block;width:100%;margin:6px 0;text-align:start';button.textContent=(voice.id===data.selected?'✓ ':'')+voice.name+'  ▶';button.setAttribute('aria-pressed',String(voice.id===data.selected));button.setAttribute('aria-label',voice.name+': selecionar e ouvir no idioma escolhido (usa créditos)');
  button.onclick=()=>{stop();window.DuoEleven.selectVoice(v.lang,voice.id);v.select.value=voice.id;v.select.dispatchEvent(new Event('change',{bubbles:true}));draw(v);v.help.textContent='Voz salva. Reproduzindo amostra…';
   // The provider's saved preview may be in English. Always synthesize a fresh
   // sample in the currently selected translation language (ElevenLabs credits).
   if(typeof v.preview==='function')v.preview();
   else v.help.textContent='Voz salva. Abra o teste para ouvir no idioma escolhido.';
  };v.list.append(button);
 }
 if(!filtered.length){const empty=document.createElement('p');empty.textContent=data.voices.length?'Nenhuma voz encontrada.':'Toque em Trocar voz para carregar as vozes disponíveis.';v.list.append(empty);}
 v.more.hidden=filtered.length<=v.limit;
}
window.addEventListener('pagehide',stop);window.DuoVoicePicker={mount,stop};
})();

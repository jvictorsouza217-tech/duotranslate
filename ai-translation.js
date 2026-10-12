/* DuoTranslate 1.3 — tradução por IA opcional, sem expor chaves da API.
   API Gemini é acessada SOMENTE através de Cloudflare Worker do usuário.
   MyMemory continua como opção padrão se o Worker não tiver sido configurado. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const ui={provider:$('translationProvider'),url:$('aiWorkerUrl'),pin:$('aiWorkerPin'),
 test:$('aiTestBtn'),status:$('aiSetupStatus'),panel:$('aiSetupFields')};
if(!ui.provider)return;
const CONFIG_KEY='duotranslate.provider.v1';
const PIN_KEY='duotranslate.pin.session.v1';
let settings={provider:'mymemory',url:''};
try{
 const obj=JSON.parse(localStorage.getItem(CONFIG_KEY)||'null');
 if(obj&&typeof obj==='object'){
  settings.provider=obj.provider==='gemini'?'gemini':'mymemory';
  if(typeof obj.url==='string')settings.url=obj.url.slice(0,250);
 }
}catch(e){}
const pin=(()=>{try{return sessionStorage.getItem(PIN_KEY)||'';}catch(e){return '';}})();
ui.provider.value=settings.provider;ui.url.value=settings.url;ui.pin.value=pin;
function status(s,error=false){ui.status.textContent=s;ui.status.classList.toggle('ai-error',error);}
function save(){
 settings.provider=ui.provider.value==='gemini'?'gemini':'mymemory';
 settings.url=ui.url.value.trim().replace(/\/+$/,'');
 try{localStorage.setItem(CONFIG_KEY,JSON.stringify(settings));}catch(e){}
 try{sessionStorage.setItem(PIN_KEY,ui.pin.value);}catch(e){}
 update();
}
function update(){
 const active=settings.provider==='gemini';
 ui.panel.classList.toggle('hidden',!active);
 if(!active){status('O tradutor tradicional continua ativo. Nenhuma chave de IA é necessária.');return;}
 if(!settings.url||!ui.pin.value.trim()){status('Para ativar a IA, configure o endereço HTTPS do Worker e seu código de acesso.');return;}
 status('IA selecionada. Toque em Testar IA para verificar a conexão e a tradução.');
}
function getEndpoint(){
 const raw=ui.url.value.trim().replace(/\/+$/,'');
 let u;
 try{u=new URL(raw);}catch(e){throw Error('Endereço do Worker inválido. Use o link HTTPS completo.');}
 if(u.protocol!=='https:' || u.username || u.password || u.search || u.hash)
  throw Error('Endereço do Worker inválido. Use somente o link HTTPS, sem chave ou parâmetros.');
 return u.href.replace(/\/+$/,'')+'/translate';
}
async function translate(text,source,target){
 const url=getEndpoint();
 const access=ui.pin.value.trim();
 if(!access)throw Error('Informe o código de acesso configurado no Cloudflare.');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),20000);
 let response;
 try{
  response=await (window.DuoAccess?.fetch || fetch)(url,{
   method:'POST',
   mode:'cors',
   headers:{'Content-Type':'application/json','X-Duo-Pin':access},
   body:JSON.stringify({text:String(text).slice(0,600),source,target}),
   signal:controller.signal,
   cache:'no-store'
  });
 }catch(e){
  if(e.name==='AbortError')throw Error('IA demorou mais de 20 segundos. Volte ao MyMemory se precisar.');
  throw Error('Não foi possível conectar ao Worker. Confira a URL, publicação e internet.');
 }finally{clearTimeout(timeout);}
 let data;
 try{data=await response.json();}catch(e){throw Error('Resposta inválida do Worker; confira a publicação.');}
 if(!response.ok){window.DuoUsage?.record({engine:'gemini',action:'translation',ok:false});throw Error(typeof data?.error==='string'?data.error:'Falha do tradutor IA (HTTP '+response.status+').');}
 const result=String(data?.translation||'').trim();
 if(!result)throw Error('A IA não devolveu uma tradução.');
 window.DuoUsage?.record({engine:'gemini',action:'translation',ok:true,usage:data?.usage});
 return result.slice(0,900);
}

async function analyze(original,translation,source,target){
 const base=getEndpoint();
 const access=ui.pin.value.trim();
 if(!access)throw Error('Digite o código de acesso Cloudflare na seção Gemini, acima.');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),20000);
 let response;
 try{
  response=await (window.DuoAccess?.fetch || fetch)(base.replace(/\/translate$/,'/analyze'),{
   method:'POST',
   mode:'cors',
   headers:{'Content-Type':'application/json','X-Duo-Pin':access},
   body:JSON.stringify({original:String(original).slice(0,650),translation:String(translation).slice(0,1000),source,target}),
   signal:controller.signal,
   cache:'no-store'
  });
 }catch(e){
  if(e.name==='AbortError')throw Error('A análise demorou demais. Tente mais tarde.');
  throw Error('Falha de rede. Verifique o endereço do Worker e a internet.');
 }finally{clearTimeout(timeout);}
 let data;
 try{data=await response.json();}catch(e){throw Error('Resposta inválida do servidor de análise.');}
 if(!response.ok){window.DuoUsage?.record({engine:'gemini',action:'analysis',ok:false});throw Error(String(data?.error||'Análise indisponível (HTTP '+response.status+').'));}
 const answer=String(data?.analysis||'').trim();
 if(!answer)throw Error('A IA não retornou uma avaliação.');
 window.DuoUsage?.record({engine:'gemini',action:'analysis',ok:true,usage:data?.usage});
 return answer;
}
ui.provider.addEventListener('change',save);
ui.url.addEventListener('change',save);
ui.pin.addEventListener('change',save);
ui.url.addEventListener('input',()=>{settings.url=ui.url.value.trim();});
ui.test.addEventListener('click',async()=>{
 save();
 if(!settings.url||!ui.pin.value.trim()){status('Preencha URL do Worker e código de acesso.',true);return;}
 ui.test.disabled=true;
 status('Testando uma frase com Gemini... aguarde.');
 const start=performance.now();
 try{
  const output=await translate('Bonjour, je suis ravi de faire votre connaissance.','fr-FR','pt-BR');
  status('✅ Gemini respondeu em '+((performance.now()-start)/1000).toFixed(2)+' s: '+output);
 }catch(e){status('Falha: '+e.message,true);}
 finally{ui.test.disabled=false;}
});
window.DuoAI={
 enabled:()=>ui.provider.value==='gemini',
 translate,analyze,
 label:()=>ui.provider.value==='gemini'?'Gemini (IA)':'MyMemory'
};
update();
})();
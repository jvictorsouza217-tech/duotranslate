import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const history=await readFile(new URL('../voice/conversation-history-v220.js',import.meta.url),'utf8');
const voice=await readFile(new URL('../voice/connected-v220.js',import.meta.url),'utf8');
const preview=await readFile(new URL('../preview/v2.20/index.html',import.meta.url),'utf8');
const before=await readFile(new URL('../preview/v2.19/index.html',import.meta.url),'utf8');
const access=await readFile(new URL('../access/client-v2.20.js',import.meta.url),'utf8');

function fakeStorage(){
 const map=new Map();return {getItem:k=>map.get(k)??null,
  setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
}
function journalHarness(){
 const data=new Map();let database;
 const databaseFactory={
  open(){
   const req={result:null,error:null};
   queueMicrotask(()=>{
    database={
     objectStoreNames:{contains:()=>false},createObjectStore:()=>{},
     transaction(){
      const tx={error:null,oncomplete:null,onerror:null,onabort:null};
      tx.objectStore=()=>({
       put(item){data.set(item.id,item);queueMicrotask(()=>tx.oncomplete?.());},
       getAll(){const get={result:[],error:null,onsuccess:null,onerror:null};
        queueMicrotask(()=>{get.result=[...data.values()];get.onsuccess?.();});return get;}
      });
      return tx;
     }
    };
    req.result=database;req.onupgradeneeded?.();req.onsuccess?.();
   });
   return req;
  }
 };
 const localStorage=fakeStorage(),clicked=[];
 const doc={body:{append(){},},createElement:()=>({click(){clicked.push(this.download);},remove(){}})};
 const window={indexedDB:databaseFactory,crypto:globalThis.crypto};
 const URLstub={createObjectURL:()=> 'blob:test',revokeObjectURL(){}};
 vm.runInNewContext(history,{window,localStorage,document:doc,URL:URLstub,Blob,
  Date,setTimeout,clearTimeout,Uint8Array,Promise});
 return {api:window.DuoVoiceHistory220,clicked,localStorage,data};
}
function createBrowser(){
 const events=[],translated=[],status={textContent:''},caption={textContent:''},voiceStatus={textContent:''};
 const selected={value:'local',disabled:false};
 const controls={duo217Status:status,duo217Caption:caption,duo217VoiceState:voiceStatus,
  duo217HistoryState:{textContent:''},duo217Voice:selected,duo217Preview:{disabled:false},
  duo217Pause:{textContent:''},duo217Hear:{value:'pt-BR',parentElement:{hidden:true}},
  duo217Messages:{children:[],scrollHeight:12,append(x){this.children.push(x);},get firstElementChild(){return this.children[0];}}
 };
 const document={readyState:'loading',getElementById:id=>controls[id]||null,addEventListener(){},
  createElement:tag=>({tagName:tag,textContent:'',className:'',children:[],append(...x){this.children.push(...x);}})};
 let rec;
 const window={addEventListener(){},DuoVoiceHistory220:{add:async value=>{events.push(value);return {saved:true}}},
  SpeechRecognition:class {constructor(){rec=this;}start(){this.onstart?.();}abort(){this.onend?.();}},
  DuoReliable:{translate:async(original,from,to)=>{translated.push({original,from,to});return {text:'bonjour',provider:'Gemini'};}},
  DuoAccess:{active:true,voiceUrl:'https://voice.example.com'},
  speechSynthesis:{speak(u){queueMicrotask(()=>u.onend());},getVoices:()=>[],cancel(){}},
  SpeechSynthesisUtterance:class {constructor(text){this.text=text;}}
 };
 const fakeEnv={window,document,location:{search:'',origin:'https://example.test'},
  navigator:{language:'pt-BR'},localStorage:fakeStorage(),crypto:globalThis.crypto,
  URL,URLSearchParams,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,
  WebSocket:{OPEN:1},Date,Audio:class{constructor(uri){this.uri=uri;}play(){queueMicrotask(()=>this.onended?.());return Promise.resolve();}}};
 const instrument=voice.replace('window.DuoConnected217={openHost,stop:close,',
  'window.__test={listen,previewVoice,rejectSpeech,rememberOutput,setState(x){s=x;},getState(){return s;}};window.DuoConnected217={openHost,stop:close,');
 assert.match(instrument,/window\.__test=\{listen,previewVoice/);
 vm.runInNewContext(instrument,fakeEnv);
 return {api:window.__test,window,events,translated,controls,getRecognizer:()=>rec};
}
function session(){
 return {ticket:'f'.repeat(32),name:'João',role:'host',speak:'pt-BR',hear:'pt-BR',peer:{speaks:'fr-FR',name:'Jérôme'},
  paired:true,permission:true,paused:false,playing:false,previewing:false,rec:null,
  recentSpeech:[],outputs:[],outputMuteUntil:0,lastLoudAt:Date.now(),
  active:true,utterances:[],translating:false,pending:0,voice:'local',
  playlist:[],restart:null};
}
test('v2.20 browser and access modules parse; previous application CSS and modes unchanged',()=>{
 assert.doesNotThrow(()=>new vm.Script(voice));
 assert.doesNotThrow(()=>new vm.Script(history));
 assert.doesNotThrow(()=>new vm.Script(access));
 const css=html=>(html.match(/<style[\s\S]*?<\/style>/g)||[]).join('\n');
 assert.equal(css(preview),css(before));
 assert.match(preview,/conversation-history-v220\.js/);
 assert.match(preview,/connected-v220\.js/);
 for(const mode of ['voice/continuous.js','voice/listening-v214.js','voice/free-lab.js'])assert.ok(preview.includes(mode));
});
test('conversation history stores recognized, translated and failure details in IndexedDB and existing History',async()=>{
 const h=journalHarness();
 await h.api.add({session:'f'.repeat(8),speaker:'João',stage:'recognized',direction:'sent',original:'bom dia',source:'pt-BR'});
 await h.api.add({session:'f'.repeat(8),speaker:'João',stage:'translated',direction:'sent',original:'bom dia',translation:'bonjour',target:'fr-FR'});
 const events=await h.api.all();
 assert.equal(events.length,2);
 assert.equal(events[1].translation,'bonjour');
 assert.equal(JSON.parse(h.localStorage.getItem('duotranslate.local.history.v1')).length,2);
 assert.equal(await h.api.download('json'),2);
 assert.equal(await h.api.download('csv'),2);
 assert.equal(h.clicked.length,2);
});
test('History preference false prevents recording, with no private content leaked to local DB',async()=>{
 const h=journalHarness();
 h.localStorage.setItem('duotranslate.history.enabled.v1','false');
 const result=await h.api.add({original:'private words'});
 assert.equal(result.disabled,true);
 assert.equal(h.data.size,0);
});
test('recognized text from own synthesized audio is rejected and logged without translation',async()=>{
 const h=createBrowser(),s=session();h.api.setState(s);
 h.api.rememberOutput(s,'Meu Deus, você é lindo');
 h.api.listen();
 const r=h.getRecognizer();
 assert.ok(r,'Recognition should start');
 r.onresult({resultIndex:0,results:[Object.assign([{transcript:'Meu Deus, você é lindo',confidence:.95}],{isFinal:true})]});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(h.translated.length,0);
 assert.ok(h.events.some(x=>x.stage==='rejected'&&/eco/.test(x.error)));
});
test('recognizer ignores a delayed final result while speech output is muted',async()=>{
 const h=createBrowser(),s=session();h.api.setState(s);h.api.listen();
 s.outputMuteUntil=Date.now()+10000;
 h.getRecognizer().onresult({resultIndex:0,results:[Object.assign([{transcript:'hello again',confidence:.9}],{isFinal:true})]});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(h.translated.length,0);
 assert.ok(h.events.some(x=>x.stage==='rejected'));
});
test('legitimate speech still translates and creates a send record',async()=>{
 const h=createBrowser(),s=session();h.api.setState(s);h.api.listen();
 h.getRecognizer().onresult({resultIndex:0,results:[Object.assign([{transcript:'bom dia',confidence:.9}],{isFinal:true})]});
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(h.translated.length,1);
 assert.equal(h.translated[0].to,'fr-FR');
 assert.ok(h.events.some(x=>x.stage==='translated'&&x.translation==='bonjour'));
});
test('voice preview UI is present and is activated explicitly by user click',()=>{
 assert.match(voice,/id="duo217Preview"/);
 assert.match(voice,/duo217Preview'\)\.onclick/);
 assert.match(voice,/currentSession\.voicePreviews\[item\.id\]=item\.preview/);
 assert.match(voice,/await premiumSpeech\(example\.slice\(0,120\),voice\)/);
 assert.match(voice,/voiceOverride\|\|session\.voice/);
 assert.match(voice,/await window\.DuoVoiceHistory220\.download\(format\)/);
});
test('acoustic calibration is used only as a noise threshold, not as claimed speaker identification',()=>{
 assert.match(voice,/window\.DuoVoiceProfile\?\.current\?\.\(\)/);
 assert.match(voice,/Não identifica pessoas por voz/);
 assert.match(voice,/createMediaStreamSource\(media\)/);
 assert.match(voice,/session\.micStream\?\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
});

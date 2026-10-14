import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../voice/connected-v218.js',import.meta.url),'utf8');
const latest=await readFile(new URL('../preview/v2.18/index.html',import.meta.url),'utf8');
const previous=await readFile(new URL('../preview/v2.17/index.html',import.meta.url),'utf8');
const access=await readFile(new URL('../access/client-v2.18.js',import.meta.url),'utf8');

function harness(){
 const messages=[],status={textContent:''},caption={textContent:''},pause={textContent:''};
 const transcript={children:[],scrollHeight:20,append(value){this.children.push(value);},get firstElementChild(){return this.children[0]||null;}};
 const elements={duo217Status:status,duo217Caption:caption,duo217Pause:pause,duo217Messages:transcript};
 const document={
  readyState:'loading',hidden:false,addEventListener(){},
  getElementById:id=>elements[id]||null,
  createElement:tag=>({tagName:tag,children:[],className:'',textContent:'',append(...values){this.children.push(...values);}})
 };
 const spoken=[],window={
  addEventListener(){},
  SpeechRecognition:class {},
  DuoReliable:{translate:async(original)=>({text:'translation:'+original,provider:'test'})},
  speechSynthesis:{getVoices:()=>[],cancel(){},speak(utterance){
   spoken.push(utterance.text);
   setTimeout(()=>utterance.text==='broken'?utterance.onerror({error:'speaker-failed'}):utterance.onend(),0);
  }},
  SpeechSynthesisUtterance:class {constructor(text){this.text=text;}}
 };
 const navigator={mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}};
 const instrument=source.replace('window.DuoConnected217={openHost,stop:close,',
  'window.__test={queueSpeech,playQueue,unlockMicrophone,connect,setState(value){s=value;},getState(){return s;}};window.DuoConnected217={openHost,stop:close,');
 assert.match(instrument,/window\.__test=\{queueSpeech,playQueue/);
 const context={window,document,navigator,localStorage:{getItem(){return null;}},location:{search:'',origin:'https://example.test'},
  URL,URLSearchParams,crypto:globalThis.crypto,setTimeout,clearTimeout,setInterval,clearInterval,
  WebSocket:{OPEN:1}};
 vm.runInNewContext(instrument,context);
 return {api:window.__test,spoken,messages,status,pause,transcript};
}

test('2.18 is an isolated valid browser update without CSS or existing mode changes',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.doesNotThrow(()=>new vm.Script(access));
 const styles=html=>(html.match(/<style[\s\S]*?<\/style>/g)||[]).join('\n');
 assert.equal(styles(latest),styles(previous));
 assert.match(latest,/voice\/connected-v218\.js/);
 assert.match(latest,/access\/client-v2\.18\.js/);
 assert.match(latest,/voice\/continuous\.js/);
 assert.match(latest,/voice\/listening-v214\.js/);
 assert.match(latest,/voice\/free-lab\.js/);
 assert.match(source,/duoGuest/);
 assert.match(source,/\/duotranslate\/preview\/v2\.18\//);
});

test('2.18 queues speech transcripts in order instead of dropping concurrent final phrases',async()=>{
 const h=harness(),sent=[];
 const session={paired:true,active:true,peer:{hears:'fr-FR'},speak:'pt-BR',
  ws:{readyState:1,send:v=>sent.push(JSON.parse(v))},utterances:[],translating:false,pending:0,playlist:[]};
 h.api.setState(session);
 h.api.queueSpeech('first sentence');
 h.api.queueSpeech('second sentence');
 await new Promise(resolve=>setTimeout(resolve,35));
 assert.deepEqual(sent.map(x=>x.original),['first sentence','second sentence']);
 assert.deepEqual(sent.map(x=>x.translation),['translation:first sentence','translation:second sentence']);
 assert.equal(session.translating,false);
});

test('2.18 continues to the next translation audio after a single voice failure',async()=>{
 const h=harness();
 const session={paired:false,active:true,permission:false,paused:false,playlist:['broken','next phrase'],
  playing:false,voice:'local',hear:'fr-FR',rec:null,restart:null};
 h.api.setState(session);
 await h.api.playQueue();
 assert.deepEqual(h.spoken,['broken','next phrase']);
 assert.equal(session.playlist.length,0);
 assert.equal(session.playing,false);
});

test('2.18 can request microphone permission again without rebuilding a room',async()=>{
 const h=harness();
 const session={paired:false,active:true,permission:false,paused:false,rec:null,restart:null};
 h.api.setState(session);
 await h.api.unlockMicrophone();
 assert.equal(session.permission,true);
 assert.equal(h.pause.textContent,'Pausar microfone');
});

test('2.18 sends heartbeat pings and disposes them on disconnect',()=>{
 assert.match(source,/setInterval\(\(\)=>\{/);
 assert.match(source,/type:'ping'/);
 assert.match(source,/if\(msg\.type==='pong'\)session\.lastPong=Date\.now\(\)/);
 assert.match(source,/clearInterval\(session\.heartbeat\)/);
 assert.match(source,/clearInterval\(previous\.heartbeat\)/);
 assert.match(source,/document\.addEventListener\('visibilitychange'/);
 assert.match(source,/window\.addEventListener\('pagehide'/);
});

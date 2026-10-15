import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../voice/connected-v219.js',import.meta.url),'utf8');
const preview=await readFile(new URL('../preview/v2.19/index.html',import.meta.url),'utf8');
const before=await readFile(new URL('../preview/v2.18/index.html',import.meta.url),'utf8');
const access=await readFile(new URL('../access/client-v2.19.js',import.meta.url),'utf8');
const voiceWorker=await readFile(new URL('../cloudflare/voice-worker-test.js',import.meta.url),'utf8');

function select(){
 const result={options:[],value:'',parentElement:{hidden:false},
  replaceChildren(){this.options=[];this.value='';},
  append(option){this.options.push(option);if(this.options.length===1)this.value=option.value;}
 };
 return result;
}
function context({accessActive=true,voices=[],voiceError=null,inviteError=null}={}){
 const items=new Map(),sent=[],translations=[],calls=[];
 const entry={
  duo217Voice:select(),duo217Hear:select(),duo217Speak:select(),
  duo217Status:{textContent:''},duo217Caption:{textContent:''},
  duo217VoiceState:{textContent:''},
  duo217Copy:{textContent:'',disabled:true},
  duo217Messages:{children:[],append(el){this.children.push(el);},get firstElementChild(){return this.children[0];},get scrollHeight(){return 10;},removeChild(){this.children.shift();}}
 };
 for(const [k,v] of Object.entries(entry))items.set(k,v);
 const createElement=tag=>({tagName:tag,value:'',textContent:'',className:'',children:[],
  append(...nodes){this.children.push(...nodes);},get options(){return this.children;}});
 const document={readyState:'loading',addEventListener(){},
  getElementById:id=>items.get(id)||null,createElement};
 const windows={
  addEventListener(){},DuoInviteHost:()=>({name:'Host',speak:'pt-BR',hear:'fr-FR'}),
  DuoAccess:{
   active:accessActive,ready:Promise.resolve(),voiceUrl:'https://voice.example.test',
   invite:async(room,options)=>{calls.push(['invite',room,options]);if(inviteError)throw Error(inviteError);return 'https://example.test/duotranslate/preview/v2.19/#duo-invite='+ 'b'.repeat(64);},
  },
  DuoEleven:{
   choices:()=>({selected:voices[0]?.id||'local',voices}),
   loadVoices:async(force)=>{calls.push(['voices',force]);if(voiceError)throw Error(voiceError);return voices;},
  },
  DuoReliable:{translate:async(text,from,to)=>{translations.push({text,from,to});return {text:'translated-'+to,provider:'Gemini'};}}
 };
 const location={search:'',origin:'https://example.test'};
 const instrument=source.replace('window.DuoConnected217={openHost,stop:close,',
  'window.__v219={loadVoices,translate,premiumInvite,makeLink,copyLink,playQueue,fill,enterGuest,openHost,setState(x){s=x;},getState(){return s;}};window.DuoConnected217={openHost,stop:close,');
 assert.match(instrument,/window\.__v219=\{loadVoices/);
 const ctx={window:windows,document,location,localStorage:{getItem(){return null;}},navigator:{language:'pt-BR'},
  URL,URLSearchParams,setTimeout,clearTimeout,setInterval,clearInterval,WebSocket:{OPEN:1},crypto:globalThis.crypto};
 vm.runInNewContext(instrument,ctx);
 return {api:windows.__v219,entry,calls,translations,sent,windows,items};
}
function state({role='host',speak='pt-BR',hear='pt-BR',peerSpeaks='fr-FR',peerHears='pt-BR'}={}){
 return {role,active:true,paired:true,pending:0,voice:'local',voicesVerified:false,name:'Host',
  speak,hear,counterpart:'fr-FR',ticket:'a'.repeat(32),
  peer:{speaks:peerSpeaks,hears:peerHears},
  ws:{readyState:1,send(packet){state.lastPacket=JSON.parse(packet);}},
 };
}
test('v2.19 browser modules parse and UI styling plus legacy modes are unchanged',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.doesNotThrow(()=>new vm.Script(access));
 const styles=s=>(s.match(/<style[\s\S]*?<\/style>/g)||[]).join('\n');
 assert.equal(styles(preview),styles(before));
 for(const path of ['voice/free-lab.js','voice/continuous.js','voice/listening-v214.js','engine-v2.12'])assert.ok(preview.includes(path));
 assert.match(preview,/voice\/connected-v219\.js/);
 assert.match(preview,/access\/client-v2\.19\.js/);
 assert.ok(access.includes('preview/v2.19/')||access.includes('preview\\/v2\\.19'));
});

test('v2.19 only asks guest for one language for speech and listening',()=>{
 assert.match(source,/Meu idioma \(falo e escuto\)/);
 assert.match(source,/\$\('duo217Hear'\)\.parentElement\.hidden=true/);
 assert.match(source,/const selected=\$\('duo217Speak'\)\.value;\$\('duo217Hear'\)\.value=selected/);
 assert.match(source,/s\.speak=\$\('duo217Speak'\)\.value;s\.hear=s\.speak/);
});

test('v2.19 translates Portuguese speech to the partner French even if old hear field says Portuguese',async()=>{
 const h=context(),member=state({peerHears:'pt-BR'});
 const packets=[];
 member.ws.send=packet=>packets.push(JSON.parse(packet));
 h.api.setState(member);
 await h.api.translate('bom dia');
 assert.deepEqual(h.translations,[{text:'bom dia',from:'pt-BR',to:'fr-FR'}]);
 assert.equal(packets[0].target,'fr-FR');
 assert.equal(packets[0].translation,'translated-fr-FR');
 assert.notEqual(packets[0].translation,'bom dia');
});
test('v2.19 translates French speech into Brazilian Portuguese in the opposite direction',async()=>{
 const h=context(),member=state({role:'guest',speak:'fr-FR',hear:'fr-FR',peerSpeaks:'pt-BR',peerHears:'fr-FR'});
 const packets=[];member.ws.send=packet=>packets.push(JSON.parse(packet));
 h.api.setState(member);
 await h.api.translate('Bonjour');
 assert.deepEqual(h.translations,[{text:'Bonjour',from:'fr-FR',to:'pt-BR'}]);
 assert.equal(packets[0].target,'pt-BR');
});
test('v2.19 never silently repeats original text when the source and destination languages match',async()=>{
 const h=context(),member=state({peerSpeaks:'pt-BR'});
 const packets=[];member.ws.send=packet=>packets.push(JSON.parse(packet));
 h.api.setState(member);
 await h.api.translate('bom dia');
 assert.equal(h.translations.length,0);
 assert.equal(packets.length,0);
 assert.match(h.entry.duo217Caption.textContent,/idiomas/);
});
test('v2.19 unauthenticated guest never sees unverified premium voices',async()=>{
 const saved=[{id:'a'.repeat(20),name:'Matilda'}];
 const h=context({accessActive:false,voices:saved}),member=state({role:'guest',speak:'fr-FR',hear:'fr-FR'});
 h.api.setState(member);h.entry.duo217Hear.value='fr-FR';
 await h.api.loadVoices('fr-FR');
 assert.equal(h.entry.duo217Voice.options.length,1);
 assert.equal(member.voice,'local');
 assert.match(h.entry.duo217VoiceState.textContent,/não autorizada/);
 assert.equal(h.calls.length,0);
});
test('v2.19 authorized guest verifies ElevenLabs API before enabling voice options',async()=>{
 const list=[{id:'c'.repeat(20),name:'Matilda'}];
 const h=context({accessActive:true,voices:list}),member=state({role:'guest',speak:'fr-FR',hear:'fr-FR'});
 h.api.setState(member);h.entry.duo217Hear.value='fr-FR';
 await h.api.loadVoices('fr-FR');
 assert.equal(h.entry.duo217Voice.options.length,2);
 assert.equal(member.voicesVerified,true);
 assert.equal(h.calls[0][0],'voices');
 assert.equal(h.calls[0][1],true,'first selection must query the authorized provider rather than relying on stale cache');
 assert.equal(h.entry.duo217Voice.value,list[0].id);
});
test('v2.19 guest sees an actual authorization failure rather than a phantom ElevenLabs choice',async()=>{
 const h=context({accessActive:true,voiceError:'HTTP 401'}),member=state({role:'guest',speak:'fr-FR',hear:'fr-FR'});
 h.api.setState(member);h.entry.duo217Hear.value='fr-FR';
 await h.api.loadVoices('fr-FR');
 assert.equal(h.entry.duo217Voice.options.length,1);
 assert.equal(member.voice,'local');
 assert.match(h.entry.duo217VoiceState.textContent,/HTTP 401/);
});

test('v2.19 host invite includes redeemable premium token or explicitly shows voice-free limitation',async()=>{
 const success=context(),a=state({role:'host'});
 success.api.setState(a);await success.api.premiumInvite();
 assert.equal(a.premiumInvite,true);
 assert.match(a.link,/#duo-invite=b{64}$/);
 assert.equal(success.entry.duo217Copy.disabled,false);
 const fail=context({inviteError:'No administrator authorization'}),b=state({role:'host'});
 fail.api.setState(b);await fail.api.premiumInvite();
 assert.equal(b.premiumInvite,false);
 assert.doesNotMatch(b.link,/#duo-invite/);
 assert.match(fail.entry.duo217Copy.textContent,/sem ElevenLabs/);
 assert.match(fail.entry.duo217Status.textContent,/No administrator authorization/);
});

test('v2.19 uses authenticated high-throughput voice route and never silently degrades premium into local',()=>{
 assert.match(source,/voiceUrl\+'\/stream-tts'/);
 assert.match(voiceWorker,/STREAM_VOICE_LIMITER/);
 assert.match(voiceWorker,/path==='\/stream-tts'&&!access\?\.user/);
 assert.match(source,/if\(session\.voice==='local'\)await localSpeech/);
 assert.doesNotMatch(source,/catch.*await localSpeech/);
});

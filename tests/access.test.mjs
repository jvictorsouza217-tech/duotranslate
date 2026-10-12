import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import aiWorker from '../cloudflare/gemini-worker.js';
import voiceWorker from '../cloudflare/voice-worker-test.js';
import {DuoAccessStore,ACCESS_ORIGIN,ACCESS_SERVICES} from '../cloudflare/access-store.js';

const OWNER_PIN='developer-only-test-pin',VOICE_PIN='voice-only-test-pin';
const selectedVoice='abcdefghijklmnopqrst';
class MemoryStorage {
 data=new Map();tail=Promise.resolve();
 async get(key){return structuredClone(this.data.get(key));}
 async put(key,value){this.data.set(key,structuredClone(value));}
 async delete(key){return this.data.delete(key);}
 async list({prefix,limit}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)).slice(0,limit).map(([k,v])=>[k,structuredClone(v)]));}
 transaction(fn){
  const run=this.tail.then(async()=>{const saved=structuredClone(this.data);try{return await fn(this);}catch(e){this.data=saved;throw e;}});
  this.tail=run.catch(()=>{});return run;
 }
}
function fixture() {
 const storage=new MemoryStorage(),store=new DuoAccessStore({storage});
 const env={GEMINI_API_KEY:'test-gemini-key-never-public',DUO_ACCESS_CODE:OWNER_PIN,
  AI_RATE_LIMITER:{limit:async()=>({success:true})},
  DUO_ACCESS_STORE:{idFromName:name=>name,get:()=>({fetch:req=>store.fetch(req)})}};
 const voice={ELEVENLABS_API_KEY:'test-eleven-key-never-public',DUO_ACCESS_CODE:VOICE_PIN,ENABLE_VOICE_TEST:'yes',
  VOICE_LIMITER:{limit:async()=>({success:true})},DUO_ACCESS_SERVICE:{fetch:req=>aiWorker.fetch(req,env)}};
 return {storage,store,env,voice};
}
function request(path,body,headers={}) {
 return new Request(ACCESS_SERVICES.ai+path,{method:body===undefined?'GET':'POST',
  headers:{Origin:ACCESS_ORIGIN,'Content-Type':'application/json',...headers},
  body:body===undefined?undefined:JSON.stringify(body)});
}
function auth(token){return {Authorization:'Bearer '+token};}
async function owner(f) {
 const response=await aiWorker.fetch(request('/access/admin/login',{preferences:{voices:{'fr-FR':selectedVoice},voiceEnabled:true}},{'X-Duo-Pin':OWNER_PIN}),f.env);
 assert.equal(response.status,200);return response.json();
}
async function invitation(f,admin,extra={}) {
 const response=await aiWorker.fetch(request('/access/invites',{label:'Jérôme',preferences:{voices:{'fr-FR':selectedVoice},voiceEnabled:true},...extra},auth(admin.token)),f.env);
 assert.equal(response.status,200);return response.json();
}
async function member(f) {
 const admin=await owner(f),invite=await invitation(f,admin);
 const response=await aiWorker.fetch(request('/access/redeem',{invite:invite.invite}),f.env);
 assert.equal(response.status,200);return {admin,invite,access:await response.json()};
}
async function withProviders(run) {
 const old=globalThis.fetch,calls=[];
 globalThis.fetch=async(input,init={})=>{
  const url=String(input);calls.push({url,...init});
  if(url.includes('generativelanguage.googleapis.com'))return Response.json({candidates:[{content:{parts:[{text:'Bonjour, comment allez-vous ?'}]}}],usageMetadata:{promptTokenCount:3,candidatesTokenCount:4,totalTokenCount:7}});
  if(url.includes('/v2/voices'))return Response.json({voices:[{voice_id:selectedVoice,name:'Selected test voice'}]});
  if(url.includes('/text-to-speech/'))return new Response(new Uint8Array([73,68,51,0]),{headers:{'Content-Type':'audio/mpeg'}});
  throw Error('Unexpected external request in test');
 };
 try{return await run(calls);}finally{globalThis.fetch=old;}
}

test('existing developer PIN is required for administrator bootstrap',async()=>{
 const f=fixture();
 for(const pin of ['',VOICE_PIN,'wrong-pin']) {
  const response=await aiWorker.fetch(request('/access/admin/login',{}, {'X-Duo-Pin':pin}),f.env);
  assert.equal(response.status,401);
 }
 const admin=await owner(f);assert.equal(admin.user.role,'admin');
 assert.match(admin.token,/^[a-f0-9]{64}$/);
});

test('single-use invitation grants only member access and safe service defaults',async()=>{
 const f=fixture(),{admin,invite,access}=await member(f);
 assert.equal(access.user.role,'member');assert.equal(access.user.label,'Jérôme');
 assert.deepEqual(access.services,ACCESS_SERVICES);
 assert.equal(access.preferences.voices['fr-FR'],selectedVoice);
 assert.equal(access.preferences.voiceEnabled,true);
 assert.notEqual(access.token,admin.token);
 const publicData=JSON.stringify(access);
 for(const secret of [OWNER_PIN,VOICE_PIN,f.env.GEMINI_API_KEY,f.voice.ELEVENLABS_API_KEY])assert.ok(!publicData.includes(secret));
 const reused=await aiWorker.fetch(request('/access/redeem',{invite:invite.invite}),f.env);
 assert.equal(reused.status,401);
 const stored=JSON.stringify([...f.storage.data]);
 for(const token of [invite.invite,access.token,admin.token])assert.ok(!stored.includes(token));
});

test('competing devices cannot redeem the same invitation twice',async()=>{
 const f=fixture(),admin=await owner(f),invite=await invitation(f,admin);
 const responses=await Promise.all(Array.from({length:8},()=>aiWorker.fetch(request('/access/redeem',{invite:invite.invite}),f.env)));
 assert.equal(responses.filter(r=>r.status===200).length,1);
 assert.equal(responses.filter(r=>r.status===401).length,7);
});

test('member cannot create users, list users, revoke access or self-promote',async()=>{
 const f=fixture(),{access}=await member(f);
 for(const [path,body] of [['/access/invites',{role:'admin'}],['/access/users',undefined],['/access/revoke',{userId:'owner'}]]) {
  const response=await aiWorker.fetch(request(path,body,auth(access.token)),f.env);assert.equal(response.status,403);
 }
 assert.equal((await aiWorker.fetch(request('/access/owner',{},auth(access.token)),f.env)).status,404);
});

test('expired invites and sessions are rejected by server timestamps',async()=>{
 const f=fixture(),admin=await owner(f),invite=await invitation(f,admin);
 const entry=[...f.storage.data].find(([k])=>k.startsWith('invite:'));
 f.storage.data.set(entry[0],{...entry[1],expiresAt:Date.now()-1});
 assert.equal((await aiWorker.fetch(request('/access/redeem',{invite:invite.invite}),f.env)).status,401);
 const session=[...f.storage.data].find(([k])=>k.startsWith('session:'));
 f.storage.data.set(session[0],{...session[1],expiresAt:Date.now()-1});
 assert.equal((await aiWorker.fetch(request('/access/session',undefined,auth(admin.token)),f.env)).status,401);
});

test('revocation blocks Gemini and ElevenLabs before contacting either provider',async()=>{
 const f=fixture(),{admin,access}=await member(f);
 const revoked=await aiWorker.fetch(request('/access/revoke',{userId:access.user.id},auth(admin.token)),f.env);
 assert.equal(revoked.status,200);
 await withProviders(async calls=>{
  const ai=await aiWorker.fetch(request('/translate',{text:'Olá',source:'pt-BR',target:'fr-FR'},auth(access.token)),f.env);
  const voice=await voiceWorker.fetch(request('/tts',{text:'Bonjour',voiceId:selectedVoice,lang:'fr-FR'},auth(access.token)),f.voice);
  assert.equal(ai.status,401);assert.equal(voice.status,401);assert.equal(calls.length,0);
 });
});

test('valid member session translates, analyzes and selects ElevenLabs voices',async()=>{
 const f=fixture(),{access}=await member(f);
 await withProviders(async calls=>{
  const ai=await aiWorker.fetch(request('/translate',{text:'Olá',source:'pt-BR',target:'fr-FR'},auth(access.token)),f.env);
  assert.equal(ai.status,200);assert.equal((await ai.json()).translation,'Bonjour, comment allez-vous ?');
  const analysis=await aiWorker.fetch(request('/analyze',{original:'Olá',translation:'Bonjour',source:'pt-BR',target:'fr-FR'},auth(access.token)),f.env);
  assert.equal(analysis.status,200);assert.ok((await analysis.json()).analysis);
  const voices=await voiceWorker.fetch(request('/voices',{},auth(access.token)),f.voice);
  assert.equal(voices.status,200);assert.equal((await voices.json()).voices[0].id,selectedVoice);
  const speech=await voiceWorker.fetch(request('/tts',{text:'Bonjour',voiceId:selectedVoice,lang:'fr-FR'},auth(access.token)),f.voice);
  assert.equal(speech.status,200);assert.equal(speech.headers.get('Content-Type'),'audio/mpeg');
  assert.equal(calls.length,4);
 });
});

test('legacy PIN requests still work and invalid bearer cannot fall back to them',async()=>{
 const f=fixture();
 await withProviders(async calls=>{
  assert.equal((await aiWorker.fetch(request('/translate',{text:'Olá',source:'pt-BR',target:'fr-FR'},{'X-Duo-Pin':OWNER_PIN}),f.env)).status,200);
  assert.equal((await voiceWorker.fetch(request('/tts',{text:'Bonjour',voiceId:selectedVoice,lang:'fr-FR'},{'X-Duo-Pin':VOICE_PIN}),f.voice)).status,200);
  for(const Authorization of ['Bearer invalid','Bearer '+ 'f'.repeat(64)]) {
   assert.equal((await aiWorker.fetch(request('/translate',{text:'Olá',source:'pt-BR',target:'fr-FR'},{Authorization,'X-Duo-Pin':OWNER_PIN}),f.env)).status,401);
   assert.equal((await voiceWorker.fetch(request('/voices',{}, {Authorization,'X-Duo-Pin':VOICE_PIN}),f.voice)).status,401);
  }
  assert.equal(calls.length,2);
 });
});

test('existing provider payloads, limits and language validation remain intact',async()=>{
 const f=fixture(),{access}=await member(f);
 await withProviders(async calls=>{
  for(const headers of [{'X-Duo-Pin':OWNER_PIN},auth(access.token)])
   assert.equal((await aiWorker.fetch(request('/translate',{text:'Olá',source:'pt-BR',target:'fr-FR'},headers),f.env)).status,200);
  assert.equal(calls[0].body,calls[1].body);
  assert.equal(calls[0].url,calls[1].url);
  const invalid=await aiWorker.fetch(request('/translate',{text:'Olá',source:'pt-BR',target:'pt-BR'},auth(access.token)),f.env);
  assert.equal(invalid.status,400);
  const long=await voiceWorker.fetch(request('/tts',{text:'x'.repeat(221),lang:'fr-FR',voiceId:selectedVoice},auth(access.token)),f.voice);
  assert.equal(long.status,400);
  f.voice.VOICE_LIMITER={limit:async()=>({success:false})};
  assert.equal((await voiceWorker.fetch(request('/voices',{},auth(access.token)),f.voice)).status,429);
  f.env.AI_RATE_LIMITER={limit:async()=>({success:false})};
  assert.equal((await aiWorker.fetch(request('/translate',{text:'Olá',source:'pt-BR',target:'fr-FR'},auth(access.token)),f.env)).status,429);
 });
});

test('unauthorized origins and missing access bindings fail closed',async()=>{
 const f=fixture(),{access}=await member(f);
 assert.equal((await aiWorker.fetch(request('/access/session',undefined,{...auth(access.token),Origin:'https://other.example'}),f.env)).status,403);
 const preflight=await aiWorker.fetch(new Request(ACCESS_SERVICES.ai+'/translate',{method:'OPTIONS',headers:{Origin:ACCESS_ORIGIN}}),f.env);
 assert.ok(preflight.headers.get('Access-Control-Allow-Headers').includes('Authorization'));
 delete f.env.DUO_ACCESS_STORE;delete f.voice.DUO_ACCESS_SERVICE;
 assert.equal((await aiWorker.fetch(request('/translate',{text:'Olá',source:'pt-BR',target:'fr-FR'},auth(access.token)),f.env)).status,503);
 assert.equal((await voiceWorker.fetch(request('/voices',{},auth(access.token)),f.voice)).status,503);
});

function browserStore(initial={}) {
 const values=new Map(Object.entries(initial));return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),values};
}
async function client(f,href,initial={},top=null) {
 const localStorage=browserStore(initial),sessionStorage=browserStore(),requests=[];
 const location={href,pathname:new URL(href).pathname,hash:new URL(href).hash};
 const document={getElementById:()=>null,addEventListener:()=>{}};
 const win={fetch:async(input,init={})=>{
  requests.push({url:String(input),headers:new Headers(init.headers)});
  const req=new Request(input,{...init,headers:{Origin:ACCESS_ORIGIN,...Object.fromEntries(new Headers(init.headers))}});
  if(String(input).startsWith(ACCESS_SERVICES.ai))return aiWorker.fetch(req,f.env);
  if(String(input).startsWith(ACCESS_SERVICES.voice))return voiceWorker.fetch(req,f.voice);
  return new Response('public request');
 }};
 win.parent=top||win;
 const context=vm.createContext({window:win,localStorage,sessionStorage,location,document,
  history:{replaceState:(_a,_b,url)=>{location.href=url;location.hash=new URL(url).hash;}},
  Headers,Request,URL,URLSearchParams,AbortController,setTimeout,clearTimeout});
 vm.runInContext(await readFile(new URL('../access/client.js',import.meta.url),'utf8'),context);
 await win.DuoAccess?.ready;
 return {win,localStorage,sessionStorage,location,requests};
}

test('new guest needs no provider account, URL, PIN or voice ID setup',async()=>{
 const f=fixture(),admin=await owner(f),invite=await invitation(f,admin);
 const c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/?room=ABCDEFGH#duo-invite='+invite.invite);
 assert.equal(c.win.DuoAccess.role,'member');assert.equal(c.location.hash,'');
 assert.equal(new URL(c.location.href).searchParams.get('room'),'ABCDEFGH');
 const ai=JSON.parse(c.localStorage.getItem('duotranslate.provider.v1'));
 const voice=JSON.parse(c.localStorage.getItem('duotranslate.premium.voice.v1'));
 assert.equal(ai.url,ACCESS_SERVICES.ai);assert.equal(ai.provider,'gemini');
 assert.equal(voice.url,ACCESS_SERVICES.voice);assert.equal(voice.voices['fr-FR'],selectedVoice);assert.equal(voice.enabled,true);
 const stored=JSON.stringify([...c.localStorage.values,...c.sessionStorage.values]);
 assert.ok(!stored.includes(OWNER_PIN));assert.ok(!stored.includes(VOICE_PIN));
 await withProviders(async()=>{
  const response=await c.win.DuoAccess.fetch(ACCESS_SERVICES.ai+'/translate',{
   method:'POST',headers:{'Content-Type':'application/json','X-Duo-Pin':'duo-individual-session'},
   body:JSON.stringify({text:'Olá',source:'pt-BR',target:'fr-FR'})});
  assert.equal(response.status,200);
  const last=c.requests.at(-1);assert.ok(last.headers.has('Authorization'));assert.ok(!last.headers.has('X-Duo-Pin'));
 });
});

test('session resumes on another visit and never leaks to unrelated services',async()=>{
 const f=fixture(),{access}=await member(f),key='duotranslate.access.session.v1';
 const c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',{[key]:JSON.stringify(access)});
 assert.equal(c.win.DuoAccess.active,true);
 await c.win.DuoAccess.fetch('https://public.example/data',{headers:{'Content-Type':'application/json'}});
 assert.ok(!c.requests.at(-1).headers.has('Authorization'));
 c.win.DuoAccess.forget();assert.equal(c.localStorage.getItem(key),null);
 assert.ok(c.sessionStorage.getItem(key));assert.equal(c.win.DuoAccess.active,true);
 c.win.DuoAccess.remember();assert.ok(c.localStorage.getItem(key));
});

test('administrator invitations use the current interface and carry selected voices',async()=>{
 const f=fixture(),{admin}=await member(f);
 const c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',{
  'duotranslate.access.session.v1':JSON.stringify(admin),
  'duotranslate.premium.voice.v1':JSON.stringify({enabled:true,voices:{'fr-FR':selectedVoice}})});
 const url=new URL(await c.win.DuoAccess.invite('ABCDEFGH',{label:'Jérôme'}));
 assert.equal(url.pathname,'/duotranslate/preview/v2.10/');assert.equal(url.searchParams.get('room'),'ABCDEFGH');
 assert.match(url.hash,/^#duo-invite=[a-f0-9]{64}$/);
 const guest=await client(f,url.href);assert.equal(guest.win.DuoAccess.role,'member');
 assert.equal(JSON.parse(guest.localStorage.getItem('duotranslate.premium.voice.v1')).voices['fr-FR'],selectedVoice);
});

test('shared engine opts in only for the access-enabled parent',async()=>{
 const f=fixture();
 const old=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.9/');assert.equal(old.win.DuoAccess,undefined);
 const bare=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/engine-v2.7/');assert.equal(bare.win.DuoAccess,undefined);
 const top={DuoAccess:{ready:Promise.resolve(),role:'member'}};
 const child=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/engine-v2.7/',{},top);
 assert.equal(child.win.DuoAccess,top.DuoAccess);assert.equal(child.requests.length,0);
});

async function copyHandler(window,navigator) {
 const source=await readFile(new URL('../preview/engine-v2.7/app.js',import.meta.url),'utf8');
 const match=/el\.copy\.addEventListener\('click',(async\(\)=>\{[\s\S]*?\n\})\);/.exec(source);
 assert.ok(match,'existing copy button handler is present');
 const notices=[],context=vm.createContext({window,navigator,state:{room:'ABCDEFGH'},
  location:{href:ACCESS_ORIGIN+'/duotranslate/preview/engine-v2.7/'},URL,Blob,ClipboardItem:window.ClipboardItem,
  notify:(...args)=>notices.push(args)});
 return {handler:vm.runInContext('('+match[1]+')',context),notices};
}

test('copy invitation begins clipboard write during the click before awaiting the server',async()=>{
 let release,writing=false,copied='';
 const pending=new Promise(resolve=>{release=resolve;});
 class ClipboardItem {constructor(data){this.data=data;}}
 const window={ClipboardItem,DuoAccess:{invite:()=>pending}};
 const navigator={clipboard:{write:async([item])=>{writing=true;copied=await (await item.data['text/plain']).text();}}};
 const {handler,notices}=await copyHandler(window,navigator);
 const running=handler();assert.equal(writing,true);
 release('https://app.example/?room=ABCDEFGH#duo-invite=one-use-test');await running;
 assert.ok(copied.includes('#duo-invite='));assert.equal(notices[0][0],'Convite copiado!');
});

test('clipboard denial offers the full access invitation instead of only a room code',async()=>{
 let offered='';
 const full='https://app.example/?room=ABCDEFGH#duo-invite=one-use-test';
 const window={DuoAccess:{invite:async()=>full},prompt:(_message,url)=>{offered=url;}};
 const navigator={clipboard:{writeText:async()=>{throw Error('clipboard denied');}}};
 const {handler}=await copyHandler(window,navigator);await handler();assert.equal(offered,full);
});

test('legacy copy button retains the original room invitation behavior',async()=>{
 let copied='';
 const {handler}=await copyHandler({}, {clipboard:{writeText:async value=>{copied=value;}}});
 await handler();assert.equal(copied,ACCESS_ORIGIN+'/duotranslate/preview/v2.7/?room=ABCDEFGH');
});

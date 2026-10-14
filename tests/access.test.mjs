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
async function client(f,href,initial={},top=null,tabInitial={}) {
 const localStorage=browserStore(initial),sessionStorage=browserStore(tabInitial),requests=[];
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
  Headers,Request,URL,URLSearchParams,AbortController,Blob,Event,setTimeout,clearTimeout,queueMicrotask});
 vm.runInContext(await readFile(new URL('../access/client.js',import.meta.url),'utf8'),context);
 await win.DuoAccess?.ready;
 return {win,localStorage,sessionStorage,location,requests,context,document};
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

class Field {
 value='';textContent='';disabled=false;checked=false;readOnly=false;options=[];events={};
 classList={toggle(){}};
 replaceChildren(){this.options=[];this.value='';}
 append(item){this.options.push(item);}
 addEventListener(type,callback){this.events[type]=callback;}
}
function installFields(c,names) {
 const fields=Object.fromEntries(names.map(name=>[name,new Field()]));
 c.document.getElementById=id=>fields[id]||null;c.document.createElement=()=>new Field();
 c.document.defaultView=c.win;c.context.$=id=>fields[id];
 return fields;
}
async function installEleven(c) {
 vm.runInContext(await readFile(new URL('../access/eleven-setup.js',import.meta.url),'utf8'),c.context);
 return c.win.DuoEleven;
}
let inlineAst;
async function inlineNodes() {
 if(inlineAst)return inlineAst;
 const html=await readFile(new URL('../preview/v2.10/index.html',import.meta.url),'utf8');
 const code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(v=>v.length>10000);
 const acorn={};vm.runInNewContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],{exports:acorn,module:{exports:acorn}});
 const ast=acorn.parse(code,{ecmaVersion:'latest'}),functions={},handlers={};
 function walk(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration')functions[node.id.name]=code.slice(node.start,node.end);
  if(node.type==='AssignmentExpression'&&node.left?.type==='MemberExpression'&&node.left.object?.type==='CallExpression'&&node.left.object.callee?.name==='$'&&['onclick','onchange'].includes(node.left.property?.name))
   handlers[node.left.object.arguments[0]?.value+(node.left.property.name==='onchange'?'.onchange':'')]=code.slice(node.right.start,node.right.end);
  for(const [key,value] of Object.entries(node))if(key!=='start'&&key!=='end'){
   if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
  }
 }
 walk(ast);inlineAst={functions,handlers};return inlineAst;
}
async function useFunctions(c,names) {
 const nodes=await inlineNodes();vm.runInContext(names.map(name=>nodes.functions[name]).join('\n'),c.context);
}

test('saving Gemini settings activates persistent access without copying a room invitation first',async()=>{
 const f=fixture(),c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/');
 const fields=installFields(c,['translationProvider','aiWorkerUrl','aiWorkerPin','aiTestBtn','aiSetupStatus','aiSetupFields']);
 vm.runInContext(await readFile(new URL('../ai-translation.js',import.meta.url),'utf8'),c.context);
 fields.translationProvider.value='gemini';fields.aiWorkerPin.value=OWNER_PIN;
 fields.aiWorkerPin.events.change();await c.win.DuoAccess.configure();
 assert.equal(c.win.DuoAccess.role,'admin');assert.equal(c.win.DuoAccess.remembered,true);
 const reopened=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',Object.fromEntries(c.localStorage.values));
 assert.equal(reopened.win.DuoAccess.role,'admin');
 assert.equal(reopened.requests.filter(r=>r.url.endsWith('/access/admin/login')).length,0);
});

test('voice-only developer configuration survives a new tab without reentering the voice code',async()=>{
 const f=fixture(),c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/');
 await c.win.DuoAccess.configure({voicePin:VOICE_PIN});
 const setup=await installEleven(c);setup.selectVoice('fr-FR',selectedVoice);
 const reopened=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',Object.fromEntries(c.localStorage.values));
 assert.equal(reopened.sessionStorage.getItem('duotranslate.voice.pin.session'),VOICE_PIN);
 assert.equal(JSON.parse(reopened.localStorage.getItem('duotranslate.premium.voice.v1')).enabled,true);
 const next=await installEleven(reopened);
 await withProviders(async calls=>{assert.equal((await next.loadVoices()).length,1);assert.equal(calls.length,1);});
 assert.equal(reopened.requests.at(-1).headers.get('X-Duo-Pin'),VOICE_PIN);
});

test('entering the voice access code remembers it before selecting or saving a voice',async()=>{
 const f=fixture(),c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/');
 const fields=installFields(c,['premiumPin','premiumStatus']);fields.premiumPin.value=VOICE_PIN;
 const nodes=await inlineNodes(),handler=vm.runInContext('('+nodes.handlers['premiumPin.onchange']+')',c.context);
 await handler();
 const reopened=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',Object.fromEntries(c.localStorage.values));
 assert.equal(reopened.sessionStorage.getItem('duotranslate.voice.pin.session'),VOICE_PIN);
 assert.equal(reopened.requests.filter(r=>r.url.endsWith('/access/admin/login')).length,0);
});

test('existing codes in the current tab migrate once to remembered access',async()=>{
 const f=fixture(),c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',
  {'duotranslate.access.remember.v1':'0'},null,
  {'duotranslate.pin.session.v1':OWNER_PIN,'duotranslate.voice.pin.session':VOICE_PIN});
 assert.equal(c.win.DuoAccess.role,'admin');assert.ok(c.localStorage.getItem('duotranslate.access.session.v1'));
 const saved=JSON.parse(c.localStorage.getItem('duotranslate.trusted.access.v210'));
 assert.equal(saved.voice,VOICE_PIN);assert.equal(saved.gemini,OWNER_PIN);
 c.win.DuoAccess.forget();assert.equal(c.localStorage.getItem('duotranslate.trusted.access.v210'),null);
 assert.equal(c.localStorage.getItem('duotranslate.access.session.v1'),null);
});

test('stale browser expiration metadata does not discard a still-valid server session',async()=>{
 const f=fixture(),{access}=await member(f),copy={...access,expiresAt:1};
 const c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',{'duotranslate.access.session.v1':JSON.stringify(copy)});
 assert.equal(c.win.DuoAccess.role,'member');
 assert.ok(JSON.parse(c.localStorage.getItem('duotranslate.access.session.v1')).expiresAt>Date.now());
});

test('saved voice directory stays selectable after revisiting a screen',async()=>{
 const second='zyxwvutsrqponmlkjihg',f=fixture(),{access}=await member(f);
 const c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',{
  'duotranslate.access.session.v1':JSON.stringify(access),
  'duotranslate.eleven.voices.v29':JSON.stringify([{id:selectedVoice,name:'First voice'},{id:second,name:'Second voice'}])});
 installFields(c,[]);const setup=await installEleven(c),select=new Field();
 setup.render(select,'fr-FR');assert.equal(select.options.length,2);
 setup.selectVoice('fr-FR',second);setup.render(select,'fr-FR');
 assert.equal(select.value,second);assert.equal(select.options.length,2);assert.equal(select.disabled,false);
 const next=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',Object.fromEntries(c.localStorage.values));
 installFields(next,[]);const reopened=await installEleven(next),picker=new Field();reopened.render(picker,'fr-FR');
 assert.equal(picker.value,second);assert.equal(picker.options.length,2);
});

test('default voice covers empty language settings and preserves previously chosen voices',async()=>{
 const second='zyxwvutsrqponmlkjihg',f=fixture(),{access}=await member(f);
 const c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',{
  'duotranslate.access.session.v1':JSON.stringify(access),
  'duotranslate.premium.voice.v1':JSON.stringify({voices:{'fr-FR':selectedVoice,'pt-BR':second},enabled:true})});
 const setup=await installEleven(c);setup.selectVoice('en-US',selectedVoice);
 const cfg=setup.get();assert.equal(Object.keys(cfg.voices).length,14);
 assert.equal(cfg.voices['pt-BR'],second);assert.equal(cfg.voices['fr-FR'],selectedVoice);
 setup.selectVoice('fr-FR',selectedVoice,false);assert.equal(setup.get().enabled,false);
});

test('concurrent voice controls reuse a single directory request without synthesizing speech',async()=>{
 const f=fixture(),{access}=await member(f),c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',{'duotranslate.access.session.v1':JSON.stringify(access)});
 const setup=await installEleven(c);
 await withProviders(async calls=>{
  const values=await Promise.all([setup.loadVoices(),setup.loadVoices(),setup.loadVoices()]);
  assert.equal(values.length,3);assert.equal(calls.length,1);assert.ok(calls[0].url.includes('/v2/voices'));
  await setup.loadVoices();assert.equal(calls.length,1);
 });
});

test('onboarding dropdown lists ElevenLabs voices even if device speech synthesis is unavailable',async()=>{
 const f=fixture(),{access}=await member(f),c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',{
  'duotranslate.access.session.v1':JSON.stringify(access),
  'duotranslate.eleven.voices.v29':JSON.stringify([{id:selectedVoice,name:'Selected ElevenLabs voice'}])});
 const fields=installFields(c,['hear','speak','voicePreview','l_voice','hearVoice','selBadge','nextReal']);
 fields.hear.value='fr-FR';fields.speak.value='pt-BR';
 await installEleven(c);
 c.win.speechSynthesis=new Proxy({}, {get(){throw Error('Device voices must not be requested here');}});
 Object.assign(c.context,{step:3,locale:()=>['pt-BR','Português','pt'],QUICK_VOICE_LOCALES:{pt:['','Voz natural ElevenLabs'],en:['','ElevenLabs voice']},langs:[['pt-BR','Português'],['fr-FR','Français']]});
 await useFunctions(c,['populateVoices']);vm.runInContext('populateVoices()',c.context);
 assert.equal(fields.voicePreview.value,selectedVoice);assert.equal(fields.voicePreview.options[0].textContent,'Selected ElevenLabs voice');
 assert.equal(fields.hearVoice.disabled,false);assert.ok(fields.l_voice.textContent.includes('ElevenLabs'));
});

test('initial voice example uses ElevenLabs before the translator iframe exists',async()=>{
 const f=fixture(),{access}=await member(f),c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',{'duotranslate.access.session.v1':JSON.stringify(access)});
 const fields=installFields(c,['voicePreview','nextReal','hearVoice']);fields.voicePreview.value=selectedVoice;
 let played=0;
 c.context.Audio=class {play(){played++;queueMicrotask(()=>this.onended());return Promise.resolve();}};
 vm.runInContext(await readFile(new URL('../preview/engine-v2.7/premium-voice.js',import.meta.url),'utf8'),c.context);
 await installEleven(c);
 Object.assign(c.context,{integrateFrameDoc:()=>null,phrases:{'fr-FR':'Bonjour'},quickTestAudioContext:null});
 await useFunctions(c,['unlockQuickTestAudio','premiumStored','quickVoiceSample']);
 await withProviders(async calls=>{
  await vm.runInContext("quickVoiceSample('voicePreview','fr-FR','nextReal','hearVoice')",c.context);
  assert.equal(calls.length,1);assert.ok(calls[0].url.includes('/text-to-speech/'));
 });
 assert.equal(played,1);assert.ok(fields.nextReal.textContent.includes('Amostra reproduzida'));assert.equal(fields.hearVoice.disabled,false);
});

test('settings button creates an individual invitation without needing a room',async()=>{
 const f=fixture(),{admin}=await member(f),c=await client(f,ACCESS_ORIGIN+'/duotranslate/preview/v2.10/',{'duotranslate.access.session.v1':JSON.stringify(admin)});
 const fields=installFields(c,['trustedSave','trustedStatus']);let copied='';
 c.win.navigator={clipboard:{writeText:async text=>{copied=text;}}};
 const nodes=await inlineNodes();await useFunctions(c,['updateTrustedMessage']);
 vm.runInContext('updateTrustedMessage()',c.context);assert.equal(fields.trustedSave.textContent,'Copiar convite individual');
 const handler=vm.runInContext('('+nodes.handlers.trustedSave+')',c.context);await handler();
 const url=new URL(copied);assert.equal(url.searchParams.get('room'),null);assert.ok(url.hash.startsWith('#duo-invite='));
 const receiver=await client(f,copied);assert.equal(receiver.win.DuoAccess.role,'member');
 assert.equal(fields.trustedSave.disabled,false);
});

test('active access renews near expiration without permitting a revoked user to renew',async()=>{
 const f=fixture(),{access,admin}=await member(f);
 const entry=[...f.storage.data].find(([key,value])=>key.startsWith('session:')&&value.userId===access.user.id);
 f.storage.data.set(entry[0],{...entry[1],expiresAt:Date.now()+86400000});
 const response=await aiWorker.fetch(request('/access/session',undefined,auth(access.token)),f.env);
 assert.equal(response.status,200);assert.ok((await response.json()).expiresAt>Date.now()+29*86400000);
 assert.equal((await aiWorker.fetch(request('/access/revoke',{userId:access.user.id},auth(admin.token)),f.env)).status,200);
 assert.equal((await aiWorker.fetch(request('/access/session',undefined,auth(access.token)),f.env)).status,401);
});

test('invitation status follows redemption, profile name and revocation without allowing role escalation',async()=>{
 const f=fixture(),admin=await owner(f),invite=await invitation(f,admin);
 assert.equal(invite.user.status,'pending');
 const activated=await (await aiWorker.fetch(request('/access/redeem',{invite:invite.invite}),f.env)).json();
 assert.equal(activated.user.status,'active');assert.ok(activated.user.activatedAt);
 const changed=await aiWorker.fetch(request('/access/profile',{name:'Pedro',role:'admin',userId:'owner'},auth(activated.token)),f.env);
 assert.equal(changed.status,200);const value=await changed.json();assert.equal(value.user.label,'Pedro');assert.equal(value.user.role,'member');assert.equal(value.user.id,activated.user.id);
 const list=await (await aiWorker.fetch(request('/access/users',undefined,auth(admin.token)),f.env)).json();
 assert.equal(list.users.find(u=>u.id===activated.user.id).label,'Pedro');assert.equal(list.users.find(u=>u.id==='owner').label,'Administrador');
 await aiWorker.fetch(request('/access/revoke',{userId:activated.user.id},auth(admin.token)),f.env);
 assert.equal((await aiWorker.fetch(request('/access/profile',{name:'Other'},auth(activated.token)),f.env)).status,401);
});

test('all skipped samples permit results and opening the app without a saved profile',async()=>{
 const nodes=await inlineNodes(),fields=new Proxy({}, {get:(o,k)=>o[k]||=( {classList:{toggle(){}},value:'',textContent:'',disabled:false})});let opened=false;
 const context=vm.createContext({$:id=>fields[id],flow:()=>Array.from({length:25},()=>'{n}'),locale:()=>['pt-BR','Português','pt'],voiceSubstep:2,isRecording:false,index:4,
  results:Array.from({length:4},(_,position)=>({position,success:false})),deviceState:{kind:'phone',mic:'built-in',currentId:null},
  setVoiceSubstep:n=>context.voiceSubstep=n,save(){},enterIntegrated(){opened=true;},persistIntegratedConfig:()=>({complete:true}),window:{DuoVoiceProfile:{activate(){}}}});
 vm.runInContext(nodes.functions.renderSubstep,context);vm.runInContext('renderSubstep()',context);assert.equal(fields.next2.disabled,false);
 const next=vm.runInContext('('+nodes.handlers.next2+')',context);next();assert.equal(context.voiceSubstep,3);
 vm.runInContext('renderSubstep()',context);assert.equal(fields.next2.disabled,false);next();assert.equal(opened,true);
});

test('continuous synthesis requires individual access, respects its own limit and leaves legacy limits intact',async()=>{
 const f=fixture(),{access,admin}=await member(f);f.voice.STREAM_VOICE_LIMITER={limit:async()=>({success:true})};
 await withProviders(async calls=>{
  const body={text:'Bonjour '.repeat(40),voiceId:selectedVoice,lang:'fr-FR'};
  assert.equal((await voiceWorker.fetch(request('/stream-tts',body,auth(access.token)),f.voice)).status,200);
  assert.equal((await voiceWorker.fetch(request('/tts',body,auth(access.token)),f.voice)).status,400);
  assert.equal((await voiceWorker.fetch(request('/stream-tts',body,{'X-Duo-Pin':VOICE_PIN}),f.voice)).status,401);
  f.voice.STREAM_VOICE_LIMITER={limit:async()=>({success:false})};
  assert.equal((await voiceWorker.fetch(request('/stream-tts',body,auth(access.token)),f.voice)).status,429);
  await aiWorker.fetch(request('/access/revoke',{userId:access.user.id},auth(admin.token)),f.env);
  assert.equal((await voiceWorker.fetch(request('/stream-tts',body,auth(access.token)),f.voice)).status,401);assert.equal(calls.length,1);
 });
});

test('voice profile uses measured pauses and sensitivity and skipping removes personalized endpointing',async()=>{
 const localStorage=browserStore(),window={};const context=vm.createContext({window,localStorage});
 vm.runInContext(await readFile(new URL('../voice/profile.js',import.meta.url),'utf8'),context);
 const api=window.DuoVoiceProfile;
 const make=(pause)=>Array.from({length:80},(_,i)=>({time:i*50,rms:i<20||i>=20+pause?.08:.002,pitch:160}));
 const short=api.summarize(make(4)),long=api.summarize(make(20));assert.ok(long.pauseMs>short.pauseMs);assert.equal(api.summarize(Array.from({length:20},(_,i)=>({time:i*50,rms:0,pitch:0}))),null);
 api.activate([{success:true,acoustic:long}],'Test microphone');assert.equal(api.current().pauseMs,long.pauseMs);
 const end=api.endpoint(api.current());assert.equal(end(.08,100),false);assert.equal(end(0,100+short.pauseMs),false);assert.equal(end(0,101+long.pauseMs),true);
 api.activate([{success:false}],'');assert.equal(api.current(),null);
});

test('calibrated capture delivers a complete turn and releases the microphone on stop',async()=>{
 const localStorage=browserStore();localStorage.setItem('duotranslate.acoustic-profile.v1',JSON.stringify({version:1,threshold:.01,pauseMs:900}));
 let stopped=0;const delivered=[];const window={};const context=vm.createContext({window,localStorage,setTimeout,clearTimeout,clearInterval,setInterval,
  navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++;}}]})}}});
 vm.runInContext(await readFile(new URL('../voice/profile.js',import.meta.url),'utf8'),context);
 const rec={onresult:e=>delivered.push(e.results[0][0].transcript),onend(){},stop(){}};
 const release=window.DuoVoiceProfile.attach(rec);assert.equal(rec.continuous,true);
 await rec.onstart();rec.onresult({resultIndex:0,results:[Object.assign([{transcript:'Olá'}],{isFinal:true}),Object.assign([{transcript:'Jérôme'}],{isFinal:true})]});assert.equal(delivered.length,0);
 rec.onend();assert.deepEqual(delivered,['Olá Jérôme']);assert.equal(stopped,1);release();assert.equal(stopped,1);
});

test('continuous listening keeps capturing during playback and releases the microphone on exit',async()=>{
 let stopped=0,closed=0,spoken=0,translated=0,logged=[];const timers=new Map();
 const socket={readyState:1,bufferedAmount:0,send(message){logged.push(JSON.parse(message));},close(){closed++;}};
 const track={stop(){stopped++;}};
 const ctx={resume:async()=>{},audioWorklet:{addModule:async()=>{}},createMediaStreamSource:()=>({connect(){},disconnect(){}}),
  createBufferSource:()=>({connect(){},start(){spoken++;queueMicrotask(()=>this.onended());},stop(){}}),
  decodeAudioData:async()=>({}),destination:{},close:async()=>{}};
 const window={AudioContext:class {constructor(){return ctx;}},DuoAccess:{configure:async()=>{},openRealtime:()=>socket,voiceUrl:'https://voice.example',fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)})}};
 const document={currentScript:{src:'https://app.example/voice/continuous.js'}};
 const context=vm.createContext({window,document,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track]})}},
  AudioWorkletNode:class {port={onmessage:null};connect(){}disconnect(){}},setInterval:(fn,ms)=>{timers.set(ms,fn);return ms;},clearInterval:ms=>timers.delete(ms),setTimeout,clearTimeout,
  AbortController,AbortSignal,btoa,URL,Uint8Array,queueMicrotask});
 vm.runInContext(await readFile(new URL('../voice/continuous.js',import.meta.url),'utf8'),context);
 const stages=[];const api=window.DuoContinuous.create({status:message=>stages.push(message),caption(){},result(){},onState(){},translate:async()=>{translated++;return 'Bonjour';}});
 await api.start('pt-BR','fr-FR',selectedVoice);
 socket.onmessage({data:JSON.stringify({message_type:'session_started'})});
 socket.onmessage({data:JSON.stringify({message_type:'committed_transcript',text:'Olá'})});
 assert.equal(timers.has(2500),false);assert.equal(timers.has(5000),false);
  await new Promise(resolve=>setImmediate(resolve));
 assert.equal(stopped,0);assert.equal(api.active,true);
 assert.equal(translated,1);assert.equal(spoken,1);assert.ok(stages.some(s=>s.includes('Traduzindo trecho')));assert.ok(stages.some(s=>s.includes('Reproduzindo a tradução')));
 api.stop();assert.equal(stopped,1);assert.equal(closed,1);
});

test('ElevenLabs voice selection synthesizes a language-specific sample instead of an English voice preview',async()=>{
 const source=await readFile(new URL('../voice/picker.js',import.meta.url),'utf8');
 const created=[];function element(tag){return {tag,style:{},children:[],value:'',textContent:'',replaceChildren(...items){this.children=items},append(...items){this.children.push(...items)},after(node){this.sibling=node},setAttribute(){},dispatchEvent(){}};}
 const window={addEventListener(){},DuoEleven:{choices:()=>({voices:[{id:selectedVoice,name:'George',preview:'https://english.example/voice.mp3'}],selected:selectedVoice}),selectVoice(lang,id){assert.equal(lang,'fr-FR');assert.equal(id,selectedVoice);return true;}}};
 const document={createElement:tag=>{const el=element(tag);created.push(el);return el;}};
 let generated=0,recordedPreview=0;
 const context=vm.createContext({window,document,Event:class{},Audio:class{constructor(){recordedPreview++;}}});
 vm.runInContext(source,context);
 const select=element('select'),status=element('p');
 window.DuoVoicePicker.mount(select,'fr-FR',status,()=>{generated++;});
 const button=created.find(el=>el.tag==='button'&&el.textContent.includes('George'));
 assert.ok(button);button.onclick();
 assert.equal(generated,1);assert.equal(recordedPreview,0);assert.equal(select.value,selectedVoice);
});
test('continuous translation uses shared provider fallback without depending on the hidden iframe',async()=>{
 const html=await readFile(new URL('../preview/v2.10/index.html',import.meta.url),'utf8');
 const mark='translate:async(text,source,target)=>{',start=html.indexOf(mark,html.indexOf('const continuous=window.DuoContinuous.create'));
 const end=html.indexOf('\n },\n onState:',start);
 assert.ok(start>0&&end>start);
 const body=html.slice(start+mark.length,end),calls=[];
 const window={DuoReliable:{translate:async(text,source,target)=>{calls.push({text,source,target});return {text:'Bonjour !',provider:'MyMemory (reserva)'};}}};
 const context=vm.createContext({window,integrateFrameDoc:()=>null,AbortSignal,continuousProvider:''});
 const fn=vm.runInContext('(async(text,source,target)=>{'+body+'})',context);
 assert.equal(await fn('Olá!','pt-BR','fr-FR'),'Bonjour !');
 assert.equal(context.continuousProvider,'MyMemory (reserva)');
 assert.deepEqual(calls,[{text:'Olá!',source:'pt-BR',target:'fr-FR'}]);
 assert.ok(html.includes("if(intState.view==='continuous')$('intContinuousPanel').before($('quickVoicePanel'))"));
});

test('Gemini error falls back to MyMemory without ending the request',async()=>{
 const source=await readFile(new URL('../translation/reliable.js',import.meta.url),'utf8');
 const seen=[];
 const window={DuoAccess:{active:true,aiUrl:'https://gemini.example',fetch:async()=>({ok:false,status:503,json:async()=>({error:'Gemini indisponível (HTTP 503)'})})}};
 const store=browserStore({'duotranslate.provider.v1':JSON.stringify({provider:'gemini'})});
 const context=vm.createContext({window,localStorage:store,URL,AbortController,TextEncoder,Date,setTimeout,clearTimeout,
   fetch:async url=>{seen.push(String(url));return Response.json({responseStatus:200,responseData:{translatedText:'Bonjour'}})}});
 vm.runInContext(source,context);
 const first=await window.DuoReliable.translate('Bom dia','pt-BR','fr-FR');
 assert.equal(first.text,'Bonjour');assert.equal(first.provider,'MyMemory (reserva)');
 assert.ok(first.geminiError.includes('503'));
 const second=await window.DuoReliable.translate('Boa tarde','pt-BR','fr-FR');
 assert.equal(second.provider,'MyMemory');
 assert.equal(seen.length,2);
});

test('local everyday phrasebook works by default and can be disabled explicitly',async()=>{
 const source=await readFile(new URL('../preview/engine-v2.7/phrasebook.js',import.meta.url),'utf8');
 const window={},localStorage=browserStore();
 vm.runInContext(source,vm.createContext({window,localStorage}));
 assert.equal(window.DuoPhrasebook.enabled(),true);
 assert.equal(window.DuoPhrasebook.translate('Bom dia','pt-BR','fr-FR'),'Bonjour');
 assert.equal(window.DuoPhrasebook.translate('Oi, você me escuta?','pt-BR','fr-FR'),null);
 window.DuoPhrasebook.setEnabled(false);
 assert.equal(window.DuoPhrasebook.translate('Bom dia','pt-BR','fr-FR'),null);
});

test('existing history supports all modes and continuous failures with no audio retention',async()=>{
 const history=await readFile(new URL('../history.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../preview/v2.10/index.html',import.meta.url),'utf8');
 assert.match(history,/continuous:'Tradução contínua'/);
 assert.match(history,/listening:'Escutar e traduzir'/);
 assert.ok(history.includes("error:String(entry.error||'')"));
 assert.ok(html.includes('recordContinuousHistory(original,translated)'));
 assert.ok(html.includes("failure:(original,reason)=>recordContinuousHistory(original,'',reason)"));
 assert.ok(!html.includes('localStorage.setItem(key,JSON.stringify(r.stream)'));
});

test('realtime Scribe capture relies on VAD and carries provider closure details',async()=>{
 const code=await readFile(new URL('../cloudflare/realtime-voice.js',import.meta.url),'utf8');
 const client=await readFile(new URL('../voice/continuous.js',import.meta.url),'utf8');
 assert.ok(code.includes("keepalive_interval_ms:'1000'"));
 assert.ok(code.includes("vad_silence_threshold_secs:'1.3'"));
 assert.ok(code.includes("event.code"));
 assert.ok(client.includes('flush(r);'));
 assert.ok(!client.includes('r.commitTimer=setInterval'));
 assert.ok(!client.includes('r.flushTimer=setInterval'));
 assert.ok(!client.includes('commit:r.commitPending===true'));
});

test('common spoken greeting and statement do not produce false MyMemory translations',async()=>{
 const code=await readFile(new URL('../preview/engine-v2.7/phrasebook.js',import.meta.url),'utf8');
 const window={},localStorage=browserStore();
 vm.runInContext(code,vm.createContext({window,localStorage}));
 assert.equal(window.DuoPhrasebook.translate('ola','pt-BR','fr-FR'),'Bonjour');
 assert.equal(window.DuoPhrasebook.translate('Tudo bem.','pt-BR','fr-FR'),'Tout va bien.');
 assert.equal(window.DuoPhrasebook.translate('Tudo bem?','pt-BR','fr-FR'),'Ça va ?');
 assert.equal(window.DuoPhrasebook.translate('Oi, tudo bem, pessoal?','pt-BR','fr-FR'),null);
});

test('2.10 selected ElevenLabs voices are not silently replaced with native voices',async()=>{
 const premium=await readFile(new URL('../preview/engine-v2.7/premium-voice.js',import.meta.url),'utf8');
 const solo=await readFile(new URL('../preview/engine-v2.7/solo.js',import.meta.url),'utf8');
 const pair=await readFile(new URL('../preview/engine-v2.7/app.js',import.meta.url),'utf8');
 assert.ok(premium.includes("const path=individual?'/stream-tts':'/tts'"));
 assert.ok(premium.includes('window.DuoAccess?.active===true'));
 assert.ok(solo.includes('A voz do aparelho não será usada automaticamente.'));
 assert.ok(pair.includes('Nenhuma outra voz foi utilizada.'));
 assert.ok(solo.includes("document.body.dataset.duoContext&&window.DuoPremiumVoice?.configuredFor?.(language)"));
});


test('2.11 adds a separate free mode without changing approved 2.10 CSS or requiring billable services',async()=>{
 const legacy=await readFile(new URL('../preview/v2.10/index.html',import.meta.url),'utf8');
 const fresh=await readFile(new URL('../preview/v2.11/index.html',import.meta.url),'utf8');
 const style=text=>(text.match(/<style[^>]*>([\s\S]*?)<\/style>/)||[])[1];
 assert.ok(style(fresh).startsWith(style(legacy)));
 assert.ok(fresh.includes('id="intOpenFree"'));
 assert.ok(fresh.includes('id="intFreePanel"'));
 assert.ok(fresh.includes('../../voice/free-lab.js'));
 assert.ok(fresh.includes('const confirmCredits='));
 assert.ok(fresh.includes("intState.view==='free'"));
 assert.ok(!legacy.includes('id="intOpenFree"'));
 const ids=[...fresh.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
});

test('2.11 free laboratory is self-contained and has stable-prefix streaming captions',async()=>{
 const code=await readFile(new URL('../voice/free-lab.js',import.meta.url),'utf8');
 for(const forbidden of ['DuoAccess.fetch','DuoReliable.translate','DuoAI.translate','api.mymemory.translated.net','api.elevenlabs.io','api.openai.com']){
  assert.ok(!code.includes(forbidden),'Unexpected commercial or remote translation path: '+forbidden);
 }
 const window={addEventListener(){},speechSynthesis:{getVoices:()=>[],addEventListener(){},cancel(){},speak(){}}};
 vm.runInContext(code,vm.createContext({window,document:{},setTimeout,clearTimeout,performance}));
 assert.equal(window.DuoFreeLab.stablePrefix('Bonjour comment','Bonjour comment ça va'),'Bonjour');
 assert.equal(window.DuoFreeLab.stablePrefix('Bonjour','Bonsoir'),'');
 assert.equal(window.DuoFreeLab.short('pt-BR'),'pt');
 assert.equal(window.DuoFreeLab.short('zh-CN'),'zh-Hans');
});

test('2.11 local translator handles several utterances in order without any remote fetch',async()=>{
 const code=await readFile(new URL('../voice/free-lab.js',import.meta.url),'utf8');
 const elements=new Map(),translateCalls=[];
 function element(id){
  if(elements.has(id))return elements.get(id);
  const e={id,value:'',textContent:'',children:[],handlers:{},checked:id==='freeSpeak'||id==='freeInterrupt',disabled:false,
   addEventListener(name,fn){this.handlers[name]=fn;},click(){return this.handlers.click?.();},
   replaceChildren(...nodes){this.children=nodes;},append(...nodes){this.children.push(...nodes);},
   prepend(node){this.children.unshift(node);},setAttribute(){},get lastChild(){return this.children.at(-1);},
   remove(){this.removed=true;}};
  elements.set(id,e);return e;
 }
 const local={value:new Map(),getItem(k){return this.value.get(k)||null;},setItem(k,v){this.value.set(k,v);}};
 let remoteCalls=0,spoken=0;
 const window={crypto:{randomUUID:()=>String(Math.random())},Translator:{create:async options=>{
  assert.equal(options.sourceLanguage,'pt');assert.equal(options.targetLanguage,'fr');
  return {translate:async original=>{translateCalls.push(original);await new Promise(r=>setImmediate(r));return 'FR: '+original;},destroy(){}};
 }},DuoPhrasebook:{translate:()=>null},speechSynthesis:{getVoices:()=>[{voiceURI:'v1',lang:'fr-FR'}],addEventListener(){},cancel(){},speak(){spoken++;}},addEventListener(){}};
 const document={getElementById:element,createElement:tag=>element(tag+'-new-'+Math.random())};
 const context=vm.createContext({window,document,localStorage:local,performance,setTimeout,clearTimeout,
  SpeechSynthesisUtterance:class {constructor(text){this.text=text;}},fetch(){remoteCalls++;throw Error('Remote fetch forbidden');}});
 vm.runInContext(code,context);window.DuoFreeLab.mount();window.DuoFreeLab.setVisible(true);
 await element('freePrepare').click();
 assert.equal(window.DuoFreeLab.state.prepared,true);
 element('freeSpeak').checked=false;
 element('freeInput').value='Primeira frase';element('freeManual').click();
 element('freeInput').value='Segunda frase';element('freeManual').click();
 await new Promise(r=>setTimeout(r,40));
 assert.deepEqual(translateCalls,['Primeira frase','Segunda frase']);
 assert.equal(element('freeResults').children.length,2);
 assert.equal(remoteCalls,0);assert.equal(spoken,0);
 assert.equal(JSON.parse(local.getItem('duotranslate.local.history.v1')).length,2);
 assert.match(element('freeTranslated').textContent,/Segunda frase/);
 window.DuoFreeLab.setVisible(false);
 assert.equal(window.DuoFreeLab.state.active,false);
});

test('2.11 free mode fails clearly without a local translator rather than calling an external fallback',async()=>{
 const code=await readFile(new URL('../voice/free-lab.js',import.meta.url),'utf8');
 const elements=new Map();
 function el(id){
  if(elements.has(id))return elements.get(id);
  const e={value:'',textContent:'',children:[],handlers:{},checked:false,addEventListener(n,f){this.handlers[n]=f;},
   click(){return this.handlers.click?.();},append(...a){this.children.push(...a);},
   replaceChildren(...a){this.children=a;},prepend(x){this.children.unshift(x);},setAttribute(){}};
  elements.set(id,e);return e;
 }
 let requested=0;
 const window={speechSynthesis:{getVoices:()=>[],addEventListener(){},cancel(){}},addEventListener(){}};
 const document={getElementById:el,createElement:()=>({value:'',textContent:''})};
 vm.runInContext(code,vm.createContext({window,document,localStorage:{getItem:()=>null},performance,setTimeout,clearTimeout,
  fetch(){requested++;throw Error('No paid provider allowed');}}));
 window.DuoFreeLab.mount();window.DuoFreeLab.setVisible(true);
 await el('freePrepare').click();assert.match(el('freeCompat').textContent,/indisponível/);
 el('freeInput').value='Frase livre sem modelo';el('freeManual').click();
 await new Promise(r=>setImmediate(r));
 assert.match(el('freeStatus').textContent,/não está no vocabulário local/);
 assert.equal(requested,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const client=await readFile(new URL('../access/client-v2.16.js',import.meta.url),'utf8');
const original=await readFile(new URL('../preview/v2.15/index.html',import.meta.url),'utf8');
const preview=await readFile(new URL('../preview/v2.16/index.html',import.meta.url),'utf8');

function harness({savedCode=false,liveCode=false,marker=false,existingRole='member'}={}){
 const store=()=>{
  const state=new Map();
  return {getItem:k=>state.get(k)??null,setItem:(k,v)=>state.set(k,String(v)),removeItem:k=>state.delete(k)};
 };
 const localStorage=store(),sessionStorage=store(),calls=[];
 localStorage.setItem('duotranslate.access.session.v1',JSON.stringify({
  token:'a'.repeat(64),user:{id:'member-1',role:existingRole,label:'Host',active:true},
  preferences:{voices:{},voiceEnabled:true}
 }));
 if(savedCode)localStorage.setItem('duotranslate.trusted.access.v210',JSON.stringify({gemini:'owner-code-test'}));
 if(marker)sessionStorage.setItem('duotranslate.pin.session.v1','duo-individual-session');
 const fetch=async (url,options={})=>{
  const path=new URL(String(url)).pathname;
  calls.push({path,headers:options.headers});
  if(path==='/access/session')return Response.json({user:{id:'member-1',role:existingRole,label:'Host',active:true},preferences:{voices:{},voiceEnabled:true}});
  if(path==='/access/admin/login'){
   assert.equal(options.headers['X-Duo-Pin'],'owner-code-test');
   return Response.json({token:'b'.repeat(64),user:{role:'admin',label:'Owner'},preferences:{voices:{},voiceEnabled:true}});
  }
  if(path==='/access/invites'){
   assert.equal(options.headers.Authorization,'Bearer '+'b'.repeat(64));
   return Response.json({invite:'c'.repeat(64),expiresAt:Date.now()+86400000});
  }
  throw Error('Unexpected network operation: '+path);
 };
 const frame={contentDocument:{getElementById(id){return id==='aiWorkerPin'?{value:liveCode?'owner-code-test':marker?'duo-individual-session':''}:null;}}};
 const document={getElementById:id=>id==='duoRealFrame'?frame:null};
 const window={fetch,dispatchEvent(){}};
 const location={href:'https://jvictorsouza217-tech.github.io/duotranslate/preview/v2.16/?v=216',pathname:'/duotranslate/preview/v2.16/',hash:''};
 const env={window,document,localStorage,sessionStorage,location,history:{replaceState(){}},
  URL,URLSearchParams,Request,Response,Headers,Event,AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(client,env,{filename:'access/client-v2.16.js'});
 return {access:window.DuoAccess,calls,localStorage,sessionStorage};
}

for(const variant of [
 {name:'saved code',options:{savedCode:true}},
 {name:'saved code takes precedence over marker',options:{savedCode:true,marker:true}},
 {name:'live Gemini setting used when session stores a marker',options:{liveCode:true,marker:true}}
]){
 test('2.16 creates an authorized invite using '+variant.name,async()=>{
  const {access,calls}=harness(variant.options);
  await access.ready;
  const uri=new URL(await access.inviteGuest('V4957FMF',{hostName:'Anfitrião',hostSpeak:'pt-BR',hostHear:'fr-FR'}));
  assert.equal(access.role,'admin');
  assert.equal(uri.pathname,'/duotranslate/preview/v2.16/');
  assert.equal(uri.searchParams.get('guest'),'1');
  assert.equal(uri.searchParams.get('room'),'V4957FMF');
  assert.equal(uri.hash,'#duo-invite='+ 'c'.repeat(64));
  assert.deepEqual(calls.map(r=>r.path),['/access/session','/access/admin/login','/access/invites']);
 });
}
test('2.16 does not treat session marker as authorization to generate a premium invite',async()=>{
 const {access,calls}=harness({marker:true});
 await access.ready;
 await assert.rejects(()=>access.inviteGuest('V4957FMF'),/Não encontrei um código administrativo válido/);
 assert.deepEqual(calls.map(r=>r.path),['/access/session']);
});
test('2.16 retains exact approved CSS and the guest short-entry UI',()=>{
 const styles=s=>(s.match(/<style[\s\S]*?<\/style>/g)||[]).join('\n');
 assert.equal(styles(original),styles(preview));
 assert.match(preview,/access\/client-v2\.16\.js/);
 assert.match(preview,/Gemini.*voice.*old\.gemini|const gemini=\[/);
 assert.match(preview,/await window\.DuoAccess\.configure\(\{geminiPin:gemini,voicePin:voice\}\)/);
 assert.doesNotMatch(preview,/if\(window\.DuoAccess\?\.active\)\{window\.DuoAccess\.remember\(\);updateTrustedMessage/);
});
test('2.16 preserves one-screen guest entry and server authorization',async()=>{
 const guest=await readFile(new URL('../voice/invite-v213.js',import.meta.url),'utf8');
 const access=await readFile(new URL('../cloudflare/access-store.js',import.meta.url),'utf8');
 assert.match(guest,/Seu nome \(opcional\)/);
 assert.match(guest,/Quero ouvir/);
 assert.match(guest,/Entrar na conversa/);
 assert.match(access,/if\(current\.user\.role!=='admin'\)/);
});

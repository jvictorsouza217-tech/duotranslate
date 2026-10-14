import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const filename=new URL('../access/client-v2.15.js',import.meta.url);
const source=await readFile(filename,'utf8');
const root=new URL('../preview/v2.14/index.html',import.meta.url);
const originalPreview=await readFile(root,'utf8');
const preview215=await readFile(new URL('../preview/v2.15/index.html',import.meta.url),'utf8');

function browser({rememberedPin=true,role='member'}={}) {
 const records=[];
 const holder=()=>{
  const map=new Map();
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),
   removeItem:key=>map.delete(key)};
 };
 const localStorage=holder(),sessionStorage=holder();
 const initial='a'.repeat(64),admin='b'.repeat(64),invite='c'.repeat(64);
 localStorage.setItem('duotranslate.access.session.v1',JSON.stringify({
  token:initial,user:{id:'member-1',role,label:'Host',active:true},
  preferences:{voices:{},voiceEnabled:true}
 }));
 if(rememberedPin)localStorage.setItem('duotranslate.trusted.access.v210',JSON.stringify({gemini:'test-private-pin'}));
 const fetch=async (input,options={})=>{
  const pathname=new URL(String(input)).pathname;
  records.push({path:pathname,options});
  if(pathname==='/access/session')return Response.json({user:{id:'member-1',role,label:'Host',active:true},preferences:{voices:{},voiceEnabled:true}});
  if(pathname==='/access/admin/login') {
   assert.equal(options.headers['X-Duo-Pin'],'test-private-pin');
   return Response.json({token:admin,user:{id:'owner',role:'admin',label:'Owner'},preferences:{voices:{},voiceEnabled:true}});
  }
  if(pathname==='/access/invites'){
   assert.equal(options.headers.Authorization,'Bearer '+admin);
   return Response.json({invite,expiresAt:Date.now()+24*3600000});
  }
  throw Error('Unexpected endpoint: '+pathname);
 };
 const window={fetch,dispatchEvent(){}};
 const location={
  href:'https://jvictorsouza217-tech.github.io/duotranslate/preview/v2.15/?v=215',
  pathname:'/duotranslate/preview/v2.15/',hash:''
 };
 const document={getElementById:()=>null};
 const sandbox={window,location,localStorage,sessionStorage,document,history:{replaceState(){}},
  URL,URLSearchParams,AbortController,Headers,Event,Request,Response,setTimeout,clearTimeout};
 vm.runInNewContext(source,sandbox,{filename:'access/client-v2.15.js'});
 return {access:window.DuoAccess,records};
}

test('2.15 restores owner session automatically when private host code is saved',async()=>{
 const {access,records}=browser();
 await access.ready;
 assert.equal(access.role,'member');
 const url=new URL(await access.inviteGuest('NJXWUT4U',{hostName:'Host',hostSpeak:'pt-BR',hostHear:'fr-FR'}));
 assert.equal(access.role,'admin');
 assert.equal(url.pathname,'/duotranslate/preview/v2.15/');
 assert.equal(url.searchParams.get('room'),'NJXWUT4U');
 assert.equal(url.searchParams.get('guest'),'1');
 assert.equal(url.hash,'#duo-invite='+ 'c'.repeat(64));
 assert.deepEqual(records.map(row=>row.path),['/access/session','/access/admin/login','/access/invites']);
});

test('2.15 offers an actionable recovery step without creating public premium access',async()=>{
 const {access,records}=browser({rememberedPin:false});
 await access.ready;
 await assert.rejects(
  ()=>access.inviteGuest('NJXWUT4U',{hostName:'Host'}),
  /Configurações.*Tradução e IA.*Gemini/
 );
 assert.deepEqual(records.map(row=>row.path),['/access/session']);
});

test('2.15 preserves 2.14 approved UI except for version and import',()=>{
 let expected=originalPreview.replace('<title>DuoTranslate 2.14 — Conversação e vozes</title>',
  '<title>DuoTranslate 2.15 — Conversação e vozes</title>');
 expected=expected.replace('../../access/client-v2.14.js?v=1','../../access/client-v2.15.js?v=1');
 expected=expected.replace('DuoTranslate 2.14 · Escutar com motor local ou atual · Vozes selecionáveis',
  'DuoTranslate 2.15 · Convites simplificados · Escuta e vozes selecionáveis');
 assert.equal(preview215,expected);
});

test('guest quick entry and the backend premium authorization remain in place',async()=>{
 const guest=await readFile(new URL('../voice/invite-v213.js',import.meta.url),'utf8');
 const store=await readFile(new URL('../cloudflare/access-store.js',import.meta.url),'utf8');
 assert.match(guest,/Você foi convidado para conversar!/);
 assert.match(guest,/Seu nome \(opcional\)/);
 assert.match(guest,/Entrar na conversa/);
 assert.match(guest,/autoJoin=true/);
 assert.match(store,/if\(current\.user\.role!=='admin'\)/);
 assert.match(source,/await ensureAdminForInvite\(\)/);
});

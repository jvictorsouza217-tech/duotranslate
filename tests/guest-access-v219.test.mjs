import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const client=await readFile(new URL('../access/client-v2.19.js',import.meta.url),'utf8');
const token='d'.repeat(64),invite='e'.repeat(64);
function store(){const values=new Map();return {
 getItem:key=>values.get(key)??null,setItem:(key,v)=>values.set(key,String(v)),removeItem:key=>values.delete(key)};}
function create({localStorage=store(),sessionStorage=store(),hash='#duo-invite='+invite,search='?duoGuest=1&duoRoom='+'a'.repeat(32),failures=0,statusCode=200}={}){
 const calls=[],historyCalls=[],location={href:'https://jvictorsouza217-tech.github.io/duotranslate/preview/v2.19/'+search+hash,
  pathname:'/duotranslate/preview/v2.19/',search,hash};
 const nativeFetch=async(url,opts={})=>{
  calls.push({url:String(url),headers:opts.headers,body:opts.body});
  if(calls.length<=failures)throw Error('simulated network unavailable');
  if(statusCode!==200)return Response.json({error:'Convite expirado.'},{status:statusCode});
  return Response.json({token,user:{id:'member-test',role:'member',active:true,label:'Guest'},preferences:{voices:{},voiceEnabled:true}});
 };
 const document={getElementById:()=>null,addEventListener(){}},window={fetch:nativeFetch,dispatchEvent(){}};
 const history={replaceState(a,b,url){historyCalls.push(url);location.href=url;location.hash=new URL(url).hash;}};
 const sandbox={window,document,history,location,localStorage,sessionStorage,URL,URLSearchParams,
  Headers,Request,Response,AbortController,Event,setTimeout,clearTimeout};
 vm.runInNewContext(client,sandbox,{filename:'access/client-v2.19.js'});
 return {access:window.DuoAccess,localStorage,sessionStorage,calls,location,historyCalls};
}

test('v2.19 recovers guest voice token after a transient failed API request',async()=>{
 const c=create({failures:1});await c.access.ready;
 assert.equal(c.calls.length,2);
 assert.equal(c.access.role,'member');
 assert.equal(c.sessionStorage.getItem('duotranslate.pending.invite.v219'),null);
 assert.equal(c.historyCalls.length,1);
 assert.equal(c.location.hash,'');
 assert.equal(JSON.parse(c.localStorage.getItem('duotranslate.access.session.v1')).token,token);
});
test('v2.19 stores only a pending same-tab one-time token if both network attempts fail',async()=>{
 const localStorage=store(),sessionStorage=store();
 const a=create({localStorage,sessionStorage,failures:2});await a.access.ready;
 assert.equal(a.access.active,false);
 assert.equal(sessionStorage.getItem('duotranslate.pending.invite.v219'),invite);
 const b=create({localStorage,sessionStorage,hash:'',failures:0});await b.access.ready;
 assert.equal(b.access.role,'member');
 assert.equal(sessionStorage.getItem('duotranslate.pending.invite.v219'),null);
});
test('v2.19 drops invalid or expired guest token and does not silently claim premium authorization',async()=>{
 const c=create({statusCode:401});await c.access.ready;
 assert.equal(c.access.active,false);
 assert.equal(c.sessionStorage.getItem('duotranslate.pending.invite.v219'),null);
});
test('v2.19 never redeems a stale guest token on an unrelated owner screen',async()=>{
 const localStorage=store(),sessionStorage=store();
 sessionStorage.setItem('duotranslate.pending.invite.v219',invite);
 const c=create({localStorage,sessionStorage,hash:'',search:'?inicio=1'});await c.access.ready;
 assert.equal(c.calls.length,0);
 assert.equal(c.access.active,false);
});

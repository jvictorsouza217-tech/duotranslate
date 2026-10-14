import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DuoRoom217} from '../cloudflare/room-v217.js';
import worker from '../cloudflare/gemini-worker.js';

const root=new URL('../',import.meta.url);
const source=await readFile(new URL('voice/connected-v217.js',root),'utf8');
const preview=await readFile(new URL('preview/v2.17/index.html',root),'utf8');
const old=await readFile(new URL('preview/v2.16/index.html',root),'utf8');
const client=await readFile(new URL('access/client-v2.17.js',root),'utf8');
const wrangler=JSON.parse(await readFile(new URL('wrangler.jsonc',root),'utf8'));
const origin='https://jvictorsouza217-tech.github.io';
const validTicket='a'.repeat(32);

class MockSocket {
 constructor(role){this.readyState=1;this.meta={role,name:'',speaks:'',hears:'',period:Date.now(),sent:0};this.messages=[];}
 deserializeAttachment(){return this.meta;}
 serializeAttachment(value){this.meta=structuredClone(value);}
 send(value){this.messages.push(JSON.parse(value));}
 close(){this.readyState=3;}
}
function simulate(){
 const host=new MockSocket('host'),guest=new MockSocket('guest');
 const ctx={getWebSockets:()=>[host,guest]};
 return {host,guest,room:new DuoRoom217(ctx,{})};
}
const hello=(name,speaks,hears)=>({type:'hello',name,speaks,hears});

test('2.17 browser client compiles, uses short voice setup instead of legacy connected journey',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.doesNotThrow(()=>new vm.Script(client));
 assert.match(preview,/\$\('intOpenLive'\)\.onclick=\(\)=>\{void window\.DuoConnected217\.openHost\(\);\}/);
 assert.match(preview,/voice\/connected-v217\.js/);
 assert.doesNotMatch(preview,/<script src="\.\.\/\.\.\/voice\/invite-v213\.js/);
 assert.match(source,/window\.DuoConnected217=\{openHost,stop:close/);
 assert.match(source,/new WebSocket\(socketUrl\(\)\)/);
 assert.doesNotMatch(source,/new window\.Peer\(|peer\.connect\(peerId\(/);
 assert.match(source,/duoGuest/);
 assert.match(source,/navigator\.mediaDevices\.getUserMedia/);
 assert.match(source,/continuous=true/);
 assert.match(source,/window\.DuoReliable\.translate/);
 assert.match(source,/await premiumSpeech/);
});
test('2.17 CSS of approved interface unchanged; backup modes remain',()=>{
 const css=html=>(html.match(/<style[\s\S]*?<\/style>/g)||[]).join('\n');
 assert.equal(css(preview),css(old));
 assert.match(preview,/voice\/continuous\.js/);
 assert.match(preview,/voice\/listening-v214\.js/);
 assert.match(preview,/voice\/free-lab\.js/);
 assert.match(preview,/engine-v2.12/);
});
test('2.17 binding and migration extend, not replace, existing access store',()=>{
 assert.ok(wrangler.durable_objects.bindings.some(x=>x.name==='DUO_ACCESS_STORE'));
 assert.ok(wrangler.durable_objects.bindings.some(x=>x.name==='DUO_ROOMS_217'&&x.class_name==='DuoRoom217'));
 assert.ok(wrangler.migrations.some(x=>x.tag==='duo-conversation-room-v217'&&x.new_sqlite_classes.includes('DuoRoom217')));
});
test('2.17 Worker blocks invalid room ticket and routes correct WebSocket without touching Gemini API',async()=>{
 let ticketName='',requests=0;
 const env={DUO_ROOMS_217:{idFromName(x){ticketName=x;return x;},get(){return {fetch:async()=>{requests++;return Response.json({ok:true});}}}}};
 const fail=await worker.fetch(new Request('https://example.workers.dev/room/v217?ticket=not-valid',{headers:{Origin:origin,Upgrade:'websocket'}}),env);
 assert.equal(fail.status,400);
 const wrong=await worker.fetch(new Request('https://example.workers.dev/room/v217?ticket='+validTicket,{headers:{Origin:origin}}),env);
 assert.equal(wrong.status,426);
 const good=await worker.fetch(new Request('https://example.workers.dev/room/v217?ticket='+validTicket+'&role=guest',{headers:{Origin:origin,Upgrade:'websocket'}}),env);
 assert.equal(good.status,200);
 assert.equal(requests,1);assert.equal(ticketName,validTicket);
 const cross=await worker.fetch(new Request('https://example.workers.dev/room/v217?ticket='+validTicket,{headers:{Origin:'https://bad-site.example',Upgrade:'websocket'}}),env);
 assert.equal(cross.status,403);
});
test('2.17 room pairs only after both hello messages and routes translated voice text',()=>{
 const {host,guest,room}=simulate();
 room.webSocketMessage(host,JSON.stringify(hello('João','pt-BR','fr-FR')));
 assert.equal(host.messages.at(-1).type,'waiting');
 room.webSocketMessage(guest,JSON.stringify(hello('Jérôme','fr-FR','pt-BR')));
 assert.equal(host.messages.at(-1).type,'paired');
 assert.equal(guest.messages.at(-1).type,'paired');
 assert.equal(host.messages.at(-1).peer.hears,'pt-BR');
 const spoken={type:'speech',original:'Olá, como foi o dia?',translation:'Bonjour, comment était ta journée ?',target:'fr-FR',provider:'Gemini'};
 room.webSocketMessage(host,JSON.stringify(spoken));
 assert.equal(guest.messages.at(-1).type,'speech');
 assert.equal(guest.messages.at(-1).translation,spoken.translation);
 assert.equal(host.messages.at(-1).type,'delivered');
 assert.ok(!JSON.stringify(guest.messages).includes('API_KEY'));
});
test('2.17 room rejects mismatched languages, oversized payload and third-party commands',()=>{
 const {host,guest,room}=simulate();
 room.webSocketMessage(host,JSON.stringify(hello('Host','pt-BR','fr-FR')));
 room.webSocketMessage(guest,JSON.stringify(hello('Guest','fr-FR','pt-BR')));
 const count=guest.messages.length;
 room.webSocketMessage(host,JSON.stringify({type:'speech',original:'olá',translation:'bonjour',target:'en-US'}));
 room.webSocketMessage(host,JSON.stringify({type:'admin',message:'grant access'}));
 room.webSocketMessage(host,'a'.repeat(5001));
 assert.equal(guest.messages.length,count);
 assert.ok(host.messages.some(m=>m.type==='error'));
});
test('2.17 transcript and speech remain separate from WebSocket transport; voice no silent premium fallback',()=>{
 assert.match(source,/send\(\{type:'speech',original:/);
 assert.match(source,/window\.DuoAccess\.fetch\(window\.DuoAccess\.voiceUrl\+'\/tts'/);
 assert.match(source,/if\(session\.voice==='local'\)await localSpeech\(text\)/);
 assert.match(source,/else for\(let i=0;i<text\.length;i\+=200\)await premiumSpeech/);
 assert.doesNotMatch(source,/catch.*await localSpeech/);
});

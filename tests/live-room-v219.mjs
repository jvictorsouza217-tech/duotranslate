/* Live, no-API-credit network smoke test for the deployed DuoTranslate room Worker.
 * Runs on GitHub Actions only. Uses random ticket, fake phrases, no microphone or secrets.
 */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';

if(typeof WebSocket!=='function')throw Error('Node 22+ WebSocket required');
const ticket=randomBytes(16).toString('hex');
const root='wss://duotranslate-ai.jvictorsouza217.workers.dev/room/v217';
const agents=[];

function connect(role){
 return new Promise((resolve,reject)=>{
  const url=root+'?ticket='+ticket+'&role='+role;
  const ws=new WebSocket(url);
  const client={ws,role,messages:[],waiters:[]};agents.push(client);
  const timeout=setTimeout(()=>reject(Error(role+' did not open WebSocket in 15 seconds.')),15000);
  ws.addEventListener('message',evt=>{
   let msg;try{msg=JSON.parse(String(evt.data));}catch{return;}
   client.messages.push(msg);
   for(const waiter of [...client.waiters])if(waiter.match(msg)){
    clearTimeout(waiter.timer);client.waiters.splice(client.waiters.indexOf(waiter),1);waiter.resolve(msg);
   }
  });
  ws.addEventListener('open',()=>{clearTimeout(timeout);resolve(client);},{once:true});
  ws.addEventListener('error',()=>{clearTimeout(timeout);reject(Error(role+' WebSocket network error.'));},{once:true});
  ws.addEventListener('close',evt=>{
   if(ws.readyState!==WebSocket.OPEN&&client.messages.length===0)
    console.error(role+' closed early: '+evt.code+' '+evt.reason);
  },{once:true});
 });
}

function message(agent,type,timeoutMs=12000){
 const existing=agent.messages.find(msg=>msg.type===type);
 if(existing)return Promise.resolve(existing);
 return new Promise((resolve,reject)=>{
  const waiter={match:msg=>msg.type===type,resolve,timer:null};
  waiter.timer=setTimeout(()=>{
   agent.waiters=agent.waiters.filter(w=>w!==waiter);
   reject(Error(agent.role+' did not receive '+type+'. Events: '+JSON.stringify(agent.messages.map(x=>x.type))));
  },timeoutMs);
  agent.waiters.push(waiter);
 });
}

try {
 const voice=await fetch('https://duotranslate.jvictorsouza217.workers.dev/health',{signal:AbortSignal.timeout(12000)});
 assert.equal(voice.status,200,'Voice Worker /health must be online');
 const voiceJson=await voice.json();
 assert.equal(voiceJson.configured,true,'Voice Worker must report configured credentials');
 assert.equal(voiceJson.individualAccess,true,'Voice Worker must expose individual access');
 console.log('Voice Worker health OK (no audio or paid API call).');

 const host=await connect('host');const guest=await connect('guest');
 host.ws.send(JSON.stringify({type:'hello',name:'Demo Host',speaks:'pt-BR',hears:'pt-BR'}));
 guest.ws.send(JSON.stringify({type:'hello',name:'Demo Guest',speaks:'fr-FR',hears:'fr-FR'}));
 const [a,b]=await Promise.all([message(host,'paired'),message(guest,'paired')]);
 assert.equal(a.peer.speaks,'fr-FR');assert.equal(b.peer.speaks,'pt-BR');
 console.log('Two participants paired on deployed Cloudflare WebSocket.');

 host.ws.send(JSON.stringify({type:'ping',stamp:'offline-free-test'}));
 assert.equal((await message(host,'pong')).stamp,'offline-free-test');
 host.ws.send(JSON.stringify({type:'speech',original:'dummy phrase',translation:'phrase fictive',target:'fr-FR',provider:'smoke-test'}));
 const received=await message(guest,'speech');
 assert.equal(received.translation,'phrase fictive');
 assert.equal(received.target,'fr-FR');
 await message(host,'delivered');
 console.log('Free live delivery and acknowledgement passed in both WebSocket endpoints.');
}finally{
 for(const agent of agents){try{agent.ws.close();}catch{}}
}

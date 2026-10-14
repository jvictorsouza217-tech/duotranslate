/* DuoTranslate 2.17 — ephemeral two-person WebSocket rooms.
   Messages contain translated text only; no microphone audio or provider secrets.
   Room membership is controlled by an unguessable 128-bit link token. */
const LANGS=new Set(['pt-BR','fr-FR','en-US','es-ES','it-IT','de-DE','ar-SA','zh-CN','nl-NL','pl-PL','ro-RO','uk-UA','ru-RU','tr-TR']);
const allowedTypes=new Set(['hello','speech','ping']);
function data(ws){try{return ws.deserializeAttachment()||{};}catch{return {};}}
function send(ws,payload){try{ws.send(JSON.stringify(payload));}catch{}}
function publicPeer(value){
 return {name:String(value.name||'Convidado').slice(0,40),
  speaks:LANGS.has(value.speaks)?value.speaks:'pt-BR',
  hears:LANGS.has(value.hears)?value.hears:'fr-FR'};
}
export class DuoRoom217 {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 sockets(){return this.ctx.getWebSockets().filter(ws=>ws.readyState===1);}
 async fetch(request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket necessário.',{status:426});
  if(this.sockets().length>=2)return new Response('Sala já possui dois aparelhos.',{status:409});
  const role=new URL(request.url).searchParams.get('role');
  if(!['host','guest'].includes(role))return new Response('Participante inválido.',{status:400});
  if(this.sockets().some(ws=>data(ws).role===role))return new Response('Este lado da sala já está conectado.',{status:409});
  const [client,server]=Object.values(new WebSocketPair());
  this.ctx.acceptWebSocket(server,[role]);
  server.serializeAttachment({role,name:'',speaks:'',hears:'',sent:0,period:Date.now()});
  send(server,{type:'ready',role});
  this.sync();
  return new Response(null,{status:101,webSocket:client});
 }
 sync(){
  const sockets=this.sockets(),host=sockets.find(ws=>data(ws).role==='host'),guest=sockets.find(ws=>data(ws).role==='guest');
  if(!host||!guest||!data(host).speaks||!data(guest).speaks){
   for(const ws of sockets)send(ws,{type:'waiting'});
   return;
  }
  send(host,{type:'paired',peer:publicPeer(data(guest))});
  send(guest,{type:'paired',peer:publicPeer(data(host))});
 }
 webSocketMessage(ws,message){
  if(typeof message!=='string'||message.length>5000){send(ws,{type:'error',message:'Mensagem grande demais.'});return;}
  let item;try{item=JSON.parse(message);}catch{return;}
  if(!item||!allowedTypes.has(item.type))return;
  if(item.type==='ping'){send(ws,{type:'pong',stamp:String(item.stamp||'').slice(0,50)});return;}
  if(item.type==='hello'){
   if(!LANGS.has(item.speaks)||!LANGS.has(item.hears)||item.speaks===item.hears){
    send(ws,{type:'error',message:'Idiomas inválidos.'});return;
   }
   const prev=data(ws);
   ws.serializeAttachment({...prev,name:String(item.name||'Convidado').slice(0,40),speaks:item.speaks,hears:item.hears});
   this.sync();return;
  }
  if(item.type==='speech'){
   const original=String(item.original||'').trim(),translation=String(item.translation||'').trim();
   if(!original||!translation||original.length>600||translation.length>900)return;
   const sockets=this.sockets(),partner=sockets.find(other=>other!==ws);
   if(!partner||!data(partner).hears){send(ws,{type:'waiting'});return;}
   const sender=data(ws),now=Date.now(),period=now-sender.period<60000?sender:{...sender,period:now,sent:0};
   if(period.sent>=20){send(ws,{type:'error',message:'Muitas falas por minuto. Aguarde um instante.'});return;}
   if(!LANGS.has(item.target)||item.target!==data(partner).hears){
    send(ws,{type:'error',message:'O idioma do outro celular mudou. Aguarde a sincronização.'});return;
   }
   ws.serializeAttachment({...period,sent:period.sent+1});
   send(partner,{type:'speech',original,translation,source:sender.speaks,target:item.target,provider:String(item.provider||'').slice(0,35)});
   send(ws,{type:'delivered'});
  }
 }
 webSocketClose(ws){
  try{ws.close(1000,'Sala encerrada.');}catch{}
  for(const other of this.sockets())if(other!==ws)send(other,{type:'waiting'});
 }
 webSocketError(ws){
  try{ws.close(1011,'Falha de conexão.');}catch{}
  for(const other of this.sockets())if(other!==ws)send(other,{type:'waiting'});
 }
}

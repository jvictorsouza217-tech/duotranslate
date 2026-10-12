import {accessStore,bearer,ACCESS_ORIGIN} from './access-store.js';

// A bearer failure never falls back to a shared developer PIN.
export async function individualAccess(request,env,voice=false) {
 if(!request.headers.has('Authorization'))return null;
 const token=bearer(request);
 if(!token)return {status:401,error:'Acesso individual inválido.'};
 if(voice ? !env.DUO_ACCESS_SERVICE : !env.DUO_ACCESS_STORE)
  return {status:503,error:'O acesso individual ainda não foi ativado pelo administrador.'};
 const check=new Request('https://duo-access-store.internal/check',{
  headers:{Authorization:'Bearer '+token,Origin:ACCESS_ORIGIN}
 });
 let response;
 try {
  response=voice
   ? await env.DUO_ACCESS_SERVICE.fetch(new Request('https://duo-access-service.internal/access/check',check))
   : await accessStore(env).fetch(check);
 } catch(e) {return {status:503,error:'Não foi possível verificar seu acesso. Tente novamente.'};}
 let value;
 try {value=await response.json();}catch(e){return {status:503,error:'Serviço de acesso indisponível.'};}
 if(!response.ok || value.authorized!==true)return {status:response.status===401?401:503,error:value.error||'Acesso individual recusado.'};
 return {user:value.user};
}

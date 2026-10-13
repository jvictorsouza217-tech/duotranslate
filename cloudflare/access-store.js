/* Individual, revocable device access. Tokens are random and only hashes are stored.
 * No audio, translations, API keys or provider access codes are stored here.
 */
export const ACCESS_ORIGIN = 'https://jvictorsouza217-tech.github.io';
export const ACCESS_SERVICES = {
 ai: 'https://duotranslate-ai.jvictorsouza217.workers.dev',
 voice: 'https://duotranslate.jvictorsouza217.workers.dev'
};
const DAY = 86400000;
const LANGS = new Set(['pt-BR','fr-FR','en-US','es-ES','it-IT','de-DE','ar-SA','zh-CN','nl-NL','pl-PL','ro-RO','uk-UA','ru-RU','tr-TR']);
const tokenPattern = /^[a-f0-9]{64}$/;
export function accessHeaders() {
 return {'Access-Control-Allow-Origin':ACCESS_ORIGIN,'Access-Control-Allow-Headers':'Content-Type, X-Duo-Pin, Authorization',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
}
export function accessJson(value, status=200) {
 return new Response(JSON.stringify(value), {status,headers:{'Content-Type':'application/json; charset=utf-8',...accessHeaders()}});
}
export function bearer(request) {
 const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') || '');
 return match ? match[1] : '';
}
async function digest(value) {
 const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 return Array.from(bytes, x=>x.toString(16).padStart(2,'0')).join('');
}
function randomToken() {
 return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
}
async function readJson(request) {
 if(!String(request.headers.get('Content-Type')||'').includes('application/json'))throw new Error('Envie JSON.');
 const text=await request.text();
 if(text.length>5000)throw new Error('Solicitação muito grande.');
 const value=JSON.parse(text);
 if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('JSON inválido.');
 return value;
}
function preferences(value={}) {
 if(!value || typeof value!=='object' || Array.isArray(value))value={};
 const voices={};
 for(const [lang,id] of Object.entries(value.voices&&typeof value.voices==='object'?value.voices:{})) {
  if(LANGS.has(lang) && typeof id==='string' && /^[a-zA-Z0-9]{12,40}$/.test(id))voices[lang]=id;
 }
 return {voices,voiceEnabled:value.voiceEnabled===true};
}
function publicUser(user) {
 return {id:user.id,label:user.label,role:user.role,active:user.active,createdAt:user.createdAt,activatedAt:user.activatedAt||null,inviteExpiresAt:user.inviteExpiresAt||null,status:!user.active?'revoked':user.activatedAt||user.role==='admin'?'active':user.inviteExpiresAt?(user.inviteExpiresAt<=Date.now()?'expired':'pending'):'unknown'};
}

export class DuoAccessStore {
 constructor(state) { this.storage=state.storage; }
 async session(storage, token) {
  if(!tokenPattern.test(token))return null;
  const session=await storage.get('session:'+await digest(token));
  if(!session || session.expiresAt<=Date.now())return null;
  const user=await storage.get('user:'+session.userId);
  return user && user.active ? {user,expiresAt:session.expiresAt} : null;
 }
 async issueSession(storage, user) {
  const token=randomToken(),expiresAt=Date.now()+30*DAY;
  await storage.put('session:'+await digest(token),{userId:user.id,expiresAt});
  return {token,expiresAt,user:publicUser(user),services:ACCESS_SERVICES,preferences:user.preferences};
 }
 async fetch(request) {
  const path=new URL(request.url).pathname;
  let input={};
  if(request.method==='POST') {
   try { input=await readJson(request); } catch(e) { return accessJson({error:e.message},400); }
  } else if(request.method!=='GET')return accessJson({error:'Rota não encontrada.'},404);
  const token=bearer(request);
  // Transactions serialize redemption and revocation, including competing devices.
  return this.storage.transaction(async storage=>{
   if(path==='/owner' && request.method==='POST') {
    // Only the outer Worker can invoke this internal route after checking its secret.
    let user=await storage.get('user:owner');
    if(!user)user={id:'owner',label:'Administrador',role:'admin',active:true,createdAt:Date.now(),preferences:preferences(input.preferences)};
    user.preferences=preferences(input.preferences);
    await storage.put('user:owner',user);
    return accessJson(await this.issueSession(storage,user));
   }
   if(path==='/redeem' && request.method==='POST') {
    if(!tokenPattern.test(input.invite||''))return accessJson({error:'Convite inválido.'},401);
    const key='invite:'+await digest(input.invite),invite=await storage.get(key);
    if(!invite || invite.expiresAt<=Date.now())return accessJson({error:'Convite expirado ou já utilizado. Peça um novo convite.'},401);
    const user=await storage.get('user:'+invite.userId);
    if(!user || !user.active)return accessJson({error:'Este acesso foi revogado.'},401);
    await storage.delete(key);
    user.activatedAt=Date.now();await storage.put('user:'+user.id,user);
    return accessJson(await this.issueSession(storage,user));
   }
   const current=await this.session(storage,token);
   if(!current)return accessJson({error:'Seu acesso expirou ou foi revogado. Peça um novo convite.'},401);
   if(['/session','/check'].includes(path) && current.expiresAt-Date.now()<7*DAY){
    current.expiresAt=Date.now()+30*DAY;
    await storage.put('session:'+await digest(token),{userId:current.user.id,expiresAt:current.expiresAt});
   }
   if(path==='/session' && request.method==='GET') {
    return accessJson({expiresAt:current.expiresAt,user:publicUser(current.user),services:ACCESS_SERVICES,preferences:current.user.preferences});
   }
   if(path==='/check' && request.method==='GET')return accessJson({authorized:true,user:publicUser(current.user)});
   if(path==='/profile' && request.method==='POST'){
    const name=typeof input.name==='string'?input.name.trim().slice(0,60):'';
    if(!name)return accessJson({error:'Informe seu nome.'},400);
    current.user.label=name;current.user.activatedAt ||= Date.now();
    await storage.put('user:'+current.user.id,current.user);
    return accessJson({user:publicUser(current.user)});
   }
   if(current.user.role!=='admin')return accessJson({error:'Somente o administrador pode gerenciar acessos.'},403);
   if(path==='/invites' && request.method==='POST') {
    const hours=input.expiresInHours===undefined?24:Number(input.expiresInHours);
    if(!Number.isFinite(hours) || hours<1 || hours>168)return accessJson({error:'O convite deve durar entre 1 e 168 horas.'},400);
    const user={id:crypto.randomUUID(),label:String(input.label||'Convidado').trim().slice(0,60)||'Convidado',
     role:'member',active:true,createdAt:Date.now(),preferences:preferences(input.preferences)};
    const invite=randomToken(),expiresAt=Date.now()+hours*3600000;
    user.inviteExpiresAt=expiresAt;
    await storage.put('user:'+user.id,user);
    await storage.put('invite:'+await digest(invite),{userId:user.id,expiresAt});
    return accessJson({invite,expiresAt,user:publicUser(user)});
   }
   if(path==='/users' && request.method==='GET') {
    const users=await storage.list({prefix:'user:',limit:200});
    return accessJson({users:Array.from(users.values(),publicUser)});
   }
   if(path==='/revoke' && request.method==='POST') {
    if(input.userId==='owner')return accessJson({error:'O administrador não pode revogar o próprio acesso por esta rota.'},400);
    const user=await storage.get('user:'+String(input.userId||''));
    if(!user)return accessJson({error:'Acesso não encontrado.'},404);
    user.active=false;
    await storage.put('user:'+user.id,user);
    return accessJson({revoked:true,user:publicUser(user)});
   }
   return accessJson({error:'Rota não encontrada.'},404);
  });
 }
}

export function accessStore(env) {
 return env.DUO_ACCESS_STORE.get(env.DUO_ACCESS_STORE.idFromName('duotranslate-individual-access-v1'));
}
export async function handleAccessRequest(request,env,checkAdmin) {
 const path=new URL(request.url).pathname;
 const routes={'/access/admin/login':'/owner','/access/redeem':'/redeem','/access/session':'/session',
  '/access/check':'/check','/access/profile':'/profile','/access/invites':'/invites','/access/users':'/users','/access/revoke':'/revoke'};
 if(!Object.hasOwn(routes,path))return accessJson({error:'Rota não encontrada.'},404);
 const method=['/access/session','/access/check','/access/users'].includes(path)?'GET':'POST';
 if(request.method!==method)return accessJson({error:'Método não permitido.'},405);
 if(!env.DUO_ACCESS_STORE)return accessJson({error:'O acesso individual ainda não foi ativado pelo administrador.'},503);
 if(path==='/access/admin/login') {
  if(!env.DUO_ACCESS_CODE)return accessJson({error:'Acesso administrativo não configurado.'},503);
  if(env.AI_RATE_LIMITER) {
   const ip=request.headers.get('CF-Connecting-IP')||'unknown';
   const rate=await env.AI_RATE_LIMITER.limit({key:'duotranslate-access-login:'+await digest(ip)});
   if(!rate.success)return accessJson({error:'Muitas tentativas de acesso. Aguarde um minuto.'},429);
  }
  if(!await checkAdmin(request.headers.get('X-Duo-Pin'),env.DUO_ACCESS_CODE))return accessJson({error:'Código administrativo inválido.'},401);
 }
 const internal=new Request('https://duo-access-store.internal'+routes[path],request);
 try {return await accessStore(env).fetch(internal);}
 catch(e) {return accessJson({error:'Acesso individual indisponível. Tente novamente mais tarde.'},503);}
}

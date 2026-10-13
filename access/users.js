(() => {
'use strict';
async function mount(){
 await window.DuoAccess.ready;
 const host=document.getElementById('trustedCodesBox');if(!host)return;
 const section=document.createElement('section');section.hidden=true;
 const title=document.createElement('h3');title.textContent='Convites e usuários';
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Ver convites e usuários';
 const notice=document.createElement('p');notice.setAttribute('role','status');
 const list=document.createElement('div');section.append(title,refresh,notice,list);host.append(section);
 const labels={pending:'Convite criado — aguardando ativação',active:'Acesso ativado',expired:'Convite expirado',revoked:'Acesso revogado',unknown:'Acesso antigo — ativação não registrada'};
 async function render(){
  refresh.disabled=true;notice.textContent='Carregando…';
  try{const data=await window.DuoAccess.admin.users();list.replaceChildren();
   for(const user of data.users.filter(u=>u.role!=='admin')){
    const row=document.createElement('div');row.className='int-profile-row';const info=document.createElement('div');
    const name=document.createElement('strong');name.textContent=user.label;
    const status=document.createElement('p');status.textContent=(labels[user.status]||labels.unknown)+(user.activatedAt?' · '+new Date(user.activatedAt).toLocaleString():'');
    info.append(name,status);row.append(info);
    if(user.active){const revoke=document.createElement('button');revoke.type='button';revoke.textContent='Revogar acesso';revoke.onclick=async()=>{if(!window.confirm('Revogar o acesso de '+user.label+'?'))return;revoke.disabled=true;try{await window.DuoAccess.admin.revoke(user.id);await render();}catch(e){notice.textContent=e.message;revoke.disabled=false;}};row.append(revoke);}
    list.append(row);
   }
   notice.textContent='O nome aparece após o cadastro. Criar ou copiar um convite não confirma que ele foi enviado.';
  }catch(e){notice.textContent=e.message;}finally{refresh.disabled=false;}
 }
 refresh.onclick=render;
 const visibility=()=>{section.hidden=window.DuoAccess.role!=='admin';};
 visibility();window.addEventListener('duo-access-changed',visibility);
}
mount();
})();

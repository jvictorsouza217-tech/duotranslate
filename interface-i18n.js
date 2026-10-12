/* DuoTranslate v1.5 — localização inicial da interface (textos fixos).
   Mensagens técnicas/status dinâmicos podem continuar em português nesta beta. */
(() => {
'use strict';
const select=document.getElementById('interfaceLanguage');
if(!select)return;
const entries={
 '#usageTitle':['Consumo e segurança','Usage & security','Utilisation et sécurité','Consumo y seguridad'],
 '#aiTitle':['Tradutor por inteligência artificial','AI translator','Traducteur IA','Traductor con IA'],
 '#solo-title':['Modo teste individual','Solo test mode','Mode test individuel','Modo de prueba individual'],
 '#localHistoryTitle':['Histórico local e qualidade','Local history & quality','Historique local et qualité','Historial local y calidad'],
 '#setup-title':['Seu idioma','Your language','Votre langue','Tu idioma'],
 '#room-title':['Conectar os celulares','Connect the phones','Connecter les téléphones','Conectar los teléfonos'],
 '#listen-title':['Conversa ao vivo','Live conversation','Conversation en direct','Conversación en directo'],
 '#history-title':['Conversação','Conversation','Conversation','Conversación'],
 '#usageReset':['Zerar contador deste navegador','Reset counter on this browser','Réinitialiser ce compteur local','Restablecer contador local'],
 '#aiTestBtn':['✦ Testar IA com uma frase em francês','✦ Test AI with a French sentence','✦ Tester l’IA avec une phrase en français','✦ Probar IA con una frase en francés'],
 '#soloSample':['▶ Testar frase de exemplo','▶ Test sample sentence','▶ Tester une phrase exemple','▶ Probar frase de ejemplo'],
 '#exportJson':['↓ Exportar JSON','↓ Export JSON','↓ Exporter JSON','↓ Exportar JSON'],
 '#exportCsv':['↓ Exportar CSV','↓ Export CSV','↓ Exporter CSV','↓ Exportar CSV'],
 '#eraseHistory':['Excluir histórico','Delete history','Effacer l’historique','Eliminar historial'],
 '#solo .solo-intro':['Teste a tradução sozinho antes de conversar com outra pessoa. O celular escuta francês e lê a tradução em português, ou faz o inverso.','Test the translation alone before speaking with someone else. Listen and translate into your chosen language.','Testez la traduction seul avant de parler avec une autre personne. Écoutez et traduisez vers la langue choisie.','Prueba la traducción a solas antes de hablar con otra persona. Escucha y traduce al idioma elegido.'],
 '#solo .solo-tip':['Teste real de áudio: coloque francês tocando na TV, no PC ou em outro aparelho, perto do microfone. O site não captura automaticamente o som interno de vídeos no mesmo telefone. Mantenha a tela ligada.','Audio test: play speech on another device near the microphone. Audio from videos playing on this phone is not captured automatically. Keep the screen awake.','Test audio : jouez une voix sur un autre appareil près du micro. Le son des vidéos de ce téléphone n’est pas capté automatiquement. Gardez l’écran allumé.','Prueba de audio: reproduce voz en otro dispositivo cerca del micrófono. El audio de vídeos en este teléfono no se capta automáticamente. Mantén la pantalla encendida.'],
 '.history-intro':['Salve frases reconhecidas, traduções e tempos neste navegador. Exporte os resultados e peça comparação ou revisão por IA quando quiser.','Save recognized speech, translations and timings in this browser. Export, compare and review them with AI when you choose.','Enregistrez les phrases, traductions et durées dans ce navigateur. Exportez, comparez et analysez avec l’IA à votre demande.','Guarda las frases reconocidas, las traducciones y los tiempos en este navegador. Exporta, compara y analiza con IA cuando quieras.'],
 '.ai-provider-note':['Compare a tradução tradicional com uma IA que entende expressões e contexto. A voz e o microfone continuam iguais; o que muda é o tradutor de texto.','Compare traditional translation with context-aware AI. The microphone and voice remain the same.','Comparez la traduction classique avec une IA qui comprend le contexte. Le micro et la voix ne changent pas.','Compara la traducción tradicional con una IA que comprende el contexto. El micrófono y la voz no cambian.'],
 '#soloForm label':['Ou escreva qualquer frase para testar','Or type a sentence to test','Ou saisissez une phrase à tester','O escribe una frase para probar'],
 '#solo label[for="soloTarget"]':['Idioma para traduzir','Translate into','Traduire vers','Traducir a'],
 '#solo label[for="soloSource"]':['Idioma que o celular vai ouvir','Language the phone listens to','Langue écoutée par le téléphone','Idioma que escuchará el teléfono'],
 '#historyFilter option[value="all"]':['Todas as traduções','All translations','Toutes les traductions','Todas las traducciones'],
 '#historyFilter option[value="solo"]':['Somente testes individuais','Solo tests only','Tests individuels','Solo pruebas individuales'],
 '#historyFilter option[value="duo"]':['Somente conversas em dupla','Two-phone conversations only','Conversations à deux','Solo conversaciones en pareja']
};
const indexes={pt:0,en:1,fr:2,es:3};
const nodes=Object.entries(entries).map(([selector,values])=>({node:document.querySelector(selector),values}));
const originals={};
const html={
 '.hero h1':['Converse em sua língua.<br><em>Escute na sua língua.</em>','Speak your language.<br><em>Listen in yours.</em>','Parlez votre langue.<br><em>Écoutez dans la vôtre.</em>','Habla tu idioma.<br><em>Escucha en tu idioma.</em>'],
 '#setup .hint':['Escolha a língua <strong>que você fala</strong>, não a que deseja ouvir. O app traduz para a língua do outro celular.','Choose the language <strong>you speak</strong>, not what you want to hear. The app translates into the other phone’s language.','Choisissez la langue <strong>que vous parlez</strong>, pas celle que vous souhaitez entendre. L’app traduit pour l’autre téléphone.','Elige el idioma <strong>que hablas</strong>, no el que quieres escuchar. La app traduce al idioma del otro teléfono.']
};
for(const selector in html){const node=document.querySelector(selector);if(node)originals[selector]=node;}
const basic={
 '.hero p':['Você fala. O outro escuta a tradução no próprio fone. E vice-versa.','You speak. They hear the translation in their own earbuds. And vice versa.','Vous parlez. L’autre entend la traduction dans ses écouteurs. Et inversement.','Tú hablas. La otra persona escucha la traducción en sus auriculares. Y viceversa.'],
 '.solo-intro':['Teste a tradução sozinho antes de conversar com outra pessoa. O celular escuta francês e lê a tradução em português, ou faz o inverso.','Test the translation on your own, before involving another person.','Testez la traduction seul avant une conversation avec une autre personne.','Prueba la traducción a solas antes de hablar con otra persona.']
};
for(const selector in basic){const node=document.querySelector(selector);if(node)nodes.push({node,values:basic[selector]});}
const placeholders=[
 ['soloText',['Digite uma frase em francês...','Enter a sentence...','Saisissez une phrase...','Escribe una frase...']],
 ['textInput',['Escreva na língua que você fala...','Type in the language you speak...','Écrivez dans votre langue...','Escribe en el idioma que hablas...']]
];
function apply(code){
 const i=indexes[code]??0;select.value=code;document.documentElement.lang=code==='pt'?'pt-BR':code;
 nodes.forEach(({node,values})=>{if(node)node.textContent=values[i];});
 for(const selector in html){if(originals[selector])originals[selector].innerHTML=html[selector][i];}
 for(const [id,values] of placeholders){const node=document.getElementById(id);if(node)node.placeholder=values[i];}
 try{localStorage.setItem('duotranslate.interface.language',code);}catch(e){}
}
let preferred='pt';
try{const stored=localStorage.getItem('duotranslate.interface.language');if(indexes[stored]!=null)preferred=stored;}
catch(e){}
select.addEventListener('change',()=>apply(select.value));
apply(preferred);
})();
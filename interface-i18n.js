/* DuoTranslate 1.6 — idioma de interface nas mesmas 8 línguas de tradução.
   Labels/controles localizados sem usar API e sem modificar valores dos idiomas. */
(() => {
'use strict';
const select=document.getElementById('interfaceLanguage');
if(!select)return;
const codes=['pt','en','fr','es','it','de','ar','zh'];
const names={pt:'Português',en:'English',fr:'Français',es:'Español',it:'Italiano',de:'Deutsch',ar:'العربية',zh:'中文'};
/* Cada conjunto contém pt, en, fr, es, it, de, ar, zh, nessa ordem. */
const D={
 appLanguage:['Idioma do aplicativo','App language',"Langue de l'application",'Idioma de la aplicación',"Lingua dell'app",'App-Sprache','لغة التطبيق','应用语言'],
 heroTitle:['Converse em sua língua.','Speak your language.','Parlez votre langue.','Habla en tu idioma.','Parla nella tua lingua.','Sprich deine Sprache.','تحدث بلغتك.','说你的语言。'],
 heroOther:['Escute na sua língua.','Listen in your language.','Écoutez dans votre langue.','Escucha en tu idioma.','Ascolta nella tua lingua.','Höre in deiner Sprache.','استمع بلغتك.','用你的语言聆听。'],
 heroNote:['Você fala. A outra pessoa escuta a tradução no próprio fone. E vice-versa.','You speak. The other person hears the translation in their own earbuds. And vice versa.',"Vous parlez. L'autre entend la traduction dans ses écouteurs. Et inversement.",'Tú hablas. La otra persona oye la traducción en sus auriculares. Y viceversa.','Tu parli. L’altra persona sente la traduzione nei propri auricolari. E viceversa.','Du sprichst. Die andere Person hört die Übersetzung in ihren Kopfhörern. Und umgekehrt.','أنت تتحدث، والشخص الآخر يسمع الترجمة في سماعاته، والعكس صحيح.','你说话，对方在自己的耳机里听到翻译，反之亦然。'],
 eyebrow:['TRADUÇÃO PRESENCIAL EM DOIS CELULARES','LIVE TRANSLATION ON TWO PHONES','TRADUCTION EN DIRECT SUR DEUX TÉLÉPHONES','TRADUCCIÓN EN VIVO CON DOS TELÉFONOS','TRADUZIONE DAL VIVO SU DUE TELEFONI','LIVE-ÜBERSETZUNG AUF ZWEI HANDYS','ترجمة مباشرة بين هاتفين','双手机实时翻译'],
 usageTitle:['Consumo e segurança','Usage & security','Consommation et sécurité','Uso y seguridad','Utilizzo e sicurezza','Nutzung und Sicherheit','الاستخدام والأمان','使用量与安全'],
 usageGemini:['Solicitações Gemini neste navegador','Gemini requests on this browser','Requêtes Gemini sur ce navigateur','Solicitudes Gemini en este navegador','Richieste Gemini in questo browser','Gemini-Anfragen in diesem Browser','طلبات Gemini في هذا المتصفح','此浏览器的 Gemini 请求'],
 usageMemory:['Traduções MyMemory neste navegador','MyMemory translations on this browser','Traductions MyMemory sur ce navigateur','Traducciones MyMemory en este navegador','Traduzioni MyMemory in questo browser','MyMemory-Übersetzungen in diesem Browser','ترجمات MyMemory في هذا المتصفح','此浏览器的 MyMemory 翻译'],
 usageTokens:['Tokens Gemini (entrada / saída)','Gemini tokens (input / output)','Tokens Gemini (entrée / sortie)','Tokens Gemini (entrada / salida)','Token Gemini (input / output)','Gemini-Tokens (Eingabe / Ausgabe)','رموز Gemini (الإدخال / الإخراج)','Gemini 令牌（输入 / 输出）'],
 usageErrors:['Erros contabilizados','Errors counted','Erreurs comptées','Errores registrados','Errori registrati','Erfasste Fehler','الأخطاء المسجلة','已记录错误'],
 usageReset:['Zerar contador deste navegador','Reset this browser counter','Remettre ce compteur à zéro','Reiniciar contador del navegador','Azzera contatore locale','Lokalen Zähler zurücksetzen','إعادة تعيين عداد المتصفح','重置此浏览器的计数器'],
 aiTitle:['Tradutor por inteligência artificial','AI translator','Traducteur IA','Traductor con IA','Traduttore con IA','KI-Übersetzer','مترجم بالذكاء الاصطناعي','AI 翻译'],
 aiDescription:['Compare a tradução tradicional com uma IA que entende expressões e contexto. A voz e o microfone continuam iguais; o que muda é o tradutor de texto.','Compare traditional translation with context-aware AI. The microphone and voice stay the same.','Comparez la traduction classique avec une IA qui comprend le contexte. Le micro et la voix restent identiques.','Compara la traducción tradicional con IA contextual. El micrófono y la voz siguen igual.','Confronta la traduzione classica con l’IA che comprende il contesto. Voce e microfono restano gli stessi.','Vergleiche die klassische Übersetzung mit kontextbewusster KI. Mikrofon und Stimme bleiben gleich.','قارن الترجمة التقليدية بالذكاء الاصطناعي الذي يفهم السياق. الصوت والميكروفون لا يتغيران.','比较传统翻译与理解上下文的 AI。麦克风和语音保持不变。'],
 translationEngine:['Motor de tradução','Translation engine','Moteur de traduction','Motor de traducción','Motore di traduzione','Übersetzungsdienst','محرك الترجمة','翻译引擎'],
 aiSetup:['Configuração inicial: para usar Gemini, configure um proxy Cloudflare que mantenha sua chave de API privada.','One-time setup: to use Gemini, configure a Cloudflare proxy to keep your API key private.','Configuration initiale : pour Gemini, configurez un proxy Cloudflare afin de protéger votre clé API.','Configuración inicial: para Gemini, configura un proxy de Cloudflare para proteger tu clave API.','Configurazione iniziale: per Gemini, configura un proxy Cloudflare che protegga la chiave API.','Einmalige Einrichtung: Für Gemini einen Cloudflare-Proxy einrichten, der den API-Schlüssel schützt.','إعداد أولي: لاستخدام Gemini، اضبط وسيط Cloudflare لحماية مفتاح API الخاص بك.','首次设置：使用 Gemini 需配置 Cloudflare 代理以保护 API 密钥。'],
 workerAddress:['Endereço HTTPS do Cloudflare Worker','Cloudflare Worker HTTPS address','Adresse HTTPS du Cloudflare Worker','Dirección HTTPS de Cloudflare Worker','Indirizzo HTTPS del Cloudflare Worker','HTTPS-Adresse des Cloudflare Workers','عنوان Cloudflare Worker الآمن','Cloudflare Worker HTTPS 地址'],
 workerPass:['Código de acesso privado do Worker','Private Worker access code','Code d’accès privé du Worker','Código privado de acceso al Worker','Codice di accesso privato al Worker','Privater Worker-Zugangscode','رمز الوصول الخاص إلى Worker','Worker 私密访问码'],
 aiTest:['✦ Testar IA com uma frase em francês','✦ Test AI with a French sentence','✦ Tester l’IA avec une phrase française','✦ Probar IA con una frase en francés','✦ Prova l’IA con una frase francese','✦ KI mit einem französischen Satz testen','✦ اختبر الذكاء الاصطناعي بجملة فرنسية','✦ 用法语句子测试 AI'],
 soloTitle:['Modo teste individual','Solo test mode','Mode test individuel','Modo de prueba individual','Modalità test individuale','Einzeltest','وضع الاختبار الفردي','单人测试模式'],
 soloIntro:['Escolha livremente a língua falada e a língua de destino. O microfone reconhece a primeira e a tradução é reproduzida na segunda.','Choose the spoken language and target independently. The microphone listens in the first and plays the translation in the second.','Choisissez la langue parlée et la langue cible séparément. Le micro écoute la première et traduit dans la seconde.','Elige por separado el idioma hablado y el de destino. El micrófono escucha el primero y reproduce el segundo.','Scegli separatamente la lingua parlata e quella di arrivo. Il microfono ascolta la prima e riproduce la seconda.','Wähle gesprochene Sprache und Zielsprache getrennt. Das Mikrofon hört die erste, die Übersetzung erfolgt in die zweite.','اختر لغة الكلام واللغة الهدف بشكل مستقل. يستمع الميكروفون للأولى ويشغل الترجمة بالثانية.','分别选择说话语言和目标语言。麦克风识别前者并播放后者的翻译。'],
 sourceLabel:['Idioma que vou falar','Language I will speak','Langue que je vais parler','Idioma que hablaré','Lingua che parlerò','Sprache, die ich spreche','اللغة التي سأتحدث بها','我要说的语言'],
 targetLabel:['Idioma que quero ouvir','Language I want to hear','Langue que je veux entendre','Idioma que quiero escuchar','Lingua che voglio ascoltare','Sprache, die ich hören möchte','اللغة التي أريد سماعها','我想听的语言'],
 startListening:['🎙 Começar a ouvir','🎙 Start listening','🎙 Commencer à écouter','🎙 Empezar a escuchar','🎙 Inizia ad ascoltare','🎙 Zuhören starten','🎙 بدء الاستماع','🎙 开始收听'],
 sample:['▶ Testar frase de exemplo','▶ Test sample sentence','▶ Tester une phrase exemple','▶ Probar frase de ejemplo','▶ Prova una frase esempio','▶ Beispielsatz testen','▶ تجربة جملة نموذجية','▶ 测试示例句子'],
 typeSample:['Ou escreva uma frase para testar','Or type a sentence to test','Ou saisissez une phrase pour tester','O escribe una frase para probar','Oppure scrivi una frase di prova','Oder schreibe einen Testsatz','أو اكتب جملة للاختبار','或输入句子进行测试'],
 translate:['Traduzir','Translate','Traduire','Traducir','Traduci','Übersetzen','ترجمة','翻译'],
 replay:['🔊 Repetir última tradução','🔊 Replay last translation','🔊 Réécouter la dernière traduction','🔊 Repetir última traducción','🔊 Ripeti l’ultima traduzione','🔊 Letzte Übersetzung abspielen','🔊 إعادة آخر ترجمة','🔊 重播上次翻译'],
 historyTitle:['Histórico local e qualidade','Local history & quality','Historique local et qualité','Historial local y calidad','Cronologia locale e qualità','Lokaler Verlauf und Qualität','السجل المحلي والجودة','本地历史与质量'],
 historyIntro:['Salve as frases, traduções e tempos neste navegador. Exporte, compare e avalie com IA quando desejar.','Save phrases, translations and timings in this browser. Export, compare and review with AI when you choose.','Enregistrez ici les phrases, traductions et durées. Exportez, comparez et analysez par IA à votre demande.','Guarda frases, traducciones y tiempos aquí. Exporta, compara y analiza con IA cuando quieras.','Salva frasi, traduzioni e tempi in questo browser. Esporta, confronta e analizza con l’IA quando vuoi.','Speichere Sätze, Übersetzungen und Zeiten lokal. Exportiere, vergleiche und überprüfe mit KI nach Bedarf.','احفظ الجمل والترجمات والأوقات في هذا المتصفح. صدّر وقارن وحلّل بالذكاء الاصطناعي عند الطلب.','在此浏览器保存句子、翻译和耗时。可按需导出、比较和用 AI 分析。'],
 saveHistory:['Salvar novas traduções neste dispositivo','Save new translations on this device','Enregistrer les nouvelles traductions sur cet appareil','Guardar nuevas traducciones en este dispositivo','Salva le nuove traduzioni su questo dispositivo','Neue Übersetzungen auf diesem Gerät speichern','حفظ الترجمات الجديدة على هذا الجهاز','在此设备保存新翻译'],
 historyFilter:['Mostrar traduções','Show translations','Afficher les traductions','Mostrar traducciones','Mostra traduzioni','Übersetzungen anzeigen','عرض الترجمات','显示翻译'],
 allHistory:['Todas as traduções','All translations','Toutes les traductions','Todas las traducciones','Tutte le traduzioni','Alle Übersetzungen','كل الترجمات','所有翻译'],
 soloHistory:['Somente testes individuais','Solo tests only','Tests individuels seulement','Solo pruebas individuales','Solo test individuali','Nur Einzeltests','الاختبارات الفردية فقط','仅单人测试'],
 duoHistory:['Somente conversas em dupla','Two-phone conversations only','Conversations à deux seulement','Solo conversaciones en pareja','Solo conversazioni a due','Nur Gespräche mit zwei Handys','المحادثات الثنائية فقط','仅双手机对话'],
 exportJson:['↓ Exportar JSON','↓ Export JSON','↓ Exporter JSON','↓ Exportar JSON','↓ Esporta JSON','↓ JSON exportieren','↓ تصدير JSON','↓ 导出 JSON'],
 exportCsv:['↓ Exportar CSV','↓ Export CSV','↓ Exporter CSV','↓ Exportar CSV','↓ Esporta CSV','↓ CSV exportieren','↓ تصدير CSV','↓ 导出 CSV'],
 erase:['Excluir histórico','Delete history','Supprimer l’historique','Eliminar historial','Elimina cronologia','Verlauf löschen','حذف السجل','删除历史'],
 setupTitle:['Seu idioma','Your language','Votre langue','Tu idioma','La tua lingua','Deine Sprache','لغتك','你的语言'],
 duoHint:['Escolha a língua que fala e a língua em que deseja ouvir a tradução. Cada pessoa escolhe as suas.','Choose your spoken and listening languages. Each person sets their own.','Choisissez la langue que vous parlez et celle dans laquelle vous voulez écouter. Chaque personne choisit les siennes.','Elige el idioma que hablas y el idioma que quieres escuchar. Cada persona elige los suyos.','Scegli la lingua che parli e quella che vuoi ascoltare. Ogni persona sceglie le proprie.','Wähle deine Sprech- und Hörsprache. Jede Person wählt selbst.','اختر لغة التحدث ولغة سماع الترجمة. يختار كل شخص لغاته.','选择说话语言和希望听到的语言。每个人分别设置。'],
 connectTitle:['Conectar os celulares','Connect the phones','Connecter les téléphones','Conectar los teléfonos','Collega i telefoni','Handys verbinden','توصيل الهاتفين','连接手机'],
 createRoom:['✦ Criar uma sala','✦ Create a room','✦ Créer un salon','✦ Crear una sala','✦ Crea una stanza','✦ Raum erstellen','✦ إنشاء غرفة','✦ 创建房间'],
 orRoom:['ou entre na sala criada no outro celular','or join a room from the other phone','ou rejoignez le salon créé sur l’autre téléphone','o entra en una sala creada en el otro teléfono','oppure entra nella stanza creata sull’altro telefono','oder tritt einem Raum des anderen Handys bei','أو انضم إلى غرفة أنشأها الهاتف الآخر','或加入另一部手机创建的房间'],
 joinRoom:['Entrar','Join','Rejoindre','Entrar','Entra','Beitreten','انضمام','加入'],
 leaveRoom:['Sair da sala','Leave room','Quitter le salon','Salir de la sala','Esci dalla stanza','Raum verlassen','مغادرة الغرفة','退出房间'],
 copyRoom:['↗ Copiar convite','↗ Copy invitation','↗ Copier l’invitation','↗ Copiar invitación','↗ Copia invito','↗ Einladung kopieren','↗ نسخ الدعوة','↗ 复制邀请'],
 liveTitle:['Conversa ao vivo','Live conversation','Conversation en direct','Conversación en directo','Conversazione dal vivo','Live-Gespräch','محادثة مباشرة','实时对话'],
 startDuo:['🎙 Ativar conversa','🎙 Start conversation','🎙 Démarrer la conversation','🎙 Iniciar conversación','🎙 Avvia conversazione','🎙 Gespräch starten','🎙 بدء المحادثة','🎙 开始对话'],
 testAudio:['🔊 Testar áudio do fone','🔊 Test earbud audio','🔊 Tester le son des écouteurs','🔊 Probar audio de auriculares','🔊 Prova audio auricolari','🔊 Kopfhörerton testen','🔊 اختبار صوت السماعة','🔊 测试耳机音频'],
 conversationTitle:['Conversação','Conversation','Conversation','Conversación','Conversazione','Gespräch','المحادثة','对话'],
 clear:['Limpar','Clear','Effacer','Limpiar','Pulisci','Löschen','مسح','清除'],
 noMessages:['As frases traduzidas aparecerão aqui. Você não precisa olhar para a tela durante a conversa.','Translations will appear here. You do not need to look at the screen while talking.','Les traductions apparaîtront ici. Vous n’avez pas besoin de regarder l’écran pendant la conversation.','Las traducciones aparecerán aquí. No necesitas mirar la pantalla mientras conversas.','Le traduzioni appariranno qui. Non devi guardare lo schermo durante la conversazione.','Übersetzungen erscheinen hier. Beim Sprechen musst du nicht auf den Bildschirm schauen.','ستظهر الترجمات هنا. لا حاجة للنظر إلى الشاشة أثناء المحادثة.','翻译会显示在这里。对话时无需看屏幕。'],
 textFallback:['Plano B: enviar texto se o microfone não funcionar','Backup: send text if the microphone fails','Solution de secours : envoyer du texte si le micro ne fonctionne pas','Alternativa: enviar texto si falla el micrófono','Alternativa: invia testo se il microfono non funziona','Alternative: Text senden, falls das Mikrofon ausfällt','بديل: أرسل نصاً إذا لم يعمل الميكروفون','备用：麦克风不工作时发送文字'],
 send:['Enviar','Send','Envoyer','Enviar','Invia','Senden','إرسال','发送'],
 voicePanel:['🎙 Escolher vozes e velocidade','🎙 Voices & speed','🎙 Voix et vitesse','🎙 Voces y velocidad','🎙 Voci e velocità','🎙 Stimmen und Tempo','🎙 الأصوات والسرعة','🎙 语音和速度'],
 voicePt:['Voz em português','Portuguese voice','Voix en portugais','Voz en portugués','Voce in portoghese','Portugiesische Stimme','الصوت البرتغالي','葡萄牙语语音'],
 voiceFr:['Voz em francês','French voice','Voix en français','Voz en francés','Voce in francese','Französische Stimme','الصوت الفرنسي','法语语音'],
 speed:['Velocidade da voz','Speech speed','Vitesse de la voix','Velocidad de voz','Velocità della voce','Sprechtempo','سرعة الصوت','语速'],
 beforeUse:['Antes de usar','Before use','Avant utilisation','Antes de usar','Prima di usare','Vor der Verwendung','قبل الاستخدام','使用前'],
 micOff:['Microfone desligado','Microphone off','Micro désactivé','Micrófono apagado','Microfono spento','Mikrofon aus','الميكروفون مغلق','麦克风已关闭'],
 micOn:['Microfone ligado','Microphone on','Micro activé','Micrófono encendido','Microfono acceso','Mikrofon an','الميكروفون يعمل','麦克风已开启'],
 chooseDifferent:['Escolha idiomas diferentes.','Choose different languages.','Choisissez des langues différentes.','Elige idiomas diferentes.','Scegli lingue diverse.','Wähle verschiedene Sprachen.','اختر لغتين مختلفتين.','请选择不同的语言。'],
 translating:['Traduzindo frase...','Translating sentence...','Traduction en cours...','Traduciendo frase...','Traduzione in corso...','Satz wird übersetzt...','جارٍ ترجمة الجملة...','正在翻译句子...'],
 waiting:['Conecte os dois celulares para começar.','Connect both phones to start.','Connectez les deux téléphones pour commencer.','Conecta los dos teléfonos para comenzar.','Collega entrambi i telefoni per iniziare.','Verbinde beide Handys, um zu beginnen.','وصّل الهاتفين للبدء.','连接两部手机以开始。'],
 retry:['Tente novamente.','Please try again.','Veuillez réessayer.','Inténtalo de nuevo.','Riprova.','Bitte erneut versuchen.','حاول مرة أخرى.','请重试。'],
 notTranslated:['Origem e destino são iguais. Escolha idiomas diferentes antes de traduzir.','Source and target are the same. Choose different languages before translating.','La source et la cible sont identiques. Choisissez des langues différentes.','Origen y destino son iguales. Elige idiomas diferentes antes de traducir.','Origine e destinazione sono uguali. Scegli lingue diverse.','Quell- und Zielsprache sind gleich. Bitte unterschiedliche Sprachen wählen.','لغة المصدر والهدف متطابقتان. اختر لغتين مختلفتين.','源语言和目标语言相同。请先选择不同的语言。']
};
const mapping={
 '#usageTitle':'usageTitle',
 '#usagePanel .usage-stat:nth-child(1) span':'usageGemini',
 '#usagePanel .usage-stat:nth-child(2) span':'usageMemory',
 '#usagePanel .usage-stat:nth-child(3) span':'usageTokens',
 '#usagePanel .usage-stat:nth-child(4) span':'usageErrors',
 '#usageReset':'usageReset',
 '#aiTitle':'aiTitle',
 '.ai-provider-note':'aiDescription',
 'label[for="translationProvider"]':'translationEngine',
 'label[for="aiWorkerUrl"]':'workerAddress',
 'label[for="aiWorkerPin"]':'workerPass',
 '#aiTestBtn':'aiTest',
 '#solo-title':'soloTitle',
 '.solo-intro':'soloIntro',
 'label[for="soloSource"]':'sourceLabel',
 'label[for="soloTarget"]':'targetLabel',
 '#soloSample':'sample',
 '#soloForm label':'typeSample',
 '#soloForm button':'translate',
 '#soloReplay':'replay',
 '#localHistoryTitle':'historyTitle',
 '.history-intro':'historyIntro',
 'label[for="historyFilter"]':'historyFilter',
 '#historyFilter option[value="all"]':'allHistory',
 '#historyFilter option[value="solo"]':'soloHistory',
 '#historyFilter option[value="duo"]':'duoHistory',
 '#exportJson':'exportJson',
 '#exportCsv':'exportCsv',
 '#eraseHistory':'erase',
 '#setup-title':'setupTitle',
 '#duoSourceHint':'duoHint',
 'label[for="duoHearLanguage"]':'targetLabel',
 '#room-title':'connectTitle',
 '#createBtn':'createRoom',
 '#roomSetup .or span':'orRoom',
 '#joinBtn':'joinRoom',
 '#leaveBtn':'leaveRoom',
 '#copyBtn':'copyRoom',
 '#listen-title':'liveTitle',
 '#testAudioBtn':'testAudio',
 '#history-title':'conversationTitle',
 '#clearBtn':'clear',
 '#textForm label':'textFallback',
 '#sendBtn':'send',
 '.privacy h3':'beforeUse',
 'label[for="interfaceLanguage"]':'appLanguage',
 'label[for="voicePt"]':'voicePt',
 'label[for="voiceFr"]':'voiceFr',
 'label[for="voiceRate"]':'speed'
};
const nodes=Object.entries(mapping).map(([selector,key])=>({node:document.querySelector(selector),key}));
const header=document.querySelector('.hero h1');
const headerText=document.querySelector('.hero p');
const eyebrow=document.querySelector('.eyebrow');
const empty=document.querySelector('.empty-messages');
const saveLabel=document.querySelector('.history-toolbar label');
const aiSetup=document.querySelector('.ai-fields p');
const voiceSummary=document.querySelector('#voicePanel summary');
const liveStart=document.getElementById('listenBtn');
const soloStart=document.getElementById('soloToggle');
const micBadge=document.getElementById('micBadge');
const roomLabel=document.querySelector('#roomHelp');
const options=Array.from(select.options);
let locale='pt';
function t(key){
 const i=codes.indexOf(locale);
 return D[key]?.[i]||D[key]?.[0]||key;
}
function statusTranslation(phrase){
 const key={'Microfone desligado':'micOff','Microfone ligado':'micOn','Escolha idiomas diferentes.':'chooseDifferent',
  'Traduzindo frase...':'translating','Conecte os dois celulares para começar.':'waiting','Tente novamente.':'retry',
  'Origem e destino são iguais. Escolha idiomas diferentes antes de traduzir.':'notTranslated'}[phrase];
 return key?t(key):phrase;
}
function apply(next){
 if(!codes.includes(next))next='pt';
 locale=next;select.value=next;
 document.documentElement.lang=next==='pt'?'pt-BR':next;
 document.documentElement.dir=next==='ar'?'rtl':'ltr';
 for(const {node,key} of nodes){if(node)node.textContent=t(key);}
 if(header){const em=header.querySelector('em');header.replaceChildren(document.createTextNode(t('heroTitle')),document.createElement('br'));const e=document.createElement('em');e.textContent=t('heroOther');header.append(e);}
 if(headerText)headerText.textContent=t('heroNote');
 if(eyebrow){const dot=eyebrow.querySelector('.live-dot');eyebrow.textContent='';if(dot)eyebrow.append(dot);eyebrow.append(document.createTextNode(' '+t('eyebrow')));}
 if(empty)empty.textContent=t('noMessages');
 if(saveLabel){const input=saveLabel.querySelector('input');saveLabel.replaceChildren();if(input)saveLabel.append(input);saveLabel.append(document.createTextNode(' '+t('saveHistory')));}
 if(aiSetup){aiSetup.textContent=t('aiSetup');}
 if(voiceSummary){
  const badge=voiceSummary.querySelector('span');voiceSummary.replaceChildren(document.createTextNode(t('voicePanel')+' '));if(badge)voiceSummary.append(badge);
 }
 if(liveStart && !liveStart.disabled && !/Parar|Stop|Arrêter|Detener|Ferma|Stoppen|إيقاف|停止/.test(liveStart.textContent))liveStart.textContent=t('startDuo');
 if(soloStart && !/Parar|Stop|Arrêter|Detener|Ferma|Stoppen|إيقاف|停止/.test(soloStart.textContent))soloStart.textContent=t('startListening');
 if(micBadge)micBadge.textContent=t(micBadge.classList.contains('active')?'micOn':'micOff');
 if(roomLabel && !roomLabel.textContent.includes('Conectados')){ /* dynamic connection messages are handled by app.js */ }
 options.forEach(o=>{o.textContent=names[o.value]||o.value;});
 try{localStorage.setItem('duotranslate.interface.language',next);}catch(e){}
}
window.DuoI18n={t,localizeStatus:statusTranslation,locale:()=>locale,apply};
let preferred='pt';
try{const stored=localStorage.getItem('duotranslate.interface.language');if(codes.includes(stored))preferred=stored;}catch(e){}
select.addEventListener('change',()=>apply(select.value));
apply(preferred);
})();
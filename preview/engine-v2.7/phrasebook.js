/* DuoTranslate 2.7 — vocabulário rápido experimental.
   Correspondência exata (não parcial), sem armazenar frases pessoais.
   Não substitui tradução contextual: use só para saudações isoladas.
   Termos precisam de revisão por falantes nativos antes de distribuição pública. */
(() => {
'use strict';
const languages=["pt-BR","fr-FR","en-US","es-ES","it-IT","de-DE","ar-SA","zh-CN","nl-NL","pl-PL","ro-RO","uk-UA","ru-RU","tr-TR"];
const phrases={"hello":{"pt-BR":"Olá","fr-FR":"Bonjour","en-US":"Hello","es-ES":"Hola","it-IT":"Salve","de-DE":"Hallo","ar-SA":"مرحبا","zh-CN":"你好","nl-NL":"Hallo","pl-PL":"Dzień dobry","ro-RO":"Salut","uk-UA":"Привіт","ru-RU":"Привет","tr-TR":"Merhaba"},"thanks":{"pt-BR":"Obrigado","fr-FR":"Merci","en-US":"Thank you","es-ES":"Gracias","it-IT":"Grazie","de-DE":"Danke","ar-SA":"شكراً","zh-CN":"谢谢","nl-NL":"Dank je wel","pl-PL":"Dziękuję","ro-RO":"Mulțumesc","uk-UA":"Дякую","ru-RU":"Спасибо","tr-TR":"Teşekkür ederim"},"please":{"pt-BR":"Por favor","fr-FR":"S'il vous plaît","en-US":"Please","es-ES":"Por favor","it-IT":"Per favore","de-DE":"Bitte","ar-SA":"من فضلك","zh-CN":"请","nl-NL":"Alstublieft","pl-PL":"Proszę","ro-RO":"Vă rog","uk-UA":"Будь ласка","ru-RU":"Пожалуйста","tr-TR":"Lütfen"},"goodbye":{"pt-BR":"Adeus","fr-FR":"Au revoir","en-US":"Goodbye","es-ES":"Adiós","it-IT":"Arrivederci","de-DE":"Auf Wiedersehen","ar-SA":"مع السلامة","zh-CN":"再见","nl-NL":"Tot ziens","pl-PL":"Do widzenia","ro-RO":"La revedere","uk-UA":"До побачення","ru-RU":"До свидания","tr-TR":"Hoşça kal"},"later":{"pt-BR":"Até logo","fr-FR":"À bientôt","en-US":"See you later","es-ES":"Hasta luego","it-IT":"A presto","de-DE":"Bis später","ar-SA":"أراك لاحقاً","zh-CN":"回头见","nl-NL":"Tot later","pl-PL":"Do zobaczenia","ro-RO":"Pe curând","uk-UA":"До зустрічі","ru-RU":"До скорого","tr-TR":"Sonra görüşürüz"},"sorry":{"pt-BR":"Desculpe","fr-FR":"Désolé","en-US":"Sorry","es-ES":"Lo siento","it-IT":"Mi dispiace","de-DE":"Entschuldigung","ar-SA":"آسف","zh-CN":"对不起","nl-NL":"Het spijt me","pl-PL":"Przepraszam","ro-RO":"Îmi pare rău","uk-UA":"Вибачте","ru-RU":"Извините","tr-TR":"Özür dilerim"},"howareyou":{"pt-BR":"Como você está?","fr-FR":"Comment ça va ?","en-US":"How are you?","es-ES":"¿Cómo estás?","it-IT":"Come stai?","de-DE":"Wie geht es dir?","ar-SA":"كيف حالك؟","zh-CN":"你好吗？","nl-NL":"Hoe gaat het met je?","pl-PL":"Jak się masz?","ro-RO":"Ce mai faci?","uk-UA":"Як справи?","ru-RU":"Как дела?","tr-TR":"Nasılsın?"},"yes":{"pt-BR":"Sim","fr-FR":"Oui","en-US":"Yes","es-ES":"Sí","it-IT":"Sì","de-DE":"Ja","ar-SA":"نعم","zh-CN":"是的","nl-NL":"Ja","pl-PL":"Tak","ro-RO":"Da","uk-UA":"Так","ru-RU":"Да","tr-TR":"Evet"},"no":{"pt-BR":"Não","fr-FR":"Non","en-US":"No","es-ES":"No","it-IT":"No","de-DE":"Nein","ar-SA":"لا","zh-CN":"不是","nl-NL":"Nee","pl-PL":"Nie","ro-RO":"Nu","uk-UA":"Ні","ru-RU":"Нет","tr-TR":"Hayır"}};
const enableKey='duotranslate.phrasebook.enabled.v1';
const countersKey='duotranslate.phrasebook.stats.v1';
const lookup=Object.create(null);
function norm(value){return String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[.,!?¿¡。、，！？؟]/g,'').replace(/\s+/g,' ').trim()}
for(const code of languages){
 const terms=new Map();
 for(const [id,record] of Object.entries(phrases))terms.set(norm(record[code]),id);
 lookup[code]=terms;
}
function enabled(){try{return localStorage.getItem(enableKey)==='1'}catch(e){return false}}
function setEnabled(v){try{localStorage.setItem(enableKey,v?'1':'0')}catch(e){}}
let lastHit=false;
function translate(text,source,target){
 lastHit=false;
 if(!enabled()||source===target||!lookup[source]||!lookup[target])return null;
 const word=norm(text);
 // 90 characters max and 1 full phrase; never match fragments inside a sentence.
 if(!word||word.length>90)return null;
 const id=lookup[source].get(word);
 if(!id)return null;
 lastHit=true;
 try{
  const stats=JSON.parse(localStorage.getItem(countersKey)||'{}');
  stats.hits=(Number(stats.hits)||0)+1;stats.lastPhrase=id;
  localStorage.setItem(countersKey,JSON.stringify(stats));
 }catch(e){}
 return phrases[id][target]||null;
}
window.DuoPhrasebook={enabled,setEnabled,translate,lastHit:()=>lastHit,
 phraseCount:Object.keys(phrases).length,languageCount:languages.length,
 stats:()=>{try{return JSON.parse(localStorage.getItem(countersKey)||'{}')}catch(e){return {}}},
 sample:(from,target)=>Object.values(phrases).map(p=>({original:p[from],translation:p[target]})).filter(p=>p.original&&p.translation)};
})();
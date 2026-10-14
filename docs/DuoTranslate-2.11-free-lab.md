# DuoTranslate 2.11 — laboratório gratuito de tradução local
Data: 14/10/2026

## Preservação / backup
- Original publicado: `preview/v2.10/index.html` — não foi modificado.
- Backup no GitHub: `backup-duotranslate-v2.10-before-free-lab-20261014` apontando para `1fe4f93cd1bd08521151dc13a8c18aaebd1a9a17`.
- Nova interface: `preview/v2.11/index.html`, cópia integral da 2.10 com ajustes isolados.
- Novo motor: `voice/free-lab.js`, sem secrets, endpoint externo, API comercial ou cópia de código fechado.
- Continua possível testar a versão 2.10 separadamente.

## Objetivo
Testar, sem consumir créditos de APIs, princípios obtidos da pesquisa sobre Soniox, JotMe, Apple Live Translation, Wordly, KUDO, Google Live Translate e Whisper Streaming. Engenharia reversa **funcional**: somente documentação pública, interfaces, exemplos e técnicas; nenhum código proprietário foi extraído.

## Como usar
1. Abra `/preview/v2.11/?freeLab=1`. Se ainda não concluiu a configuração inicial do DuoTranslate, finalize-a.
2. Entre em **Laboratório gratuito 2.11**. Os outros modos são os da 2.10, que podem consumir créditos e apresentam confirmação.
3. Selecione o idioma falado e o idioma de tradução.
4. Clique em **Preparar tradução local**. Navegadores compatíveis podem baixar pacotes de idiomas na primeira execução.
5. Digite `Bom dia` com PT→FR e clique em **Traduzir gratuitamente** para validar o vocabulário local sem serviços externos.
6. Teste uma frase livre. Se o Chrome Translator estiver ativo para esse par, haverá tradução contextual; caso contrário, o sistema explicará a indisponibilidade.
7. Clique em **Iniciar escuta** e permita o microfone (opcional). Use um fone para reduzir o eco. Verifique as legendas parciais, resultados finais e Histórico.
8. Use **Parar escuta** ou volte ao menu para interromper a captação.

## Política de custos e privacidade
- Laboratório 2.11: **zero chamadas diretas às APIs comerciais**. Usa exclusivamente o vocabulário local, `Translator` do navegador, `SpeechRecognition` do navegador e `speechSynthesis`.
- A API `Translator` traduz **no dispositivo**, depois de baixar um modelo; está sujeita à disponibilidade do sistema/navegador e a pares de idioma específicos.
- `SpeechRecognition` pode depender de um serviço online do fabricante do navegador, que recebe áudio; não equivale a STT local. A opção **Exigir reconhecimento no aparelho** só funciona quando `processLocally` é suportado e o pacote instalado.
- `speechSynthesis` reproduz a voz do sistema. **Não** é a ElevenLabs, cuja API pode consumir créditos.
- Frases livres sem modelo local **não são traduzidas** e não há fallback silencioso para Gemini, OpenAI, Soniox, MyMemory ou ElevenLabs.
- Nenhuma gravação de áudio é salva. Histórico permanece no `localStorage`, com texto e tempo de tradução. Não envie informações confidenciais para STT do navegador sem conhecer sua política de privacidade.
- A versão 2.10 anterior continua funcional, mas seus modos podem chamar serviços pagos; em 2.11, solicitamos confirmação antes de abri-los.

## Técnicas realmente implementadas
- Interface existente preservada; laboratório como modo adicional.
- Reconhecimento por eventos com texto parcial (`interimResults`) e final.
- Prévia somente após estabilização de palavras completas e debounce, evitando textos enganosos.
- Fila de resultados finais para preservar ordem enquanto o tradutor ainda está processando.
- Reconexão limitada da sessão de reconhecimento caso o navegador a encerre.
- Bloqueio quando modelo/idioma indisponível; sem substituição oculta do fornecedor.
- Seleção de voz compatível com idioma de destino; interrupção de síntese antiga configurável.
- Medida de processamento, aviso de fontes, resultados legíveis e Histórico integrado.

## Pesquisa e limites da reutilização
- Soniox: https://soniox.com/docs/demo-apps/soniox-speech-to-speech-translation — demonstra pipeline WebSocket STT+tradução+TTS, mas a API própria exige chave/créditos. Reproduzimos **ideias de arquitetura**, não seu código.
- `soniox/soniox_examples`: https://github.com/soniox/soniox_examples — exemplos públicos; não presumir direito de cópia sem licença aplicável verificada.
- Whisper Streaming: https://github.com/ufal/whisper_streaming — projeto MIT com local-agreement de trechos estáveis; nosso algoritmo JavaScript é original e simplificado, não uma reprodução integral desse software.
- Chrome Translator API: https://developer.chrome.com/docs/ai/translator-api — execução local, principalmente Chrome desktop; não presumir suporte no Chrome móvel.
- OpenAI Realtime Translate e Google Gemini Live Translate: arquitetura documentada e experimental, **não ativadas** no laboratório gratuito.
- Apple AirPods Live Translation, JotMe, Wordly, KUDO, Maestra e Transync: comportamentos estudados, sem acesso ou cópia de tecnologia proprietária.

## Não concluído nesta versão
- Não há modelo local STT/MT para **todos** os celulares ou idiomas.
- Não há garantia de tradução simultânea fala→fala em tempo inferior a 3 segundos.
- Não há captura direta do áudio interno de outro aplicativo no celular.
- Não há identificação biométrica de locutores ou reconhecimento de nomes por voz.
- Nenhuma qualidade de áudio ou transcrição foi validada em dispositivo real por esta suíte automatizada.

## Critério para avançar
Executar testes manuais de PT↔FR com frases curtas e longas, microfone e fone, comparar tempo até a primeira tradução e estabilidade de sessão. Antes de adicionar Soniox, OpenAI ou Gemini Live, confirmar disponibilidades/cota gratuita e obter aprovação explícita para qualquer custo, credencial ou serviço.

## Testes
`npm run test:access` executa os testes automatizados existentes e os novos testes de isolamento do laboratório, preservação do CSS, estabilidade de palavras e fila de traduções. Eles não substituem um teste manual no Chrome ou celular.

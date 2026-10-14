# DuoTranslate 2.14 — escutar e traduzir com motores selecionáveis

Data: 14/10/2026

## Backups e isolamento
- Backup anterior à intervenção: branch `backup-before-v214-20261014`, commit `5d105f812e9ad784d0964bed6de32f7f10b74fff`.
- Nova versão: `preview/v2.14/index.html`, construída copiando a 2.13.
- O CSS original aprovado da 2.13 foi preservado integralmente na página da 2.14.
- A interface específica do novo modo é inserida por `voice/listening-v214-ui.js`, com CSS isolado em `#duoListen214Panel`.
- O motor isolado de escuta é `voice/listening-v214.js`. O Laboratório 2.11 (`voice/free-lab.js`), a tradução contínua, o motor de conversação PeerJS e as versões 2.10–2.13 não foram alterados.
- `access/client-v2.14.js` é cópia independente do cliente de acesso para v2.14, preservando autenticação e convites à nova página.

## Como testar
1. Abra `/preview/v2.14/` no computador, preferencialmente Chrome desktop.
2. Entre em **Escutar e traduzir**. O novo painel é exibido diretamente; não precisamos abrir o iframe do motor individual antigo.
3. Selecione idioma da fonte e idioma em que vai ouvir (ex.: português → francês).
4. Comece com **Chrome Translator** + **Voz do dispositivo**. Clique **Preparar tradução local**; no primeiro uso, pode baixar o modelo de idioma no próprio Chrome.
5. Escreva uma frase e clique **Traduzir frase de teste**. A partir desse momento, as métricas mostram tempo de tradução e início da reprodução (quando o navegador reportar).
6. Clique **Iniciar escuta**, autorize o microfone, fale normalmente e acompanhe transcrição provisória, texto final, tradução, áudio e Histórico.
7. Opcionalmente, escolha **Gemini/MyMemory** como motor; essa escolha é explícita e pode usar créditos ou serviço externo. Nesse modo, as frases parciais **não** são enviadas ao provedor de tradução para evitar cobranças por palavra.
8. Opcionalmente, escolha **ElevenLabs** em Voz da tradução, clique **Consultar vozes ElevenLabs** e selecione uma voz. Requer uma sessão individual ativa no DuoTranslate. Áudio gerado pela ElevenLabs consome créditos do serviço. O código utiliza a rota de voz autorizada `/stream-tts`, nunca guarda chave no browser.
9. Ao sair do modo, parar ou alterar as preferências, a escuta é encerrada, a fila de frases é cancelada e a reprodução atual é interrompida.

## O que foi implementado
- Motor principal/local ou existente explicitamente selecionável, sem fallback silencioso entre motores.
- Chrome Translator on-device, com preparo de idiomas e mensagem clara se indisponível. O vocabulário rápido funciona para frases conhecidas mesmo sem modelo baixado.
- `SpeechRecognition` com texto parcial, trecho final, idioma configurado, tentativa de recuperação de interrupções, contador de falhas e opção de exigir reconhecimento local quando suportado.
- Prévia textual de tradução só para prefixos estabilizados pelo motor local; não enviar parciais à tradução comercial.
- Fila de trechos finais em ordem, até 12 pendentes; ao atingir limite, interrupção explícita em vez de perda silenciosa.
- Voz local com seleção por idioma do dispositivo ou ElevenLabs escolhida pelo usuário, com saída de erro se a voz escolhida falhar. Não substituir ElevenLabs por voz do sistema de maneira silenciosa.
- Histórico com `mode: 'listening'`, provedor utilizado, texto de origem/resultado, tempo de tradução e metadados simples de latência. Nenhum arquivo de áudio é gravado.
- Métrica de tempo da primeira transcrição parcial até texto final (quando houve parcial), tempo da tradução e tempo entre resultado traduzido e início da reprodução. **Não representa o tempo físico da fala até o som ouvido nem latência acústica medida.**
- Interface e escolha de idioma preservadas no restante do DuoTranslate.

## Custos, privacidade e compatibilidade
- Configuração padrão: motor local e voz do dispositivo, sem chamadas de tradução pagas pelo DuoTranslate.
- `SpeechRecognition` pode usar um serviço do fornecedor do navegador e transferir áudio a ele; o modo exigir reconhecimento local falha claramente se o navegador não oferecer tal recurso.
- `Translator` local pode estar indisponível em navegadores e dispositivos, especialmente móveis. Para frases livres, o usuário pode escolher explicitamente o motor existente.
- ElevenLabs exige sessão autorizada. Crédítos e limites existentes no Worker permanecem aplicáveis; falhas ou cota esgotada são mostradas sem substituição de voz.
- Gemini/MyMemory envolve a infraestrutura atual, suas regras e eventuais custos.
- O painel captura som pelo microfone; a captura de som interno de outros aplicativos no celular não é garantida.
- Ouvir a tradução com o microfone ativo pode gerar eco, recomenda-se fone de ouvido.
- Não houve nova contratação, assinatura, ligação a ferramentas pagas nem alteração de configuração de cobrança.

## Próximos testes manuais
- Confirmar local PT → FR e FR → PT com frases de 5 a 60 palavras.
- Testar frase digitada e fala contínua de cinco minutos para comparar estabilidade e erros.
- Fazer os mesmos testes com o motor existente selecionado, comparando provedores e tempos.
- Testar voz gratuita e, apenas se o usuário selecionar e aceitar usar créditos, ElevenLabs em frases curtas.
- Comparar medições do Histórico e relatos perceptivos (tempo até o áudio, naturalidade e palavras perdidas).

Os testes automatizados de interface, localidade e seleção de voz não substituem a execução em navegador real, nem comprovam que o Chrome Translator funciona em todo dispositivo.

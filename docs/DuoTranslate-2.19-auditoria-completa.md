# DuoTranslate 2.19 — auditoria de conversação, vozes e traduções

## Defeitos identificados na 2.18
- O destinatário podia declarar "Eu falo francês / Quero ouvir português", enquanto o outro aparelho falava português. O tradutor recebia `source=pt-BR` e `target=pt-BR` e devolvia a mesma frase sem traduzir, inclusive “bom dia”. O par bilateral era configurado de forma contraditória.
- A lista de vozes podia vir de uma cache no próprio navegador, sem confirmação de que o convidado realmente possuía token ElevenLabs válido.
- Um erro ao emitir acesso individual ElevenLabs era silenciosamente convertido num link sem autorização premium. O status podia ser sobrescrito por “Convite copiado”.
- A conversa chamava `/tts`, rota antiga de testes com limite compartilhado de 4/min. A infraestrutura já oferecia a rota `/stream-tts` protegida por token individual e limitador de 30/min.
- Um erro de TTS ainda podia resultar num texto dizendo que o áudio havia sido reproduzido.
- Se a rede falhasse durante o resgate do convite, o token era apagado da URL e perdido, impossibilitando uma nova tentativa sem pedir outro convite.

## Implementação 2.19
1. O modo de dois celulares apresenta **Meu idioma (falo e escuto)**. O segundo seletor redundante é ocultado; idioma ouvido = idioma falado para cada participante. O host mantém sua preferência sobre o idioma convidado no link.
2. Em cada fala, a tradução usa sempre o idioma **falado pelo outro participante** como destino. Se os dois estão configurados com o mesmo idioma, o sistema mostra o problema em vez de transmitir uma falsa tradução.
3. O menu premium aparece somente com acesso individual ativo e após buscar a lista de vozes do servidor (primeira verificação ao entrar). Falhas incluem o motivo visível; vozes salvas não são tratadas como autorização.
4. O convite mostra se realmente inclui autorização ElevenLabs, e quando não inclui identifica claramente "sem ElevenLabs" e o motivo; nenhum token ou chave é exposto nos logs.
5. A conversa utiliza o endpoint já existente `/stream-tts`, sujeito à autenticação e à proteção de consumo de 30/min; não desativa limites de segurança nem muda o endpoint de teste.
6. Feedback específico: microfone ouvindo, fala reconhecida, tradutor processando, frase enviada, frase recebida, áudio reproduzido ou erro exato.
7. Em rede temporariamente indisponível, resgate individual do convite é tentado duas vezes; token fica em `sessionStorage` apenas na aba do convidado até sucesso. O fragmento é removido imediatamente da URL; em erro definitivo de 401/403, o token pendente é descartado.

## Infraestrutura preservada
- Backup: `backup-before-v219-dialogue-integrity-20261015`.
- Prévia isolada `preview/v2.19/`, com CSS da 2.18 preservado.
- Núcleo v2.18, módulos de escuta, laboratório, tradução contínua, histórico, integração Gemini, Workers e contratos de API antigos preservados.
- Chaves secretas continuam nos Workers; sessões individuais são exigidas para premium. O aplicativo não fornece acesso público livre à ElevenLabs.
- Uma pessoa convidada com convite de sala **sem** token individual ainda consegue usar voz local, mas a ElevenLabs não é anunciada como disponível.

## Testes
- Suíte offline com tradução PT → FR e FR → PT, inclusive reproduzindo o cenário de idioma duplicado que causou fala sem tradução.
- Convites válidos e sem permissão premium, lista ElevenLabs real/autorizada versus cache não autorizada, falhas de voz, rota de síntese, reinício de resgate do convidado e preservação dos demais modos.
- Nova suíte automática online de diagnóstico gratuito da sala WebSocket e dos Workers Cloudflare. Executa dois clientes conectados pela internet, verifica `ping/pong`, troca mensagem fictícia PT → FR e FR → PT e confirma a entrega em ambos os sentidos. **Não consome API paga.**
- Ainda é obrigatório o teste físico de captação de voz no Chrome, ElevenLabs, Bluetooth e latência, já que os testes online não ativam microfones nem sintetizam vozes com créditos.

## Como validar no aparelho
1. No aparelho do anfitrião, abra `preview/v2.19/?v=219` e selecione **Com celulares conectados**. O aplicativo prepara a sala e o convite.
2. Confira no botão se o convite inclui ElevenLabs ou se está marcado **sem ElevenLabs**. Se for sem ElevenLabs, o acesso premium não foi autorizado; não considere uma falha de microfone.
3. Envie o link completo por mensagem. O outro participante abre, escolhe seu único idioma e voz, e toca **Entrar e conversar**.
4. Ao permitir o microfone em ambos, aguarde **Conectados**. Um participante fala uma frase PT; o outro escuta FR. Depois inverta. As linhas de progresso indicarão qual etapa falhou se algum áudio não sair.
5. Não compartilhe links completos de convidados publicamente: o fragmento `#duo-invite=` contém um token de uso individual.

**Critério de aprovação final:** falas PT → FR e FR → PT reproduzidas de forma audível nos aparelhos reais, com vozes escolhidas e sem cliques extras entre as frases. Testes automáticos bem-sucedidos não equivalem a essa aprovação.

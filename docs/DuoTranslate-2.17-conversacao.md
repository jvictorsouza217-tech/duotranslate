# DuoTranslate 2.17 — Conversação conectada sem etapas repetidas

Implementado em 14/10/2026 para validação experimental em dois aparelhos físicos.

## Preservação
- Backup: `backup-before-v217-20261014`.
- Prévia isolada: `preview/v2.17/`.
- Interface aprovada e seus CSS permanecem preservados.
- Motores da tradução individual, escuta, tradução contínua, laboratório e conexão 2.12/2.16 não foram modificados.
- Cloudflare AI Worker mantém as rotas Gemini e acesso individual anteriores; foi adicionada somente a rota `/room/v217` e o Durable Object `DuoRoom217`.

## Fluxo esperado
1. O anfitrião seleciona **Com celulares conectados**. A sala de teste é criada automaticamente e o navegador pede permissão de microfone. Não há código de 8 caracteres nem clique posterior em **Ir para conversa**.
2. O anfitrião toca **Copiar convite** e envia o link completo ao convidado.
3. O convidado abre o link, confirma nome (opcional), idioma de fala e idioma que deseja ouvir, escolhe voz e toca **Entrar e conversar**.
4. Os aparelhos conectam ao mesmo Durable Object via WebSockets. A interface só exibe **Conectados** quando ambos confirmam a sessão e o perfil de idiomas.
5. O aplicativo inicia reconhecimento de fala automático após a permissão do microfone. Cada trecho finalizado é traduzido e encaminhado ao outro aparelho, que reproduz a tradução com a voz configurada. Ninguém precisa tocar em botões para cada frase.

**Exemplo:** João fala português e escuta português; Jérôme fala francês e escuta francês. Falas de João são traduzidas para o francês no telefone do Jérôme; falas do Jérôme para o português no telefone do João.

## Considerações técnicas e privacidade
- A conexão transporta frases traduzidas, não áudio bruto da conversa. A captação/transcrição ocorre no aparelho (Web Speech); o texto é traduzido pelo motor existente (Gemini quando autorizado ou MyMemory) e a reprodução é local ou ElevenLabs.
- A chave de sala é aleatória com 128 bits e os links devem ser privados; no máximo dois aparelhos ocupam a mesma sala ativa.
- Compartilhar autorização ElevenLabs usa convite individual do backend existente. Se o acesso premium não estiver disponível, o link de sala ainda pode funcionar com voz do aparelho, **sem fingir** que a ElevenLabs está autorizada.
- Não foram removidos os limites de crédito, Secret ou autenticação de voz.
- Cada navegador deve permitir microfone e reprodução de áudio. Navegadores que não disponibilizam `SpeechRecognition` não poderão transcrever nesse motor.
- Para evitar eco, o reconhecimento do microfone é suspenso durante a reprodução de voz recebida e reiniciado em seguida. Isso causa pequenas pausas durante o áudio de saída.
- WebSocket tenta se reconectar automaticamente, limitado a seis tentativas.

## Implantação
O Worker `duotranslate-ai` recebe o binding `DUO_ROOMS_217`, classe `DuoRoom217` e a migração SQLite `duo-conversation-room-v217`. O Github Pages sozinho não ativa esse backend; o deploy do Worker precisa concluir com sucesso.

## Validação real pendente
Os testes automáticos cobrem sintaxe, segurança do ticket, pareamento, tradução encaminhada, preservação do layout e regressões. **Eles não confirmam** autorização do microfone, TTS ElevenLabs nem comunicação em dois aparelhos físicos. Testar primeiro duas abas/dispositivos com Wi-Fi, depois redes diferentes; registrar os estados e o erro exato caso falhe. O uso real pode consumir créditos de Gemini/ElevenLabs.

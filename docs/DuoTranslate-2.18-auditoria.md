# DuoTranslate 2.18 — auditoria corretiva de conversação (14/10/2026)

## Origem
Revisão após a publicação de `preview/v2.17/`. A v2.17 introduziu sala WebSocket Cloudflare e entrada rápida com reconhecimento de voz por frases. Esta atualização **não** altera o backend Cloudflare, os Workers, o motor das versões antigas nem o estilo visual aprovado.

## Alterações entregues
1. Se o microfone for bloqueado ou a permissão falhar, o botão pode solicitar novamente o microfone na mesma sala. Antes a função apenas tentava reiniciar um reconhecimento não autorizado.
2. O WebSocket manda `ping` a cada 15 segundos e espera `pong`; em 45 segundos sem resposta, fecha para entrar no mecanismo de reconexão. Intervalos são descartados ao desconectar e encerrar.
3. As frases reconhecidas são traduzidas e entregues sequencialmente, evitando que frases consecutivas concluam fora de ordem; há aviso quando a fila supera 12 trechos.
4. Uma falha de síntese numa frase não impede reproduzir as frases seguintes. Uma reprodução local que nunca conclua tem limite de 45 segundos.
5. Ao encerrar a conversa, parar reconhecimento, síntese, reprodução de áudio e timers. Ao alternar para outra aba o reconhecimento é suspenso; na volta ele tenta retomar se o usuário tinha autorizado.
6. A tela deixa de informar apenas "Pode falar" quando está conectado mas ainda falta autorização do microfone.

## Preservação e segurança
- Backup: `backup-before-v218-20261014`.
- Arquivos isolados: `voice/connected-v218.js`, `access/client-v2.18.js`, `preview/v2.18/index.html`.
- A sala continua no `/room/v217` do Worker AI publicado e não depende de WebRTC.
- Não há novas permissões administrativas, secrets ou cobranças.
- Nenhuma alteração nos controles de crédito ElevenLabs: um convite sem autorização premium continua disponibilizando a voz local explicitamente.

## O que NÃO está validado
Os testes de regressão usam WebSocket, tradução e áudio simulados, **não** dois celulares reais. Não foram verificados o áudio real ElevenLabs nos dois lados, o tratamento de permissões do Chrome/Samsung, a experiência com Bluetooth, latência total, ou continuidade com a tela bloqueada.

## Teste físico recomendado
Abra `preview/v2.18/?v=218` no Samsung. Toque em "Com celulares conectados" e "Copiar convite". No outro aparelho abra o link completo, selecione idiomas e voz, toque em "Entrar e conversar" e autorize o microfone nos dois aparelhos. Confirme ambos "Conectados", depois cada um fala uma frase no seu idioma e verifica se a voz traduzida sai no outro aparelho no idioma correto. Se falhar, guarde o texto de erro visível em cada aparelho. Não envie a parte `#duo-invite=` do link.

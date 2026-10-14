# DuoTranslate 2.12 — Conversação com diagnóstico e teste gratuito
Data: 14/10/2026

## Isolamento e backup
- Backup anterior à 2.12: branch `backup-before-v212-20261014`, commit `3752fe8f96344822d89d13564876b14a62bb8bba`.
- Versões `preview/v2.10/` e `preview/v2.11/` e seu código de conexão original são mantidos sem modificação.
- Interface 2.12 em `preview/v2.12/index.html`: cópia fiel da 2.11, com a mesma folha CSS.
- Novo iframe de conversação em `preview/engine-v2.12/index.html`, com app isolado em `preview/engine-v2.12/app.js`.
- Novo cliente de acesso `access/client-v2.12.js`, exclusivo do caminho v2.12.
- O laboratório gratuito 2.11 permanece acessível e com o mesmo motor `voice/free-lab.js` na 2.12.

## Fluxo de conexão
1. Abra `/preview/v2.12/` em ambos os aparelhos.
2. Configure idioma de fala e idioma de escuta de cada aparelho.
3. Em **Conversação > Com celulares conectados**, uma pessoa toca em Criar sala.
4. Aguarde aparecer **Sala pronta — aguardando a outra pessoa**. Isso confirma o cadastro do código no servidor PeerJS, **não** que os celulares já estejam conectados.
5. Compartilhe o **código de oito caracteres** ou use **Copiar convite** para enviar um link com o código. O link não inclui senha administrativa ou acesso pago.
6. No segundo aparelho, entre no mesmo código. O diagnóstico informa o progresso de registro, localização da sala, abertura WebRTC e confirmação dos idiomas.
7. Ambos devem chegar a **Conectados · comunicação confirmada**.
8. Em qualquer aparelho, toque em **Enviar teste gratuito entre aparelhos**. Uma mensagem de diagnóstico sem conteúdo pessoal será enviada ao outro aparelho, que responderá automaticamente. A confirmação mostra o tempo de ida e volta em ms. Não exige microfone, IA ou acesso a APIs de voz/tradução.
9. Somente após o teste de conexão, avance à conversa e ative os microfones. Os modos legados de tradução podem usar API externa/créditos e são independentes do ping.

## Estados exibidos
- Registrando sala: PeerJS ainda não confirmou o host; timeout de 12 segundos.
- Sala pronta/aguardando outra pessoa: host registrado, sem limite para chegada do convidado.
- Localizando a sala: convidado está conectando ao servidor; timeout inicial de 15 segundos.
- Abrindo canal entre aparelhos: sinalização WebRTC até 15–20 segundos.
- Confirmando idiomas: canal aberto, aguardando mensagem `hello` do outro aparelho; limite de 10 segundos.
- Conectados: canal aberto e troca de idiomas confirmada; teste gratuito habilitado.
- Falha: erros de sala inexistente, conflito de ID, rede/sinalização, WebRTC, fechamento de canal e temporização são mostrados com explicação e opção **Tentar novamente**.
- Reconectando: tentativa de restaurar sinalização, com limite de 12 segundos.

## Diagnóstico de ping
- Evento de ida: `{type:'duo-test',id:...}`.
- Evento de volta: `{type:'duo-test-ack',id:...}`.
- Apenas o remetente mede o tempo de ida e volta com `performance.now()`; não há exigência de sincronização de relógios.
- Sem resposta em oito segundos, o teste apresenta uma mensagem de timeout.
- Não utiliza `fetch`, `DuoReliable`, `DuoAI`, ElevenLabs, Gemini, Soniox, OpenAI ou MyMemory.
- Nenhum áudio, gravação ou token de acesso é transmitido no teste.

## Limitações explícitas
- A sinalização usa o servidor público da biblioteca PeerJS. A qualidade e a disponibilidade dessa infraestrutura não são garantidas pelo DuoTranslate.
- WebRTC pode falhar em redes com firewall/NAT restritivo. Não adicionamos um servidor TURN por conta própria, nem contratamos hospedagem.
- Os testes automatizados simulam navegadores e canais PeerJS, verificando estados e mensagens, **mas não demonstram conectividade real entre celulares em redes diferentes**.
- A conexão de dados é apenas a primeira fase. Tradução, reconhecimento de voz, idioma e reprodução ainda têm testes próprios, não estão garantidos por um ping bem-sucedido.
- O acesso compartilhado via URL com código não cria usuário de IA/ElevenLabs. Cada participante precisa de autorização individual para os recursos que exijam autenticação.
- Apenas conexões iniciadas por usuários na tela são criadas; não há envio de chamadas pagas durante a conexão/teste.

## Diagnóstico em dispositivos reais
Se a ligação ficar em Falha, registrar dos dois aparelhos: (1) etapa, (2) mensagem visível, (3) código de sala, (4) navegadores, (5) redes utilizadas (Wi-Fi/celular). Nunca enviar tokens de acesso. Repetir uma vez após recriar a sala. Se a conexão entre redes distintas não ocorrer, estudar um servidor de sinalização próprio e as opções de relay/TURN **após aprovação do usuário**.

## Testes
A suíte de testes inclui simulação de criador e convidado com um servidor PeerJS em memória: conexão, mensagens `hello`, teste `duo-test`, confirmação, ausência de requisições externas e sala inexistente. A CI não utiliza contas, chaves ou serviços pagos para esses cenários.

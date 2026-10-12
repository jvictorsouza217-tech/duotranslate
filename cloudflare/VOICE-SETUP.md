# ElevenLabs no DuoTranslate — instalação sem terminal

**Não altere nem apague o Worker `duotranslate-ai` existente.** Ele faz as traduções com Gemini. Vamos criar um SEGUNDO Worker chamado `duotranslate-voice-test` só para sintetizar a voz. Comece com o Worker de voz desligado: nenhum crédito será usado automaticamente.

## Passo a passo pelo site Cloudflare

1. Na tela **Workers & Pages** (a que mostra `duotranslate-ai`), clique em **Create application**.
2. Escolha a opção para **importar/conectar um repositório Git** (GitHub). Se essa opção não aparecer na mesma tela, crie um Worker simples com nome `duotranslate-voice-test`; depois entre nele em **Settings → Builds → Connect**.
3. Escolha a conta GitHub `jvictorsouza217-tech`, repositório **duotranslate** e ramificação **main**.
4. Configure o nome do Worker como **`duotranslate-voice-test`** e o diretório raiz como **`/`**.
5. Quando aparecerem as configurações de compilação, deixe **Build command** em branco (se opcional) e informe em **Deploy command**, **no campo do site Cloudflare, não no seu terminal**:

   `npx wrangler deploy -c wrangler.voice.jsonc`

   Esse comando indica à Cloudflare qual dos dois Workers do repositório deve ser implantado. O arquivo `wrangler.voice.jsonc` já existe no GitHub e inclui o limite de 4 chamadas/minuto. O rate limiting é configurado ali, pois esse tipo de binding não é atualmente configurável pelo painel.

6. Execute a implantação e confira se aparece o **segundo Worker** `duotranslate-voice-test` com endereço `https://duotranslate-voice-test.SUA-CONTA.workers.dev` (o endereço exato será mostrado pelo painel). Se aparecer um erro, **pare e envie a captura**, sem mudar o Worker do Gemini.

## Segredos e ativação (só depois do segundo Worker publicado)

7. Abra o **Worker novo → Settings → Variables and Secrets → Add**.
8. Acrescente **dois Secrets**, cada um com seu valor real e sem divulgar aqui:
   - **ELEVENLABS_API_KEY**: chave gerada em ElevenLabs → Developers → API Keys.
   - **DUO_ACCESS_CODE**: senha nova e diferente da API Key, idealmente com 16 caracteres aleatórios ou mais.
9. Acrescente uma variável de texto `ENABLE_VOICE_TEST` com valor **`yes`** somente quando quiser iniciar testes que consomem créditos. Sem isso o Worker recusa os testes. O arquivo GitHub utiliza `keep_vars: true` para preservar segredos e variáveis de execução em futuros deploys.
10. Abra o link do novo Worker seguido de `/health`. Ele deverá indicar `configured: true`. Isso **não testa o áudio**; apenas verifica pré-requisitos.

## Usar no DuoTranslate experimental

11. Abra a **prévia 2.8** → **Configurações → Vozes → ElevenLabs**. Informe a URL pública do segundo Worker, o código de acesso **DUO_ACCESS_CODE** (não a API Key), e uma voz da ElevenLabs para o idioma desejado.
12. Clique em **Testar áudio** apenas quando concordar com o consumo de créditos. A tradução tradicional, o Gemini e as vozes gratuitas do navegador permanecem independentes.

Não envie nenhuma chave de API por chat. Se a conta gratuita não permitir listar vozes por API, copie um Voice ID de uma voz que esteja disponível na sua própria conta.

### Limitações importantes
- Na etapa experimental, a chamada é limitada a **4 solicitações por minuto compartilhadas**, no máximo 220 caracteres e 1 MB de áudio. Isso **não é** um teto mensal garantido. O controle de créditos continua na ElevenLabs; limites de Cloudflare são aproximados.
- A síntese de voz envia o **texto traduzido** à ElevenLabs; não envia a gravação do microfone.
- O produto não possui autenticação individual segura para disponibilização pública; não compartilhe o código de acesso.
- A ElevenLabs pode cobrar créditos; a experiência gratuita do site não garante créditos gratuitos de API suficientes para uso contínuo.

Fontes: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/ ; https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ ; https://elevenlabs.io/docs/overview/capabilities/text-to-speech

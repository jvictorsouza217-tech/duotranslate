# Ativar Gemini gratuito no DuoTranslate 1.3

O MyMemory continua funcionando mesmo sem criar conta no Google ou na Cloudflare. A opção Gemini é **opcional** e **NÃO está ativa até que estes passos sejam concluídos**.

## Antes de começar

- Conta **Google AI Studio**: https://aistudio.google.com/api-keys
- Conta **Cloudflare Workers Free**: https://dash.cloudflare.com/
- Não copie sua API Key para nenhum arquivo do GitHub, não a envie para o ChatGPT nem compartilhe em capturas de tela.
- Use **um projeto Gemini no Free Tier**, sem ativar um plano pago nem habilitar faturamento. Confira o status e os limites em https://aistudio.google.com/usage.
- O modelo padrão é `gemini-3.5-flash-lite`, cuja faixa gratuita pode mudar e tem limites por minuto/dia. Só a publicação do código não ativa o serviço.

## Etapa 1: chave Gemini

1. No Google AI Studio, vá a **API Keys**.
2. Crie uma chave para um projeto de API Gemini com nível **Free**. Se o projeto não estiver no nível gratuito ou pedir habilitar faturamento para o modelo, pare e não prossiga.
3. Copie a chave para um local privado temporário. **Nunca** coloque a chave num site público.

## Etapa 2: criar Cloudflare Worker

1. Acesse https://dash.cloudflare.com/ e abra **Workers & Pages**.
2. Crie um Worker pelo editor do painel (pode começar com um template simples).
3. Substitua o código de exemplo pelo conteúdo integral de [gemini-worker.js](./gemini-worker.js). Publique.
4. Em **Settings → Variables and Secrets → Add**, crie **dois Secrets** (não variáveis de texto públicas):
   - `GEMINI_API_KEY`: sua chave secreta do Google AI Studio.
   - `DUO_ACCESS_CODE`: uma senha diferente da API Key, longa (idealmente 16+ caracteres), que você mesmo inventa.
5. Salve e faça deploy dos Secrets. Não habilite faturamento pago no Cloudflare. Plano **Workers Free** suporta Workers com secrets.
6. Copie o endereço HTTPS fornecido pela Cloudflare, semelhante a `https://duotranslate-ai.seu-usuario.workers.dev` (seu endereço real será diferente).
7. Abra `https://SEU-ENDERECO.workers.dev/health`: deverá mostrar `"configured":true`. Isso verifica somente o Worker e os Secrets, não uma tradução real.

## Etapa 3: selecionar Gemini no DuoTranslate

1. Abra https://jvictorsouza217-tech.github.io/duotranslate/ (versão **BETA 1.3**).
2. Em **Tradutor por inteligência artificial**, escolha **Gemini Flash-Lite — IA gratuita**.
3. Cole a URL do Worker (a URL pública **não é** a chave de API).
4. Digite o valor da senha `DUO_ACCESS_CODE` no campo **Seu código de acesso**.
5. Toque em **Testar IA com uma frase em francês**. Se aparecer uma tradução, o Gemini está acessível.
6. Faça os testes com frases reais. Se não funcionar ou estiver lento, selecione **MyMemory** novamente, sem perder o modo de conversa.

O Worker foi criado para aceitar apenas requisições de navegador que venham de `https://jvictorsouza217-tech.github.io`. Isso não é autenticação: a senha privada protege o acesso. Mesmo com senha, não é sistema de segurança empresarial nem há limitação própria de abuso por IP, portanto acompanhe a cota no Google AI Studio.

## Importante

- **O serviço não traduz áudio diretamente.** O navegador reconhece a fala, a IA traduz o **texto**, e a voz do aparelho fala a tradução.
- Como a IA adiciona uma requisição, **pode ficar mais lenta**, e não mais rápida, que o MyMemory. Compare o tempo de tradução exibido no app.
- No plano gratuito do Gemini, conteúdos enviados podem ser utilizados pelo Google para melhorar seus produtos. Evite dados pessoais e conversas sensíveis.
- A URL do Worker fica guardada localmente no navegador; a senha de acesso fica guardada apenas na sessão da aba. Ao abrir o app em outro celular, configure a URL e o código lá também.
- **Nunca** publique `GEMINI_API_KEY` nem `DUO_ACCESS_CODE` no GitHub.
- Ao habilitar faturamento no Google AI Studio/Cloudflare, podem existir cobranças. Mantenha os projetos estritamente **Free** para respeitar o objetivo de custo zero.
- Em caso de erro, a troca manual para MyMemory preserva o aplicativo.

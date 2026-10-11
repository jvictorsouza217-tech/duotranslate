# DuoTranslate — protótipo 1.0

**Objetivo:** duas pessoas se comunicarem em português (Brasil) e francês (França), cada uma usando **seu próprio celular e fone Bluetooth comum**. A pessoa fala ao microfone do celular/fone; o outro aparelho reproduz a versão traduzida em voz alta.

## O que já está no código

- Interface responsiva em português, estilo escuro, sem instalação e sem frameworks de build.
- Uma pessoa cria uma sala de oito caracteres; a outra entra usando o código ou link.
- Conexão entre celulares via WebRTC/PeerJS (não há banco de dados próprio).
- Cada pessoa seleciona o idioma que **fala**; o texto enviado é traduzido para o idioma da outra pessoa.
- Reconhecimento de fala com a API de voz do navegador (`SpeechRecognition` / `webkitSpeechRecognition`), reiniciando depois de cada frase quando possível.
- Tradução de texto com MyMemory (serviço externo, gratuito e limitado).
- Leitura em voz alta da tradução recebida com `speechSynthesis` — deve usar o dispositivo de saída padrão do telefone, incluindo Bluetooth quando roteado pelo sistema.
- Botões para testar o áudio e para digitar frases manualmente se o reconhecimento de voz não funcionar.
- Ao reproduzir uma tradução, o app tenta pausar temporariamente a captação para evitar que o áudio seja novamente traduzido.

## Como colocar online sem pagar (GitHub Pages)

> Em celulares diferentes a página deve ser servida por **HTTPS**; abrir `index.html` diretamente no gerenciador de arquivos não é o procedimento correto para o teste.

1. Crie uma conta gratuita no GitHub, se ainda não tiver.
2. Crie um repositório **público** chamado `duotranslate`.
3. Descompacte o ZIP. Envie todos os arquivos de `DuoTranslate_v1` para a **raiz** do repositório (`index.html`, `style.css`, `app.js`, `icon.svg`, `manifest.webmanifest`, `.nojekyll`). Não envie a pasta externa em vez de seus conteúdos.
4. No repositório, vá a **Settings → Pages → Build and deployment → Deploy from a branch**. Selecione `main` e `/ (root)` e salve.
5. Aguarde o GitHub Pages disponibilizar o endereço HTTPS em `https://SEU-USUARIO.github.io/duotranslate/`.
6. Abra esse mesmo endereço no **Chrome do Samsung** e no **Safari do iPhone**.
7. Samsung: selecione **Português** e **Criar uma sala**. iPhone: selecione **Français**, insira o código recebido e toque em **Entrar**. (Pode inverter as plataformas.)
8. Em **ambos** os celulares, conecte o fone Bluetooth nas configurações do sistema, toque em **Testar áudio do fone** e confira se o som sai pelo fone.
9. Nos dois aparelhos, toque em **Ativar conversa** e aceite os pedidos de permissão para o microfone/reconhecimento de fala.
10. Teste frases curtas, um de cada vez. Se o microfone apresentar erro, teste digitando uma frase no campo de texto; isso separa problemas de áudio dos problemas de tradução/conexão.

O GitHub Pages gratuito normalmente exige repositório público. **Não coloque senhas, dados privados ou API keys neste repositório.**

## Testes locais no computador

No terminal, dentro da pasta deste projeto:

```bash
python -m http.server 8000
```

No navegador do PC, abra `http://localhost:8000`. Para testar dois celulares diferentes, utilize o HTTPS publicado online: `http://192.168.x.x:8000` não é contexto seguro para reconhecimento de voz no celular.

## Limitações conhecidas e honestas

1. **Não foi testado fisicamente** em um Samsung e iPhone reais. Compatibilidade e permissões dependem da versão de Chrome, Safari e iOS/Android.
2. O reconhecimento contínuo não é garantido: no Chrome Android `continuous` não funciona como no desktop; o código reinicia a escuta após cada frase. Safari/iPhone pode exigir intervenções, encerrar sessões ou não reproduzir áudio sintetizado sem novo gesto.
3. O app precisa permanecer visível e o telefone desbloqueado para os primeiros testes. Tela bloqueada, mudança de app, áudio e microfone simultâneos e Bluetooth podem falhar conforme sistema e navegador.
4. **Não é tradução simultânea palavra a palavra.** Espera o navegador concluir uma frase, pede a tradução e só então envia o texto traduzido para o outro celular. Há atraso.
5. A tradução online **não é ilimitada**. MyMemory impõe cota gratuita anônima (documentação pública indica cerca de 5 mil caracteres por dia), pode aplicar bloqueios e está sujeito a indisponibilidade. Não cobramos nada, mas dependemos deste serviço sem garantia de continuidade.
6. A voz pode ser processada por serviços do sistema/navegador; o conteúdo textual das frases é enviado ao MyMemory. A infraestrutura pública do PeerJS é usada no encontro entre os celulares. **Não use com informações confidenciais.**
7. A conexão P2P usa o servidor público PeerJS e STUN; pode não conectar em algumas redes com NAT restritivo por falta de servidor TURN. Não é uma garantia de que funcione em qualquer rede.
8. O navegador não deixa o site forçar um fone específico. O Android/iOS é responsável pelo roteamento de entrada e saída de áudio.
9. O protótipo requer conexão com a internet. Sem chave paga não há garantia de disponibilidade ou qualidade de produção.

## Próxima etapa, depois do primeiro teste

Se a voz falhar especialmente no Safari, substituir a versão web por apps nativos Flutter para Android/iOS. Considerar tradução offline com **Google ML Kit Translate** em cada aparelho (modelos baixados localmente), reconhecimento de fala nativo e conexão P2P/serviço gratuito de sinalização. Construir e instalar o app nativo no iPhone exige um fluxo de compilação/assinatura Apple; no Windows não é tão simples quanto gerar APK para Android.

## Estrutura

```
index.html          Interface
style.css           Visual
app.js              Conexão, reconhecimento, tradução, áudio
manifest.webmanifest Informações de aplicativo web
icon.svg            Ícone
.nojekyll           Desativa o Jekyll no GitHub Pages
README.md           Este guia
```

# DuoTranslate — protótipo 1.6

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

## Versão 1.6 — correção dos pares e oito idiomas na interface

- Backup criado: branch `stable-v1.5` (antes da correção).
- Corrigida a seleção **origem → destino** no teste individual: selecionar uma língua não muda mais automaticamente a outra para francês/português.
- Se origem e destino coincidirem, o app mostra um aviso explícito, em vez de redirecionar para um idioma inesperado.
- A conversa em dupla agora tem escolhas independentes: **idioma que cada pessoa fala** e **idioma no qual cada pessoa quer ouvir**. Cada telefone envia ambas as informações ao parceiro; a tradução vai para o destino que ele pediu. A seleção do outro telefone não fica mais implicitamente vinculada ao idioma que a pessoa fala.
- A interface tem opções para português, francês, inglês, espanhol, italiano, alemão, árabe e mandarim, com tradução de painéis, campos principais e avisos. Algumas mensagens técnicas dinâmicas podem aparecer em português nesta versão beta.
- Fontes e destinos permanecem válidos nos oito idiomas; capacidade de reconhecimento e síntese de voz continua dependente do dispositivo.
- Validação em ambiente simulado: 56 pares encaminhados corretamente no modo individual e no Worker. Testes em aparelhos e com API externa real continuam necessários.
- Importante: após abrir a atualização, recarregar **os dois** navegadores para que o novo protocolo de conexão seja utilizado em ambas as pontas.

## Versão 1.5 — idiomas e controle de consumo (beta, sem instaladores)

**Backup:** a versão 1.4 anterior às mudanças foi preservada na branch \`stable-v1.4\`.

**Android, iOS e Web:** esta etapa modifica somente o código Web que usamos como base comum. **Não foi criado APK Android ou IPA iOS.** O Android utiliza \`.apk\` (ou \`.aab\` nas lojas) e o iPhone não instala APK: aplicativos iOS usam \`.ipa\`, assinatura e provisionamento. Quando decidirmos empacotar para testes, avaliar Capacitor, ferramentas nativas (Android Studio/Xcode), microfone/voz e permissões. Não publicar nas lojas por enquanto.

**Idiomas de tradução:** \`languages.js\` centraliza português, francês, inglês, espanhol, italiano, alemão, árabe e mandarim simplificado. Na conversa em dupla, cada pessoa escolhe a língua que fala; no teste individual, há campos independentes para o idioma ouvido e o idioma de destino. Diferentes pares são aceitos pela tradução Gemini via Cloudflare e enviados ao MyMemory no modo tradicional. O reconhecimento de voz e a síntese dependem do navegador/sistema; árabe e chinês podem falhar ou usar vozes pouco naturais. Testar em cada aparelho. O seletor avançado de vozes ainda cobre principalmente PT/FR.

**Idioma da interface:** seletor português, francês, inglês e espanhol com tradução inicial dos títulos, botões e textos principais. Alguns avisos/status técnicos continuam em português, para ajuste em versões posteriores.

**Consumo:** o painel mostra estimativa de solicitações Gemini/MyMemory feitas **neste navegador**, tokens reportados pelo Gemini e falhas. Os dados são guardados localmente, não combinam vários aparelhos e não refletem o limite real da conta. Os limites oficiais ficam no Google AI Studio (RPM/TPM/RPD) e na Cloudflare (requisições). Reiniciar o contador local não renova a cota.

**Proteção no servidor:** binding Cloudflare Rate Limiting (\`AI_RATE_LIMITER\`) configura **40 chamadas por 60 segundos por localidade**, com chave compartilhada do protótipo. É aproximado/eventualmente consistente, não faz contagem diária global, e não é uma garantia contra abuso. O código \`DUO_ACCESS_CODE\` continua obrigatório e armazenado no Cloudflare Secret. **Não compartilhar o código de acesso com amigos**, porque não temos contas individuais/autenticação pública. Antes de divulgação pública, implementar cadastro, cotas por usuário e monitoramento servidor seguro. Não vincular cartão/faturamento na chave Free.

**Privacidade:** o histórico existente continua armazenado no dispositivo. Não são gravadas chaves Gemini nem senhas no histórico. Nenhuma gravação de áudio. O reconhecimento pode processar fala em serviços do navegador e a tradução em APIs externas.

## Versão 1.4 — histórico, exportação e avaliação

**Backup:** a versão anterior à atualização 1.4 está preservada em \`stable-v1.3\`.

**Histórico local:** painel "Histórico local e qualidade". Salva automaticamente, a partir desta versão, frases, tradução, idioma de origem/destino, mecanismo, modo (individual ou em dupla), data e duração medida da chamada do tradutor (não inclui reconhecimento de fala nem voz). É possível pausar a gravação e apagar os registros; o limite é de 250 itens, com os mais antigos substituídos. Não contém áudio. **Não é sincronizado entre computador/Android/iPhone**, nem retroativamente recupera traduções antigas que só existam em PDFs.

**Exportar:** botões JSON (inclui comparação e análise) ou CSV (abre em planilhas, com UTF-8 e aspas para texto). Os arquivos contêm as frases e devem ser compartilhados com cuidado.

**Comparar tradutores (opcional):** em cada item salvo, o botão permite comparar Gemini e MyMemory. Se a tradução já veio de um dos motores, a resposta e o tempo são reaproveitados para reduzir chamadas extras; consulta apenas o outro motor. Os resultados e tempos ficam registrados no próprio item. A comparação não é um julgamento automático de qual é melhor: avalie a fidelidade e a naturalidade.

**Analisar qualidade com IA (opcional):** ao tocar, o original reconhecido e a tradução são enviados ao **Gemini via Cloudflare**, usando as credenciais configuradas no painel do aplicativo. A IA retorna um parecer de fidelidade, naturalidade, problemas concretos e sugestão de correção. O parecer é orientativo: **não confere o áudio original** nem garante tradução perfeita. Cada análise gasta uma requisição da cota gratuita.

**Privacidade e segurança:** o histórico está no localStorage do navegador (não criptografado pelo aplicativo), potencialmente acessível a pessoas com acesso ao perfil do navegador e scripts da mesma origem. Não use com dados confidenciais. Desativar a gravação não apaga registros antigos. Excluir o histórico local não apaga exports já baixados nem registros de processamento de serviços externos. O PIN e a API Key não são escritos no histórico. Se o armazenamento for bloqueado por privacidade/aba anônima, os registros podem não persistir.

**Importante:** essa atualização não muda os estilos de voz, as opções da voz sintetizada, as funções de conversa ou a estrutura PWA. A melhoria das vozes e do layout fica para uma versão futura, depois dos testes em celular.

## Versão 1.2: primeiro melhorias gratuitas

A versão 1.1 aprovada foi preservada na branch **stable-v1.1**, para permitir retorno caso uma mudança cause problemas.

**Novidades 1.2:** no painel recolhível **Escolher vozes e velocidade**, é possível selecionar entre as vozes disponíveis no próprio navegador/celular para pt e fr, ajustar a velocidade de leitura de 0,75 a 1,25 vezes e experimentar um **modo rápido**, desativado por padrão, que pede ao reconhecimento de voz para finalizar quando detecta que a pessoa parou de falar. O modo rápido pode cortar frases; compare ligado/desligado.

Os resultados mostram **apenas o tempo da requisição de tradução ao MyMemory**, excluindo o tempo de reconhecimento de fala, a transmissão entre celulares e o começo ou a duração do áudio. Use isso para identificar se o atraso observado ocorre fora da API de tradução. A amostra de voz não deve ser reproduzida com o microfone ligado, para evitar eco.

Esta etapa **não muda o motor de tradução** e não usa serviços pagos. Integração com DeepL API Free, Gemini ou serviço de voz baseado em IA necessita conta própria, cotas válidas e um proxy/backend para manter credenciais fora do repositório público. Não inserir chaves no GitHub Pages. A qualidade e rapidez das vozes do sistema dependem do aparelho.

## Modo Teste Individual — v1.1 (sem segundo celular)

1. Abra https://jvictorsouza217-tech.github.io/duotranslate/ e encontre **Modo teste individual** no topo. Não precisa criar sala.
2. Selecione **Francês → Português** (ou o sentido contrário).
3. **Testar frase de exemplo**: envia texto ao MyMemory, mostra a tradução e tenta reproduzi-la em voz alta. Não testa o microfone.
4. **Começar a ouvir**: solicita o microfone; coloque uma fala francesa tocando em outro dispositivo, numa TV ou PC, perto do celular. Ao reconhecer uma frase, traduz e tenta reproduzir a tradução no áudio padrão (inclusive Bluetooth, quando selecionado pelo sistema).
5. Use **Repetir última tradução** para testar a saída de áudio com um toque; também é possível digitar uma frase própria.
6. Se o microfone não reconhecer, tente com o fone desconectado para verificar qual microfone está sendo utilizado; depois teste o JBL para validar a saída.

**Limitações:** não capta automaticamente o som interno de vídeos no mesmo celular; pode haver interrupções após frases, dependência de rede, falhas de permissão e atraso. A fala pode ser tratada pelos serviços do navegador, e o texto vai ao MyMemory. Não use para conversas confidenciais. A página precisa permanecer aberta e o dispositivo desbloqueado.

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
index.html          Interface (inclui teste individual)
style.css           Visual
solo.js             Reconhecimento/tradução/reprodução no teste individual
solo.css            Visual do modo teste
voice-settings.js   Preferências gratuitas de voz e finalização experimental
voice-settings.css  Painel visual de preferências
app.js              Conexão, reconhecimento, tradução, áudio
manifest.webmanifest Informações de aplicativo web
icon.svg            Ícone
.nojekyll           Desativa o Jekyll no GitHub Pages
README.md           Este guia
```

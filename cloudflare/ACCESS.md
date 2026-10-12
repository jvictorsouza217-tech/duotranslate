# Acesso individual — DuoTranslate 2.10

Backup anterior às alterações: [`backup-v2.10-before-individual-access-20261012`](https://github.com/jvictorsouza217-tech/duotranslate/tree/backup-v2.10-before-individual-access-20261012), commit `300258ffc7b3bfefe1244cef75ec53662e81480c`.

## Fluxo de uso

O desenvolvedor mantém suas contas e os Secrets dos dois Workers. Convidados não configuram GitHub, Cloudflare, Gemini, ElevenLabs, endereços ou códigos dos serviços.

1. O administrador abre a prévia 2.10 no navegador onde já configurou o acesso Gemini. O app usa esse código apenas para estabelecer a sessão administrativa. A chave de API permanece no Worker.
2. Escolhe normalmente idiomas e voz. Na tela de conexão, cria uma sala e usa o botão de convite que já existia.
3. O convite inclui a sala e uma autorização individual de uso único. Vale 24 horas para ativação; a sessão ativada vale 30 dias.
4. O convidado abre o link, conclui as telas iniciais existentes e usa os mesmos recursos de tradução e conversa. Os serviços vêm configurados e as vozes inicialmente selecionadas pelo administrador são herdadas. O convidado pode escolher outra voz normalmente.
5. Depois da primeira abertura, a sessão é lembrada naquele navegador. O controle existente para esquecer remove a lembrança permanente sem interromper a sessão da aba.

Quem já tem uma sessão de convidado pode copiar o link da sala para outro usuário já autorizado. Convidados não podem criar novas autorizações. Fechar uma sala não revoga a autorização individual.

O layout, HTML visual e CSS das duas telas permanecem iguais. Só o acesso, a entrega do convite e a configuração automática foram integrados. Não mudam tradução, reprodução, microfone, idiomas, histórico ou limites já configurados.

## Implantação pelo desenvolvedor

Os Workers existentes continuam separados:

- Gemini: `duotranslate-ai`, usando `wrangler.jsonc`. A configuração acrescenta o binding SQLite Durable Object `DUO_ACCESS_STORE` e exporta `DuoAccessStore`.
- Voz: o Worker existente `duotranslate`, cujo Build já usa `wrangler.voice.jsonc` e substitui o nome do arquivo de configuração pelo nome do serviço conectado. A configuração acrescenta `DUO_ACCESS_SERVICE`, um Service binding para `duotranslate-ai`.

Deploy do Gemini: `npx wrangler deploy -c wrangler.jsonc`.

No Build já conectado ao Worker de voz: `npx wrangler deploy -c wrangler.voice.jsonc`.

Ao implantar por terminal fora do Build conectado, use o nome real do serviço existente: `npx wrangler deploy -c wrangler.voice.jsonc --name duotranslate`.

Nenhum Secret novo é necessário. Os valores existentes `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `DUO_ACCESS_CODE` e `ENABLE_VOICE_TEST` permanecem privados. `keep_vars` preserva variáveis existentes. Não trocar as chaves nem habilitar faturamento pago para esta alteração. SQLite Durable Objects é compatível com Workers Free.

O `/health` de cada serviço passa a informar `individualAccess: true` quando seu binding de acesso está presente. Essa verificação não testa uma tradução ou áudio real. A implantação do código no GitHub Pages, sozinha, não confirma a atualização dos dois Workers.

## Administração sem alterar a interface

No próprio navegador do administrador, estes métodos ficam disponíveis para gerenciamento técnico:

```js
await DuoAccess.admin.users();
await DuoAccess.admin.revoke('id-do-convidado');
```

O servidor verifica o papel do usuário em cada operação. Editar o papel no navegador não dá permissão administrativa. Revogar bloqueia novas chamadas Gemini e ElevenLabs imediatamente após a operação; áudio já recebido pelo aparelho pode terminar de tocar.

## Proteções e limites

- Tokens aleatórios de 256 bits; apenas hashes ficam no servidor.
- Convites resgatados em transação, para impedir uso em dois aparelhos.
- Convite no fragmento da URL, removido ao abrir. Não contém códigos dos Workers ou chaves de API e não vai no pedido ao GitHub Pages.
- Sessão validada no servidor antes das chamadas aos provedores. O Worker de voz consulta o serviço de acesso por binding interno.
- Os limites compartilhados existentes (Gemini 40/min e voz 4/min, conforme bindings) continuam. Não foi acrescentada cota diária, faturamento ou cobrança por usuário.
- O acesso por convite autoriza o portador do link; não verifica identidade por email.
- Sessão guardada no armazenamento do navegador, separada dos códigos de desenvolvedor. O convidado não recebe as credenciais administrativas.
- A interface antiga e os pedidos com PIN continuam compatíveis; se um pedido envia uma sessão inválida, ele é recusado sem recorrer ao PIN.
- Nenhuma gravação, frase ou histórico é enviada ao armazenamento de acesso.

Validação automatizada: `npm run test:access`. Os testes simulam provedores e não usam créditos reais. Testes físicos Android/iPhone e áudio real continuam separados dessa validação.

Referências técnicas: [SQLite Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/), [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/) e [clipboard WebKit](https://webkit.org/blog/10855/async-clipboard-api/).

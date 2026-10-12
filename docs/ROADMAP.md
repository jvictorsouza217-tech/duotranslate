# DuoTranslate — plano vivo do projeto
Atualização: 2026-10-12. Este arquivo é o registro das decisões e pendências para futuras conversas.
Não é um relatório de funções que já estão implementadas.

## Versões preservadas
- **Beta 1.7:** tradutor real, Gemini, 14 idiomas, Web Speech/SpeechSynthesis, modo individual, dois celulares com conexão PeerJS, histórico. Backup imutável pretendido: `stable-v1.7`; produção em `/duotranslate/`.
- **Concept 2.4:** telas iniciais aprovadas; manter a estrutura/estética da saudação multilíngue e as fases de cadastro.
- **Prévia 2.5:** experiência integrada anterior; arquivada em `preview/v2.5/`.
- **Prévia 2.6:** três caminhos claros de tradução; código em `preview/v2.6/` e na branch `integration-v2`. Integração ainda experimental e não substitui a Beta 1.7.

## O que a 2.6 realmente oferece
- **Conversação conectada:** reutiliza o mecanismo real da Beta 1.7; dois celulares com DuoTranslate, acesso à internet e código de sala. Fones opcionais. Não é chamada de áudio/VoIP: cada celular reconhece a própria fala e envia texto traduzido ao outro para ser falado.
- **Conversação sem conectar:** usa o motor real de teste individual com *um sentido de cada vez*. Para responder, precisa inverter manualmente os idiomas. Não identifica dois locutores nem alterna automaticamente.
- **Escutar e traduzir:** usa o reconhecimento de voz do dispositivo e a tradução individual, captando fala pelo microfone. Não captura automaticamente áudio interno de vídeos no mesmo aparelho, nem garante funcionamento em longos filmes/ruído. Fones opcionais.
- **Laboratório de tradução:** teste individual antigo preservado.
- **Histórico, vozes, consumo e IA:** permanecem em seus menus.
- Telas iniciais da Concept 2.4: não alterar sem pedido explícito.

## Pendências priorizadas (não implementadas)
1. **QA da 2.6:** verificar leitura no Android Chrome, iPhone Safari e desktop; idiomas de interface; acesso ao microfone; áudio Bluetooth; compatibilidade dos controles da Beta embutida; travamento/eco/recomeço. Não declarar sucesso antes de teste real.
2. **Pareamento persistente voluntário** (futura 2.7): vincular usuários/aparelhos uma vez com aprovação mútua, nomes amigáveis e revogação; nas sessões seguintes, solicitar conexão ao aparelho salvo, com aceite do destinatário. Sem exigir código a cada vez, mas internet e conexão ainda serão necessárias. Verificar privacidade/autenticação; **não** guardar apenas código de sala estático como credencial permanente.
3. **Modo sem conexão verdadeiramente bidirecional:** determinar quem falou usando seleção de turno, idioma automático testado ou reconhecimento de locutor; projetar confirmação manual como fallback; medir precisão antes de ativar automação. Não prometer reconhecimento perfeito.
4. **Escuta contínua para aulas, filmes, palestras:** avaliação de VAD, subtítulos locais, tradução por blocos, latência, alertas discretos, microfone ativo, áudio do fone e limites com tela bloqueada. Respeitar privacidade/consentimento; evitar gravação permanente.
5. **Integração real dos perfis de microfone:** escolher entrada quando sistema/navegador permitir; comparar RMS/clipping, ruído, ASR e precisão com o mesmo fone/celular; salvar avaliações locais. Os atuais testes não treinam ASR e não identificam pessoas.
6. **Identificação vocal opt-in:** avaliar em piloto separado *Picovoice Eagle* (web, Android/iOS, processamento local; AccessKey e condições comerciais), *SpeechBrain ECAPA-TDNN* (modelo Apache-2.0 e processamento próprio, possivelmente servidor/computador), e *pyannote community-1* (diarização, quem falou quando, open source com condições de download). São componentes complementares, não equivalentes. Medir falsas identificações, custo real, memória, latência, desempenho em PT/FR/AR, fone e ruído. Nunca afirmar que diarização por si reconhece nomes. Obter consentimento explícito para biometria e prover exclusão e transparência.
7. **Melhorar transcrição (diferente de identificação):** avaliar Speech-to-Text com adaptação por PhraseSet e nomes próprios. Pode ter custo e limites por idioma. Notificações faladas opcionais 'Não entendi; pode repetir?' no idioma selecionado, com limite para não interromper usuário.
8. **ElevenLabs TTS:** API protegida no backend/Worker (nunca expor API key no frontend), voz de qualidade por idioma com fallback SpeechSynthesis, Flash v2.5 vs Multilingual v2. Testar com texto real, latência ponta-a-ponta, preços/créditos e disponibilidade nos 14 idiomas; sem ativar cobrança automaticamente. Voz sintética NÃO é reconhecimento biométrico.
9. **Vocabulário e desempenho — DEIXAR PARA DEPOIS:** base pequena (100–300 frases inicialmente) de saudações e expressões verificadas, tradução cacheada por par e contexto, nunca converter palavra ambígua sem contexto, medir taxa de cache e tempo total (captação+ASR+tradução+TTS). Personal dictionary com correções aprovadas; não guardar frases sensíveis sem consentimento. Validar benefícios em teste A/B antes de escalar.
10. **Outras ideias futuras:** histórico unificado e exportações; legendas em tempo real; modo discreto; indicador de ruído/conexão; interface multilíngue 14 idiomas completa; PWA/APK/iPhone posteriormente; ouvir alertas offline apenas se tecnologia validar.
11. **Segurança, custo e privacidade:** métricas por usuário e cota em backend antes de compartilhar com amigos; não publicar senhas/API keys; segregação dos dados, política de exclusão e consentimento; dados da voz usados para identificar pessoas são potencialmente biométricos sob GDPR.

## Pesquisas/documentações verificadas
- Eagle speaker recognition on-device (inclui web e mobile; conta/AccessKey): https://picovoice.ai/docs/eagle/ e https://picovoice.ai/docs/quick-start/eagle-web/
- SpeechBrain ECAPA embeddings / verificação: https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb
- pyannote Community-1 diarização (não identidade por nome automaticamente): https://github.com/pyannote/pyannote-audio e https://huggingface.co/pyannote/speaker-diarization-community-1
- Speech-to-Text adaptation de frases: https://docs.cloud.google.com/speech-to-text/docs/adaptation-model
- ElevenLabs TTS e otimização latência: https://elevenlabs.io/docs/overview/capabilities/text-to-speech e https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization
- GDPR / dados biométricos: https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en

## Restrições de desenvolvimento
- Não substituir a Beta 1.7 até aprovação explícita do usuário após testes.
- Não modificar telas iniciais aprovadas sem novo pedido.
- Diferenciar comprovadamente funcional de experimental e planejado.
- Criar releases/ramificações para recuperação antes de mudanças destrutivas.
- Custos preferencialmente zero, e indicar custos, uso de CPU ou credenciais antes de adicionar serviços.

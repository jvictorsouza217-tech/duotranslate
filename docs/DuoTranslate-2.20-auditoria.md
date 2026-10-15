# DuoTranslate 2.20 — auditoria de histórico, vozes e captação

## O que foi comprovado no código anterior (2.19)
1. A conversa conectada não escrevia nenhuma entrada no histórico. O histórico geral disponível no iframe é limitado a 250 traduções e não guarda falas descartadas ou falhas de reprodução.
2. O perfil acústico calibrava volume, frequência e pausas, mas não identifica biometricamente quem está falando. O motor conectado não consultava o perfil.
3. O reconhecimento `SpeechRecognition` do navegador podia interpretar áudio ambiente, sobreposição do som de saída ou resultados atrasados como novas falas. Não havia garantia de que o texto reconhecido correspondia ao locutor desejado.
4. O menu mostrava nomes de vozes ElevenLabs, mas não oferecia uma prévia da voz dentro da tela simplificada.

## O que mudou na 2.20
- Nova trilha de **histórico local automático**, gravada evento a evento em IndexedDB: reconexão, reconhecimento de fala, frase descartada com motivo, tradução, recebimento, reprodução e falhas. Registra data/hora, identificador curto da sala, rótulo do aparelho, idiomas, original e tradução. **Áudio bruto, chaves e token de convite não são gravados.**
- Botões **Exportar histórico JSON** (inclui eventos de diagnóstico) e **Exportar CSV** no próprio modo conectado. Cada navegador preserva sua própria parte da conversa. Para juntar as duas visões, exportar dos dois aparelhos. A gravação requer armazenamento permitido pelo navegador e pode ser apagada pelo usuário, navegador ou limite do dispositivo.
- Traduções completadas também entram como **Conversa em dupla** no Histórico antigo, limitadas às 250 mais recentes nessa visualização, sem confundir os eventos intermediários com frases traduzidas.
- Botão **Ouvir exemplo** para pré-escutar a voz selecionada (ElevenLabs ou voz do dispositivo). Quando existir prévia pública validada do serviço, usa a amostra; na ausência da prévia, sintetiza uma amostra com autorização individual após clique explícito e **pode consumir créditos**.
- Reconhecimento pausado durante a reprodução de voz e mantido em espera por 1,8 segundo depois da reprodução; rejeição de falas duplicadas, coincidentes com texto da voz recém-reproduzida, confiança muito baixa (quando informada) e ausência de atividade acústica suficiente.
- Filtro de energia local por analisador `AudioContext`, usando o limiar calibrado salvo em `DuoVoiceProfile.current()` quando disponível. A análise de energia não é reconhecimento de identidade vocal e não envia áudio para o histórico nem para o relay.
- No Chrome que suporta `SpeechRecognition.start(audioTrack)`, tenta usar a trilha real autorizada; usa o microfone padrão do navegador quando indisponível. Suporte varia por navegador e aparelho.
- Ao pausar, interrompe a gravação e libera a trilha de áudio; ao encerrar, interrompe reprodução e análise e tenta salvar um evento final.

## Limitações fundamentais que NÃO estão resolvidas
- **Não há diarização nem verificação de locutor:** pessoas no mesmo microfone não podem ser diferenciadas com confiabilidade pelo Web Speech + calibração RMS/pitch. O nome no histórico significa identificação por aparelho/sessão, não por voz verificada.
- **Proteção contra eco não é prova de silêncio ou ausência de alucinações.** Alto-falantes externos, ruído e reconhecedor do navegador ainda podem gerar transcrições erradas. Usar fones ajuda a reduzir retorno acústico.
- O histórico de falas **que nunca foi gravado na 2.19 não pode ser reconstruído retroativamente** pelo programa.
- Histórico persistente é local, não sincronizado; eventos completos requerem exportação da sessão e armazenamento habilitado. A preferência explícita de desativar histórico é respeitada.
- A gravação completa da voz não é feita; somente texto e eventos.
- A tradução e a TTS continuam sujeitas às limitações/cotas de Gemini, MyMemory e ElevenLabs. Os testes unitários não substituem uma conversa real.

## Preservação e testes
- Backup `backup-before-v220-voice-history-20261015`.
- Prévia isolada `preview/v2.20/`.
- Somente arquivos novos: `voice/conversation-history-v220.js`, `voice/connected-v220.js`, `access/client-v2.20.js`, `preview/v2.20/index.html` e teste `tests/conversation-v220.test.mjs`.
- Worker Cloudflare e outros modos anteriores permanecem inalterados.
- Testes automatizados de escrita/leitura/exportação, preferência de privacidade, anti-eco, rejeição de resultados atrasados, preservação de traduções válidas, prévia e compatibilidade de layout.
- O `room-smoke` testa o relay online PT ↔ FR com mensagens fictícias sem custo de TTS.

## Critério para aprovação real
Num teste curto com dois aparelhos, validar: seleção e reprodução de voz de exemplo, escuta da fala real, tradução correta no outro aparelho, silêncio sem transcrições espontâneas, pausa e retomada, e exportação JSON/CSV que contenha os eventos de ambos os lados (cada dispositivo exporta o seu). Se frases falsas persistirem, o próximo passo NÃO é mais um filtro de texto: será trocar o reconhecimento do navegador por um motor de captura com VAD e diarização real, com análise de custos e privacidade antes de implementar.

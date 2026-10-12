# Teste de reconhecimento de locutor — SpeechBrain

**Situação:** experimento isolado de identificação vocal, sem integração ao aplicativo web, Gemini ou ElevenLabs.

O modelo aberto `speechbrain/spkrec-ecapa-voxceleb` (Apache-2.0) estima se duas gravações pertencem à mesma pessoa. Não é reconhecimento de palavras e não melhora diretamente a transcrição.

## Como testar no Windows
1. Tenha Python 3.10+ e crie um ambiente virtual. Instale `speechbrain`, `torch` e `torchaudio` com versões compatíveis com seu Windows.
2. Grave dois áudios de sua própria voz (ou de alguém que autorizou), de preferência 5–10 segundos, em WAV, fala normal.
3. Execute a partir da raiz do repositório:

```powershell
python experiments/speechbrain_voice_test.py --reference minha_voz_1.wav --sample minha_voz_2.wav
```

4. Repita com dois áudios de pessoas diferentes e fones/ambientes distintos. Registre a pontuação e os erros antes de decidir um limiar.
5. Evite uso biométrico em produção sem base legal, consentimento, privacidade e direito à exclusão (GDPR).

O modelo (~90 MB) precisa ser baixado no primeiro uso. Este roteiro **não prova** que o modelo funciona com precisão em árabe, português, francês, ruído ou diferentes aparelhos. É preciso medir.

## Vozes ElevenLabs (experimento separado)
A integração opcional foi preparada na prévia 2.7, mas **não está ativada**. O arquivo `cloudflare/voice-worker-test.js` pode ser publicado como um **Worker novo, separado** do atual Gemini. O Worker exige os segredos `ELEVENLABS_API_KEY`, `DUO_ACCESS_CODE` e a variável `ENABLE_VOICE_TEST=yes`, além de uma ligação Rate Limiting `VOICE_LIMITER` (quatro chamadas por minuto, compartilhado). Sem ela, recusa solicitações.

No painel da prévia, vá a **Configurações → Vozes → ElevenLabs**, informe o endereço desse Worker, o código privado e o ID de uma voz ElevenLabs por idioma. Não introduza a chave API no site ou GitHub.

**Aviso:** cada síntese de voz consome créditos e pode introduzir latência adicional. O sistema mantém a voz do aparelho como padrão. Não ativar sem consentimento e sem verificar cota, direitos de uso e privacidade.

O vocabulário experimental de 9 expressões × 14 idiomas pode ser ativado em **Configurações → Frases rápidas**. É um atalho de tradução por frases exatas, não um dicionário universal nem treinamento de voz.

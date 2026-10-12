# ElevenLabs optional — separate Worker
This is a separate test project and does not replace the existing `duotranslate-ai` Gemini Worker.

1. Keep the current Gemini Worker untouched.
2. Cloudflare Workers & Pages → Create Worker. Deploy `cloudflare/voice-worker-test.js` using `npx wrangler deploy -c wrangler.voice.jsonc` from a clone of this repo, **or** copy the script into a NEW Cloudflare Worker and create the rate-limiter binding specified in the config.
3. In new Worker's Settings, add **Secrets** (encrypted, never commit):
   - `ELEVENLABS_API_KEY` — your ElevenLabs API key; test credits may be consumed.
   - `DUO_ACCESS_CODE` — long private passphrase (at least 16 random characters, unrelated to the ElevenLabs key).
4. **VOICE_LIMITER** must be linked to a 4-per-minute shared Rate Limiting binding. The Worker will refuse ALL voice calls if missing.
5. Once ready, set **ENABLE_VOICE_TEST** to `yes`. Leave at `no` to disable API calls and prevent credit use.
6. Open the NEW Worker URL + `/health`. Confirm configured=true.
7. In DuoTranslate 2.7 → Settings → Voices → ElevenLabs, enter the new Worker URL, secret access *code* (not API key), destination-language ID of a voice selected in ElevenLabs, and enable. The PIN remains session-only and the voice ID + URL are saved locally.
8. Only click **Testar áudio** if you accept spending ElevenLabs credits. If unavailable, the app retains a browser TTS fallback during normal conversation.

No microphone audio is sent to this Worker; translated *text* is sent to ElevenLabs for synthesis. Regular speech recognition and Gemini translation are independent.

Hard limits: 4 shared calls/minute (with binding), 220 input characters per call, 1 MB audio maximum. **Not a global monthly budget**; monitor credits in ElevenLabs and disable the Worker when not testing. Before distributing the app to others, require real per-user authentication and strong quotas. Do not reuse the simple PIN for a public product.

On the free ElevenLabs account, the API voice catalog may be restricted; you may need to copy the ID of a voice that already belongs to your account. Models support the 14 DuoTranslate languages, but naturalness and accents vary by actual voice. Test each language individually.

Official docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert and https://elevenlabs.io/docs/api-reference/voices/search

#!/usr/bin/env python3
"""SpeechBrain ECAPA speaker-verification experiment for DuoTranslate (not authentication).
User must provide two consented voice samples recorded as WAV/FLAC.
Computes same/different-speaker similarity; it does NOT improve transcription or translate.
Model is downloaded on first run, roughly 90 MB plus Python/PyTorch dependencies.
"""
import argparse
import json
import pathlib
import time

def main():
    parser = argparse.ArgumentParser(description="Compare two voice recordings with SpeechBrain ECAPA-TDNN on the user's own computer.")
    parser.add_argument("--reference", type=pathlib.Path, required=True, help="Consented enrolled-voice recording, WAV/FLAC.")
    parser.add_argument("--sample", type=pathlib.Path, required=True, help="Second consented recording to compare, WAV/FLAC.")
    parser.add_argument("--model-dir", default="models/speechbrain-ecapa", help="Model download/cache directory.")
    args = parser.parse_args()
    for path in (args.reference, args.sample):
        if not path.is_file():
            parser.error("Arquivo inexistente: " + str(path))
        if path.suffix.lower() not in (".wav", ".flac"):
            parser.error("Use WAV ou FLAC, não MP3: " + str(path))
    start = time.perf_counter()
    from speechbrain.inference.speaker import SpeakerRecognition
    model = SpeakerRecognition.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", savedir=args.model_dir, run_opts={"device": "cpu"})
    score, same = model.verify_files(str(args.reference), str(args.sample))
    value = float(score.reshape(-1)[0])
    accepted = bool(same.reshape(-1)[0])
    print(json.dumps({
        "model": "speechbrain/spkrec-ecapa-voxceleb",
        "cosine_score": round(value, 4),
        "model_default_decision_same_speaker": accepted,
        "elapsed_seconds": round(time.perf_counter()-start, 2),
        "notes": "Preliminary experimental output, not an identity proof. Confirm accuracy with many clean/noisy recordings."
    }, ensure_ascii=False, indent=2))
if __name__ == "__main__":
    main()

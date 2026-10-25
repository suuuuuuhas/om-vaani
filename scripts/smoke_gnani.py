"""Synthetic TTS→STT integration check; this is not a real-user speech quality evaluation."""
import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.config import ROOT, settings
from app.languages import GREETINGS, normalize_language
from app.stt import transcribe
from app.tts import synthesize
from app.providers import ProviderError


async def run(language):
    if not settings().stt_key or not settings().tts_key:
        raise SystemExit('Add GNANI_STT_API_KEY and GNANI_TTS_API_KEY at http://127.0.0.1:8000/setup first.')
    target=ROOT/'output'/'smoke'
    target.mkdir(parents=True,exist_ok=True)
    start=time.monotonic()
    audio=await synthesize(GREETINGS[language],language)
    tts_ms=int((time.monotonic()-start)*1000)
    (target/f'{language}.ogg').write_bytes(audio)
    start=time.monotonic()
    transcript=await transcribe(audio,language)
    result={'test_type':'synthetic_roundtrip','language':language,'tts_ms':tts_ms,
            'stt_ms':int((time.monotonic()-start)*1000),'transcript':transcript,
            'real_speech_quality_verified':False}
    (target/f'{language}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--language',default='te-IN');args=parser.parse_args()
    try:asyncio.run(run(normalize_language(args.language)))
    except ProviderError as error:raise SystemExit(str(error))

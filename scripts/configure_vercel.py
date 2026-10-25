"""Upload this project's server configuration through stdin, without printing values."""
import json
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import ROOT, Settings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='+', help='Upload only these setting names')
    args = parser.parse_args()
    config = Settings()
    cloud = json.loads((ROOT / 'data/deploy-secrets.json').read_text())
    values = {
        'SUPABASE_URL': cloud['SUPABASE_URL'],
        'SUPABASE_KEY': cloud['SUPABASE_KEY'],
        'STORAGE_BACKEND': 'supabase',
        'SUPABASE_AUDIO_BUCKET': 'complaint-audio',
        'GEMINI_MODEL': config.gemini_model,
        'GEMINI_API_MODE': config.gemini_api_mode,
        'DEFAULT_LANGUAGE': config.default_language,
        'GNANI_TTS_MODEL': config.gnani_tts_model,
        'GNANI_TTS_VOICE': config.gnani_tts_voice,
        'PUBLIC_BASE_URL': 'https://om-vaani.vercel.app',
    }
    for name, value in [('GNANI_STT_API_KEY', config.stt_key), ('GNANI_TTS_API_KEY', config.tts_key),
                        ('GEMINI_API_KEY', config.gemini_api_key)]:
        if value:
            values[name] = value
        else:
            print(f'{name}: missing locally', flush=True)
    executable = shutil.which('vercel')
    if not executable:
        raise SystemExit('Vercel CLI not found')
    for name, value in values.items():
        if args.only and name not in args.only:
            continue
        result = subprocess.run([executable, 'env', 'add', name, 'production', '--sensitive',
                                 '--force', '--yes', '--scope', 'suhas-projects13'],
                                input=value, text=True, capture_output=True, cwd=ROOT)
        if result.returncode:
            raise SystemExit(f'{name}: upload failed (exit {result.returncode})')
        print(f'{name}: uploaded', flush=True)


if __name__ == '__main__':
    main()

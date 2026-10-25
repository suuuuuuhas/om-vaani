import httpx
from .config import settings
from .audio import normalize_audio
from .http_client import provider_client
from .providers import ProviderError, checked


async def transcribe(audio: bytes, language: str) -> str:
    config = settings()
    if not config.stt_key:
        raise ProviderError('Gnani Prisma', 'Add GNANI_STT_API_KEY on the local setup page.')
    wav = await normalize_audio(audio)
    async with provider_client(timeout=45) as client:
        response = await checked(await client.post(
            'https://api.vachana.ai/stt/v3',
            timeout=45,
            headers={'X-API-Key-ID': config.stt_key},
            data={'language_code': language, 'format': 'transcribe', 'itn_native_numerals': 'false'},
            files={'audio_file': ('recording.wav', wav, 'audio/wav')},
        ), 'Gnani Prisma')
    data = response.json()
    transcript = data.get('transcript', '').strip()
    if data.get('success') is not True or not transcript:
        raise ProviderError('Gnani Prisma', 'No speech was recognised. Please try again or type your message.')
    return transcript

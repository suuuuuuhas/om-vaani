import asyncio
import httpx
from .config import settings
from .providers import ProviderError, checked
from .http_client import provider_client, speech_slot


async def synthesize(text: str, language: str) -> bytes:
    config = settings()
    if not config.tts_key:
        raise ProviderError('Gnani Timbre', 'Speech is unavailable until GNANI_TTS_API_KEY is configured.')
    # Official Timbre REST returns binary audio. OGG container is Opus.
    async with speech_slot():
        async with provider_client(timeout=45) as client:
            for attempt in range(2):
                response = await client.post(
                    'https://api.vachana.ai/api/v1/tts/inference', timeout=45,
                    headers={'X-API-Key-ID': config.tts_key},
                    json={'text': text, 'language': language, 'model': config.gnani_tts_model,
                          'voice': config.gnani_tts_voice,
                          'audio_config': {'container': 'ogg', 'sample_rate': 48000, 'num_channels': 1}},
                )
                if response.status_code == 429 and not attempt:
                    await asyncio.sleep(2)
                    continue
                if response.status_code == 429:
                    raise ProviderError('Gnani Timbre', 'Speech is busy. Please retry the voice reply in a moment.')
                await checked(response, 'Gnani Timbre')
                break
    if not response.content.startswith(b'OggS'):
        raise ProviderError('Gnani Timbre', 'The speech service returned an unexpected audio format.')
    return response.content

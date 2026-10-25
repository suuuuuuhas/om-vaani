import time
from uuid import uuid4
import httpx
from .config import settings
from .providers import checked, supabase_headers
from .http_client import provider_client


async def save_audio(audio: bytes) -> str:
    config = settings()
    name = uuid4().hex + '.ogg'
    if config.storage_backend == 'supabase':
        url = f'{config.supabase_url.rstrip("/")}/storage/v1'
        headers = {**supabase_headers(config.supabase_key), 'Content-Type': 'audio/ogg', 'x-upsert': 'false'}
        async with provider_client(timeout=30) as client:
            await checked(await client.post(f'{url}/object/{config.supabase_audio_bucket}/{name}',
                                            headers=headers, content=audio, timeout=30), 'Supabase Storage')
            response = await checked(await client.post(f'{url}/object/sign/{config.supabase_audio_bucket}/{name}',
                                                       headers=supabase_headers(config.supabase_key), json={'expiresIn': 3600}, timeout=30), 'Supabase Storage')
        signed = response.json()['signedURL']
        return signed if signed.startswith('https://') else url + signed
    folder = config.data_dir / 'audio'
    folder.mkdir(parents=True, exist_ok=True)
    (folder / name).write_bytes(audio)
    # Audio URLs are unguessable and expire after one hour; no directory listing.
    for path in folder.glob('*.ogg'):
        if time.time() - path.stat().st_mtime > 3600:
            path.unlink(missing_ok=True)
    return f'/audio/{name}'

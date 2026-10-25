import asyncio
import io
import tempfile
import wave
import shutil
from pathlib import Path
from .providers import ProviderError


async def normalize_audio(data: bytes) -> bytes:
    """Validate decoded duration before sending audio to Prisma; never truncate silently."""
    with tempfile.TemporaryDirectory(prefix='complaint-audio-') as folder:
        source = Path(folder) / 'input.audio'
        target = Path(folder) / 'normalized.wav'
        source.write_bytes(data)
        executable = shutil.which('ffmpeg')
        if not executable:
            try:
                import imageio_ffmpeg
                executable = imageio_ffmpeg.get_ffmpeg_exe()
            except (ImportError, RuntimeError):
                raise ProviderError('Audio', 'The audio decoder is unavailable. Please type your message for now.')
        try:
            process = await asyncio.create_subprocess_exec(
                executable, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
                '-i', str(source), '-t', '61', '-ac', '1', '-ar', '16000',
                '-c:a', 'pcm_s16le', str(target),
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
        except FileNotFoundError:
            raise ProviderError('Audio', 'ffmpeg is missing. Install ffmpeg and restart the app.')
        try:
            await asyncio.wait_for(process.wait(), timeout=20)
        except TimeoutError:
            process.kill()
            await process.wait()
            raise ProviderError('Audio', 'Audio decoding timed out. Try a shorter recording.')
        if process.returncode or not target.exists():
            raise ProviderError('Audio', 'This audio file could not be decoded.')
        result = target.read_bytes()
        with wave.open(io.BytesIO(result)) as wav:
            duration = wav.getnframes() / wav.getframerate()
        if duration > 60:
            raise ProviderError('Audio', 'Please send a voice note of 60 seconds or less.')
        if duration < 0.2:
            raise ProviderError('Audio', 'The recording is too short. Please try again.')
        return result

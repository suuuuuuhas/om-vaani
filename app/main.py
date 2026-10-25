import asyncio
import hashlib
import hmac
import ipaddress
import json
import os
import re
import secrets
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID
import httpx
from dotenv import set_key
from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .config import ROOT, settings
from .db import SQLiteRepository, SupabaseRepository
from .engine import Engine, pin_digest
from .languages import LANGUAGES, GREETINGS, normalize_language
from .models import StartSession, TextTurn, SpeechRequest
from .providers import ProviderError
from .http_client import http_lifespan

HOSTED = os.environ.get('VERCEL') == '1'
local = None if HOSTED else SQLiteRepository(settings().data_dir / 'complaints.sqlite3')
engine = None if HOSTED else Engine(local)
engine_config = None if HOSTED else ('sqlite', '', '')
limits = defaultdict(deque)


def runtime():
    global engine, engine_config
    config = settings()
    if HOSTED and (config.storage_backend != 'supabase' or not config.supabase_url or not config.supabase_key):
        raise ProviderError('Storage', 'Hosted storage is not configured yet. Please try again after setup.')
    signature = (config.storage_backend, config.supabase_url, config.supabase_key)
    if signature != engine_config:
        if config.storage_backend == 'supabase':
            if not config.supabase_url or not config.supabase_key:
                raise ProviderError('Supabase', 'Configure the Supabase URL and server key first.')
            engine = Engine(SupabaseRepository(config))
        else:
            engine = Engine(local)
        engine_config = signature
    return engine


async def throttle(key, count=20, period=60):
    if HOSTED:
        await runtime().repo.enforce_limit(hashlib.sha256(str(key).encode()).hexdigest(), count, period)
        return
    current = time.monotonic()
    queue = limits[key]
    while queue and queue[0] < current - period:
        queue.popleft()
    if len(queue) >= count:
        raise HTTPException(429, 'Too many requests. Please wait a minute and try again.')
    queue.append(current)
    if len(limits) > 10000:
        for name in list(limits):
            if not limits[name] or limits[name][-1] < current - 3600:
                del limits[name]


def local_only(request):
    if HOSTED:
        raise HTTPException(404, 'Not found')
    host = request.client.host if request.client else ''
    try:
        allowed = ipaddress.ip_address(host).is_loopback
    except ValueError:
        allowed = host == 'testclient'
    forwarded = any(k.lower() in {'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'} for k in request.headers)
    if not allowed or forwarded or request.url.hostname not in ('localhost', '127.0.0.1', 'testserver', '::1'):
        raise HTTPException(404, 'Not found')


@asynccontextmanager
async def lifespan(app):
    async with http_lifespan():
        if HOSTED:
            yield
            return
        from .channels.whatsapp import worker
        (settings().data_dir / 'runtime.json').write_text(json.dumps({'pid': os.getpid(), 'app': 'om-vaani-local'}), encoding='utf-8')
        task = asyncio.create_task(worker(local, runtime))
        try:
            yield
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(title='Om Vaani — Voice Complaint Assistant', lifespan=lifespan)


@app.middleware('http')
async def headers_and_limits(request: Request, call_next):
    started = time.monotonic()
    if request.method == 'POST':
        try:
            if int(request.headers.get('content-length', '0')) > settings().max_audio_bytes + 1024 * 1024:
                return JSONResponse({'detail': 'Request too large.'}, status_code=413)
        except ValueError:
            return JSONResponse({'detail': 'Invalid content length.'}, status_code=400)
    if request.url.path == '/static/setup.html':
        try:
            local_only(request)
        except HTTPException:
            return JSONResponse({'detail': 'Not found'}, status_code=404)
    response = await call_next(request)
    response.headers['Server-Timing'] = f'app;dur={(time.monotonic()-started)*1000:.1f}'
    response.headers.update({'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
                             'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
                             'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob: https://*.supabase.co; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"})
    return response


@app.exception_handler(ProviderError)
async def provider_error(request, error):
    return JSONResponse({'detail': str(error)}, status_code=503)


@app.exception_handler(httpx.HTTPError)
async def network_error(request, error):
    return JSONResponse({'detail': 'A provider could not be reached. Please retry shortly.'}, status_code=503)


@app.get('/')
async def home():
    return FileResponse(ROOT / 'web/index.html')


@app.get('/status')
async def status_page():
    return FileResponse(ROOT / 'web/status.html')


@app.get('/setup')
async def setup_page(request: Request):
    local_only(request)
    return FileResponse(ROOT / 'web/setup.html')


@app.get('/api/config')
async def public_config():
    config = settings()
    number = re.sub(r'\D', '', config.whatsapp_display_number)
    return {'languages': [{'code': code, 'name': name, 'native': native} for code, (name, native) in LANGUAGES.items()],
            'default_language': config.default_language, 'whatsapp_url': f'https://wa.me/{number}' if number else None,
            'ready': bool(config.gemini_api_key), 'voice_ready': bool(config.stt_key and config.tts_key),
            'stt_ready': bool(config.stt_key), 'tts_ready': bool(config.tts_key),
            'storage': config.storage_backend, 'max_audio_bytes': config.max_audio_bytes}


SETUP_KEYS = ['GNANI_API_KEY', 'GNANI_STT_API_KEY', 'GNANI_TTS_API_KEY', 'GEMINI_API_KEY', 'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID',
              'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_DISPLAY_NUMBER',
              'SUPABASE_URL', 'SUPABASE_KEY', 'PUBLIC_BASE_URL', 'DEFAULT_LANGUAGE', 'STORAGE_BACKEND']


@app.get('/api/setup')
async def setup_state(request: Request):
    local_only(request)
    config = settings()
    return {'configured': {key: bool(getattr(config, key.lower())) for key in SETUP_KEYS},
            'storage_backend': config.storage_backend}


@app.post('/api/setup')
async def save_setup(request: Request):
    local_only(request)
    # Reject drive-by cross-origin writes and DNS rebinding; no CORS is enabled.
    if request.headers.get('origin') != str(request.base_url).rstrip('/'):
        raise HTTPException(403, 'Open setup directly on localhost to save keys.')
    payload = await request.json()
    if not isinstance(payload, dict) or payload.keys() - set(SETUP_KEYS):
        raise HTTPException(422, 'Unknown setting.')
    for key, value in payload.items():
        if not isinstance(value, str) or len(value) > 5000 or '\n' in value or '\r' in value:
            raise HTTPException(422, 'Invalid setting value.')
        if key == 'DEFAULT_LANGUAGE' and value:
            try:
                normalize_language(value)
            except ValueError:
                raise HTTPException(422, 'Choose a supported language.')
        if key == 'STORAGE_BACKEND' and value not in ('sqlite', 'supabase'):
            raise HTTPException(422, 'Unknown storage backend.')
        if key == 'SUPABASE_URL' and value and not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', value.rstrip('/')):
            raise HTTPException(422, 'Enter your Supabase project HTTPS URL.')
        if key == 'PUBLIC_BASE_URL' and value and not value.startswith(('http://127.0.0.1:', 'http://localhost:', 'https://')):
            raise HTTPException(422, 'Use HTTPS for a public URL.')
    config = settings()
    if payload.get('STORAGE_BACKEND') == 'supabase':
        if not (payload.get('SUPABASE_URL') or config.supabase_url) or not (payload.get('SUPABASE_KEY') or config.supabase_key):
            raise HTTPException(422, 'Add both Supabase settings before switching storage.')
    # Keep setup separate from the editable template so an old editor tab cannot erase keys.
    env = ROOT / '.env.keys.local'
    env.touch(exist_ok=True)
    for key, value in payload.items():
        if value.strip():  # blanks keep existing values; keys are never returned to the browser
            set_key(str(env), key, value.strip())
    return {'saved': True}


@app.get('/health')
async def health():
    return {'status': 'ok'}


@app.post('/api/sessions')
async def start(data: StartSession, request: Request):
    await throttle(('session', request.client.host), 10)
    if not data.consent:
        raise HTTPException(422, 'Consent is required before sending a complaint to AI providers.')
    try:
        language = normalize_language(data.language)
    except ValueError as error:
        raise HTTPException(422, str(error))
    session, token = await runtime().create_session(data.phone, language)
    return {'session_id': session['id'], 'access_token': token, 'reply_text': GREETINGS[language]}


async def authorized_session(sid: str, request: Request):
    try:
        UUID(sid)
    except ValueError:
        raise HTTPException(404, 'Session not found.')
    await throttle(('turn', request.client.host), 30)
    session = await runtime().repo.get_session(sid)
    token = request.headers.get('authorization', '').removeprefix('Bearer ')
    if not session or not hmac.compare_digest(session['access_hash'], hashlib.sha256(token.encode()).hexdigest()):
        raise HTTPException(404, 'Session not found.')
    return session


@app.post('/api/sessions/{sid}/turn')
async def text_turn(sid: str, data: TextTurn, request: Request):
    await authorized_session(sid, request)
    return await runtime().handle_turn(sid, input_text=data.text, request_id=data.request_id, defer_speech=data.defer_speech)


@app.post('/api/sessions/{sid}/audio')
async def audio_turn(sid: str, request: Request, audio: UploadFile = File(...), request_id: str = Form(...), defer_speech: bool = Form(False)):
    await authorized_session(sid, request)
    if not 8 <= len(request_id) <= 100:
        raise HTTPException(422, 'Invalid request ID.')
    contents = await audio.read(settings().max_audio_bytes + 1)
    if len(contents) > settings().max_audio_bytes:
        raise HTTPException(413, f'Audio must be smaller than {settings().max_audio_bytes // (1024 * 1024)} MB.')
    return await runtime().handle_turn(sid, input_audio=contents, request_id=request_id, defer_speech=defer_speech)


@app.post('/api/sessions/{sid}/speech')
async def retry_speech(sid: str, request: Request, data: SpeechRequest | None = None):
    from .tts import synthesize
    from .storage import save_audio
    started = time.monotonic()
    session = await authorized_session(sid, request)
    await throttle(('speech', sid), 10)
    speech = (session.get('speech_requests', {}).get(data.request_id) if data and data.request_id
              else session['state'].get('last_speech'))
    if not speech:
        raise HTTPException(404, 'No reply is available for speech yet.')
    stage = time.monotonic()
    audio_reply = await synthesize(speech, session['language'])
    synthesis_ms = round((time.monotonic()-stage)*1000)
    stage = time.monotonic()
    url = await save_audio(audio_reply)
    return {'reply_audio_url': url, 'speech_request_id': data.request_id if data else None,
            'timings_ms': {'speech_synthesis': synthesis_ms, 'audio_storage': round((time.monotonic()-stage)*1000)},
            'latency_ms': round((time.monotonic()-started)*1000)}


@app.get('/audio/{filename}')
async def audio_file(filename: str):
    if not re.fullmatch(r'[a-f0-9]{32}\.ogg', filename):
        raise HTTPException(404)
    path = settings().data_dir / 'audio' / filename
    if not path.exists() or time.time() - path.stat().st_mtime > 3600:
        raise HTTPException(404, 'Audio expired.')
    return FileResponse(path, media_type='audio/ogg')


class StatusLookup(BaseModel):
    code: str = Field(pattern=r'^GC-[A-Z0-9]{10}$')
    pin: str = Field(pattern=r'^[0-9]{4}$')


async def lookup(code, pin, request):
    await throttle(('status-ip', request.client.host), 20)
    await throttle(('status-code', code), 5)
    complaint = await runtime().repo.get_complaint(code)
    salt = complaint['pin_salt'] if complaint else 'unknown-complaint'
    digest = pin_digest(pin, salt)
    if not complaint or not hmac.compare_digest(complaint['pin_hash'], digest):
        raise HTTPException(404, 'No draft found with that reference and phone suffix.')
    return {key: complaint[key] for key in ('short_code', 'language', 'category', 'summary_user_language',
            'complaint_text_en', 'where_to_send', 'status', 'created_at', 'status_events', 'missing_required')}


@app.post('/api/status')
async def status_lookup(data: StatusLookup, request: Request):
    return await lookup(data.code, data.pin, request)


@app.get('/status/{short_code}')
async def status_compat(short_code: str, request: Request, pin: str = Query(pattern=r'^[0-9]{4}$')):
    if not re.fullmatch(r'GC-[A-Z0-9]{10}', short_code.upper()):
        raise HTTPException(422, 'Invalid draft reference.')
    data = StatusLookup(code=short_code.upper(), pin=pin)
    return await lookup(data.code, data.pin, request)


from .channels.whatsapp import router
app.include_router(router)
app.mount('/static', StaticFiles(directory=ROOT / 'web'), name='static')

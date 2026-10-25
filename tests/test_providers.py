import io
import asyncio
import json
import wave
from unittest.mock import AsyncMock
import httpx
import pytest
from app import llm, stt, tts, storage
from app.audio import normalize_audio
from app.config import Settings
from app.providers import ProviderError, supabase_headers


def client_for(monkeypatch, module, handler):
    original = httpx.AsyncClient
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(module.httpx, 'AsyncClient', lambda **kwargs:original(transport=transport, **kwargs))


@pytest.mark.asyncio
async def test_gnani_stt_wire_contract(monkeypatch):
    monkeypatch.setattr(stt, 'settings', lambda:Settings(_env_file=None,gnani_api_key='shared-unused',gnani_stt_api_key='test-only'))
    monkeypatch.setattr(stt, 'normalize_audio', AsyncMock(return_value=b'RIFFtest'))
    def handler(request):
        assert str(request.url)=='https://api.vachana.ai/stt/v3'
        assert request.headers['X-API-Key-ID']=='test-only'
        assert b'name="audio_file"' in request.content and b'te-IN' in request.content
        return httpx.Response(200,json={'success':True,'transcript':'నా సమస్య'})
    client_for(monkeypatch,stt,handler)
    assert await stt.transcribe(b'input','te-IN')=='నా సమస్య'


@pytest.mark.asyncio
async def test_timbre_binary_ogg_contract(monkeypatch):
    monkeypatch.setattr(tts,'settings',lambda:Settings(_env_file=None,gnani_api_key='shared-unused',gnani_tts_api_key='tts-test-only'))
    def handler(request):
        body=json.loads(request.content)
        assert request.headers['X-API-Key-ID']=='tts-test-only'
        assert body['model']=='timbre-v3.0' and body['voice']=='Shivani'
        assert body['language']=='te-IN' and body['audio_config']['container']=='ogg'
        return httpx.Response(200,content=b'OggStest-audio',headers={'Content-Type':'audio/ogg'})
    client_for(monkeypatch,tts,handler)
    assert (await tts.synthesize('నమస్కారం','te-IN')).startswith(b'OggS')


@pytest.mark.asyncio
async def test_gemini_interactions_structured_contract(monkeypatch):
    monkeypatch.setattr(llm,'settings',lambda:Settings(_env_file=None,gemini_api_key='test-only',gemini_api_mode='interactions'))
    extraction={'category':'unknown','fields':{},'urgent_fraud':False,'reply':'Tell me what happened.',
                'summary_user_language':'','formal_complaint_en':'','confirmation':'unclear'}
    def handler(request):
        body=json.loads(request.content)
        assert body['store'] is False
        assert body['generation_config']['thinking_level']=='low'
        assert body['response_format']['mime_type']=='application/json'
        return httpx.Response(200,json={'status':'completed','steps':[{'type':'model_output','content':[{'type':'text','text':json.dumps(extraction)}]}]})
    client_for(monkeypatch,llm,handler)
    assert (await llm.llm_next_turn({},'hello','en-IN')).category=='unknown'


@pytest.mark.asyncio
async def test_provider_errors_do_not_leak_private_body(monkeypatch):
    monkeypatch.setattr(tts,'settings',lambda:Settings(_env_file=None,gnani_api_key='test-only'))
    client_for(monkeypatch,tts,lambda request:httpx.Response(403,json={'error':'private-user-text-and-token'}))
    with pytest.raises(ProviderError) as error:
        await tts.synthesize('private user text','en-IN')
    assert 'private' not in str(error.value) and '403' in str(error.value)


@pytest.mark.asyncio
async def test_audio_longer_than_one_minute_rejected():
    buffer=io.BytesIO()
    with wave.open(buffer,'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000);wav.writeframes(b'\0\0'*16000*61)
    with pytest.raises(ProviderError,match='60 seconds'):
        await normalize_audio(buffer.getvalue())


def test_new_supabase_secret_is_not_used_as_jwt():
    assert supabase_headers('sb_secret_test')=={'apikey':'sb_secret_test'}


@pytest.mark.asyncio
async def test_private_audio_upload_and_json_signing_use_separate_content_types(monkeypatch):
    monkeypatch.setattr(storage,'settings',lambda:Settings(_env_file=None,storage_backend='supabase',
        supabase_url='https://example.supabase.co',supabase_key='sb_secret_test'))
    calls=[]
    def handler(request):
        calls.append(request)
        if '/object/sign/' in request.url.path:
            assert request.headers['content-type']=='application/json'
            assert json.loads(request.content)=={'expiresIn':3600}
            return httpx.Response(200,json={'signedURL':'/object/sign/complaint-audio/test.ogg?token=test'})
        assert request.headers['content-type']=='audio/ogg' and request.content==b'OggStest'
        return httpx.Response(200,json={'Key':'test'})
    client_for(monkeypatch,storage,handler)
    result=await storage.save_audio(b'OggStest')
    assert result.startswith('https://example.supabase.co/storage/v1/object/sign/')
    assert len(calls)==2


def test_separate_gnani_keys_take_precedence():
    config=Settings(_env_file=None,gnani_api_key='shared',gnani_stt_api_key='stt-only',gnani_tts_api_key='tts-only')
    assert config.stt_key=='stt-only' and config.tts_key=='tts-only'


def test_shared_gnani_key_is_a_service_specific_fallback():
    config=Settings(_env_file=None,gnani_api_key='shared',gnani_stt_api_key='stt-only')
    assert config.stt_key=='stt-only' and config.tts_key=='shared'


@pytest.mark.asyncio
async def test_generate_content_structured_contract(monkeypatch):
    monkeypatch.setattr(llm,'settings',lambda:Settings(_env_file=None,gemini_api_key='test-only',gemini_api_mode='generate_content',gemini_model='gemini-3.6-flash'))
    extraction={'category':'unknown','fields':{},'urgent_fraud':False,'reply':'Tell me what happened.',
                'summary_user_language':'','formal_complaint_en':'','confirmation':'unclear'}
    def handler(request):
        assert request.url.path.endswith('/gemini-3.6-flash:generateContent')
        body=json.loads(request.content)
        assert body['generationConfig']['thinkingConfig']['thinkingLevel']=='LOW'
        assert body['generationConfig']['responseFormat']['text']['mimeType']=='APPLICATION_JSON'
        return httpx.Response(200,json={'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(extraction)}]}}]})
    client_for(monkeypatch,llm,handler)
    assert (await llm.llm_next_turn({},'hello','en-IN')).category=='unknown'


@pytest.mark.asyncio
async def test_generation_timeout_is_safe_provider_error(monkeypatch):
    monkeypatch.setattr(llm,'settings',lambda:Settings(_env_file=None,gemini_api_key='private-test-only'))
    def handler(request):
        raise httpx.ReadTimeout('private-test-only',request=request)
    client_for(monkeypatch,llm,handler)
    with pytest.raises(ProviderError,match='timed out') as error:
        await llm.llm_next_turn({},'hello','en-IN')
    assert 'private-test-only' not in str(error.value)


@pytest.mark.asyncio
async def test_transient_generation_error_retried_once(monkeypatch):
    monkeypatch.setattr(llm,'settings',lambda:Settings(_env_file=None,gemini_api_key='test-only',gemini_api_mode='interactions'))
    extraction={'category':'unknown','fields':{},'urgent_fraud':False,'reply':'Tell me what happened.',
                'summary_user_language':'','formal_complaint_en':'','confirmation':'unclear'}
    calls=[]
    def handler(request):
        calls.append(request)
        if len(calls)==1:return httpx.Response(503,json={'error':'temporarily unavailable'})
        return httpx.Response(200,json={'status':'completed','steps':[{'type':'model_output','content':[{'type':'text','text':json.dumps(extraction)}]}]})
    client_for(monkeypatch,llm,handler)
    assert (await llm.llm_next_turn({},'hello','en-IN')).category=='unknown'
    assert len(calls)==2


@pytest.mark.asyncio
async def test_daily_quota_error_is_actionable_and_not_retried(monkeypatch):
    monkeypatch.setattr(llm,'settings',lambda:Settings(_env_file=None,gemini_api_key='test-only'))
    calls=[]
    def handler(request):
        calls.append(request)
        return httpx.Response(429,json={'error':{'message':'private-provider-details',
            'details':[{'violations':[{'quotaId':'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}]}})
    client_for(monkeypatch,llm,handler)
    with pytest.raises(ProviderError,match='daily quota') as error:
        await llm.llm_next_turn({},'synthetic test','en-IN')
    assert 'private-provider' not in str(error.value) and len(calls)==1


@pytest.mark.asyncio
async def test_timbre_calls_are_serialized_and_busy_is_retried_once(monkeypatch):
    monkeypatch.setattr(tts,'settings',lambda:Settings(_env_file=None,gnani_tts_api_key='tts-test'))
    active=0;maximum=0;calls=0
    async def handler(request):
        nonlocal active,maximum,calls
        calls+=1;active+=1;maximum=max(maximum,active)
        await asyncio.sleep(0.01)
        active-=1
        return httpx.Response(200,content=b'OggStest')
    client_for(monkeypatch,tts,handler)
    results=await asyncio.gather(tts.synthesize('First','en-IN'),tts.synthesize('Second','en-IN'))
    assert maximum==1 and calls==2 and all(result.startswith(b'OggS') for result in results)


@pytest.mark.asyncio
async def test_timbre_busy_retry_is_bounded(monkeypatch):
    monkeypatch.setattr(tts,'settings',lambda:Settings(_env_file=None,gnani_tts_api_key='tts-test'))
    monkeypatch.setattr(tts.asyncio,'sleep',AsyncMock())
    calls=[]
    def handler(request):
        calls.append(request)
        return httpx.Response(429,json={'private':'provider details'})
    client_for(monkeypatch,tts,handler)
    with pytest.raises(ProviderError,match='Speech is busy') as error:
        await tts.synthesize('Test','en-IN')
    assert len(calls)==2 and 'provider details' not in str(error.value)

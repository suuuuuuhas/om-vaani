import hashlib
import hmac
import json
import time
import asyncio
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
from app import main
from app.config import Settings
from app.db import SQLiteRepository
from app.engine import Engine
from app.models import Extraction
from app.providers import ProviderError


@pytest.fixture
def client(tmp_path, monkeypatch):
    repo = SQLiteRepository(tmp_path/'api.sqlite3')
    config = Settings(_env_file=None, data_dir=tmp_path, whatsapp_app_secret='test-secret',
                      whatsapp_phone_number_id='12345',whatsapp_verify_token='verify-test')
    monkeypatch.setattr(main, 'local', repo)
    monkeypatch.setattr(main, 'engine', Engine(repo))
    monkeypatch.setattr(main, 'engine_config', ('sqlite','',''))
    monkeypatch.setattr(main, 'settings', lambda:config)
    monkeypatch.setattr('app.channels.whatsapp.settings',lambda:config)
    main.limits.clear()
    return TestClient(main.app)


def test_session_needs_consent_and_token(client):
    assert client.post('/api/sessions',json={'phone':'919999991234','language':'en-IN','consent':False}).status_code==422
    response=client.post('/api/sessions',json={'phone':'919999991234','language':'en-IN','consent':True})
    assert response.status_code==200
    sid=response.json()['session_id']
    assert client.post(f'/api/sessions/{sid}/turn',json={'text':'hello','request_id':'testrequest'}).status_code==404


def test_setup_not_public_or_cross_origin(client):
    assert client.get('/setup',headers={'x-forwarded-for':'8.8.8.8'}).status_code==404
    assert client.get('/api/setup',headers={'host':'attacker.example'}).status_code==404
    assert client.post('/api/setup',json={'GNANI_API_KEY':'fake'},headers={'origin':'https://attacker.example'}).status_code==403
    data=client.get('/api/setup').json()
    assert 'configured' in data and 'test-secret' not in json.dumps(data)


def test_webhook_signature_verification_and_dedup(client):
    payload={'entry':[{'changes':[{'value':{'metadata':{'phone_number_id':'12345'},'messages':[{'id':'wamid.test','from':'919999991234','type':'text','text':{'body':'hello'},'timestamp':str(int(time.time()))}]}}]}]}
    raw=json.dumps(payload).encode()
    assert client.post('/whatsapp/webhook',content=raw).status_code==403
    headers={'x-hub-signature-256':'sha256='+hmac.new(b'test-secret',raw,hashlib.sha256).hexdigest()}
    assert client.post('/whatsapp/webhook',content=raw,headers=headers).status_code==200
    assert client.post('/whatsapp/webhook',content=raw,headers=headers).status_code==200
    with main.local.connect() as db:
        assert db.execute('select count(*) from inbox').fetchone()[0]==1
    assert client.get('/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=123').text=='123'
    assert client.get('/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123').status_code==403


def test_health_pages_and_no_secret_config(client):
    for path in ['/','/status','/setup','/health','/static/app.js']:
        assert client.get(path).status_code==200
    response=client.get('/api/config')
    assert len(response.json()['languages'])==10
    assert 'test-secret' not in response.text
    assert response.headers['Cache-Control']=='no-store'


def test_status_failure_is_generic_and_throttled(client):
    for _ in range(5):
        response=client.post('/api/status',json={'code':'GC-ABCDEFGHJK','pin':'1234'})
        assert response.status_code==404
    assert client.post('/api/status',json={'code':'GC-ABCDEFGHJK','pin':'1234'}).status_code==429


def test_invalid_language_rejected(client):
    assert client.post('/api/sessions',json={'phone':'919999991234','language':'xx','consent':True}).status_code==422


def test_complete_http_flow_and_private_lookup(client, monkeypatch):
    extraction=Extraction(category='delivery_or_food',fields={'platform':'Example Food','amount':350,'date':'2026-10-24','problem':'Order not delivered','resolution':'Refund'},
        urgent_fraud=False,reply='Is this correct?',summary_user_language='Your order for INR 350 did not arrive.',formal_complaint_en='',confirmation='unclear')
    monkeypatch.setattr('app.llm.llm_next_turn',AsyncMock(return_value=extraction))
    monkeypatch.setattr('app.tts.synthesize',AsyncMock(side_effect=ProviderError('TTS','test text-only')))
    start=client.post('/api/sessions',json={'phone':'919999991234','language':'en-IN','consent':True}).json()
    headers={'Authorization':'Bearer '+start['access_token']}
    url=f'/api/sessions/{start["session_id"]}/turn'
    first=client.post(url,headers=headers,json={'text':'My order never arrived','request_id':'describe1'})
    assert first.status_code==200 and not first.json()['is_complete']
    final=client.post(url,headers=headers,json={'text':'yes','request_id':'confirm1'})
    assert final.status_code==200 and final.json()['is_complete']
    code=final.json()['short_code']
    assert client.post('/api/status',json={'code':code,'pin':'0000'}).status_code==404
    response=client.post('/api/status',json={'code':code,'pin':'1234'})
    assert response.status_code==200
    data=response.json()
    assert data['status']=='ready_to_submit' and '350' in data['complaint_text_en']
    assert 'phone' not in data and 'pin_hash' not in data and 'fields' not in data
    assert len(data['status_events'])==1 and data['where_to_send']
    # New repository instance reads the same durable record.
    restored=SQLiteRepository(main.local.path)
    assert asyncio.run(restored.get_complaint(code))['short_code']==code


def test_compat_status_bad_input_returns_validation_error(client):
    assert client.get('/status/bad?pin=1234').status_code==422
    assert client.get('/status/GC-ABCDEFGHJK?pin=xxx').status_code==422


def test_speech_retry_is_authorized_and_does_not_change_draft(client,monkeypatch):
    start=client.post('/api/sessions',json={'phone':'919999991234','language':'en-IN','consent':True}).json()
    sid=start['session_id']
    session=asyncio.run(main.engine.repo.get_session(sid))
    session['state']={'last_speech':'The last spoken reply.'}
    asyncio.run(main.engine.repo.save_turn(session))
    mock=AsyncMock(return_value=b'OggStest')
    monkeypatch.setattr('app.tts.synthesize',mock)
    monkeypatch.setattr('app.storage.save_audio',AsyncMock(return_value='/audio/test.ogg'))
    assert client.post(f'/api/sessions/{sid}/speech').status_code==404
    result=client.post(f'/api/sessions/{sid}/speech',headers={'Authorization':'Bearer '+start['access_token']})
    assert result.status_code==200 and result.json()['reply_audio_url']=='/audio/test.ogg'
    mock.assert_awaited_once_with('The last spoken reply.','en-IN')
    assert asyncio.run(main.engine.repo.get_session(sid))['complaint_id'] is None


def test_speech_stays_bound_to_its_turn_after_newer_confirmation(client,monkeypatch):
    extracted=Extraction(category='delivery_or_food',fields={'platform':'Example Food','amount':350,
        'date':'2026-10-24','problem':'Not delivered','resolution':'Refund'},urgent_fraud=False,
        reply='',summary_user_language='The food never arrived.',formal_complaint_en='',confirmation='unclear')
    monkeypatch.setattr('app.llm.llm_next_turn',AsyncMock(return_value=extracted))
    speech=AsyncMock(return_value=b'OggStest')
    monkeypatch.setattr('app.tts.synthesize',speech)
    monkeypatch.setattr('app.storage.save_audio',AsyncMock(return_value='/audio/test.ogg'))
    start=client.post('/api/sessions',json={'phone':'919999991234','language':'en-IN','consent':True}).json()
    sid=start['session_id'];headers={'Authorization':'Bearer '+start['access_token']}
    first=client.post(f'/api/sessions/{sid}/turn',headers=headers,
        json={'text':'Missing food','request_id':'firstmsg1','defer_speech':True}).json()
    final=client.post(f'/api/sessions/{sid}/turn',headers=headers,
        json={'text':'yes','request_id':'confirmmsg','defer_speech':True}).json()
    assert first['speech_pending'] and final['is_complete'] and speech.await_count==0
    response=client.post(f'/api/sessions/{sid}/speech',headers=headers,json={'request_id':'firstmsg1'})
    assert response.status_code==200 and response.json()['speech_request_id']=='firstmsg1'
    speech.assert_awaited_once_with(first['reply_text'],'en-IN')
    assert 'speech_synthesis' in response.json()['timings_ms']
    assert response.headers['Server-Timing'].startswith('app;dur=')
    assert client.post(f'/api/sessions/{sid}/speech',headers=headers,json={'request_id':'unknown01'}).status_code==404
    assert speech.await_count==1
    assert asyncio.run(main.engine.repo.get_session(sid))['complaint_id'] is not None


def test_audio_upload_can_return_text_before_speech(client,monkeypatch):
    monkeypatch.setattr('app.stt.transcribe',AsyncMock(return_value='This was a scam'))
    speech=AsyncMock(side_effect=AssertionError('Audio response must defer TTS'))
    monkeypatch.setattr('app.tts.synthesize',speech)
    start=client.post('/api/sessions',json={'phone':'919999991234','language':'en-IN','consent':True}).json()
    response=client.post(f'/api/sessions/{start["session_id"]}/audio',
        headers={'Authorization':'Bearer '+start['access_token']},
        data={'request_id':'voicefirst','defer_speech':'true'},files={'audio':('test.ogg',b'test','audio/ogg')})
    assert response.status_code==200 and '1930' in response.json()['reply_text']
    assert response.json()['speech_pending'] and response.json()['speech_request_id']=='voicefirst'
    assert speech.await_count==0

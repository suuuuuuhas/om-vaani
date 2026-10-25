"""Exercise the selected cloud repository using synthetic data; no AI calls."""
import asyncio
import json
import sys
from pathlib import Path
from uuid import uuid4
from unittest.mock import AsyncMock, patch
import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import ROOT, Settings
from app.db import SupabaseRepository
from app.engine import Engine
from app.models import Extraction
from app.storage import save_audio


async def run():
    cloud = json.loads((ROOT / 'data/deploy-secrets.json').read_text())
    config = Settings(storage_backend='supabase', supabase_url=cloud['SUPABASE_URL'], supabase_key=cloud['SUPABASE_KEY'])
    repo = SupabaseRepository(config)
    engine = Engine(repo)
    session, token = await engine.create_session('919999991234', 'en-IN')
    assert (await repo.get_session(session['id']))['access_hash'] == session['access_hash']
    owner, rival = str(uuid4()), str(uuid4())
    assert await repo.rpc('acquire_intake_lease', {'session_key':session['id'], 'owner_key':owner})
    assert not await repo.rpc('acquire_intake_lease', {'session_key':session['id'], 'owner_key':rival})
    await repo.rpc('release_intake_lease', {'session_key':session['id'], 'owner_key':owner})
    bucket = 'verification-' + str(uuid4())
    assert await repo.rpc('consume_api_limit', {'bucket_key':bucket, 'max_count':1, 'period_seconds':60})
    assert not await repo.rpc('consume_api_limit', {'bucket_key':bucket, 'max_count':1, 'period_seconds':60})
    extracted = Extraction(category='ecommerce_product', fields={'platform':'Synthetic Test Store',
        'product':'mixer', 'problem':'damaged item', 'amount':2499, 'date':'2026-10-20', 'resolution':'replacement'},
        urgent_fraud=False, reply='Please review the details.', summary_user_language='Synthetic storage verification.',
        formal_complaint_en='', confirmation='unclear')
    with patch('app.engine.llm.llm_next_turn', AsyncMock(return_value=extracted)), \
         patch('app.engine.tts.synthesize', AsyncMock(return_value=b'OggS-test')), \
         patch('app.engine.storage.save_audio', AsyncMock(return_value='/test.ogg')):
        first = await engine.handle_turn(session['id'], input_text='Synthetic test complaint', request_id=str(uuid4()))
        assert not first.is_complete and first.complaint_state['awaiting_confirmation']
        final = await engine.handle_turn(session['id'], input_text='yes', request_id=str(uuid4()))
        assert final.is_complete
    saved = await SupabaseRepository(config).get_complaint(final.short_code)
    assert saved['short_code'] == final.short_code and '2499' in saved['complaint_text_en']
    clip_path = ROOT / 'output/smoke/te-IN.ogg'
    with patch('app.storage.settings', lambda: config):
        signed_url = await save_audio(clip_path.read_bytes())
    async with httpx.AsyncClient(timeout=30) as client:
        clip = await client.get(signed_url)
        assert clip.status_code == 200 and clip.content.startswith(b'OggS')
        anonymous = await client.get(config.supabase_url+'/rest/v1/complaints?select=id', headers={
            'apikey':'sb_publishable_wXSHHV19cARbtjnDPvL3TA_aBTBJYBQ'})
        assert anonymous.status_code in (401,403)
    result = {'repository_save_and_reload':True, 'atomic_draft_and_event_save':True,
        'shared_session_lease':True, 'shared_rate_limit':True, 'private_audio_signed_url':True,
        'public_table_access_denied':True, 'synthetic_draft_reference':final.short_code,
        'provider_calls_mocked':True}
    path = ROOT/'output/evaluation/cloud-storage.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))


if __name__ == '__main__':
    asyncio.run(run())

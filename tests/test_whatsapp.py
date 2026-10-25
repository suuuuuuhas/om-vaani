import hashlib
import time
from unittest.mock import AsyncMock
from uuid import uuid5,NAMESPACE_URL
import httpx
import pytest
from app.channels import whatsapp
from app.config import Settings
from app.db import SQLiteRepository
from app.engine import Engine
from app.models import Extraction
from app.providers import ProviderError


@pytest.mark.asyncio
async def test_whatsapp_consent_dedup_finalization_and_new(tmp_path,monkeypatch):
    config=Settings(_env_file=None,data_dir=tmp_path,whatsapp_token='test-token',whatsapp_phone_number_id='12345',default_language='en-IN')
    monkeypatch.setattr(whatsapp,'settings',lambda:config)
    queue=SQLiteRepository(tmp_path/'whatsapp.sqlite3');engine=Engine(queue)
    extraction=Extraction(category='delivery_or_food',fields={'platform':'Example Food','amount':350,'date':'2026-10-24','problem':'Missing order','resolution':'Refund'},
        urgent_fraud=False,reply='Is this correct?',summary_user_language='Food did not arrive.',formal_complaint_en='',confirmation='unclear')
    model=AsyncMock(return_value=extraction)
    monkeypatch.setattr('app.llm.llm_next_turn',model)
    monkeypatch.setattr('app.tts.synthesize',AsyncMock(side_effect=ProviderError('TTS','test')))
    sent=[]
    monkeypatch.setattr(whatsapp,'send_text',AsyncMock(side_effect=lambda client,phone,text:sent.append(text)))
    phone='919999991234'
    async def send(index,text):
        mid='wamid.'+str(index)
        message={'id':mid,'from':phone,'timestamp':str(int(time.time())),'type':'text','text':{'body':text}}
        assert queue.enqueue(mid,message)
        await whatsapp.process_job(queue.next_job(time.time()),queue,lambda:engine)
    await send(1,'My food is missing')
    assert 'CONTINUE' in sent[-1] and model.await_count==0
    await send(2,'continue')
    await send(3,'My food is missing')
    await send(4,'yes')
    assert 'Next steps:' in sent[-1]
    session=await queue.get_session(str(uuid5(NAMESPACE_URL,'whatsapp:'+phone)))
    first_code=session['state']['short_code']
    assert await queue.get_complaint(first_code)
    await send(5,'new')
    await send(6,'My second food order is missing')
    await send(7,'yes')
    with queue.connect() as db:
        assert db.execute('select count(*) from complaints').fetchone()[0]==2
    assert await queue.get_complaint(first_code)


@pytest.mark.asyncio
async def test_expired_webhook_never_sends_reply(tmp_path,monkeypatch):
    monkeypatch.setattr(whatsapp,'settings',lambda:Settings(_env_file=None,whatsapp_token='test'))
    queue=SQLiteRepository(tmp_path/'expired.sqlite3')
    queue.enqueue('old-message',{'from':'919999991234','timestamp':str(int(time.time()-25*3600))})
    sender=AsyncMock();monkeypatch.setattr(whatsapp,'send_text',sender)
    await whatsapp.process_job(queue.next_job(time.time()),queue,lambda:None)
    assert sender.await_count==0 and queue.next_job(time.time()) is None

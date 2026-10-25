import asyncio
from unittest.mock import AsyncMock
import pytest
from app.db import SQLiteRepository
from app.engine import Engine, explicit_yes, likely_fraud
from app.models import Extraction
from app.providers import ProviderError
from app.routing import CATEGORIES


def extract(category='delivery_or_food', fields=None, **kwargs):
    return Extraction(category=category, fields=fields or {}, urgent_fraud=kwargs.get('fraud', False),
        reply='What would you like the company to do?', summary_user_language='You paid INR 400 for food that did not arrive.',
        formal_complaint_en='Invented penalty demand must not enter the saved draft.', confirmation=kwargs.get('confirmation', 'unclear'))


@pytest.fixture
def fixtures(tmp_path, monkeypatch):
    repo = SQLiteRepository(tmp_path / 'test.sqlite3')
    engine = Engine(repo)
    mock = AsyncMock()
    monkeypatch.setattr('app.llm.llm_next_turn', mock)
    monkeypatch.setattr('app.tts.synthesize', AsyncMock(side_effect=ProviderError('TTS', 'not configured')))
    return engine, repo, mock


@pytest.mark.asyncio
async def test_confirm_is_separate_and_retry_is_idempotent(fixtures):
    engine, repo, mock = fixtures
    session, _ = await engine.create_session('919999991234', 'en-IN')
    mock.return_value = extract(fields={'platform':'Food App','amount':400,'date':'2026-10-24','problem':'Food never arrived','resolution':'Refund'})
    first = await engine.handle_turn(session['id'], input_text='Please help', request_id='first001')
    assert first.complaint_state['awaiting_confirmation'] and not first.is_complete
    assert (await repo.get_session(session['id']))['complaint_id'] is None
    final = await engine.handle_turn(session['id'], input_text='Yes.', request_id='confirm1')
    again = await engine.handle_turn(session['id'], input_text='Yes.', request_id='confirm1')
    assert final.short_code == again.short_code and final.is_complete
    complaint = await repo.get_complaint(final.short_code)
    assert 'Invented penalty' not in complaint['complaint_text_en']
    assert complaint['status'] == 'ready_to_submit'
    assert mock.await_count == 1
    assert final.warnings  # Speech failure preserves a usable text draft.


@pytest.mark.asyncio
async def test_correction_replaces_fields_and_requires_new_yes(fixtures):
    engine, repo, mock = fixtures
    session, _ = await engine.create_session('919999991234', 'hi-IN')
    full = {'platform':'Food App','amount':400,'date':'2026-10-24','problem':'Not delivered','resolution':'Refund'}
    mock.return_value = extract(fields=full)
    await engine.handle_turn(session['id'], input_text='Food order not delivered')
    mock.return_value = extract(fields={'amount':500}, confirmation='yes')
    change = await engine.handle_turn(session['id'], input_text='Yes but the amount was 500')
    assert not change.is_complete and change.complaint_state['fields']['amount'] == 500
    assert change.complaint_state['fields']['platform'] == 'Food App'
    final = await engine.handle_turn(session['id'], input_text='हाँ')
    assert final.is_complete


@pytest.mark.asyncio
async def test_no_pending_confirmation_means_yes_cannot_finalize(fixtures):
    engine, repo, mock = fixtures
    session, _ = await engine.create_session('919999991234', 'en-IN')
    mock.return_value = extract(fields={'platform':'Food App'}, confirmation='yes')
    result = await engine.handle_turn(session['id'], input_text='yes')
    assert not result.is_complete and not result.complaint_state['awaiting_confirmation']


@pytest.mark.asyncio
async def test_missing_fields_capped_and_not_invented(fixtures):
    engine, repo, mock = fixtures
    session, _ = await engine.create_session('919999991234','en-IN')
    mock.return_value = extract(fields={'platform':'Food App','amount':None})
    for index in range(5):
        result = await engine.handle_turn(session['id'], input_text="I don't know", request_id=f'turn000{index}')
    assert result.complaint_state['followup_count'] == 4
    assert result.complaint_state['awaiting_confirmation']
    final = await engine.handle_turn(session['id'], input_text='yes')
    complaint = await repo.get_complaint(final.short_code)
    assert 'amount' not in complaint['fields']
    assert 'Details not provided' in complaint['complaint_text_en']


@pytest.mark.parametrize('category', list(CATEGORIES))
@pytest.mark.asyncio
async def test_all_categories(fixtures, category):
    engine, repo, mock = fixtures
    session, _ = await engine.create_session('919999991234', 'te-IN')
    mock.return_value = extract(category=category, fields={key: False if key == 'bill_available' else 'User provided detail' for key in CATEGORIES[category]['required']})
    result = await engine.handle_turn(session['id'], input_text='నా సమస్య')
    assert not result.complaint_state['missing_required']
    final = await engine.handle_turn(session['id'], input_text='అవును')
    assert final.is_complete and (await repo.get_complaint(final.short_code))['category'] == category


@pytest.mark.asyncio
async def test_fraud_interrupts_pending_confirmation(fixtures):
    engine, repo, mock = fixtures
    session, _ = await engine.create_session('919999991234', 'te-IN')
    session['state'] = {'awaiting_confirmation':True}
    await repo.save_turn(session)
    result = await engine.handle_turn(session['id'], input_text='I just shared an OTP and was scammed')
    assert '1930' in result.reply_text and 'cybercrime.gov.in' in result.reply_text
    assert not result.is_complete and not result.complaint_state['awaiting_confirmation']
    assert mock.await_count == 0


@pytest.mark.asyncio
async def test_llm_fraud_detection_for_unmatched_phrasing(fixtures):
    engine, repo, mock = fixtures
    session, _ = await engine.create_session('919999991234','en-IN')
    mock.return_value = extract(fraud=True)
    result = await engine.handle_turn(session['id'],input_text='An unknown person emptied my wallet')
    assert '1930' in result.reply_text and not result.is_complete


@pytest.mark.asyncio
async def test_concurrent_confirmation_saves_one_draft(fixtures):
    engine, repo, mock = fixtures
    session, _ = await engine.create_session('919999991234','en-IN')
    mock.return_value = extract(fields={'platform':'Food','amount':100,'date':'Yesterday','problem':'Missing','resolution':'Refund'})
    await engine.handle_turn(session['id'],input_text='Missing food')
    results = await asyncio.gather(engine.handle_turn(session['id'],input_text='yes',request_id='requestA'),
                                   engine.handle_turn(session['id'],input_text='yes',request_id='requestB'))
    assert results[0].short_code == results[1].short_code
    with repo.connect() as db:
        assert db.execute('select count(*) from complaints').fetchone()[0] == 1


@pytest.mark.parametrize('text',['yes but change the amount','not yes','yesterday','please say yes','no','हाँ लेकिन रकम गलत है'])
def test_not_unqualified_yes(text):
    assert not explicit_yes(text)


def test_ordinary_failed_payment_is_not_keyword_fraud():
    assert not likely_fraud('UPI payment failed but money debited')


@pytest.mark.asyncio
async def test_deferred_speech_returns_without_calling_tts_and_retry_is_idempotent(fixtures,monkeypatch):
    engine, repo, mock = fixtures
    speech = AsyncMock(side_effect=AssertionError('Text turn must not wait for speech'))
    monkeypatch.setattr('app.tts.synthesize',speech)
    session,_=await engine.create_session('919999991234','en-IN')
    mock.return_value=extract(fields={'platform':'Food','amount':100,'date':'2026-10-24',
        'problem':'Missing','resolution':'Refund'})
    first=await engine.handle_turn(session['id'],input_text='Missing food',request_id='deferred1',defer_speech=True)
    again=await engine.handle_turn(session['id'],input_text='Missing food',request_id='deferred1',defer_speech=True)
    assert first.speech_pending and first.reply_audio_url is None
    assert first.speech_request_id==again.speech_request_id=='deferred1'
    assert first.timings_ms['speech_synthesis']==0 and 'save_session' in first.timings_ms
    assert speech.await_count==0 and mock.await_count==1
    saved=await repo.get_session(session['id'])
    assert saved['speech_requests']['deferred1']==first.reply_text
    assert not first.is_complete and saved['complaint_id'] is None

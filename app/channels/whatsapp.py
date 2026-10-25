"""Signed WhatsApp webhooks with persistent deduplication and a single durable worker."""
import asyncio
import hashlib
import hmac
import json
import logging
import re
import time
import os
from urllib.parse import urlparse
from uuid import uuid5, NAMESPACE_URL
import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import PlainTextResponse
from ..config import settings
from ..languages import LANGUAGES, GREETINGS, normalize_language
from ..providers import ProviderError, checked

router = APIRouter(prefix='/whatsapp')
log = logging.getLogger(__name__)


@router.get('/webhook')
async def verification(request: Request):
    if os.environ.get('VERCEL') == '1':
        raise HTTPException(503, 'The WhatsApp channel is not enabled on this deployment.')
    config = settings()
    query = request.query_params
    if (config.whatsapp_verify_token and query.get('hub.mode') == 'subscribe'
            and hmac.compare_digest(query.get('hub.verify_token', ''), config.whatsapp_verify_token)):
        return PlainTextResponse(query.get('hub.challenge', ''))
    raise HTTPException(403, 'Webhook verification failed.')


@router.post('/webhook')
async def webhook(request: Request):
    if os.environ.get('VERCEL') == '1':
        raise HTTPException(503, 'The WhatsApp channel is not enabled on this deployment.')
    from ..main import local
    config = settings()
    if not config.whatsapp_app_secret or not config.whatsapp_phone_number_id:
        raise HTTPException(503, 'Configure the WhatsApp app secret and phone number ID first.')
    body = await request.body()
    if len(body) > 1024 * 1024:
        raise HTTPException(413)
    signature = 'sha256=' + hmac.new(config.whatsapp_app_secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, request.headers.get('x-hub-signature-256', '')):
        raise HTTPException(403, 'Invalid webhook signature.')
    try:
        payload = json.loads(body)
    except ValueError:
        raise HTTPException(400, 'Invalid JSON.')
    for entry in payload.get('entry', []):
        for change in entry.get('changes', []):
            value = change.get('value', {})
            if value.get('metadata', {}).get('phone_number_id') != config.whatsapp_phone_number_id:
                continue
            for message in value.get('messages', []):
                if message.get('id') and message.get('from'):
                    local.enqueue(message['id'], message)
    return {'received': True}


def graph_url(path):
    return f'https://graph.facebook.com/{settings().whatsapp_graph_version}/{path}'


async def send_text(client, phone, text):
    config = settings()
    await checked(await client.post(graph_url(config.whatsapp_phone_number_id + '/messages'),
        headers={'Authorization': 'Bearer ' + config.whatsapp_token},
        json={'messaging_product': 'whatsapp', 'to': phone, 'type': 'text', 'text': {'body': text}}), 'WhatsApp')


async def download_media(client, media_id):
    config = settings()
    headers = {'Authorization': 'Bearer ' + config.whatsapp_token}
    response = await checked(await client.get(graph_url(media_id), headers=headers), 'WhatsApp media')
    metadata = response.json()
    if int(metadata.get('file_size', 0)) > config.max_audio_bytes:
        raise ProviderError('WhatsApp', 'The voice note must be smaller than 10 MB.')
    url = metadata['url']
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not (parsed.hostname == 'fbsbx.com' or (parsed.hostname or '').endswith('.fbsbx.com')):
        raise ProviderError('WhatsApp', 'Unexpected media download host.')
    audio = bytearray()
    async with client.stream('GET', url, headers=headers) as stream:
        await checked(stream, 'WhatsApp media')
        async for chunk in stream.aiter_bytes():
            audio.extend(chunk)
            if len(audio) > config.max_audio_bytes:
                raise ProviderError('WhatsApp', 'The voice note must be smaller than 10 MB.')
    return bytes(audio)


async def send_audio(client, phone, url):
    config = settings()
    if url.startswith('/audio/'):
        # Upload local bytes; Meta does not need network access to localhost.
        name = url.rsplit('/', 1)[-1]
        if not re.fullmatch(r'[a-f0-9]{32}\.ogg', name):
            raise ProviderError('WhatsApp', 'Invalid audio filename.')
        contents = (config.data_dir / 'audio' / name).read_bytes()
    else:
        response = await checked(await client.get(url), 'Audio storage')
        contents = response.content
    response = await checked(await client.post(graph_url(config.whatsapp_phone_number_id + '/media'),
        headers={'Authorization': 'Bearer ' + config.whatsapp_token},
        data={'messaging_product': 'whatsapp', 'type': 'audio/ogg; codecs=opus'},
        files={'file': ('reply.ogg', contents, 'audio/ogg; codecs=opus')}), 'WhatsApp media upload')
    await checked(await client.post(graph_url(config.whatsapp_phone_number_id + '/messages'),
        headers={'Authorization': 'Bearer ' + config.whatsapp_token},
        json={'messaging_product': 'whatsapp', 'to': phone, 'type': 'audio',
              'audio': {'id': response.json()['id']}}), 'WhatsApp')


async def process_job(job, queue, get_engine):
    config = settings()
    if not config.whatsapp_token:
        raise ProviderError('WhatsApp', 'Configure the WhatsApp access token.')
    message = job['payload']
    phone = message['from']
    # Do not retry replies after WhatsApp's user-initiated 24-hour window.
    if time.time() - int(message.get('timestamp', 0)) > 23 * 3600:
        queue.update_job(job['id'], state='expired')
        return
    async with httpx.AsyncClient(timeout=45) as client:
        result = job['result']
        if result is None:
            engine = get_engine()
            sid = str(uuid5(NAMESPACE_URL, 'whatsapp:' + phone))
            session = await engine.repo.get_session(sid)
            text = message.get('text', {}).get('body', '').strip()
            if not session:
                session, _ = await engine.create_session(phone, config.default_language, 'whatsapp', sid)
            language_command = re.fullmatch(r'(?:language|lang)\s+([a-z]{2}(?:-IN)?)', text, re.I)
            if language_command:
                try:
                    language = normalize_language(language_command.group(1).lower().replace('-in', '-IN'))
                    session['language'] = language
                    session['state']['awaiting_confirmation'] = False
                    await engine.repo.save_turn(session)
                    reply = GREETINGS[language]
                except ValueError:
                    reply = 'Choose: ' + ', '.join('language ' + code[:2] for code in LANGUAGES)
                result = {'reply_text': reply, 'reply_audio_url': None}
            elif text.casefold() in ('hi', 'hello', 'start', 'help', '/start'):
                result = {'reply_text': GREETINGS[session['language']] + '\n\n' +
                          'Send language te / hi / en / ta / kn / ml / mr / bn / gu / pa to switch.\n' +
                          'Your messages are processed by Gnani and Google to prepare a draft. Send CONTINUE to consent, or STOP to cancel.',
                          'reply_audio_url': None}
            elif text.casefold() in ('stop', 'cancel'):
                session['state'] = {'consented': False}
                session['turns'] = []
                await engine.repo.save_turn(session)
                result = {'reply_text': 'Conversation stopped. Send START when you want to begin again.', 'reply_audio_url': None}
            elif not session['state'].get('consented'):
                if text.casefold() == 'continue':
                    session['state']['consented'] = True
                    await engine.repo.save_turn(session)
                    reply = GREETINGS[session['language']]
                else:
                    reply = 'We use Gnani and Google to process your messages and prepare a complaint draft. Send CONTINUE to consent, or STOP to cancel. Use language te / hi / en / ta / kn / ml / mr / bn / gu / pa to choose your language.'
                result = {'reply_text': reply, 'reply_audio_url': None}
            elif text.casefold() in ('new', 'restart'):
                session['state'] = {'consented': True}
                session['responses'] = {}
                session['turns'] = []
                # Complaints keep their own IDs when the channel starts a new intake.
                session, _ = await engine.create_session(phone, session['language'], 'whatsapp', sid)
                session['state']['consented'] = True
                await engine.repo.save_turn(session)
                result = {'reply_text': GREETINGS[session['language']], 'reply_audio_url': None}
            elif text.casefold() == 'status' or re.fullmatch(r'GC-[A-Z0-9]{10}', text.upper()):
                code = text.upper() if text.casefold() != 'status' else session['state'].get('short_code')
                complaint = await engine.repo.get_complaint(code) if code else None
                if complaint and hmac.compare_digest(complaint['phone'], phone):
                    reply = f'{code}: {complaint["status"].replace("_", " ")}. This tracks your draft; no authority status is available.\n\n' + complaint['complaint_text_en']
                else:
                    reply = 'No confirmed draft found for this number. Send your draft reference or describe a new problem.'
                result = {'reply_text': reply, 'reply_audio_url': None}
            elif message.get('type') == 'text':
                result = (await engine.handle_turn(sid, input_text=text, request_id=job['id'])).model_dump()
            elif message.get('type') == 'audio':
                audio = await download_media(client, message['audio']['id'])
                result = (await engine.handle_turn(sid, input_audio=audio, request_id=job['id'])).model_dump()
            else:
                result = {'reply_text': 'Please send a text message or a voice note of up to 60 seconds.', 'reply_audio_url': None}
            if result.get('is_complete'):
                code = result['short_code']
                complaint = await engine.repo.get_complaint(code)
                result['reply_text'] += '\n\nNext steps:\n' + '\n'.join(step['title'] + ': ' + step['detail'] + (' ' + step['url'] if step['url'] else '') for step in complaint['where_to_send'])
                result['reply_text'] += f'\n\nTrack your draft: {config.public_base_url.rstrip("/")}/status\nUse {code} and the last four digits of your phone. Send NEW for another complaint.'
            queue.update_job(job['id'], result=result)
        chunks = [result['reply_text'][i:i + 3500] for i in range(0, len(result['reply_text']), 3500)]
        for index, text in enumerate(chunks):
            if job['progress'] <= index:
                await send_text(client, phone, text)
                queue.update_job(job['id'], progress=index + 1)
        if result.get('reply_audio_url') and job['progress'] <= len(chunks):
            await send_audio(client, phone, result['reply_audio_url'])
            queue.update_job(job['id'], progress=len(chunks) + 1)
        queue.update_job(job['id'], state='done')
        latency_ms = max(0, int((time.time() - int(message.get('timestamp', time.time()))) * 1000))
        log.info('WhatsApp reply complete, end-to-end latency_ms=%d, over_target=%s', latency_ms, latency_ms > 8000)


async def worker(queue, get_engine):
    while True:
        job = queue.next_job(time.time())
        if not job:
            await asyncio.sleep(1)
            continue
        try:
            await process_job(job, queue, get_engine)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            # No payloads, phone numbers, tokens, transcripts or provider bodies in logs.
            attempts = job['attempts'] + 1
            queue.update_job(job['id'], attempts=attempts, state='failed' if attempts >= 5 else 'pending',
                             next_at=time.time() + min(300, 2 ** attempts * 3))
            log.warning('WhatsApp job failed (%s), attempt %d', type(error).__name__, attempts)
            if attempts >= 5 and time.time() - int(job['payload'].get('timestamp', 0)) < 23 * 3600:
                try:
                    async with httpx.AsyncClient(timeout=15) as client:
                        await send_text(client, job['payload']['from'],
                            'I could not process that message. Please try again with a shorter voice note or text. Your draft has not been sent anywhere.')
                except Exception:
                    log.warning('WhatsApp failure notice could not be delivered.')

import asyncio
import hashlib
import re
import secrets
import time
import httpx
from uuid import uuid4
from . import llm, stt, tts, storage
from .config import settings
from .db import now
from .languages import GREETINGS, FRAUD_WARNINGS, YES, normalize_language
from .models import TurnResult
from .providers import ProviderError
from .routing import CATEGORIES, routing_steps

CONFIRM = {
    'en-IN': 'Is this correct? Reply yes to prepare the draft, or tell me what to change.',
    'te-IN': 'ఇది సరైనదేనా? ముసాయిదా కోసం అవును అని చెప్పండి లేదా మార్చాల్సినది చెప్పండి.',
    'hi-IN': 'क्या यह सही है? मसौदा बनाने के लिए हाँ कहें या बताएं क्या बदलना है।',
    'ta-IN': 'இது சரியா? வரைவு தயாரிக்க ஆம் என்று சொல்லுங்கள் அல்லது மாற்றத்தைச் சொல்லுங்கள்.',
    'kn-IN': 'ಇದು ಸರಿಯೇ? ಕರಡು ತಯಾರಿಸಲು ಹೌದು ಎಂದು ಹೇಳಿ ಅಥವಾ ಬದಲಾವಣೆ ತಿಳಿಸಿ.',
    'ml-IN': 'ഇത് ശരിയാണോ? കരട് തയ്യാറാക്കാൻ അതെ എന്നു പറയുക, അല്ലെങ്കിൽ തിരുത്തൽ പറയുക.',
    'mr-IN': 'हे बरोबर आहे का? मसुद्यासाठी हो म्हणा किंवा काय बदलायचे ते सांगा.',
    'bn-IN': 'এটি কি ঠিক? খসড়া বানাতে হ্যাঁ বলুন বা কী বদলাতে হবে বলুন।',
    'gu-IN': 'શું આ સાચું છે? મુસદ્દા માટે હા કહો અથવા ફેરફાર જણાવો.',
    'pa-IN': 'ਕੀ ਇਹ ਸਹੀ ਹੈ? ਖਰੜੇ ਲਈ ਹਾਂ ਕਹੋ ਜਾਂ ਤਬਦੀਲੀ ਦੱਸੋ।',
}
READY = {
    'en-IN': 'Your draft is ready to submit. Your reference is',
    'te-IN': 'మీ ముసాయిదా సమర్పించడానికి సిద్ధంగా ఉంది. మీ సూచన సంఖ్య',
    'hi-IN': 'आपका मसौदा भेजने के लिए तैयार है। आपका संदर्भ नंबर है',
    'ta-IN': 'உங்கள் வரைவு சமர்ப்பிக்கத் தயாராக உள்ளது. உங்கள் குறிப்பு எண்',
    'kn-IN': 'ನಿಮ್ಮ ಕರಡು ಸಲ್ಲಿಸಲು ಸಿದ್ಧವಾಗಿದೆ. ನಿಮ್ಮ ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ',
    'ml-IN': 'നിങ്ങളുടെ കരട് സമർപ്പിക്കാൻ തയ്യാറാണ്. നിങ്ങളുടെ റഫറൻസ്',
    'mr-IN': 'तुमचा मसुदा पाठवण्यासाठी तयार आहे. तुमचा संदर्भ क्रमांक',
    'bn-IN': 'আপনার খসড়া পাঠানোর জন্য প্রস্তুত। আপনার রেফারেন্স',
    'gu-IN': 'તમારો મુસદ્દો મોકલવા માટે તૈયાર છે. તમારો સંદર્ભ નંબર',
    'pa-IN': 'ਤੁਹਾਡਾ ਖਰੜਾ ਭੇਜਣ ਲਈ ਤਿਆਰ ਹੈ। ਤੁਹਾਡਾ ਹਵਾਲਾ ਨੰਬਰ',
}


def pin_digest(pin: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', pin.encode(), salt.encode(), 100_000).hex()


def explicit_yes(text: str) -> bool:
    return re.sub(r'[.!?,।]+$', '', text.strip().casefold()).strip() in YES


def likely_fraud(text: str) -> bool:
    value = text.casefold()
    return bool(re.search(r'\b(scam(?:med)?|fraud|hacked|unauthori[sz]ed|fake link|remote.access)\b', value)
                or re.search(r'(shared|gave|told).{0,25}\botp\b|\botp\b.{0,25}(shared|gave)', value)
                or any(word in value for word in ('మోసం', 'धोखाधड़ी', 'ठगी', 'மோசடி', 'ವಂಚನೆ', 'തട്ടിപ്പ്', 'फसवणूक', 'প্রতারণা', 'છેતરપિંડી', 'ਧੋਖਾਧੜੀ')))


def formal_draft(category: str, fields: dict, missing: list[str]) -> str:
    """Render exactly the confirmed structured facts, avoiding model-added legal allegations."""
    labels = {'app_or_bank': 'Bank / payment app', 'bill_available': 'Bill available', 'problem': 'What happened',
              'resolution': 'Requested resolution', 'order_id': 'Order ID', 'transaction_id': 'Transaction reference'}
    lines = ['To the Customer Support / Grievance Officer,', '',
             f'Subject: Complaint regarding {CATEGORIES[category]["label"].lower()}', '',
             'I request your assistance regarding the following issue:', '']
    for key, value in fields.items():
        if value is not None and value != '':
            rendered = ('Yes' if value else 'No') if isinstance(value, bool) else str(value)
            lines.append(f'{labels.get(key, key.replace("_", " ").capitalize())}: {rendered}')
    if missing:
        lines.extend(['', 'Details not provided: ' + ', '.join(key.replace('_', ' ') for key in missing) + '.'])
    lines.extend(['', 'Please review this issue and provide a written response with the available resolution.',
                  'I can provide the supporting documents that are available to me.', '', 'Thank you.',
                  '', 'Drafting aid only. Review and add your name and contact details before sending.'])
    return '\n'.join(lines)


class Engine:
    def __init__(self, repository):
        self.repo = repository
        self.locks: dict[str, asyncio.Lock] = {}

    async def create_session(self, phone: str, language: str, channel='web', session_id=None):
        language = normalize_language(language)
        token = secrets.token_urlsafe(32)
        session = {'id': session_id or str(uuid4()), 'phone': phone, 'language': language, 'channel': channel,
                   'access_hash': hashlib.sha256(token.encode()).hexdigest(), 'state': {}, 'turns': [],
                   'complaint_id': None, 'created_at': now(), 'updated_at': now(), 'responses': {}}
        await self.repo.save_turn(session)
        return session, token

    async def handle_turn(self, session_id: str, input_text=None, input_audio=None, language=None, request_id=None, defer_speech=False) -> TurnResult:
        lock = self.locks.setdefault(session_id, asyncio.Lock())
        async with lock:
            if hasattr(self.repo, 'turn_lock'):
                async with self.repo.turn_lock(session_id):
                    return await self._handle_turn(session_id, input_text, input_audio, language, request_id, defer_speech)
            return await self._handle_turn(session_id, input_text, input_audio, language, request_id, defer_speech)

    async def _handle_turn(self, sid, text, audio, language, request_id, defer_speech):
        started = time.monotonic()
        session = await self.repo.get_session(sid)
        loaded = time.monotonic()
        if not session:
            raise ValueError('Session not found.')
        if request_id and request_id in session['responses']:
            return TurnResult.model_validate(session['responses'][request_id])
        language = session['language']  # fixed for the session; start a new session to switch
        if bool(text) == bool(audio):
            raise ValueError('Send either text or audio.')
        stage = time.monotonic()
        transcript = await stt.transcribe(audio, language) if audio else text.strip()
        state = session['state']
        result = TurnResult(reply_text='', complaint_state={}, transcript=transcript)
        result.timings_ms = {'load_session': round((loaded-started)*1000),
                             'transcription': round((time.monotonic()-stage)*1000) if audio else 0,
                             'gemini': 0, 'speech_synthesis': 0, 'audio_storage': 0}
        complaint = None
        if likely_fraud(transcript):
            state['fraud_warned'] = True
            state['awaiting_confirmation'] = False
            result.reply_text = FRAUD_WARNINGS[language]
        elif state.get('complete'):
            result.reply_text = f'{READY[language]} {state["short_code"]}.'
            result.is_complete = True
            result.short_code = state['short_code']
        elif state.get('awaiting_confirmation') and explicit_yes(transcript):
            category = state['category']
            code = 'GC-' + ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(10))
            salt = secrets.token_hex(16)
            complaint = {'id': str(uuid4()), 'session_id': sid, 'short_code': code,
                         'phone': session['phone'], 'pin_salt': salt,
                         'pin_hash': pin_digest(session['phone'][-4:], salt),
                         'language': language, 'category': category, 'fields': state['fields'],
                         'missing_required': state.get('missing_required', []),
                         'summary_user_language': state['summary'],
                         'complaint_text_en': formal_draft(category, state['fields'], state.get('missing_required', [])),
                         'where_to_send': routing_steps(category), 'status': 'ready_to_submit',
                         'created_at': now(), 'updated_at': now(),
                         'status_events': [{'status': 'ready_to_submit', 'note': 'Draft confirmed by you. No complaint has been sent to an authority.', 'created_at': now()}]}
            state.update(complete=True, awaiting_confirmation=False, short_code=code)
            session['complaint_id'] = complaint['id']
            result.short_code, result.is_complete = code, True
            result.reply_text = f'{READY[language]} {code}.\n\n{state["summary"]}\n\n{complaint["complaint_text_en"]}'
        else:
            stage = time.monotonic()
            extraction = await llm.llm_next_turn({**state, 'recent_turns': session['turns'][-8:]}, transcript, language)
            result.timings_ms['gemini'] = round((time.monotonic()-stage)*1000)
            if extraction.urgent_fraud:
                state.update(fraud_warned=True, awaiting_confirmation=False)
                result.reply_text = FRAUD_WARNINGS[language]
            else:
                category = extraction.category
                if category == 'unknown' and state.get('category'):
                    category = state['category']
                if category != 'unknown':
                    config = CATEGORIES[category]
                    old_fields = state.get('fields', {}) if state.get('category') == category else {}
                    allowed = set(config['required'] + config['optional'])
                    fields = {**old_fields, **{k: v for k, v in extraction.fields.items() if k in allowed and v is not None and v != ''}}
                    missing = [key for key in config['required'] if key not in fields or fields[key] is None or fields[key] == '']
                    count = state.get('followup_count', 0)
                    ready = not missing or count >= 4
                    summary = extraction.summary_user_language.strip()
                    if ready and not summary:
                        raise ProviderError('Gemini', 'The read-back summary was missing. Please retry.')
                    state.update(category=category, fields=fields, missing_required=missing,
                                 summary=summary, awaiting_confirmation=ready,
                                 followup_count=count + (0 if ready else 1))
                    result.reply_text = f'{summary}\n\n{CONFIRM[language]}' if ready else extraction.reply
                else:
                    # Unknown requests never become a consumer complaint automatically.
                    state['awaiting_confirmation'] = False
                    result.reply_text = extraction.reply
        state['last_reply'] = result.reply_text
        result.complaint_state = dict(state)
        speech = (f'{state.get("summary", "")} {READY[language]} {" . ".join(result.short_code)}.'
                  if result.is_complete else result.reply_text.replace('https://cybercrime.gov.in', 'cybercrime dot gov dot in'))
        state['last_speech'] = speech
        # Freeze the speech for this turn before another message can change last_speech.
        speech_id = request_id or str(uuid4())
        result.speech_request_id = speech_id
        session.setdefault('speech_requests', {})[speech_id] = speech
        session['speech_requests'] = dict(list(session['speech_requests'].items())[-16:])
        result.speech_pending = defer_speech
        if not defer_speech:
            try:
                stage = time.monotonic()
                audio_reply = await tts.synthesize(speech, language)
                result.timings_ms['speech_synthesis'] = round((time.monotonic()-stage)*1000)
                stage = time.monotonic()
                result.reply_audio_url = await storage.save_audio(audio_reply)
                result.timings_ms['audio_storage'] = round((time.monotonic()-stage)*1000)
            except (ProviderError, httpx.HTTPError):
                result.warnings.append('The text reply is available, but voice synthesis failed. Check Gnani configuration and retry speech.')
        result.latency_ms = int((time.monotonic() - started) * 1000)
        if result.latency_ms > 8000:
            result.warnings.append('This turn exceeded the 8-second latency target.')
        session['turns'] = (session['turns'] + [{'role': 'user', 'text': transcript, 'ts': now()},
                            {'role': 'assistant', 'text': result.reply_text[:2500], 'ts': now()}])[-24:]
        session['updated_at'] = now()
        if request_id:
            session['responses'][request_id] = result.model_dump()
            session['responses'] = dict(list(session['responses'].items())[-16:])
        stage = time.monotonic()
        await self.repo.save_turn(session, complaint)
        result.timings_ms['save_session'] = round((time.monotonic()-stage)*1000)
        result.latency_ms = round((time.monotonic()-started)*1000)
        return result

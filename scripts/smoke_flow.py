"""Real providers + local HTTP API + persistence, using synthetic Telugu speech and a test phone."""
import asyncio
import argparse
import json
import sys
from pathlib import Path
from uuid import uuid4
import httpx
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.config import ROOT
from app.tts import synthesize


async def run(base_url, turn_delay=0):
    target=ROOT/'output/evaluation';target.mkdir(parents=True,exist_ok=True)
    case=json.loads((ROOT/'tests/transcripts/intake.json').read_text(encoding='utf-8'))[4]
    audio=await synthesize(case['text'],'te-IN')
    (target/'synthetic-complaint-te.ogg').write_bytes(audio)
    async def report_failure(response):
        if response.is_error:
            await response.aread()
            try:
                detail=response.json().get('detail','Request failed')
            except ValueError:
                detail='Request failed'
            print(json.dumps({'status':response.status_code,'detail':detail}),flush=True)
    async with httpx.AsyncClient(base_url=base_url,timeout=180,event_hooks={'response':[report_failure]}) as client:
        start=await client.post('/api/sessions',json={'phone':'919999991234','language':'te-IN','consent':True})
        start.raise_for_status();session=start.json();headers={'Authorization':'Bearer '+session['access_token']}
        response=await client.post(f'/api/sessions/{session["session_id"]}/audio',headers=headers,
            data={'request_id':str(uuid4())},files={'audio':('synthetic.ogg',audio,'audio/ogg')})
        response.raise_for_status();first=response.json()
        assert first['complaint_state'].get('category')=='ecommerce_product', 'Wrong category'
        assert not first['is_complete'], 'Draft saved before explicit confirmation'
        print(json.dumps({'stage':'voice_intake','latency_ms':first['latency_ms'],'has_spoken_reply':bool(first['reply_audio_url'])}),flush=True)
        # A synthetic voice can still mispronounce a date. Verify that a missing
        # detail is asked for, rather than inventing it or bypassing confirmation.
        turn=first;followups=[]
        answers={'date':'నేను అక్టోబర్ 20, 2026న ఆర్డర్ చేశాను.', 'amount':'నేను 2499 రూపాయలు చెల్లించాను.',
                 'platform':'అమెజాన్', 'product':'మిక్సీ', 'problem':'పగిలిపోయి వచ్చింది.', 'resolution':'రీప్లేస్‌మెంట్ కావాలి.'}
        for _ in range(4):
            if turn['complaint_state'].get('awaiting_confirmation'):break
            missing=turn['complaint_state'].get('missing_required',[])
            assert missing and missing[0] in answers, 'Unexpected missing detail'
            detail=missing[0]
            if turn_delay:
                print(json.dumps({'stage':'waiting_for_provider_quota','seconds':turn_delay}),flush=True)
                await asyncio.sleep(turn_delay)
            response=await client.post(f'/api/sessions/{session["session_id"]}/turn',headers=headers,
                json={'text':answers[detail],'request_id':str(uuid4())})
            response.raise_for_status();turn=response.json()
            followups.append({'field':detail,'latency_ms':turn['latency_ms']})
        assert turn['complaint_state'].get('awaiting_confirmation'), 'Read-back missing after follow-ups'
        observed=turn['complaint_state']['fields']
        mismatches={key:observed.get(key) for key,expected in {'amount':2499,'date':'2026-10-20'}.items() if observed.get(key)!=expected}
        if mismatches:
            if turn_delay:
                print(json.dumps({'stage':'waiting_before_correction','seconds':turn_delay}),flush=True)
                await asyncio.sleep(turn_delay)
            response=await client.post(f'/api/sessions/{session["session_id"]}/turn',headers=headers,
                json={'text':'కాదు, సవరణ: మొత్తం 2499 రూపాయలు. ఆర్డర్ తేదీ అక్టోబర్ 20, 2026.','request_id':str(uuid4())})
            response.raise_for_status();turn=response.json()
            assert not turn['is_complete'], 'Correction bypassed a fresh confirmation'
            assert turn['complaint_state']['fields']['amount']==2499
            assert turn['complaint_state']['fields']['date']=='2026-10-20'
            assert turn['complaint_state'].get('awaiting_confirmation')
        final_response=await client.post(f'/api/sessions/{session["session_id"]}/turn',headers=headers,
            json={'text':'అవును','request_id':str(uuid4())})
        final_response.raise_for_status();final=final_response.json()
        assert final['is_complete'] and final['short_code']
        code=final['short_code']
        lookup=await client.post('/api/status',json={'code':code,'pin':'1234'})
        lookup.raise_for_status();complaint=lookup.json()
        assert complaint['status']=='ready_to_submit'
        assert '2499' in complaint['complaint_text_en'].replace(',','')
        assert 'phone' not in complaint and 'pin_hash' not in complaint
        denied=await client.post('/api/status',json={'code':code,'pin':'0000'})
        assert denied.status_code==404
        for result in (first,final):
            assert result['reply_audio_url'], 'Spoken reply missing'
            clip=await client.get(result['reply_audio_url'])
            assert clip.status_code==200 and clip.content.startswith(b'OggS')
        report={'kind':'live_http_flow_synthetic_voice','language':'te-IN','test_phone_suffix':'1234',
            'short_code':code,'status_url':f'{base_url}/status?code={code}',
            'voice_intake_latency_ms':first['latency_ms'],'confirmation_latency_ms':final['latency_ms'],
            'followups':followups,
            'speech_roundtrip_mismatches_before_correction':mismatches,
            'correction_flow_passed':bool(mismatches),
            'eight_second_voice_target_met':first['latency_ms']<=8000,
            'explicit_confirmation_gate_passed':True,'status_lookup_passed':True,'wrong_pin_denied':True,
            'spoken_replies_downloaded':2,'transcript':first['transcript'],'real_speaker_quality_verified':False}
        (target/'live-flow.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=True,indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--base-url',default='http://127.0.0.1:8000')
    parser.add_argument('--turn-delay',type=float,default=0,help='Space LLM turns for API plans with low minute quotas')
    args=parser.parse_args()
    asyncio.run(run(args.base_url.rstrip('/'),max(0,args.turn_delay)))

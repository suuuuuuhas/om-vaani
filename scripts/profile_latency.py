"""Measure the hosted text-first flow using synthetic Telugu audio and test data."""
import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from uuid import uuid4
import httpx
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.config import ROOT


async def run(base_url, text_input=False):
    audio=None if text_input else (ROOT/'output/evaluation/synthetic-complaint-te.ogg').read_bytes()
    async with httpx.AsyncClient(base_url=base_url,timeout=90) as client:
        async def post(path, **kwargs):
            # A replay uses the same request ID if a local connection drops after sending.
            for attempt in range(2):
                try:
                    return await client.post(path,**kwargs)
                except (httpx.ReadError,httpx.ConnectError):
                    if attempt: raise
                    await asyncio.sleep(0.25)
        start=await post('/api/sessions',json={'phone':'919999991234','language':'en-IN' if text_input else 'te-IN','consent':True})
        start.raise_for_status();session=start.json()
        headers={'Authorization':'Bearer '+session['access_token']}
        path=f'/api/sessions/{session["session_id"]}'
        started=time.perf_counter()
        if text_input:
            response=await post(path+'/turn',headers=headers,json={'request_id':str(uuid4()),'defer_speech':True,
                'text':'I bought a mixer on Amazon for 2499 rupees on 20 October 2026. It arrived broken. I want a replacement.'})
        else:
            response=await post(path+'/audio',headers=headers,
                data={'request_id':str(uuid4()),'defer_speech':'true'},
                files={'audio':('synthetic.ogg',audio,'audio/ogg')})
        if response.is_error:
            print(json.dumps({'stage':'intake_failed','status':response.status_code,'detail':response.json().get('detail')}))
        response.raise_for_status();first=response.json()
        first_wall=round((time.perf_counter()-started)*1000)
        assert first['speech_pending'] and first['reply_audio_url'] is None and not first['is_complete']
        print(json.dumps({'stage':'text_ready','wall_ms':first_wall,'timings_ms':first['timings_ms']}),flush=True)
        partial={'text_ready_wall_ms':first_wall,'timings_ms':first['timings_ms'],
                 'mode':'written_english' if text_input else 'synthetic_telugu_audio','completed':False}
        (ROOT/'output/evaluation/latency-partial.json').write_text(json.dumps(partial,indent=2))

        async def speech(result):
            stage=time.perf_counter()
            response=await post(path+'/speech',headers=headers,json={'request_id':result['speech_request_id']})
            response.raise_for_status()
            return response.json(),round((time.perf_counter()-stage)*1000)

        # Speech generation remains an ordinary request, so no serverless background task is needed.
        first_speech_task=asyncio.create_task(speech(first))
        fields=first['complaint_state'].get('fields',{})
        ready=first['complaint_state'].get('awaiting_confirmation')
        correction_wall=None
        if not ready or fields.get('amount')!=2499 or fields.get('date')!='2026-10-20':
            stage=time.perf_counter()
            response=await post(path+'/turn',headers=headers,json={
                'text':'Correction: I bought a mixer on Amazon for 2499 rupees on 20 October 2026. It arrived broken. I want a replacement.',
                'request_id':str(uuid4()),'defer_speech':True})
            if response.is_error:
                await asyncio.gather(first_speech_task,return_exceptions=True)
                print(json.dumps({'stage':'correction_failed','status':response.status_code,'detail':response.json().get('detail')}))
                response.raise_for_status()
            corrected=response.json()
            correction_wall=round((time.perf_counter()-stage)*1000)
            fields=corrected['complaint_state'].get('fields',{})
            ready=corrected['complaint_state'].get('awaiting_confirmation')
            if corrected['is_complete'] or not ready or fields.get('amount')!=2499 or fields.get('date')!='2026-10-20':
                await asyncio.gather(first_speech_task,return_exceptions=True)
                raise AssertionError('Synthetic details still need review; no confirmation sent')
        stage=time.perf_counter()
        response=await post(path+'/turn',headers=headers,json={
            'text':'yes' if text_input else 'అవును','request_id':str(uuid4()),'defer_speech':True})
        response.raise_for_status();final=response.json()
        confirm_wall=round((time.perf_counter()-stage)*1000)
        assert final['is_complete'] and final['speech_pending']
        speech_still_running=not first_speech_task.done()
        (first_voice,first_voice_wall),(last_voice,last_voice_wall)=await asyncio.gather(first_speech_task,speech(final))
        for voice in (first_voice,last_voice):
            clip=await client.get(voice['reply_audio_url'])
            assert clip.status_code==200 and clip.content.startswith(b'OggS')
        code=final['short_code']
        found=await client.post('/api/status',json={'code':code,'pin':'1234'})
        found.raise_for_status()
        assert '2499' in found.json()['complaint_text_en']
        denied=await client.post('/api/status',json={'code':code,'pin':'0000'})
        assert denied.status_code==404
        report={'test':'written_english_text_first_flow' if text_input else 'synthetic_telugu_text_first_flow','base_url':base_url,'short_code':code,
            'text_ready_wall_ms':first_wall,'text_stage_ms':first['timings_ms'],
            'first_voice_after_text_wall_ms':first_voice_wall,'voice_stage_ms':first_voice['timings_ms'],
            'confirmation_text_wall_ms':confirm_wall,'confirmation_stage_ms':final['timings_ms'],
            'confirmation_voice_after_text_wall_ms':last_voice_wall,
            'correction_text_wall_ms':correction_wall,
            'confirmed_while_first_speech_running':speech_still_running,
            'audio_downloads_passed':True,'draft_lookup_passed':True,'wrong_pin_denied':True,
            'real_speaker_accuracy_verified':False}
        target=ROOT/'output/evaluation'/('latency-hosted.json' if base_url.startswith('https://') else 'latency-local.json')
        target.write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--base-url',default='http://127.0.0.1:8000')
    parser.add_argument('--text-input',action='store_true')
    args=parser.parse_args()
    asyncio.run(run(args.base_url.rstrip('/'),args.text_input))

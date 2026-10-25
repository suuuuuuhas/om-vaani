"""Synthetic voice test of the urgent-fraud path; does not call Gemini."""
import asyncio
import json
import sys
from pathlib import Path
from uuid import uuid4
import httpx
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.tts import synthesize
from app.config import ROOT


async def run():
    audio=await synthesize('I clicked a fake bank link and shared my OTP. This is fraud.','en-IN')
    async with httpx.AsyncClient(base_url='https://om-vaani.vercel.app',timeout=90) as client:
        response=await client.post('/api/sessions',json={'phone':'919999991234','language':'en-IN','consent':True})
        response.raise_for_status()
        session=response.json()
        response=await client.post(f'/api/sessions/{session["session_id"]}/audio',
            headers={'Authorization':'Bearer '+session['access_token']},data={'request_id':str(uuid4())},
            files={'audio':('synthetic.ogg',audio,'audio/ogg')})
        response.raise_for_status()
        data=response.json()
        result={'test':'hosted_synthetic_fraud_voice','status':response.status_code,
            'fraud_warning_present':'1930' in data['reply_text'],
            'spoken_reply':bool(data['reply_audio_url']),'latency_ms':data['latency_ms'],
            'warnings':data['warnings'],'gemini_used':False,'synthetic_speech':True}
        if data['reply_audio_url']:
            clip=await client.get(data['reply_audio_url'])
            result['signed_audio_downloaded']=clip.status_code==200 and clip.content.startswith(b'OggS')
        assert result['fraud_warning_present'] and result['spoken_reply'] and result['signed_audio_downloaded']
        target=ROOT/'output/evaluation/vercel-fraud-voice.json'
        target.write_text(json.dumps(result,indent=2))
        print(json.dumps(result,indent=2))


if __name__=='__main__':
    asyncio.run(run())

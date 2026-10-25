"""Diagnose hosted deferred speech using synthetic fraud text and no Gemini calls."""
import asyncio
import json
from uuid import uuid4
import httpx


async def run():
    async with httpx.AsyncClient(base_url='https://om-vaani.vercel.app',timeout=90) as client:
        start=await client.post('/api/sessions',json={'phone':'919999991234','language':'en-IN','consent':True})
        start.raise_for_status();session=start.json()
        headers={'Authorization':'Bearer '+session['access_token']}
        path=f'/api/sessions/{session["session_id"]}'
        first=await client.post(path+'/turn',headers=headers,json={
            'text':'This was a scam.','request_id':str(uuid4()),'defer_speech':True})
        first.raise_for_status()
        second=await client.post(path+'/turn',headers=headers,json={
            'text':'This was a scam.','request_id':str(uuid4()),'defer_speech':True})
        second.raise_for_status()
        async def speech(result):
            response=await client.post(path+'/speech',headers=headers,json={'request_id':result['speech_request_id']})
            data=response.json()
            return {'speech_status':response.status_code,'detail':data.get('detail'),
                'timings_ms':data.get('timings_ms'),'has_audio':bool(data.get('reply_audio_url'))}
        print(json.dumps(await asyncio.gather(speech(first.json()),speech(second.json())),indent=2))


if __name__=='__main__':
    asyncio.run(run())

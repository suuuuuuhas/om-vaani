"""Live Gemini evaluation on synthetic written transcripts; uses API credits."""
import asyncio
import json
import argparse
import sys
import time
import httpx
import re
from decimal import Decimal,InvalidOperation
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.config import ROOT, settings
from app.llm import llm_next_turn
from app.providers import ProviderError


def numeric_amount(value):
    text=str(value).strip().replace(',','')
    text=re.sub(r'^(?:INR|Rs\.?|₹)\s*|\s*rupees$','',text,flags=re.I)
    try:return Decimal(text)
    except InvalidOperation:return None


async def run(resume=False, interval=15):
    if not settings().gemini_api_key:
        raise SystemExit('Add GEMINI_API_KEY in local setup first.')
    cases=json.loads((ROOT/'tests/transcripts/intake.json').read_text(encoding='utf-8'))
    results=[]
    target=ROOT/'output/evaluation';target.mkdir(parents=True,exist_ok=True)
    if resume and (target/'intake.json').exists():
        previous=json.loads((target/'intake.json').read_text(encoding='utf-8'))
        if previous.get('model')==settings().gemini_model:
            results=[row for row in previous['results'] if row.get('passed')]
    for index,case in enumerate(cases):
        if any(row['case']==index+1 and row['passed'] for row in results):continue
        await asyncio.sleep(interval)
        start=time.monotonic()
        try:
            result=await llm_next_turn({},case['text'],case['language'])
            failures=[]
            if 'category' in case and result.category!=case['category']:failures.append('category')
            if 'amount' in case and numeric_amount(result.fields.get('amount'))!=Decimal(str(case['amount'])):failures.append('amount')
            if case.get('urgent_fraud') and not result.urgent_fraud:failures.append('fraud_detection')
            for key in case.get('unknown_fields',[]):
                if result.fields.get(key) not in (None,''):failures.append('invented_'+key)
            results.append({'case':index+1,'language':case['language'],'passed':not failures,'failures':failures,'latency_ms':round((time.monotonic()-start)*1000)})
            if 'amount' in failures:results[-1]['observed_amount']=result.fields.get('amount')
        except (ProviderError,httpx.HTTPError) as error:
            message=str(error) if isinstance(error,ProviderError) else type(error).__name__
            results.append({'case':index+1,'passed':False,'error':message})
            print(json.dumps(results[-1]),flush=True)
            break
        print(json.dumps(results[-1]),flush=True)
        (target/'intake.partial.json').write_text(json.dumps({'model':settings().gemini_model,'results':results},indent=2),encoding='utf-8')
    results.sort(key=lambda row:row['case'])
    report={'kind':'live_model_synthetic_written_transcripts','model':settings().gemini_model,'resumed':resume,'interval_seconds':interval,'results':results,'passed':sum(item['passed'] for item in results),'attempted':len(results),'total':len(cases)}
    (target/'intake.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
    if report['passed']<report['total']:raise SystemExit(1)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--resume',action='store_true');parser.add_argument('--interval',type=float,default=15)
    args=parser.parse_args();asyncio.run(run(args.resume,max(0,args.interval)))

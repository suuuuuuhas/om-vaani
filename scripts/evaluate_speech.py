"""Evaluate consenting real recordings; manifest stays under ignored data/ (no private sample uploads in Git)."""
import argparse
import asyncio
import json
import re
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.config import ROOT
from app.stt import transcribe
from app.languages import normalize_language


def words(text):
    return re.sub(r'[^\w\s]',' ',text.lower(),flags=re.UNICODE).split()


def edit_distance(left,right):
    previous=list(range(len(right)+1))
    for i,a in enumerate(left,1):
        current=[i]
        for j,b in enumerate(right,1):
            current.append(min(current[-1]+1,previous[j]+1,previous[j-1]+(a!=b)))
        previous=current
    return previous[-1]


async def run(manifest):
    cases=json.loads(manifest.read_text(encoding='utf-8'));results=[]
    for index,case in enumerate(cases):
        if not case.get('consent'):raise SystemExit(f'Sample {index+1}: recorded-person consent must be true.')
        audio=(manifest.parent/case['file']).read_bytes();start=time.monotonic()
        result=await transcribe(audio,normalize_language(case['language']))
        reference=words(case['reference']);hypothesis=words(result)
        if not reference:raise SystemExit('Every sample needs a non-empty reference transcript.')
        results.append({'sample':index+1,'language':case['language'],'condition':case.get('condition','unspecified'),
                        'latency_ms':round((time.monotonic()-start)*1000),'reference_words':len(reference),
                        'word_errors':edit_distance(reference,hypothesis),'transcript':result})
    languages={}
    for row in results:
        entry=languages.setdefault(row['language'],{'samples':0,'errors':0,'words':0})
        entry['samples']+=1;entry['errors']+=row['word_errors'];entry['words']+=row['reference_words']
    for entry in languages.values():
        entry['word_error_rate']=round(entry['errors']/entry['words'],4)
        entry['minimum_sample_count_met']=entry['samples']>=10
    target=ROOT/'output/evaluation';target.mkdir(parents=True,exist_ok=True)
    report={'kind':'real_recordings','normalization':'Unicode whitespace-word WER; review numeric/date errors manually; Indic word boundaries limit cross-language comparisons',
            'languages':languages,'results':results}
    (target/'speech.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'languages':languages,'report':str(target/'speech.json')},ensure_ascii=True))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('manifest',type=Path);args=parser.parse_args()
    asyncio.run(run(args.manifest.resolve()))

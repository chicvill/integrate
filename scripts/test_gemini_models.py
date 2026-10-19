import os
import urllib.request
import json
from shared.core.vault import load_encrypted_env

load_encrypted_env()
key = os.getenv('GEMINI_API_KEY')

models = [
    'models/gemini-3.5-flash',
    'models/gemini-3.5-flash-lite',
    'models/gemini-2.5-flash'
]

for m in models:
    url = f'https://generativelanguage.googleapis.com/v1beta/{m}:generateContent?key={key}'
    payload = json.dumps({'contents': [{'parts': [{'text': 'Hello, reply with OK'}]}]}).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            body = json.loads(r.read().decode('utf-8'))
            reply = body.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            print(f'[{m}] SUCCESS: {reply.strip()[:40]}...')
            break
    except Exception as e:
        print(f'[{m}] FAILED: {e}')

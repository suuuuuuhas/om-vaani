"""One-server repositories. Local SQLite persists between restarts; Supabase uses an atomic RPC."""
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from contextlib import asynccontextmanager
from uuid import uuid4
import httpx
from .providers import checked, supabase_headers, ProviderError
from .http_client import provider_client


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SQLiteRepository:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with self.connect() as db:
            db.executescript('''
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS complaints (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, short_code TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_at REAL NOT NULL DEFAULT 0, result TEXT, progress INTEGER NOT NULL DEFAULT 0);
            ''')
            schema = db.execute("SELECT sql FROM sqlite_master WHERE name='complaints'").fetchone()[0]
            if 'session_id TEXT UNIQUE' in schema:
                # Preserve all drafts created by the first local schema while allowing NEW on WhatsApp.
                db.execute('ALTER TABLE complaints RENAME TO complaints_old')
                db.execute('CREATE TABLE complaints (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, short_code TEXT UNIQUE NOT NULL, payload TEXT NOT NULL)')
                db.execute('INSERT INTO complaints SELECT * FROM complaints_old')
                db.execute('DROP TABLE complaints_old')

    def connect(self):
        return sqlite3.connect(self.path, timeout=15)

    async def get_session(self, sid: str) -> dict | None:
        with self.connect() as db:
            row = db.execute('SELECT payload FROM sessions WHERE id=?', (sid,)).fetchone()
        return json.loads(row[0]) if row else None

    async def save_turn(self, session: dict, complaint: dict | None = None):
        with self.connect() as db:
            if complaint:
                db.execute('INSERT INTO complaints VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
                           (complaint['id'], session['id'], complaint['short_code'], json.dumps(complaint)))
            db.execute('INSERT INTO sessions VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
                       (session['id'], json.dumps(session)))

    async def get_complaint(self, code: str) -> dict | None:
        with self.connect() as db:
            row = db.execute('SELECT payload FROM complaints WHERE short_code=?', (code,)).fetchone()
        return json.loads(row[0]) if row else None

    def enqueue(self, message_id: str, payload: dict) -> bool:
        with self.connect() as db:
            result = db.execute('INSERT OR IGNORE INTO inbox(id,payload) VALUES (?,?)', (message_id, json.dumps(payload)))
        return bool(result.rowcount)

    def next_job(self, current_time: float):
        with self.connect() as db:
            row = db.execute("SELECT id,payload,attempts,result,progress FROM inbox WHERE state='pending' AND next_at<=? ORDER BY rowid LIMIT 1", (current_time,)).fetchone()
        if row:
            return {'id': row[0], 'payload': json.loads(row[1]), 'attempts': row[2],
                    'result': json.loads(row[3]) if row[3] else None, 'progress': row[4]}

    def update_job(self, message_id: str, **fields):
        allowed = {'state', 'attempts', 'next_at', 'result', 'progress'}
        assert fields and fields.keys() <= allowed
        values = [json.dumps(v) if k == 'result' else v for k, v in fields.items()]
        with self.connect() as db:
            db.execute('UPDATE inbox SET ' + ','.join(f'{k}=?' for k in fields) + ' WHERE id=?', values + [message_id])


class SupabaseRepository:
    def __init__(self, config):
        self.url = config.supabase_url.rstrip('/') + '/rest/v1'
        self.headers = supabase_headers(config.supabase_key)

    async def query(self, table: str, params: dict):
        async with provider_client(timeout=20) as client:
            response = await checked(await client.get(f'{self.url}/{table}', headers=self.headers, params=params, timeout=20), 'Supabase')
        return response.json()

    async def get_session(self, sid: str):
        rows = await self.query('sessions', {'id': f'eq.{sid}', 'select': 'payload', 'limit': 1})
        return rows[0]['payload'] if rows else None

    async def get_complaint(self, code: str):
        rows = await self.query('complaints', {'short_code': f'eq.{code}', 'select': 'payload', 'limit': 1})
        return rows[0]['payload'] if rows else None

    async def save_turn(self, session: dict, complaint: dict | None = None):
        async with provider_client(timeout=20) as client:
            await checked(await client.post(f'{self.url}/rpc/save_complaint_turn', headers=self.headers,
                                           json={'session_payload': session, 'complaint_payload': complaint}, timeout=20), 'Supabase')

    async def rpc(self, name, payload):
        async with provider_client(timeout=20) as client:
            response = await checked(await client.post(f'{self.url}/rpc/{name}', headers=self.headers, json=payload, timeout=20), 'Supabase')
        return response.json()

    async def enforce_limit(self, key, count, period):
        allowed = await self.rpc('consume_api_limit', {'bucket_key': key, 'max_count': count, 'period_seconds': period})
        if not allowed:
            from fastapi import HTTPException
            raise HTTPException(429, 'Too many requests. Please wait a minute and try again.')

    @asynccontextmanager
    async def turn_lock(self, sid):
        owner = str(uuid4())
        if not await self.rpc('acquire_intake_lease', {'session_key': sid, 'owner_key': owner}):
            raise ProviderError('Intake', 'Another message is processing. Please wait for its reply before retrying.')
        try:
            yield
        finally:
            await self.rpc('release_intake_lease', {'session_key': sid, 'owner_key': owner})

"""Reuse connections within an app event loop; short-lived scripts stay self-contained."""
import asyncio
from contextlib import asynccontextmanager
import httpx

_clients = {}
_speech_slots = {}


@asynccontextmanager
async def speech_slot():
    """Avoid overlapping speech calls; discard loop state after the queue drains."""
    loop = asyncio.get_running_loop()
    slot = _speech_slots.get(loop)
    if slot is None:
        slot = {'guard': asyncio.Semaphore(1), 'users': 0}
        _speech_slots[loop] = slot
    slot['users'] += 1
    try:
        async with slot['guard']:
            yield
    finally:
        slot['users'] -= 1
        if not slot['users']:
            _speech_slots.pop(loop, None)


@asynccontextmanager
async def http_lifespan():
    loop = asyncio.get_running_loop()
    async with httpx.AsyncClient(timeout=30, limits=httpx.Limits(
            max_connections=40, max_keepalive_connections=20, keepalive_expiry=60)) as shared:
        _clients[loop] = shared
        try:
            yield
        finally:
            _clients.pop(loop, None)


@asynccontextmanager
async def provider_client(timeout=30):
    shared = _clients.get(asyncio.get_running_loop())
    if shared is not None and not shared.is_closed:
        yield shared
    else:
        async with httpx.AsyncClient(timeout=timeout) as temporary:
            yield temporary

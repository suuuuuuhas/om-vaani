import httpx
import pytest
from app.http_client import http_lifespan, provider_client


@pytest.mark.asyncio
async def test_lifespan_reuses_connections_without_sharing_auth_headers(monkeypatch):
    original=httpx.AsyncClient
    created=[];requests=[]
    def factory(**kwargs):
        transport=httpx.MockTransport(lambda request:(requests.append(request) or httpx.Response(200)))
        client=original(transport=transport,**kwargs)
        created.append(client)
        return client
    monkeypatch.setattr(httpx,'AsyncClient',factory)
    async with http_lifespan():
        async with provider_client() as first:
            await first.get('https://first.example/',headers={'X-API-Key-ID':'first-only'})
        async with provider_client() as second:
            assert first is second and not first.is_closed
            await second.get('https://second.example/')
    assert len(created)==1 and created[0].is_closed
    assert requests[0].headers['X-API-Key-ID']=='first-only'
    assert 'X-API-Key-ID' not in requests[1].headers

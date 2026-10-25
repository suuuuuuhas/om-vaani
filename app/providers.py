import httpx


def supabase_headers(key: str) -> dict:
    headers = {'apikey': key}
    # New sb_secret keys are not JWTs. The gateway resolves them from apikey.
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = 'Bearer ' + key
    return headers


class ProviderError(Exception):
    def __init__(self, service: str, message: str):
        self.service = service
        self.message = message
        super().__init__(f'{service}: {message}')


async def checked(response: httpx.Response, service: str) -> httpx.Response:
    if response.is_error:
        # Do not propagate provider response bodies, request URLs, tokens or user text.
        code = response.status_code
        reason = 'Check the API key and permissions.' if code in (401, 403) else 'Please retry shortly.'
        raise ProviderError(service, f'Request failed (HTTP {code}). {reason}')
    return response

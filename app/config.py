from pathlib import Path
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT / '.env', ROOT / '.env.keys.local'), extra='ignore')
    gnani_api_key: str = ''
    gnani_stt_api_key: str = ''
    gnani_tts_api_key: str = ''
    gemini_api_key: str = ''
    whatsapp_token: str = ''
    whatsapp_phone_number_id: str = ''
    whatsapp_app_secret: str = ''
    whatsapp_verify_token: str = ''
    whatsapp_display_number: str = ''
    whatsapp_graph_version: str = 'v26.0'
    supabase_url: str = ''
    supabase_key: str = ''
    supabase_audio_bucket: str = 'complaint-audio'
    public_base_url: str = 'http://127.0.0.1:8000'
    default_language: str = 'te-IN'
    gemini_model: str = 'gemini-3.6-flash'
    gemini_api_mode: str = 'generate_content'
    gemini_thinking_level: str = 'low'
    gnani_tts_model: str = 'timbre-v3.0'
    gnani_tts_voice: str = 'Shivani'
    storage_backend: str = 'sqlite'
    data_dir: Path = ROOT / 'data'
    max_audio_bytes: int = (3 if os.environ.get('VERCEL') == '1' else 10) * 1024 * 1024

    @property
    def stt_key(self) -> str:
        return self.gnani_stt_api_key or self.gnani_api_key

    @property
    def tts_key(self) -> str:
        return self.gnani_tts_api_key or self.gnani_api_key


def settings() -> Settings:
    # Reloading makes keys saved in local setup available without restarting.
    return Settings()

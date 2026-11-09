from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

Category = Literal['ecommerce_product', 'delivery_or_food', 'upi_payment_failure', 'defective_goods_or_overcharge', 'unknown']


class Extraction(BaseModel):
    model_config = ConfigDict(extra='forbid')
    category: Category
    fields: dict[str, str | int | float | bool | None]
    urgent_fraud: bool
    reply: str = Field(max_length=1200)
    summary_user_language: str = Field(max_length=2000)
    formal_complaint_en: str = Field(max_length=6000)
    # A rejection or correction can never act as confirmation.
    confirmation: Literal['yes', 'no', 'unclear']


class TurnResult(BaseModel):
    reply_text: str
    reply_audio_url: str | None = None
    complaint_state: dict
    is_complete: bool = False
    short_code: str | None = None
    transcript: str | None = None
    warnings: list[str] = Field(default_factory=list)
    latency_ms: int = 0
    speech_pending: bool = False
    speech_request_id: str | None = None
    timings_ms: dict[str, int] = Field(default_factory=dict)


class StartSession(BaseModel):
    language: str = 'te-IN'
    phone: str = Field(pattern=r'^\+?[0-9]{10,15}$')
    consent: bool


class TextTurn(BaseModel):
    text: str = Field(min_length=1, max_length=6000)
    request_id: str = Field(min_length=8, max_length=100)
    defer_speech: bool = False


class SpeechRequest(BaseModel):
    request_id: str | None = Field(default=None, min_length=8, max_length=100)
    delivery: Literal['url', 'audio'] = 'url'

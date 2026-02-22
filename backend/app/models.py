from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# --- Upload ---

class UploadURLRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"


class UploadURLResponse(BaseModel):
    upload_url: str
    image_path: str
    image_url: str


# --- Detection ---

class DetectRequest(BaseModel):
    image_url: str


class DetectResponse(BaseModel):
    suggested_name: str | None = None
    suggested_category: str
    brand: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    is_uncertain: bool


# --- Items ---

class ItemCreate(BaseModel):
    name: str
    category: str
    brand: str | None = None
    image_url: str
    confidence_score: float | None = Field(default=None, ge=0.0, le=1.0)


class ItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    category: str
    brand: str | None = None
    image_url: str
    confidence_score: float | None = None
    created_at: datetime


# --- Item Metadata ---

class MetadataEntry(BaseModel):
    key: str
    value: str


class MetadataResponse(BaseModel):
    id: UUID
    item_id: UUID
    key: str
    value: str

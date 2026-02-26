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
    purchase_price: float | None = None
    purchase_date: str | None = None


class ItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    category: str
    brand: str | None = None
    image_url: str
    confidence_score: float | None = None
    created_at: datetime
    purchase_price: float | None = None
    purchase_date: str | None = None
    estimated_resale_value: float | None = None
    resale_currency: str | None = "SGD"
    depreciation_rate: float | None = None
    value_last_updated: datetime | None = None
    previous_value: float | None = None


class ItemUpdate(BaseModel):
    purchase_price: float | None = None
    purchase_date: str | None = None


# --- Item Metadata ---

class MetadataEntry(BaseModel):
    key: str
    value: str


class MetadataResponse(BaseModel):
    id: UUID
    item_id: UUID
    key: str
    value: str


# --- Valuation ---

class ValuationResult(BaseModel):
    estimated_value: float | None = None
    confidence: float = 0.0
    assumptions: str | None = None
    final_value: float | None = None
    valuation_method: str | None = None
    explanation: str | None = None
    previous_value: float | None = None
    absolute_change: float | None = None
    percentage_change: float | None = None
    value_trend: str = "unknown"
    change_explanation: str | None = None


class StableValuationResult(BaseModel):
    final_value: float
    previous_value: float | None = None
    applied_change_pct: float | None = None
    confidence_used: float = 0.0
    explanation: str
    value_last_updated: datetime
    valuation_method: str | None = None
    # Pass-through fields for frontend compatibility
    absolute_change: float | None = None
    percentage_change: float | None = None
    value_trend: str = "unknown"
    change_explanation: str | None = None


class ValuationHistoryEntry(BaseModel):
    id: UUID
    item_id: UUID
    value: float
    valuation_method: str | None = None
    created_at: datetime


class AssetSummary(BaseModel):
    total_items: int = 0
    total_purchase_value: float = 0.0
    total_current_value: float = 0.0
    currency: str = "SGD"
    items_with_valuation: int = 0
    items_without_valuation: int = 0
    last_updated: datetime | None = None
    total_previous_value: float | None = None
    portfolio_change: float | None = None
    portfolio_change_percent: float | None = None

import logging
import time
from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.database import supabase
from app.models import (
    DetectRequest,
    DetectResponse,
    ItemCreate,
    ItemResponse,
    MetadataEntry,
    MetadataResponse,
)
from app.services.vision import detect_item

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/items", tags=["items"])

# Simple in-memory rate limiter: user_id -> list of timestamps
_detect_calls: dict[str, list[float]] = defaultdict(list)
DETECT_RATE_LIMIT = 10  # max calls
DETECT_RATE_WINDOW = 60  # per seconds


def _check_rate_limit(user_id: str):
    """Enforce rate limit on detect calls."""
    now = time.time()
    calls = _detect_calls[user_id]
    # Remove old entries
    _detect_calls[user_id] = [t for t in calls if now - t < DETECT_RATE_WINDOW]
    if len(_detect_calls[user_id]) >= DETECT_RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many detection requests. Please wait before trying again.",
        )
    _detect_calls[user_id].append(now)


# --- Detection ---

@router.post("/detect", response_model=DetectResponse)
async def detect(request: DetectRequest, user_id: str = Depends(get_current_user)):
    """Accept an image URL and return AI-suggested item metadata.

    Pre-AI validation:
    - JWT verified (via dependency)
    - Rate limit enforced
    - Image URL must be non-empty

    Nothing is persisted. Response is a suggestion only.
    """
    # Validate image URL is present
    if not request.image_url or not request.image_url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="image_url is required",
        )

    # Rate limit
    _check_rate_limit(user_id)

    logger.info("Detection requested by user=%s", user_id)
    return await detect_item(request.image_url)


# --- Items CRUD ---

@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(item: ItemCreate, user_id: str = Depends(get_current_user)):
    """Persist a user-confirmed item to inventory."""
    row = {
        "user_id": user_id,
        "name": item.name,
        "category": item.category,
        "brand": item.brand,
        "image_url": item.image_url,
        "confidence_score": item.confidence_score,
    }
    result = supabase.table("items").insert(row).execute()
    return result.data[0]


@router.get("", response_model=list[ItemResponse])
async def list_items(user_id: str = Depends(get_current_user)):
    """Fetch all items for the authenticated user."""
    result = (
        supabase.table("items")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(item_id: UUID, user_id: str = Depends(get_current_user)):
    """Fetch a single item, enforcing ownership."""
    result = (
        supabase.table("items")
        .select("*")
        .eq("id", str(item_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return result.data[0]


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: UUID, user_id: str = Depends(get_current_user)):
    """Delete an item, enforcing ownership."""
    result = (
        supabase.table("items")
        .select("id")
        .eq("id", str(item_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    supabase.table("items").delete().eq("id", str(item_id)).execute()


# --- Item Metadata CRUD ---

def _verify_item_ownership(item_id: UUID, user_id: str):
    """Check that the item belongs to the user."""
    result = (
        supabase.table("items")
        .select("id")
        .eq("id", str(item_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")


@router.get("/{item_id}/metadata", response_model=list[MetadataResponse])
async def list_metadata(item_id: UUID, user_id: str = Depends(get_current_user)):
    """Fetch all metadata for an item."""
    _verify_item_ownership(item_id, user_id)
    result = (
        supabase.table("item_metadata")
        .select("*")
        .eq("item_id", str(item_id))
        .execute()
    )
    return result.data


@router.post(
    "/{item_id}/metadata",
    response_model=MetadataResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_metadata(
    item_id: UUID, entry: MetadataEntry, user_id: str = Depends(get_current_user)
):
    """Add a metadata key-value pair to an item."""
    _verify_item_ownership(item_id, user_id)
    row = {"item_id": str(item_id), "key": entry.key, "value": entry.value}
    result = supabase.table("item_metadata").insert(row).execute()
    return result.data[0]


@router.delete(
    "/{item_id}/metadata/{metadata_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_metadata(
    item_id: UUID, metadata_id: UUID, user_id: str = Depends(get_current_user)
):
    """Delete a metadata entry."""
    _verify_item_ownership(item_id, user_id)
    result = (
        supabase.table("item_metadata")
        .select("id")
        .eq("id", str(metadata_id))
        .eq("item_id", str(item_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Metadata entry not found"
        )
    supabase.table("item_metadata").delete().eq("id", str(metadata_id)).execute()

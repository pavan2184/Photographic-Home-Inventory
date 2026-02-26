import asyncio
import logging
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import get_current_user
from app.database import supabase_admin as supabase
from app.models import (
    DetectRequest,
    DetectResponse,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
    MetadataEntry,
    MetadataResponse,
    StableValuationResult,
    ValuationHistoryEntry,
    ValuationResult,
)
from app.services.valuation import compute_stable_value, compute_valuation, compute_value_change
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
    try:
        return await detect_item(request.image_url)
    except RuntimeError as e:
        error_msg = str(e)
        if "quota" in error_msg.lower():
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=error_msg)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=error_msg)


# --- Background valuation ---

VALUATION_COOLDOWN_DAYS = 30


async def _run_valuation(item_id: str, name: str, category: str, brand: str | None,
                         purchase_price: float, purchase_date: date, force: bool = False):
    """Background task: compute valuation and update the item row."""
    try:
        # Read current item state
        current = supabase.table("items").select(
            "estimated_resale_value, value_last_updated"
        ).eq("id", item_id).execute()
        old_value = None
        last_updated = None
        if current.data:
            raw = current.data[0].get("estimated_resale_value")
            if raw is not None:
                old_value = float(raw)
            raw_ts = current.data[0].get("value_last_updated")
            if raw_ts:
                last_updated = datetime.fromisoformat(raw_ts)

        # Cooldown check: skip if recent valuation exists (unless forced or first-ever)
        if not force and old_value is not None and last_updated is not None:
            cutoff = datetime.now(timezone.utc) - timedelta(days=VALUATION_COOLDOWN_DAYS)
            if last_updated > cutoff:
                logger.info("Skipping valuation for item=%s (cooldown active, last updated %s)", item_id, last_updated)
                return

        raw_result = await compute_valuation(
            name=name,
            category=category,
            brand=brand,
            purchase_price=purchase_price,
            purchase_date=purchase_date,
            previous_value=old_value,
        )

        stable = compute_stable_value(
            raw_result=raw_result,
            current_value=old_value,
            purchase_price=purchase_price,
        )

        update_fields = {
            "estimated_resale_value": stable.final_value,
            "depreciation_rate": stable.confidence_used,
            "value_last_updated": stable.value_last_updated.isoformat(),
        }
        if old_value is not None:
            update_fields["previous_value"] = old_value

        supabase.table("items").update(update_fields).eq("id", item_id).execute()

        # Log to valuation history
        if stable.final_value is not None:
            supabase.table("valuation_history").insert({
                "item_id": item_id,
                "value": stable.final_value,
                "valuation_method": stable.valuation_method,
            }).execute()

        logger.info("Valuation completed for item=%s: value=%s", item_id, stable.final_value)
    except Exception:
        logger.exception("Background valuation failed for item=%s", item_id)


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
        "purchase_price": item.purchase_price,
        "purchase_date": item.purchase_date,
    }
    result = supabase.table("items").insert(row).execute()
    created = result.data[0]

    # Fire background valuation if purchase_price is set
    if item.purchase_price and item.purchase_date:
        try:
            pd = date.fromisoformat(item.purchase_date)
            asyncio.create_task(_run_valuation(
                item_id=created["id"],
                name=item.name,
                category=item.category,
                brand=item.brand,
                purchase_price=item.purchase_price,
                purchase_date=pd,
            ))
        except ValueError:
            logger.warning("Invalid purchase_date format: %s", item.purchase_date)

    return created


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


@router.get("/{item_id}/valuation", response_model=StableValuationResult)
async def get_item_valuation(
    item_id: UUID,
    user_id: str = Depends(get_current_user),
    force: bool = Query(False, description="Force fresh recomputation, bypassing cooldown"),
):
    """Return detailed valuation breakdown for an item.

    Returns cached data if within the 30-day cooldown window.
    Pass ?force=true to bypass the cooldown and trigger a fresh computation.
    """
    result = (
        supabase.table("items")
        .select("*")
        .eq("id", str(item_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    item = result.data[0]

    if not item.get("purchase_price") or not item.get("purchase_date"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item has no purchase price or date — cannot compute valuation",
        )

    purchase_price = float(item["purchase_price"])
    purchase_date_val = date.fromisoformat(item["purchase_date"])

    old_value = None
    raw = item.get("estimated_resale_value")
    if raw is not None:
        old_value = float(raw)

    # Cooldown check: return cached data if within window
    last_updated_str = item.get("value_last_updated")
    if not force and old_value is not None and last_updated_str:
        last_updated = datetime.fromisoformat(last_updated_str)
        cutoff = datetime.now(timezone.utc) - timedelta(days=VALUATION_COOLDOWN_DAYS)
        if last_updated > cutoff:
            days_ago = (datetime.now(timezone.utc) - last_updated).days
            change = compute_value_change(old_value, item.get("previous_value") and float(item["previous_value"]))
            return StableValuationResult(
                final_value=old_value,
                previous_value=float(item["previous_value"]) if item.get("previous_value") is not None else None,
                applied_change_pct=None,
                confidence_used=float(item.get("depreciation_rate") or 0),
                explanation=f"Value unchanged (last updated {days_ago} day{'s' if days_ago != 1 else ''} ago). Next revaluation available in {VALUATION_COOLDOWN_DAYS - days_ago} days.",
                value_last_updated=last_updated,
                valuation_method=None,
                absolute_change=change["absolute_change"],
                percentage_change=change["percentage_change"],
                value_trend=change["value_trend"],
                change_explanation=change["change_explanation"],
            )

    # Compute fresh valuation with stability layer
    raw_result = await compute_valuation(
        name=item["name"],
        category=item["category"],
        brand=item.get("brand"),
        purchase_price=purchase_price,
        purchase_date=purchase_date_val,
        previous_value=old_value,
    )

    stable = compute_stable_value(
        raw_result=raw_result,
        current_value=old_value,
        purchase_price=purchase_price,
    )

    # Persist to item row
    update_fields = {
        "estimated_resale_value": stable.final_value,
        "depreciation_rate": stable.confidence_used,
        "value_last_updated": stable.value_last_updated.isoformat(),
    }
    if old_value is not None:
        update_fields["previous_value"] = old_value

    supabase.table("items").update(update_fields).eq("id", str(item_id)).execute()

    # Log to valuation history
    if stable.final_value is not None:
        supabase.table("valuation_history").insert({
            "item_id": str(item_id),
            "value": stable.final_value,
            "valuation_method": stable.valuation_method,
        }).execute()

    return stable


@router.get("/{item_id}/valuation/history", response_model=list[ValuationHistoryEntry])
async def get_item_valuation_history(item_id: UUID, user_id: str = Depends(get_current_user)):
    """Return all past valuations for an item, newest first."""
    _verify_item_ownership(item_id, user_id)
    result = (
        supabase.table("valuation_history")
        .select("*")
        .eq("item_id", str(item_id))
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.patch("/{item_id}", response_model=ItemResponse)
async def update_item(item_id: UUID, update: ItemUpdate, user_id: str = Depends(get_current_user)):
    """Update purchase info on an existing item and trigger valuation."""
    result = (
        supabase.table("items")
        .select("*")
        .eq("id", str(item_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    item = result.data[0]
    changes = {}
    if update.purchase_price is not None:
        changes["purchase_price"] = update.purchase_price
    if update.purchase_date is not None:
        changes["purchase_date"] = update.purchase_date

    if not changes:
        return item

    updated = supabase.table("items").update(changes).eq("id", str(item_id)).execute()
    updated_item = updated.data[0]

    # Fire background valuation if we now have both fields
    pp = updated_item.get("purchase_price") or changes.get("purchase_price") or item.get("purchase_price")
    pd_str = updated_item.get("purchase_date") or changes.get("purchase_date") or item.get("purchase_date")
    if pp and pd_str:
        try:
            pd = date.fromisoformat(str(pd_str))
            asyncio.create_task(_run_valuation(
                item_id=str(item_id),
                name=item["name"],
                category=item["category"],
                brand=item.get("brand"),
                purchase_price=float(pp),
                purchase_date=pd,
                force=True,  # bypass cooldown on data change
            ))
        except ValueError:
            logger.warning("Invalid purchase_date format: %s", pd_str)

    return updated_item


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

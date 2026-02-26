import logging
from datetime import datetime

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.database import supabase_admin as supabase
from app.models import AssetSummary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/summary", response_model=AssetSummary)
async def get_asset_summary(user_id: str = Depends(get_current_user)):
    """Aggregate the user's items into a portfolio-style summary."""
    result = (
        supabase.table("items")
        .select("purchase_price,estimated_resale_value,previous_value,value_last_updated")
        .eq("user_id", user_id)
        .execute()
    )

    items = result.data
    total_items = len(items)
    total_purchase = 0.0
    total_current = 0.0
    # For portfolio change: only items with both current and previous values
    change_current_sum = 0.0
    change_previous_sum = 0.0
    items_with_change = 0
    with_valuation = 0
    without_valuation = 0
    latest_updated = None

    for item in items:
        pp = item.get("purchase_price")
        rv = item.get("estimated_resale_value")
        pv = item.get("previous_value")

        if pp is not None:
            total_purchase += float(pp)

        if rv is not None:
            total_current += float(rv)
            with_valuation += 1
            vlu = item.get("value_last_updated")
            if vlu:
                ts = datetime.fromisoformat(vlu.replace("Z", "+00:00")) if isinstance(vlu, str) else vlu
                if latest_updated is None or ts > latest_updated:
                    latest_updated = ts
            # Track items that have both current and previous values
            if pv is not None:
                change_current_sum += float(rv)
                change_previous_sum += float(pv)
                items_with_change += 1
        else:
            without_valuation += 1

    # Compute portfolio-level change (only from items with both values)
    portfolio_total_previous = None
    portfolio_change = None
    portfolio_change_percent = None
    if items_with_change > 0:
        portfolio_total_previous = round(change_previous_sum, 2)
        portfolio_change = round(change_current_sum - change_previous_sum, 2)
        if change_previous_sum > 0:
            portfolio_change_percent = round(
                ((change_current_sum - change_previous_sum) / change_previous_sum) * 100, 1
            )

    return AssetSummary(
        total_items=total_items,
        total_purchase_value=round(total_purchase, 2),
        total_current_value=round(total_current, 2),
        currency="SGD",
        items_with_valuation=with_valuation,
        items_without_valuation=without_valuation,
        last_updated=latest_updated,
        total_previous_value=portfolio_total_previous,
        portfolio_change=portfolio_change,
        portfolio_change_percent=portfolio_change_percent,
    )

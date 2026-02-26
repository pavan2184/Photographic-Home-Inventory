import json
import logging
from datetime import date, datetime, timezone

from google import genai
from google.genai import types

from app.config import settings
from app.models import StableValuationResult, ValuationResult

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

# Category-based annual depreciation rates (declining balance)
DEFAULT_DEPRECIATION_RATES: dict[str, float] = {
    "Electronics": 0.25,
    "Furniture": 0.10,
    "Appliances": 0.15,
    "Clothing": 0.40,
    "Kitchen": 0.15,
    "Tools": 0.10,
    "Sports": 0.20,
    "Toys": 0.30,
    "Jewelry": 0.05,
    "Art": 0.05,
    "Books": 0.20,
    "Other": 0.20,
}

RESALE_PROMPT = """You are an item valuation assistant. Estimate the current resale value
of this item in Singapore Dollars (SGD).

Item: {name}
Category: {category}
Brand: {brand}
Purchase Price: SGD {purchase_price}
Purchase Date: {purchase_date}
Current Date: {current_date}

Respond with ONLY a JSON object in this exact format:
{{
  "estimated_value": <number in SGD>,
  "confidence": <0.0 to 1.0>,
  "assumptions": "brief explanation of your estimate"
}}

Rules:
- Be realistic about depreciation and market value
- confidence should reflect how certain you are (higher for well-known items/brands)
- If you cannot estimate, set estimated_value to null and confidence to 0.0
- Return ONLY valid JSON, no markdown or extra text"""


def _compute_depreciation(
    purchase_price: float,
    purchase_date: date,
    category: str,
) -> ValuationResult:
    """Compute depreciation using declining-balance method."""
    rate = DEFAULT_DEPRECIATION_RATES.get(category, 0.20)
    today = date.today()
    years_owned = (today - purchase_date).days / 365.25

    if years_owned <= 0:
        return ValuationResult(
            estimated_value=purchase_price,
            confidence=0.8,
            assumptions="Item purchased today, no depreciation applied",
            final_value=purchase_price,
            valuation_method="depreciation",
            explanation=f"No depreciation (0 years owned). Rate: {rate*100:.0f}%/year for {category}.",
        )

    current_value = purchase_price * ((1 - rate) ** years_owned)
    current_value = round(max(current_value, 0), 2)

    return ValuationResult(
        estimated_value=current_value,
        confidence=0.6,
        assumptions=f"Declining-balance depreciation at {rate*100:.0f}%/year for {category}",
        final_value=current_value,
        valuation_method="depreciation",
        explanation=f"Depreciated from SGD {purchase_price:.2f} over {years_owned:.1f} years at {rate*100:.0f}%/year.",
    )


async def estimate_resale_value(
    name: str,
    category: str,
    brand: str | None,
    purchase_price: float,
    purchase_date: date,
) -> ValuationResult | None:
    """Use Gemini to estimate resale value. Returns None on failure."""
    try:
        prompt = RESALE_PROMPT.format(
            name=name,
            category=category,
            brand=brand or "Unknown",
            purchase_price=f"{purchase_price:.2f}",
            purchase_date=purchase_date.isoformat(),
            current_date=date.today().isoformat(),
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[types.Content(parts=[types.Part.from_text(text=prompt)])],
        )

        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            raw_text = raw_text.rsplit("```", 1)[0].strip()

        data = json.loads(raw_text)
        logger.info("Gemini resale estimate: %s", data)

        estimated = data.get("estimated_value")
        conf = float(data.get("confidence", 0))
        assumptions = data.get("assumptions", "")

        if estimated is None or conf < 0.5:
            logger.info("Resale estimate discarded (confidence=%.2f)", conf)
            return None

        estimated = float(estimated)
        # Cap at purchase price — an item shouldn't appreciate in normal cases
        if estimated > purchase_price:
            estimated = purchase_price

        return ValuationResult(
            estimated_value=round(estimated, 2),
            confidence=min(max(conf, 0.0), 1.0),
            assumptions=assumptions,
            final_value=round(estimated, 2),
            valuation_method="ai_resale_estimate",
            explanation=f"AI-estimated resale value: SGD {estimated:.2f}. {assumptions}",
        )

    except Exception as exc:
        logger.exception("Gemini resale estimation failed")
        return None


def compute_value_change(
    current_value: float | None,
    previous_value: float | None,
) -> dict:
    """Compute change metrics between current and previous valuation."""
    if previous_value is None or current_value is None:
        return {
            "previous_value": previous_value,
            "absolute_change": None,
            "percentage_change": None,
            "value_trend": "unknown",
            "change_explanation": None,
        }

    absolute_change = round(current_value - previous_value, 2)

    if abs(absolute_change) < 0.01:
        return {
            "previous_value": previous_value,
            "absolute_change": 0.0,
            "percentage_change": 0.0,
            "value_trend": "unchanged",
            "change_explanation": "Value unchanged since last update",
        }

    if previous_value == 0:
        percentage_change = None
    else:
        percentage_change = round((absolute_change / abs(previous_value)) * 100, 1)

    if absolute_change > 0:
        trend = "up"
        arrow = "\u2191"
    else:
        trend = "down"
        arrow = "\u2193"

    if percentage_change is not None:
        explanation = f"{arrow} {abs(percentage_change)}% since last update"
    else:
        explanation = f"{arrow} SGD {abs(absolute_change):.2f} since last update"

    return {
        "previous_value": previous_value,
        "absolute_change": absolute_change,
        "percentage_change": percentage_change,
        "value_trend": trend,
        "change_explanation": explanation,
    }


async def compute_valuation(
    name: str,
    category: str,
    brand: str | None,
    purchase_price: float,
    purchase_date: date,
    previous_value: float | None = None,
) -> ValuationResult:
    """Orchestrator: try AI resale estimate first, fall back to depreciation model."""
    # Try AI-based resale estimate
    ai_result = await estimate_resale_value(
        name=name,
        category=category,
        brand=brand,
        purchase_price=purchase_price,
        purchase_date=purchase_date,
    )

    result = ai_result if ai_result is not None else _compute_depreciation(
        purchase_price=purchase_price,
        purchase_date=purchase_date,
        category=category,
    )

    # Merge value change tracking into result
    change = compute_value_change(result.final_value, previous_value)
    result.previous_value = change["previous_value"]
    result.absolute_change = change["absolute_change"]
    result.percentage_change = change["percentage_change"]
    result.value_trend = change["value_trend"]
    result.change_explanation = change["change_explanation"]

    return result


def compute_stable_value(
    raw_result: ValuationResult,
    current_value: float | None,
    purchase_price: float,
    value_last_updated: datetime | None = None,
) -> StableValuationResult:
    """Apply stability rules on top of a raw valuation result.

    Rules applied in order:
    1. Fallback gate — discard low-confidence AI results
    2. Change clamp — limit change to confidence × 10%
    3. Blended update — 70/30 weighted average with old value
    4. Anchor constraints — keep within [purchase_price×0.2, purchase_price×1.1]
    """
    now = datetime.now(timezone.utc)
    reasons: list[str] = []
    raw_value = raw_result.final_value

    # --- First-ever valuation: skip smoothing, only apply anchor ---
    if current_value is None:
        new_value = raw_value if raw_value is not None else 0.0

        floor = round(purchase_price * 0.2, 2)
        ceiling = round(purchase_price * 1.1, 2)
        if new_value < floor:
            reasons.append(f"Snapped up to floor (20% of purchase price: SGD {floor:.2f})")
            new_value = floor
        elif new_value > ceiling:
            reasons.append(f"Snapped down to ceiling (110% of purchase price: SGD {ceiling:.2f})")
            new_value = ceiling

        new_value = round(new_value, 2)
        explanation = raw_result.explanation or ""
        if reasons:
            explanation += " | " + "; ".join(reasons)

        change = compute_value_change(new_value, None)
        return StableValuationResult(
            final_value=new_value,
            previous_value=None,
            applied_change_pct=None,
            confidence_used=raw_result.confidence,
            explanation=explanation.strip(),
            value_last_updated=now,
            valuation_method=raw_result.valuation_method,
            absolute_change=change["absolute_change"],
            percentage_change=change["percentage_change"],
            value_trend=change["value_trend"],
            change_explanation=change["change_explanation"],
        )

    # --- Subsequent valuations: apply full stability pipeline ---

    # 1. Fallback gate — discard low-confidence AI results
    if raw_result.valuation_method == "ai_resale_estimate" and raw_result.confidence < 0.5:
        reasons.append(f"AI confidence too low ({raw_result.confidence:.2f}), using depreciation fallback")
        raw_value = current_value  # keep current value unchanged

    if raw_value is None:
        raw_value = current_value

    # 2. Change clamp (confidence-weighted)
    effective_max_change = raw_result.confidence * 0.10
    lower_bound = current_value * (1 - effective_max_change)
    upper_bound = current_value * (1 + effective_max_change)
    clamped = max(lower_bound, min(raw_value, upper_bound))

    if clamped != raw_value:
        pct = effective_max_change * 100
        reasons.append(f"Change clamped to +/-{pct:.1f}% (confidence={raw_result.confidence:.2f})")

    # 3. Blended update (70% old, 30% new)
    blended = round((current_value * 0.7) + (clamped * 0.3), 2)
    reasons.append("Blended 70/30 with previous value")

    # 4. Anchor constraints
    floor = round(purchase_price * 0.2, 2)
    ceiling = round(purchase_price * 1.1, 2)
    final = blended
    if final < floor:
        reasons.append(f"Snapped up to floor (20% of purchase price: SGD {floor:.2f})")
        final = floor
    elif final > ceiling:
        reasons.append(f"Snapped down to ceiling (110% of purchase price: SGD {ceiling:.2f})")
        final = ceiling

    final = round(final, 2)

    # Compute applied change percentage
    applied_change_pct = None
    if current_value and current_value != 0:
        applied_change_pct = round(((final - current_value) / abs(current_value)) * 100, 2)

    # Build explanation
    base_explanation = raw_result.explanation or ""
    explanation = base_explanation + " | Stability: " + "; ".join(reasons)

    change = compute_value_change(final, current_value)
    return StableValuationResult(
        final_value=final,
        previous_value=current_value,
        applied_change_pct=applied_change_pct,
        confidence_used=raw_result.confidence,
        explanation=explanation.strip(),
        value_last_updated=now,
        valuation_method=raw_result.valuation_method,
        absolute_change=change["absolute_change"],
        percentage_change=change["percentage_change"],
        value_trend=change["value_trend"],
        change_explanation=change["change_explanation"],
    )

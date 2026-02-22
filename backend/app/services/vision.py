import json
import logging

from google import genai
from google.genai import types

from app.config import settings
from app.models import DetectResponse

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

# Vague names that indicate garbage detection
GARBAGE_NAMES = {
    "object", "thing", "item", "device", "electronic device",
    "product", "stuff", "something", "unknown", "n/a", "",
}

DETECTION_PROMPT = """You are an item identification assistant for a home inventory app.
Analyze this image and identify the primary item shown.

Respond with ONLY a JSON object in this exact format:
{
  "item_name": "specific item name",
  "category": "one of: Electronics, Furniture, Clothing, Kitchen, Books, Tools, Sports, Toys, Appliances, Jewelry, Art, Other",
  "brand": "brand name or null if unknown",
  "confidence": 0.0 to 1.0
}

Rules:
- Be specific with the name (e.g. "Sony WH-1000XM5 Headphones" not just "headphones")
- confidence should honestly reflect how certain you are about the identification
- If you are not confident, say "unknown" instead of guessing
- If the image is blurry, obscured, or you cannot identify the item, set confidence to 0.0
- brand should be null if you cannot determine it, do NOT guess brands
- Return ONLY valid JSON, no markdown or extra text"""


def _normalize_string(value: str | None) -> str | None:
    """Normalize a string value: strip whitespace, convert empty/null-ish to None."""
    if value is None:
        return None
    cleaned = str(value).strip()
    if cleaned.lower() in ("", "null", "none", "n/a", "unknown"):
        return None
    return cleaned


def _clamp_confidence(value) -> float:
    """Force confidence into [0.0, 1.0] range."""
    try:
        conf = float(value)
    except (TypeError, ValueError):
        return 0.0
    return min(max(conf, 0.0), 1.0)


def _is_garbage_name(name: str | None) -> bool:
    """Check if the detected name is too vague to be useful."""
    if name is None:
        return True
    return name.strip().lower() in GARBAGE_NAMES


def _normalize_response(data: dict) -> DetectResponse:
    """Transform raw AI output into a guaranteed-safe DetectResponse."""
    raw_name = _normalize_string(data.get("item_name") or data.get("suggested_name"))
    raw_category = _normalize_string(data.get("category") or data.get("suggested_category"))
    brand = _normalize_string(data.get("brand"))
    confidence = _clamp_confidence(data.get("confidence"))

    # Flag garbage detections
    if _is_garbage_name(raw_name):
        raw_name = None
        confidence = 0.0

    category = raw_category or "Other"
    is_uncertain = confidence < settings.confidence_threshold or raw_name is None

    return DetectResponse(
        suggested_name=raw_name,
        suggested_category=category,
        brand=brand,
        confidence=confidence,
        is_uncertain=is_uncertain,
    )


FALLBACK_RESPONSE = DetectResponse(
    suggested_name=None,
    suggested_category="Other",
    brand=None,
    confidence=0.0,
    is_uncertain=True,
)


async def detect_item(image_url: str) -> DetectResponse:
    """Send image to Gemini and return normalized item detection."""
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(
                    parts=[
                        types.Part.from_uri(file_uri=image_url, mime_type="image/jpeg"),
                        types.Part.from_text(text=DETECTION_PROMPT),
                    ]
                )
            ],
        )

        raw_text = response.text.strip()

        # Strip markdown fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            raw_text = raw_text.rsplit("```", 1)[0].strip()

        data = json.loads(raw_text)
        logger.info("Gemini raw result: %s", data)

        result = _normalize_response(data)
        logger.info(
            "Normalized detection: name=%s, category=%s, confidence=%.2f, uncertain=%s",
            result.suggested_name, result.suggested_category,
            result.confidence, result.is_uncertain,
        )
        return result

    except Exception:
        logger.exception("Gemini detection failed")
        return FALLBACK_RESPONSE

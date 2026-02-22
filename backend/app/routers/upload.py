import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.config import settings
from app.database import supabase_admin
from app.models import UploadURLRequest, UploadURLResponse

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("", response_model=UploadURLResponse)
async def create_upload_url(
    request: UploadURLRequest, user_id: str = Depends(get_current_user)
):
    """Generate a signed upload URL for Supabase Storage.

    Client uploads the image directly to storage using this URL.
    The image is scoped to the user's folder and not tied to any item yet.
    """
    ext = request.filename.rsplit(".", 1)[-1] if "." in request.filename else "jpg"
    image_path = f"{user_id}/{uuid.uuid4()}.{ext}"

    try:
        result = supabase_admin.storage.from_(settings.storage_bucket).create_signed_upload_url(
            image_path
        )
        signed_url = result.get("signed_url") or result.get("signedURL")
        if not signed_url:
            raise ValueError("No signed URL returned from storage")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create upload URL: {e}",
        )

    # Build the public (but private-bucket) URL for later use
    image_url = f"{settings.supabase_url}/storage/v1/object/{settings.storage_bucket}/{image_path}"

    return UploadURLResponse(
        upload_url=signed_url,
        image_path=image_path,
        image_url=image_url,
    )

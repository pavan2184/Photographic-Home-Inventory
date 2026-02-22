from supabase import create_client, Client

from app.config import settings

# Public client — respects RLS, used for user-scoped queries
supabase: Client = create_client(settings.supabase_url, settings.supabase_key)

# Service client — bypasses RLS, used for storage operations
supabase_admin: Client = create_client(settings.supabase_url, settings.supabase_service_key)

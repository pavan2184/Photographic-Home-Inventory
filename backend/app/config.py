from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    supabase_service_key: str
    supabase_jwt_secret: str
    gemini_api_key: str
    allowed_origins: str = "http://localhost:3000,http://localhost:8081"
    confidence_threshold: float = 0.5
    storage_bucket: str = "item-images"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

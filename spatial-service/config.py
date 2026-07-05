from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # PostgreSQL
    db_host: str = "localhost"
    db_port: int = 5432
    db_username: str = "hero_user"
    db_password: str = "hero_password"
    db_database: str = "community_hero"

    # JWT (shared secret with NestJS backend)
    jwt_secret: str = "super-secret-jwt-key-change-in-production"

    # MinIO (S3-compatible)
    minio_endpoint: str = "localhost"
    minio_port: int = 9000
    minio_access_key: str = "minio_admin"
    minio_secret_key: str = "minio_password"
    minio_bucket_name: str = "community-hero-media"
    minio_use_ssl: bool = False

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_username}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_database}"
        )

    @property
    def minio_url(self) -> str:
        scheme = "https" if self.minio_use_ssl else "http"
        return f"{scheme}://{self.minio_endpoint}:{self.minio_port}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

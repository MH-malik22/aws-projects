from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://devops:devops@localhost:5432/devops_academy"
    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    cors_origins: str = "http://localhost:3000"
    content_dir: str = "../content"

    class Config:
        env_file = ".env"


settings = Settings()

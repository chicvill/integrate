import os
from pydantic import BaseModel
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

class Settings(BaseModel):
    DEPLOYMENT_MODE: str = os.getenv("DEPLOYMENT_MODE", "LOCAL_STANDALONE").upper()
    ENABLE_AI_ANALYTICS: bool = os.getenv("ENABLE_AI_ANALYTICS", "true").lower() == "true"
    ENABLE_OFFLINE_SYNC: bool = os.getenv("ENABLE_OFFLINE_SYNC", "true").lower() == "true"

    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./store.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mqnet_store_unified_secret_key_2026")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8002"))


    @property
    def is_standalone(self) -> bool:
        return self.DEPLOYMENT_MODE == "LOCAL_STANDALONE"

settings = Settings()
